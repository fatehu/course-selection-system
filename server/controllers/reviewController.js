// course-selection-system/server/controllers/reviewController.js
const Review = require('../models/reviewModel')
const redis = require('../config/redis')

// 获取指定课程的所有评价
exports.getReviewsByCourse = async (req, res) => {
  try {
    const courseId = req.params.courseId
    const cacheKey = `reviews:course:${courseId}`

    console.log('获取课程评价:', courseId)

    // 检查 Redis 缓存
    const cachedReviews = await redis.get(cacheKey)
    if (cachedReviews) {
      console.log(`从 Redis 缓存中获取课程 ID: ${courseId} 的评价`)
      return res.status(200).json({
        success: true,
        count: JSON.parse(cachedReviews).length,
        data: JSON.parse(cachedReviews),
      })
    }

    // 如果缓存不存在，从数据库查询
    const reviews = await Review.getByCourse(courseId)

    // 将结果存入 Redis，设置过期时间为 30 分钟
    await redis.set(cacheKey, JSON.stringify(reviews), 'EX', 1800)

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

    // 清除 Redis 中对应课程的评论缓存
    const courseId = reviewData.course_id
    const cacheKey = `reviews:course:${courseId}`
    const result = await redis.del(cacheKey)

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
