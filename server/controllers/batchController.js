const User = require('../models/userModel');
const bcryptjs = require('bcryptjs');
const { pool } = require('../config/db');
const csv = require('csv-parser');
const fs = require('fs');
const multer = require('multer');
const redis = require('../config/redis'); 

// 配置 Multer 用于文件上传 (存储在内存或临时文件)
const upload = multer({ dest: 'uploads_csv/' });
// 批量插入学生
exports.batchInsertStudents = async (req, res) => {
  const { count = 10 } = req.body; // 默认插入10名学生，可以通过请求指定数量
  const maxCount = 1000; // 限制最大数量
  
  // 验证参数
  if (!Number.isInteger(count) || count <= 0) {
    return res.status(400).json({
      success: false,
      message: '数量必须是正整数'
    });
  }
  
  // 限制最大数量
  const insertCount = Math.min(count, maxCount);
  
  // 创建连接
  const connection = await pool.getConnection();
  
  try {
    // 开始事务
    await connection.beginTransaction();
    
    // 默认密码
    const defaultPassword = 'password123';
    const hashedPassword = await bcryptjs.hash(defaultPassword, 10);
    
    // 获取当前最大学生编号
    const [maxResult] = await connection.query(
      "SELECT MAX(username) as maxUsername FROM users WHERE username LIKE 'student%'"
    );
    
    let startNumber = 1;
    if (maxResult[0].maxUsername) {
      const maxNum = parseInt(maxResult[0].maxUsername.replace('student', ''));
      if (!isNaN(maxNum)) {
        startNumber = maxNum + 1;
      }
    }
    
    // 批量插入数据
    let successCount = 0;
    const batchSize = 100;
    const totalBatches = Math.ceil(insertCount / batchSize);
    
    for (let batch = 0; batch < totalBatches; batch++) {
      const values = [];
      const startIdx = batch * batchSize;
      const endIdx = Math.min(startIdx + batchSize, insertCount);
      
      for (let i = startIdx; i < endIdx; i++) {
        const studentNumber = (startNumber + i).toString().padStart(5, '0');
        const username = `student${studentNumber}`;
        const name = generateRandomName();
        const email = `${username}@university.edu`;
        
        values.push([username, hashedPassword, name, email, 'student']);
      }
      
      // 执行批量插入
      const query = 'INSERT INTO users (username, password, name, email, role) VALUES ?';
      const [result] = await connection.query(query, [values]);
      successCount += result.affectedRows;
    }
    
    // 提交事务
    await connection.commit();
    
    res.status(200).json({
      success: true,
      message: `成功批量插入 ${successCount} 名学生`,
      data: {
        requested: count,
        inserted: successCount,
        startNumber,
        endNumber: startNumber + successCount - 1
      }
    });
  } catch (error) {
    // 回滚事务
    await connection.rollback();
    
    console.error('批量插入学生失败:', error);
    res.status(500).json({
      success: false,
      message: '批量插入学生失败',
      error: error.message
    });
  } finally {
    // 释放连接
    connection.release();
  }
};

// 生成随机中文姓名
function generateRandomName() {
  const surnames = ['王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', 
                   '徐', '孙', '马', '胡', '朱', '林', '郭', '何', '高', '罗'];
  const names = ['伟', '芳', '娜', '秀英', '敏', '静', '强', '磊', '洋', '艳', 
                '勇', '军', '杰', '娟', '涛', '明', '超', '秀兰', '霞', '平'];
  
  const surname = surnames[Math.floor(Math.random() * surnames.length)];
  const name = names[Math.floor(Math.random() * names.length)];
  
  return surname + name;
}

// 从 CSV 批量插入学生
exports.batchInsertStudentsFromCSV = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: '未上传 CSV 文件。'
        });
    }

    const results = [];
    const errors = [];
    const filePath = req.file.path;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const defaultPassword = 'password123';
        const hashedPassword = await bcryptjs.hash(defaultPassword, 10);

        // --- 新增: 用于存储所有 processRow 的 Promise ---
        const processingPromises = [];

        // 异步处理每一行数据的函数
        const processRow = async (row) => {
            // ... (processRow 内部逻辑保持不变)
            const { username, name, email, password } = row;

            if (!username || !name || !email) {
                errors.push({ row, error: '缺少必填字段 (username, name, email)' });
                return;
            }

            const finalPassword = password ? await bcryptjs.hash(password, 10) : hashedPassword;

            try {
                const [result] = await connection.query(
                    'INSERT INTO users (username, password, name, email, role) VALUES (?, ?, ?, ?, ?)',
                    [username, finalPassword, name, email, 'student']
                );
                results.push({ id: result.insertId, username });
            } catch (dbError) {
                errors.push({ row, error: dbError.message });
            }
        };

        await new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (data) => {
                    // --- 而是将 Promise 添加到数组中 ---
                    processingPromises.push(processRow(data));
                })
                .on('end', async () => {
                    try {
                        // --- 在 'end' 事件中等待所有行处理完成 ---
                        await Promise.all(processingPromises);

                        if (errors.length > 0) {
                            await connection.rollback();
                            console.log('检测到错误，事务已回滚。');
                            resolve();
                        } else {
                            await connection.commit();
                            console.log('所有数据处理完毕，事务已提交。');
                            resolve();
                        }
                    } catch (commitError) {
                        reject(commitError);
                    }
                })
                .on('error', (err) => {
                    connection.rollback();
                    reject(err);
                });
        });

        // 清理上传的文件
        fs.unlinkSync(filePath);

        // 如果有错误 (这部分逻辑现在应该更准确了)
        if (errors.length > 0) {
            return res.status(409).json({
                success: false,
                message: `处理完成，但有 ${errors.length} 个错误。没有用户被插入。`,
                insertedCount: 0, // 因为回滚了，所以是 0
                errors: errors
            });
        }
        
        await redis.del('users:all');
        console.log('Redis 用户列表缓存已清除');

        // 成功响应 (现在 results.length 应该是准确的)
        res.status(200).json({
            success: true,
            message: `成功插入 ${results.length} 名学生。`,
            insertedCount: results.length,
        });

    } catch (error) {
        if (connection) await connection.rollback(); // 确保回滚
        console.error('从 CSV 批量插入失败:', error);
        // 即使出错也要清理上传的文件
        if (fs.existsSync(filePath)) {
           fs.unlinkSync(filePath);
        }
        res.status(500).json({
            success: false,
            message: '从 CSV 批量插入失败',
            error: error.message
        });
    } finally {
        if (connection) connection.release(); // 释放数据库连接
    }
};
