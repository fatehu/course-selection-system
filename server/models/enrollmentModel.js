const { pool } = require('../config/db');
const Section = require('./sectionModel');

class Enrollment {
  // 获取所有选课记录
  static async getAll() {
    try {
      const [rows] = await pool.query(`
        SELECT e.*, 
               u.name as student_name, 
               c.name as course_name, 
               c.code as course_code,
               s.semester, 
               s.time_slot, 
               s.location,
               t.name as teacher_name
        FROM enrollments e
        JOIN users u ON e.student_id = u.id
        JOIN sections s ON e.section_id = s.id
        JOIN courses c ON s.course_id = c.id
        JOIN users t ON s.teacher_id = t.id
      `);
      return rows;
    } catch (error) {
      throw error;
    }
  }

  // 通过ID获取选课记录
  static async getById(id) {
    try {
      const [rows] = await pool.query(`
        SELECT e.*, 
               u.name as student_name, 
               c.name as course_name, 
               c.code as course_code,
               s.semester, 
               s.time_slot, 
               s.location,
               t.name as teacher_name
        FROM enrollments e
        JOIN users u ON e.student_id = u.id
        JOIN sections s ON e.section_id = s.id
        JOIN courses c ON s.course_id = c.id
        JOIN users t ON s.teacher_id = t.id
        WHERE e.id = ?
      `, [id]);
      
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  // 通过学生ID获取选课记录
  static async getByStudent(studentId) {
    try {
      const [rows] = await pool.query(`
        SELECT e.*, 
               u.name as student_name, 
               c.name as course_name, 
               c.code as course_code,
               s.semester, 
               s.time_slot, 
               s.location,
               t.name as teacher_name
        FROM enrollments e
        JOIN users u ON e.student_id = u.id
        JOIN sections s ON e.section_id = s.id
        JOIN courses c ON s.course_id = c.id
        JOIN users t ON s.teacher_id = t.id
        WHERE e.student_id = ?
      `, [studentId]);
      
      return rows;
    } catch (error) {
      throw error;
    }
  }

  // 通过课程安排ID获取选课记录
  static async getBySection(sectionId) {
    try {
      const [rows] = await pool.query(`
        SELECT e.*, 
               u.name as student_name, 
               c.name as course_name, 
               c.code as course_code,
               s.semester, 
               s.time_slot, 
               s.location,
               t.name as teacher_name
        FROM enrollments e
        JOIN users u ON e.student_id = u.id
        JOIN sections s ON e.section_id = s.id
        JOIN courses c ON s.course_id = c.id
        JOIN users t ON s.teacher_id = t.id
        WHERE e.section_id = ?
      `, [sectionId]);
      
      return rows;
    } catch (error) {
      throw error;
    }
  }

  // 创建选课记录
  static async enroll(enrollmentData) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const { student_id, section_id, status = 'enrolled' } = enrollmentData;
      
      // 检查是否已选过该课程
      const [existingEnrollment] = await connection.query(
        'SELECT * FROM enrollments WHERE student_id = ? AND section_id = ?',
        [student_id, section_id]
      );
      
      if (existingEnrollment.length > 0) {
        throw new Error('已经选过该课程');
      }
      
      // 更新课程安排的选课人数
      const [section] = await connection.query(
        'SELECT current_enrollment, capacity FROM sections WHERE id = ?', 
        [section_id]
      );
      
      if (!section[0]) {
        throw new Error('课程安排不存在');
      }
      
      const currentEnrollment = section[0].current_enrollment;
      const capacity = section[0].capacity;
      
      // 检查课程是否已满
      if (status === 'enrolled' && currentEnrollment >= capacity) {
        // 如果已满，可以选择加入等待列表
        if (enrollmentData.allowWaitlist) {
          enrollmentData.status = 'waitlisted';
        } else {
          throw new Error('课程已满');
        }
      }
      
      // 插入选课记录
      const [result] = await connection.query(
        'INSERT INTO enrollments (student_id, section_id, status) VALUES (?, ?, ?)',
        [student_id, section_id, status === 'enrolled' ? 'enrolled' : 'waitlisted']
      );
      
      // 如果是已选状态，增加课程安排的选课人数
      if (status === 'enrolled') {
        await connection.query(
          'UPDATE sections SET current_enrollment = current_enrollment + 1 WHERE id = ?',
          [section_id]
        );
      }
      
      await connection.commit();
      
      return {
        id: result.insertId,
        student_id,
        section_id,
        status: status === 'enrolled' ? 'enrolled' : 'waitlisted',
        enrollment_date: new Date()
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // 更新选课状态
  static async updateStatus(id, status) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 获取当前选课记录
      const [enrollment] = await connection.query(
        'SELECT * FROM enrollments WHERE id = ?',
        [id]
      );
      
      if (!enrollment[0]) {
        throw new Error('选课记录不存在');
      }
      
      const currentStatus = enrollment[0].status;
      const sectionId = enrollment[0].section_id;
      
      // 如果状态没有变化，直接返回
      if (currentStatus === status) {
        await connection.commit();
        return true;
      }
      
      // 更新选课状态
      const [result] = await connection.query(
        'UPDATE enrollments SET status = ? WHERE id = ?',
        [status, id]
      );
      
      // 根据状态变化更新课程安排的选课人数
      if (currentStatus === 'enrolled' && status !== 'enrolled') {
        // 如果从已选变为其他状态，减少选课人数
        await connection.query(
          'UPDATE sections SET current_enrollment = current_enrollment - 1 WHERE id = ?',
          [sectionId]
        );
      } else if (currentStatus !== 'enrolled' && status === 'enrolled') {
        // 如果从其他状态变为已选，增加选课人数
        // 先检查课程是否已满
        const [section] = await connection.query(
          'SELECT current_enrollment, capacity FROM sections WHERE id = ?',
          [sectionId]
        );
        
        if (section[0].current_enrollment >= section[0].capacity) {
          throw new Error('课程已满，无法更改状态为已选');
        }
        
        await connection.query(
          'UPDATE sections SET current_enrollment = current_enrollment + 1 WHERE id = ?',
          [sectionId]
        );
      }
      
      await connection.commit();
      
      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // 退课
  static async drop(id) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 获取当前选课记录
      const [enrollment] = await connection.query(
        'SELECT * FROM enrollments WHERE id = ?',
        [id]
      );
      
      if (!enrollment[0]) {
        throw new Error('选课记录不存在');
      }
      
      const currentStatus = enrollment[0].status;
      const sectionId = enrollment[0].section_id;
      
      // 更新选课状态为已退
      const [result] = await connection.query(
        'UPDATE enrollments SET status = ? WHERE id = ?',
        ['dropped', id]
      );
      
      // 如果原状态为已选，减少课程安排的选课人数
      if (currentStatus === 'enrolled') {
        await connection.query(
          'UPDATE sections SET current_enrollment = current_enrollment - 1 WHERE id = ?',
          [sectionId]
        );
        
        // 检查是否有等待列表中的学生可以选课
        const [waitlisted] = await connection.query(
          'SELECT id FROM enrollments WHERE section_id = ? AND status = ? ORDER BY enrollment_date ASC LIMIT 1',
          [sectionId, 'waitlisted']
        );
        
        if (waitlisted.length > 0) {
          // 将等待列表中的第一个学生状态更改为已选
          await connection.query(
            'UPDATE enrollments SET status = ? WHERE id = ?',
            ['enrolled', waitlisted[0].id]
          );
          
          // 增加课程安排的选课人数
          await connection.query(
            'UPDATE sections SET current_enrollment = current_enrollment + 1 WHERE id = ?',
            [sectionId]
          );
        }
      }
      
      await connection.commit();
      
      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = Enrollment;