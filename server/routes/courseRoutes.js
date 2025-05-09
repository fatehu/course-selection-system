const express = require('express')
const router = express.Router()
const courseController = require('../controllers/courseController')
const { verifyToken, checkRole } = require('../middleware/authMiddleware')
const { validateCourse } = require('../middleware/validationMiddleware')

// 所有路由都需要验证token
router.use(verifyToken)

// 获取所有课程
router.get('/', courseController.getAllCourses)

// 搜索课程
router.get('/search', courseController.searchCourses)

// 按学院获取课程
router.get('/department/:departmentId', courseController.getCoursesByDepartment)

// 获取单个课程
router.get('/:id', courseController.getCourse)

// 创建课程（仅限管理员和教师）
router.post(
  '/',
  checkRole(['admin', 'teacher']),
  validateCourse,
  courseController.createCourse
)

// 更新课程（仅限管理员和教师）
router.put(
  '/:id',
  checkRole(['admin', 'teacher']),
  validateCourse,
  courseController.updateCourse
)

// 删除课程（仅限管理员）
router.delete('/:id', checkRole(['admin']), courseController.deleteCourse)

module.exports = router
