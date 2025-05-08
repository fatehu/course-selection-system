const Course = require('../models/courseModel');

// 获取所有课程
exports.getAllCourses = async (req, res) => {
  try {
    const courses = await Course.getAll();
    
    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses
    });
  } catch (error) {
    console.error('获取课程列表失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 获取单个课程
exports.getCourse = async (req, res) => {
  try {
    const course = await Course.getById(req.params.id);
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: '课程不存在'
      });
    }
    
    res.status(200).json({
      success: true,
      data: course
    });
  } catch (error) {
    console.error('获取课程失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 按学院获取课程
exports.getCoursesByDepartment = async (req, res) => {
  try {
    const departmentId = req.params.departmentId;
    const courses = await Course.getByDepartment(departmentId);
    
    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses
    });
  } catch (error) {
    console.error('获取学院课程失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 创建课程
exports.createCourse = async (req, res) => {
  try {
    // 只有管理员和教师才能创建课程
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作'
      });
    }
    
    const newCourse = await Course.create(req.body);
    
    res.status(201).json({
      success: true,
      message: '课程创建成功',
      data: newCourse
    });
  } catch (error) {
    console.error('创建课程失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 更新课程
exports.updateCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    
    // 检查课程是否存在
    const course = await Course.getById(courseId);
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: '课程不存在'
      });
    }
    
    // 只有管理员和教师才能更新课程
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作'
      });
    }
    
    const success = await Course.update(courseId, req.body);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        message: '更新课程失败'
      });
    }
    
    res.status(200).json({
      success: true,
      message: '课程更新成功'
    });
  } catch (error) {
    console.error('更新课程失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 删除课程
exports.deleteCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    
    // 检查课程是否存在
    const course = await Course.getById(courseId);
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: '课程不存在'
      });
    }
    
    // 只有管理员才能删除课程
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作'
      });
    }
    
    const success = await Course.delete(courseId);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        message: '删除课程失败'
      });
    }
    
    res.status(200).json({
      success: true,
      message: '课程删除成功'
    });
  } catch (error) {
    console.error('删除课程失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 搜索课程
exports.searchCourses = async (req, res) => {
  try {
    const keyword = req.query.keyword || '';
    
    if (!keyword) {
      return res.status(400).json({
        success: false,
        message: '请提供搜索关键词'
      });
    }
    
    const courses = await Course.search(keyword);
    
    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses
    });
  } catch (error) {
    console.error('搜索课程失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};