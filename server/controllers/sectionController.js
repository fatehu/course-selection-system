const Section = require('../models/sectionModel');

// 获取所有课程安排
exports.getAllSections = async (req, res) => {
  try {
    const sections = await Section.getAll();
    
    res.status(200).json({
      success: true,
      count: sections.length,
      data: sections
    });
  } catch (error) {
    console.error('获取课程安排列表失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 获取单个课程安排
exports.getSection = async (req, res) => {
  try {
    const section = await Section.getById(req.params.id);
    
    if (!section) {
      return res.status(404).json({
        success: false,
        message: '课程安排不存在'
      });
    }
    
    res.status(200).json({
      success: true,
      data: section
    });
  } catch (error) {
    console.error('获取课程安排失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 按课程ID获取课程安排
exports.getSectionsByCourse = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const sections = await Section.getByCourse(courseId);
    
    res.status(200).json({
      success: true,
      count: sections.length,
      data: sections
    });
  } catch (error) {
    console.error('获取课程安排失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 按教师ID获取课程安排
exports.getSectionsByTeacher = async (req, res) => {
  try {
    const teacherId = req.params.teacherId;
    const sections = await Section.getByTeacher(teacherId);
    
    res.status(200).json({
      success: true,
      count: sections.length,
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

// 创建课程安排
exports.createSection = async (req, res) => {
  try {
    // 只有管理员和教师才能创建课程安排
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作'
      });
    }
    
    const newSection = await Section.create(req.body);
    
    res.status(201).json({
      success: true,
      message: '课程安排创建成功',
      data: newSection
    });
  } catch (error) {
    console.error('创建课程安排失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 更新课程安排
exports.updateSection = async (req, res) => {
  try {
    const sectionId = req.params.id;
    
    // 检查课程安排是否存在
    const section = await Section.getById(sectionId);
    
    if (!section) {
      return res.status(404).json({
        success: false,
        message: '课程安排不存在'
      });
    }
    
    // 只有管理员和该排课的教师才能更新课程安排
    if (req.user.role !== 'admin' && 
        (req.user.role !== 'teacher' || req.user.id !== section.teacher_id)) {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作'
      });
    }
    
    const success = await Section.update(sectionId, req.body);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        message: '更新课程安排失败'
      });
    }
    
    res.status(200).json({
      success: true,
      message: '课程安排更新成功'
    });
  } catch (error) {
    console.error('更新课程安排失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 删除课程安排
exports.deleteSection = async (req, res) => {
  try {
    const sectionId = req.params.id;
    
    // 检查课程安排是否存在
    const section = await Section.getById(sectionId);
    
    if (!section) {
      return res.status(404).json({
        success: false,
        message: '课程安排不存在'
      });
    }
    
    // 只有管理员才能删除课程安排
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作'
      });
    }
    
    const success = await Section.delete(sectionId);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        message: '删除课程安排失败'
      });
    }
    
    res.status(200).json({
      success: true,
      message: '课程安排删除成功'
    });
  } catch (error) {
    console.error('删除课程安排失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 获取可用的课程安排
exports.getAvailableSections = async (req, res) => {
  try {
    const sections = await Section.getAvailable();
    
    res.status(200).json({
      success: true,
      count: sections.length,
      data: sections
    });
  } catch (error) {
    console.error('获取可用课程安排失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};