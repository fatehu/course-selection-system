const { pool } = require('../config/db');
const bcrypt = require('bcrypt');

class User {
  // 获取所有用户
  static async getAll() {
    try {
      const [rows] = await pool.query('SELECT id, username, name, email, role, created_at FROM users');
      return rows;
    } catch (error) {
      throw error;
    }
  }

  // 通过ID获取用户
  static async getById(id) {
    try {
      const [rows] = await pool.query(
        'SELECT id, username, name, email, role, created_at FROM users WHERE id = ?', 
        [id]
      );
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  // 通过用户名获取用户
  static async getByUsername(username) {
    try {
      const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  // 创建用户
  static async create(userData) {
    try {
      const { username, password, name, email, role } = userData;
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const [result] = await pool.query(
        'INSERT INTO users (username, password, name, email, role) VALUES (?, ?, ?, ?, ?)',
        [username, hashedPassword, name, email, role]
      );
      
      return {
        id: result.insertId,
        username,
        name,
        email,
        role
      };
    } catch (error) {
      throw error;
    }
  }

  // 更新用户
  // static async update(id, userData) {
  //   try {
  //     const { name, email, role } = userData;
  //     let password = userData.password;

  //     let query = 'UPDATE users SET name = ?, email = ?, role = ?';
  //     let params = [name, email, role];

  //     // 如果提供了新密码，则更新密码
  //     if (password) {
  //       password = await bcrypt.hash(password, 10);
  //       query += ', password = ?';
  //       params.push(password);
  //     }

  //     query += ' WHERE id = ?';
  //     params.push(id);

  //     const [result] = await pool.query(query, params);
      
  //     return result.affectedRows > 0;
  //   } catch (error) {
  //     throw error;
  //   }
  // }

  // 更新用户 - 修改版本
  static async update(id, userData) {
    try {
      const { name, email } = userData;
      let password = userData.password;
      
      // 构建动态SQL查询
      let query = 'UPDATE users SET name = ?, email = ?';
      let params = [name, email];
      
      // 如果提供了role字段，则添加到更新中
      if (userData.role !== undefined) {
        query += ', role = ?';
        params.push(userData.role);
      }
      
      // 如果提供了新密码，则更新密码
      if (password) {
        password = await bcrypt.hash(password, 10);
        query += ', password = ?';
        params.push(password);
      }
      
      query += ' WHERE id = ?';
      params.push(id);
      
      const [result] = await pool.query(query, params);
      
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  // 删除用户 - 改进版本
  static async delete(id) {
    try {
      // 开始事务
      const connection = await pool.getConnection();
      await connection.beginTransaction();
      
      try {
        // 检查是否有选课记录
        const [enrollments] = await connection.query(
          'SELECT COUNT(*) as count FROM enrollments WHERE student_id = ?',
          [id]
        );
        
        if (enrollments[0].count > 0) {
          await connection.rollback();
          connection.release();
          return false;
        }
        
        // 检查是否有课程安排
        const [sections] = await connection.query(
          'SELECT COUNT(*) as count FROM sections WHERE teacher_id = ?',
          [id]
        );
        
        if (sections[0].count > 0) {
          await connection.rollback();
          connection.release();
          return false;
        }
        
        // 执行删除
        const [result] = await connection.query('DELETE FROM users WHERE id = ?', [id]);
        
        // 提交事务
        await connection.commit();
        connection.release();
        
        return result.affectedRows > 0;
      } catch (error) {
        // 回滚事务
        await connection.rollback();
        connection.release();
        throw error;
      }
    } catch (error) {
      throw error;
    }
  }

  // 验证用户密码
  static async verifyPassword(username, password) {
    try {
      const user = await this.getByUsername(username);
      
      if (!user) {
        return null;
      }
      
      const isMatch = await bcrypt.compare(password, user.password);
      
      if (!isMatch) {
        return null;
      }
      
      // 移除密码后返回用户信息
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      throw error;
    }
  }
  
  // 检查用户是否有相关数据
  static async hasRelatedData(id) {
    try {
      // 检查是否有选课记录
      const [enrollments] = await pool.query(
        'SELECT COUNT(*) as count FROM enrollments WHERE student_id = ?',
        [id]
      );
      
      if (enrollments[0].count > 0) {
        return true;
      }
      
      // 检查是否有课程安排
      const [sections] = await pool.query(
        'SELECT COUNT(*) as count FROM sections WHERE teacher_id = ?',
        [id]
      );
      
      if (sections[0].count > 0) {
        return true;
      }
      
      return false;
    } catch (error) {
      throw error;
    }
  }

  // 验证用户密码
  static async verifyUserPassword(userId, password) {
    try {
      // 获取用户信息，包括密码
      const [rows] = await pool.query(
        'SELECT password FROM users WHERE id = ?',
        [userId]
      );
      
      if (rows.length === 0) {
        return false;
      }
      
      // 验证密码
      const isMatch = await bcrypt.compare(password, rows[0].password);
      return isMatch;
    } catch (error) {
      console.error('验证用户密码失败:', error);
      throw error;
    }
  }
}

module.exports = User;