const Enrollment = require('../models/enrollmentModel');
const { pool } = require('../config/db');

// 获取所有选课记录
exports.getAllEnrollments = async (req, res) => {
  try {
    // 只有管理员和教师才能获取所有选课记录
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作'
      });
    }
    
    const enrollments = await Enrollment.getAll();
    
    res.status(200).json({
      success: true,
      count: enrollments.length,
      data: enrollments
    });
  } catch (error) {
    console.error('获取选课记录列表失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 获取单个选课记录
exports.getEnrollment = async (req, res) => {
  try {
    const enrollment = await Enrollment.getById(req.params.id);
    
    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: '选课记录不存在'
      });
    }
    
    // 只有管理员、教师和该记录的学生才能查看选课记录
    if (req.user.role !== 'admin' && 
        req.user.role !== 'teacher' && 
        req.user.id !== enrollment.student_id) {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作'
      });
    }
    
    res.status(200).json({
      success: true,
      data: enrollment
    });
  } catch (error) {
    console.error('获取选课记录失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 获取学生的所有选课记录
exports.getStudentEnrollments = async (req, res) => {
  try {
    const studentId = req.params.studentId;
    
    // 只有管理员、教师和本人才能查看学生的选课记录
    if (req.user.role !== 'admin' && 
        req.user.role !== 'teacher' && 
        req.user.id !== parseInt(studentId)) {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作'
      });
    }
    
    const enrollments = await Enrollment.getByStudent(studentId);
    
    res.status(200).json({
      success: true,
      count: enrollments.length,
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

// 获取课程安排的所有选课记录
exports.getSectionEnrollments = async (req, res) => {
  try {
    const sectionId = req.params.sectionId;
    
    // 只有管理员和教师才能查看课程安排的选课记录
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作'
      });
    }
    
    const enrollments = await Enrollment.getBySection(sectionId);
    
    res.status(200).json({
      success: true,
      count: enrollments.length,
      data: enrollments
    });
  } catch (error) {
    console.error('获取课程安排选课记录失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 学生选课
exports.enrollCourse = async (req, res) => {
  try {
    const { section_id, allowWaitlist = false } = req.body;
    const student_id = req.user.id;
    
    // 只有学生才能选课
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: '只有学生才能进行选课操作'
      });
    }
    
    const enrollment = await Enrollment.enroll({
      student_id,
      section_id,
      allowWaitlist
    });
    
    res.status(201).json({
      success: true,
      message: enrollment.status === 'enrolled' ? '选课成功' : '已加入等待列表',
      data: enrollment
    });
  } catch (error) {
    console.error('选课失败:', error);
    
    if (error.message === '已经选过该课程' || 
        error.message === '课程已满' || 
        error.message === '课程安排不存在') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 更新选课状态
exports.updateEnrollmentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const enrollmentId = req.params.id;
    
    // 只有管理员才能更新选课状态
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作'
      });
    }
    
    // 检查状态参数是否有效
    if (!['enrolled', 'dropped', 'waitlisted'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: '无效的状态参数'
      });
    }
    
    const success = await Enrollment.updateStatus(enrollmentId, status);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        message: '更新选课状态失败'
      });
    }
    
    res.status(200).json({
      success: true,
      message: '选课状态更新成功'
    });
  } catch (error) {
    console.error('更新选课状态失败:', error);
    
    if (error.message === '选课记录不存在' || 
        error.message === '课程已满，无法更改状态为已选') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 学生退课
exports.dropCourse = async (req, res) => {
  try {
    const enrollmentId = req.params.id;
    
    // 获取选课记录
    const enrollment = await Enrollment.getById(enrollmentId);
    
    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: '选课记录不存在'
      });
    }
    
    // 只有管理员和该选课记录的学生才能退课
    if (req.user.role !== 'admin' && req.user.id !== enrollment.student_id) {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作'
      });
    }
    
    const success = await Enrollment.drop(enrollmentId);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        message: '退课失败'
      });
    }
    
    res.status(200).json({
      success: true,
      message: '退课成功'
    });
  } catch (error) {
    console.error('退课失败:', error);
    
    if (error.message === '选课记录不存在') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 删除选课记录（仅限管理员）
exports.deleteEnrollment = async (req, res) => {
  try {
    const enrollmentId = req.params.id;
    
    // 只有管理员才能删除选课记录
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作'
      });
    }
    
    // 获取选课记录信息，以便后续更新课程安排的选课人数
    const [enrollment] = await pool.query(
      'SELECT * FROM enrollments WHERE id = ?',
      [enrollmentId]
    );
    
    if (enrollment.length === 0) {
      return res.status(404).json({
        success: false,
        message: '选课记录不存在'
      });
    }
    
    // 开始事务
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // 如果是已选状态，需要减少课程安排的选课人数
      if (enrollment[0].status === 'enrolled') {
        await connection.query(
          'UPDATE sections SET current_enrollment = GREATEST(current_enrollment - 1, 0) WHERE id = ?',
          [enrollment[0].section_id]
        );
      }
      
      // 删除选课记录
      const [result] = await connection.query(
        'DELETE FROM enrollments WHERE id = ?',
        [enrollmentId]
      );
      
      if (result.affectedRows === 0) {
        await connection.rollback();
        connection.release();
        
        return res.status(404).json({
          success: false,
          message: '选课记录不存在'
        });
      }
      
      // 提交事务
      await connection.commit();
      connection.release();
      
      res.status(200).json({
        success: true,
        message: '选课记录删除成功'
      });
    } catch (error) {
      // 回滚事务
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('删除选课记录失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};