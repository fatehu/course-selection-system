const { pool } = require('../config/db');

class Section {
  // 获取所有课程安排
  static async getAll() {
    try {
      const [rows] = await pool.query(`
        SELECT s.*, c.name as course_name, c.code as course_code, u.name as teacher_name
        FROM sections s
        JOIN courses c ON s.course_id = c.id
        JOIN users u ON s.teacher_id = u.id
      `);
      return rows;
    } catch (error) {
      throw error;
    }
  }

  // 通过ID获取课程安排
  static async getById(id) {
    try {
      const [rows] = await pool.query(`
        SELECT s.*, c.name as course_name, c.code as course_code, u.name as teacher_name
        FROM sections s
        JOIN courses c ON s.course_id = c.id
        JOIN users u ON s.teacher_id = u.id
        WHERE s.id = ?
      `, [id]);
      
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  // 通过课程ID获取课程安排
  static async getByCourse(courseId) {
    try {
      const [rows] = await pool.query(`
        SELECT s.*, c.name as course_name, c.code as course_code, u.name as teacher_name
        FROM sections s
        JOIN courses c ON s.course_id = c.id
        JOIN users u ON s.teacher_id = u.id
        WHERE s.course_id = ?
      `, [courseId]);
      
      return rows;
    } catch (error) {
      throw error;
    }
  }

  // 通过教师ID获取课程安排
  static async getByTeacher(teacherId) {
    try {
      const [rows] = await pool.query(`
        SELECT s.*, c.name as course_name, c.code as course_code, u.name as teacher_name
        FROM sections s
        JOIN courses c ON s.course_id = c.id
        JOIN users u ON s.teacher_id = u.id
        WHERE s.teacher_id = ?
      `, [teacherId]);
      
      return rows;
    } catch (error) {
      throw error;
    }
  }

  // 创建课程安排
  static async create(sectionData) {
    try {
      const { course_id, teacher_id, semester, time_slot, location, capacity } = sectionData;
      
      const [result] = await pool.query(
        'INSERT INTO sections (course_id, teacher_id, semester, time_slot, location, capacity) VALUES (?, ?, ?, ?, ?, ?)',
        [course_id, teacher_id, semester, time_slot, location, capacity]
      );
      
      return {
        id: result.insertId,
        ...sectionData,
        current_enrollment: 0
      };
    } catch (error) {
      throw error;
    }
  }

  // 更新课程安排
  static async update(id, sectionData) {
    try {
      const { course_id, teacher_id, semester, time_slot, location, capacity } = sectionData;
      
      const [result] = await pool.query(
        'UPDATE sections SET course_id = ?, teacher_id = ?, semester = ?, time_slot = ?, location = ?, capacity = ? WHERE id = ?',
        [course_id, teacher_id, semester, time_slot, location, capacity, id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  // 删除课程安排
  static async delete(id) {
    try {
      const [result] = await pool.query('DELETE FROM sections WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  // 更新当前选课人数
  static async updateEnrollment(id, increment = true) {
    try {
      const [section] = await pool.query('SELECT current_enrollment, capacity FROM sections WHERE id = ?', [id]);
      
      if (!section[0]) {
        throw new Error('课程安排不存在');
      }
      
      const currentEnrollment = section[0].current_enrollment;
      const capacity = section[0].capacity;
      
      // 如果是增加选课人数，检查是否超过容量
      if (increment && currentEnrollment >= capacity) {
        throw new Error('课程已满');
      }
      
      // 如果是减少选课人数，检查是否已经为0
      if (!increment && currentEnrollment <= 0) {
        throw new Error('当前选课人数已为0');
      }
      
      const newEnrollment = increment ? currentEnrollment + 1 : currentEnrollment - 1;
      
      const [result] = await pool.query(
        'UPDATE sections SET current_enrollment = ? WHERE id = ?',
        [newEnrollment, id]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }

  // 查询可用的课程安排
  static async getAvailable() {
    try {
      const [rows] = await pool.query(`
        SELECT s.*, c.name as course_name, c.code as course_code, u.name as teacher_name
        FROM sections s
        JOIN courses c ON s.course_id = c.id
        JOIN users u ON s.teacher_id = u.id
        WHERE s.current_enrollment < s.capacity
      `);
      
      return rows;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Section;