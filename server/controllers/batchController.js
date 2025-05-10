const User = require('../models/userModel');
const bcryptjs = require('bcryptjs');
const { pool } = require('../config/db');

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