// course-selection-system/server/routes/reviewRoutes.js
const express = require('express')
const router = express.Router()
const reviewController = require('../controllers/reviewController')
const { verifyToken, checkRole } = require('../middleware/authMiddleware')

// 所有路由都需要验证token
router.use(verifyToken)

// 获取所有课程评价（仅限管理员和教师）
router.get('/', checkRole(['admin', 'teacher']), reviewController.getAllReviews)

// 获取单个课程评价
router.get('/course/:id', reviewController.getReview)

// 创建课程评价（仅限学生）
router.post('/', checkRole(['student']), reviewController.createReview)

// 更新课程评价（仅限管理员和评价发布者）
router.put('/:id', checkRole(['admin']), reviewController.updateReview)

// 删除课程评价（仅限管理员和评价发布者）
router.delete('/:id', checkRole(['admin']), reviewController.deleteReview)

module.exports = router
