const { pool } = require('../config/db');

class Course {
  // 获取所有课程
  static async getAll() {
    try {
      const [rows] = await pool.query(`
        SELECT c.*, d.name as department_name 
        FROM courses c 
        LEFT JOIN departments d ON c.department_id = d.id
      `);
      return rows;
    } catch (error) {
      throw error;
    }
  }

  // 通过ID获取课程
  static async getById(id) {
    try {
      const [rows] = await pool.query(`
        SELECT c.*, d.name as department_name 
        FROM courses c 
        LEFT JOIN departments d ON c.department_id = d.id 
        WHERE c.id = ?
      `, [id]);
      
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  // 通过学院ID获取课程
  static async getByDepartment(departmentId) {
    try {
      const [rows] = await pool.query(`
        SELECT c.*, d.name as department_name 
        FROM courses c 
        LEFT JOIN departments d ON c.department_id = d.id 
        WHERE c.department_id = ?
      `, [departmentId]);
      
      return rows;
    } catch (error) {
      throw error;
    }
  }

  // 创建课程
  static async create(courseData) {
    try {
      const { code, name, description, credits, department_id } = courseData;
      
      const [result] = await pool.query(
        'INSERT INTO courses (code, name, description, credits, department_id) VALUES (?, ?, ?, ?, ?)',
        [code, name, description, credits, department_id]
      );
      
      return {
        id: result.insertId,
        ...courseData
      };
    } catch (error) {
      throw error;
    }
  }

  // 更新课程
  static async update(id, courseData) {
    try {
      const { code, name, description, credits, department_id } = courseData;
      
      const [result] = await pool.query(
        'UPDATE courses SET code = ?, name = ?, description = ?, credits = ?, department_id = ? WHERE id = ?',
        [code, name, description, credits, department_id, id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  // 删除课程
  static async delete(id) {
    try {
      const [result] = await pool.query('DELETE FROM courses WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  // 搜索课程
  static async search(keyword) {
    try {
      const [rows] = await pool.query(`
        SELECT c.*, d.name as department_name 
        FROM courses c 
        LEFT JOIN departments d ON c.department_id = d.id 
        WHERE c.name LIKE ? OR c.code LIKE ? OR c.description LIKE ?
      `, [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`]);
      
      return rows;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Course;