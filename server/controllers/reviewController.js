// course-selection-system/server/controllers/reviewController.js
const Review = require('../models/reviewModel')

// 获取指定课程的所有评价
exports.getReviewsByCourse = async (req, res) => {
  try {
    const courseId = req.params.courseId
    console.log('获取课程评价:', courseId)

    const reviews = await Review.getByCourse(courseId)

    console.log(reviews)

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews,
    })
  } catch (error) {
    console.error('获取课程评价失败:', error)
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    })
  }
}

// 创建课程评价
exports.createReview = async (req, res) => {
  try {
    const reviewData = req.body
    const newReview = await Review.create(reviewData)

    res.status(201).json({
      success: true,
      data: newReview,
    })
  } catch (error) {
    console.error('创建课程评价失败:', error)
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    })
  }
}
