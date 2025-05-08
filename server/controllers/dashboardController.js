const { pool } = require('../config/db');

// 获取仪表盘统计数据
exports.getDashboardStats = async (req, res) => {
  try {
    // 创建连接
    const connection = await pool.getConnection();
    
    try {
      // 获取用户总数
      const [userCount] = await connection.query('SELECT COUNT(*) as count FROM users');
      
      // 获取课程总数
      const [courseCount] = await connection.query('SELECT COUNT(*) as count FROM courses');
      
      // 获取选课记录总数
      const [enrollmentCount] = await connection.query('SELECT COUNT(*) as count FROM enrollments');
      
      // 获取课程安排总数
      const [sectionCount] = await connection.query('SELECT COUNT(*) as count FROM sections');
      
      // 释放连接
      connection.release();
      
      res.status(200).json({
        success: true,
        data: {
          userCount: userCount[0].count,
          courseCount: courseCount[0].count,
          enrollmentCount: enrollmentCount[0].count,
          sectionCount: sectionCount[0].count
        }
      });
    } catch (error) {
      // 如果查询出错，释放连接
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('获取仪表盘统计数据失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 获取最近课程列表
exports.getRecentCourses = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    
    const [courses] = await pool.query(`
      SELECT c.*, d.name as department_name 
      FROM courses c 
      LEFT JOIN departments d ON c.department_id = d.id
      ORDER BY c.id DESC
      LIMIT ?
    `, [limit]);
    
    res.status(200).json({
      success: true,
      data: courses
    });
  } catch (error) {
    console.error('获取最近课程列表失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 获取教师的课程安排
exports.getTeacherSections = async (req, res) => {
  try {
    const teacherId = req.params.teacherId;
    
    const [sections] = await pool.query(`
      SELECT s.*, c.name as course_name, c.code as course_code
      FROM sections s
      JOIN courses c ON s.course_id = c.id
      WHERE s.teacher_id = ?
      ORDER BY s.id DESC
    `, [teacherId]);
    
    res.status(200).json({
      success: true,
      data: sections
    });
  } catch (error) {
    console.error('获取教师课程安排失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 获取学生的选课记录
exports.getStudentEnrollments = async (req, res) => {
  try {
    const studentId = req.params.studentId;
    
    const [enrollments] = await pool.query(`
      SELECT e.*, 
             c.name as course_name, 
             c.code as course_code,
             s.semester, 
             s.time_slot, 
             s.location,
             u.name as teacher_name
      FROM enrollments e
      JOIN sections s ON e.section_id = s.id
      JOIN courses c ON s.course_id = c.id
      JOIN users u ON s.teacher_id = u.id
      WHERE e.student_id = ?
      ORDER BY e.id DESC
    `, [studentId]);
    
    res.status(200).json({
      success: true,
      data: enrollments
    });
  } catch (error) {
    console.error('获取学生选课记录失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};