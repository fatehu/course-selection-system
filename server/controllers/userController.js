const User = require('../models/userModel');
const { pool } = require('../config/db'); // 添加对数据库连接池的引用

// 获取所有用户
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.getAll();
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 获取单个用户
exports.getUser = async (req, res) => {
  try {
    const user = await User.getById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('获取用户失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 创建用户
exports.createUser = async (req, res) => {
  try {
    // 检查用户名是否已存在
    const existingUser = await User.getByUsername(req.body.username);
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '用户名已存在'
      });
    }
    
    const newUser = await User.create(req.body);
    
    res.status(201).json({
      success: true,
      message: '用户创建成功',
      data: newUser
    });
  } catch (error) {
    console.error('创建用户失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 更新用户
exports.updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // 检查用户是否存在
    const user = await User.getById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 如果不是管理员且不是本人，禁止更新
    if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作'
      });
    }
    
    const success = await User.update(userId, req.body);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        message: '更新用户失败'
      });
    }
    
    res.status(200).json({
      success: true,
      message: '用户更新成功'
    });
  } catch (error) {
    console.error('更新用户失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 删除用户 - 修复版本
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // 检查用户是否存在
    const user = await User.getById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 只有管理员才能删除用户
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作'
      });
    }
    
    // 检查是否有与用户相关的数据
    const userHasRelatedData = await checkUserRelatedData(userId);
    
    if (userHasRelatedData) {
      return res.status(400).json({
        success: false,
        message: '无法删除用户，该用户仍有相关数据（课程、选课记录等）'
      });
    }
    
    // 执行删除
    const success = await User.delete(userId);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        message: '删除用户失败'
      });
    }
    
    res.status(200).json({
      success: true,
      message: '用户删除成功'
    });
  } catch (error) {
    console.error('删除用户失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 检查用户是否有相关数据
async function checkUserRelatedData(userId) {
  try {
    // 检查用户是否是教师且有课程安排
    if (await isTeacherWithSections(userId)) {
      return true;
    }
    
    // 检查用户是否是学生且有选课记录
    if (await isStudentWithEnrollments(userId)) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('检查用户相关数据失败:', error);
    throw error;
  }
}

// 检查用户是否是教师且有课程安排
async function isTeacherWithSections(userId) {
  try {
    const [sections] = await pool.query(
      'SELECT COUNT(*) as count FROM sections WHERE teacher_id = ?',
      [userId]
    );
    
    return sections[0].count > 0;
  } catch (error) {
    console.error('检查教师课程安排失败:', error);
    throw error;
  }
}

// 检查用户是否是学生且有选课记录
async function isStudentWithEnrollments(userId) {
  try {
    const [enrollments] = await pool.query(
      'SELECT COUNT(*) as count FROM enrollments WHERE student_id = ?',
      [userId]
    );
    
    return enrollments[0].count > 0;
  } catch (error) {
    console.error('检查学生选课记录失败:', error);
    throw error;
  }
}

// 获取当前用户信息
exports.getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.getById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('获取当前用户信息失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 更新当前用户信息
exports.updateCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, oldPassword, newPassword } = req.body;
    
    // 检查用户是否存在
    const user = await User.getById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 如果提供了旧密码和新密码，先验证旧密码
    if (oldPassword && newPassword) {
      const isPasswordValid = await User.verifyUserPassword(userId, oldPassword);
      
      if (!isPasswordValid) {
        return res.status(400).json({
          success: false,
          message: '原密码不正确'
        });
      }
      
      // 更新用户信息，包括新密码
      const updateData = { name, email, password: newPassword };
      const success = await User.update(userId, updateData);
      
      if (!success) {
        return res.status(500).json({
          success: false,
          message: '更新用户信息失败'
        });
      }
    } else {
      // 只更新基本信息，不更新密码
      const updateData = { name, email };
      const success = await User.update(userId, updateData);
      
      if (!success) {
        return res.status(500).json({
          success: false,
          message: '更新用户信息失败'
        });
      }
    }
    
    // 获取更新后的用户信息
    const updatedUser = await User.getById(userId);
    
    res.status(200).json({
      success: true,
      message: '用户信息更新成功',
      data: updatedUser
    });
  } catch (error) {
    console.error('更新用户信息失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};