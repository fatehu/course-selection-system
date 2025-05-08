const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

// 验证JWT Token
exports.verifyToken = async (req, res, next) => {
  try {
    // 获取请求头中的 token
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: '未提供认证令牌'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未提供认证令牌'
      });
    }
    
    try {
      // 验证 token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // 检查用户是否存在
      const user = await User.getById(decoded.id);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: '用户不存在'
        });
      }
      
      // 将用户信息添加到请求对象中
      req.user = {
        id: user.id,
        username: user.username,
        role: user.role
      };
      
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: '令牌已过期'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: '无效的令牌'
      });
    }
  } catch (error) {
    console.error('认证失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 检查用户角色
exports.checkRole = (roles) => {
  return (req, res, next) => {
    // 确保 verifyToken 中间件已经运行
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '未认证'
      });
    }
    
    // 检查用户角色是否在允许的角色列表中
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作'
      });
    }
    
    next();
  };
};