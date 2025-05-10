// course-selection-system/server/routes/reviewRoutes.js
const express = require('express')
const router = express.Router()
const reviewController = require('../controllers/reviewController')

// 获取指定课程的所有评价
router.get('/course/:courseId', reviewController.getReviewsByCourse)

// 创建课程评价
router.post('/', reviewController.createReview)

module.exports = router
