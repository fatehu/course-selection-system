const { body, validationResult } = require('express-validator');

// 处理验证结果
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '输入数据验证失败',
      errors: errors.array().map(error => ({
        field: error.param,
        message: error.msg
      }))
    });
  }
  
  next();
};

// 用户相关验证规则
exports.validateUser = [
  body('username')
    .notEmpty().withMessage('用户名不能为空')
    .isLength({ min: 3, max: 50 }).withMessage('用户名长度必须在3-50字符之间'),
  
  body('password')
    .notEmpty().withMessage('密码不能为空')
    .isLength({ min: 6 }).withMessage('密码长度必须至少为6字符'),
  
  body('name')
    .notEmpty().withMessage('姓名不能为空')
    .isLength({ min: 2, max: 100 }).withMessage('姓名长度必须在2-100字符之间'),
  
  body('email')
    .notEmpty().withMessage('邮箱不能为空')
    .isEmail().withMessage('邮箱格式不正确'),
  
  body('role')
    .notEmpty().withMessage('角色不能为空')
    .isIn(['student', 'teacher', 'admin']).withMessage('角色必须是学生、教师或管理员'),
  
  handleValidationErrors
];

// 登录验证规则
exports.validateLogin = [
  body('username')
    .notEmpty().withMessage('用户名不能为空'),
  
  body('password')
    .notEmpty().withMessage('密码不能为空'),
  
  handleValidationErrors
];

// 课程相关验证规则
exports.validateCourse = [
  body('code')
    .notEmpty().withMessage('课程代码不能为空')
    .isLength({ min: 3, max: 20 }).withMessage('课程代码长度必须在3-20字符之间'),
  
  body('name')
    .notEmpty().withMessage('课程名称不能为空')
    .isLength({ min: 2, max: 100 }).withMessage('课程名称长度必须在2-100字符之间'),
  
  body('credits')
    .notEmpty().withMessage('学分不能为空')
    .isInt({ min: 1 }).withMessage('学分必须是正整数'),
  
  body('department_id')
    .notEmpty().withMessage('学院ID不能为空')
    .isInt({ min: 1 }).withMessage('学院ID必须是正整数'),
  
  handleValidationErrors
];

// 课程安排相关验证规则
exports.validateSection = [
  body('course_id')
    .notEmpty().withMessage('课程ID不能为空')
    .isInt({ min: 1 }).withMessage('课程ID必须是正整数'),
  
  body('teacher_id')
    .notEmpty().withMessage('教师ID不能为空')
    .isInt({ min: 1 }).withMessage('教师ID必须是正整数'),
  
  body('semester')
    .notEmpty().withMessage('学期不能为空')
    .isLength({ min: 3, max: 20 }).withMessage('学期长度必须在3-20字符之间'),
  
  body('time_slot')
    .notEmpty().withMessage('时间段不能为空')
    .isLength({ min: 3, max: 100 }).withMessage('时间段长度必须在3-100字符之间'),
  
  body('location')
    .notEmpty().withMessage('上课地点不能为空')
    .isLength({ min: 3, max: 100 }).withMessage('上课地点长度必须在3-100字符之间'),
  
  body('capacity')
    .notEmpty().withMessage('容量不能为空')
    .isInt({ min: 1 }).withMessage('容量必须是正整数'),
  
  handleValidationErrors
];

// 选课相关验证规则
exports.validateEnrollment = [
  body('section_id')
    .notEmpty().withMessage('课程安排ID不能为空')
    .isInt({ min: 1 }).withMessage('课程安排ID必须是正整数'),
  
  handleValidationErrors
];

// 用户更新验证规则（允许密码为空）
exports.validateUserUpdate = [
  body('username')
    .notEmpty().withMessage('用户名不能为空')
    .isLength({ min: 3, max: 50 }).withMessage('用户名长度必须在3-50字符之间'),
  
  body('password')
    .optional({ checkFalsy: true }) // 允许密码为空或未定义
    .isLength({ min: 6 }).withMessage('如果提供密码，长度必须至少为6字符'),
  
  body('name')
    .notEmpty().withMessage('姓名不能为空')
    .isLength({ min: 2, max: 100 }).withMessage('姓名长度必须在2-100字符之间'),
  
  body('email')
    .notEmpty().withMessage('邮箱不能为空')
    .isEmail().withMessage('邮箱格式不正确'),
  
  body('role')
    .notEmpty().withMessage('角色不能为空')
    .isIn(['student', 'teacher', 'admin']).withMessage('角色必须是学生、教师或管理员'),
  
  handleValidationErrors
];