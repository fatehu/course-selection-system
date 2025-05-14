// course-selection-system/server/controllers/reviewController.js
const Review = require('../models/reviewModel')

const redis = require('../config/redis')
const pool = require('../config/db')

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

// 获取课程评价总结
exports.getCourseReviewSummary = async (req, res) => {
  try {
    const courseId = req.params.courseId
    console.log('获取课程评价总结:', courseId)

    // 检查是否需要更新总结
    const isOutdated = await Review.isSummaryOutdated(courseId)

    if (!isOutdated) {
      // 如果总结不过期，直接返回现有总结
      const summary = await Review.getSummary(courseId)
      return res.status(200).json({
        success: true,
        data: summary,
        fromCache: true,
      })
    }

    // 获取课程所有评价
    const reviews = await Review.getByCourse(courseId)

    if (reviews.length === 0) {
      return res.status(404).json({
        success: false,
        message: '未找到该课程的评价',
      })
    }

    // 获取课程信息（名称）
    const courseName = await Review.getCourseName(courseId) // 调用模型方法

    // 准备评价内容用于AI总结
    const reviewContents = reviews.map((review) => review.content).join('\n\n')

    // 使用AdvisorService生成总结
    const advisorService = require('../services/advisor')
    const summaryText = await advisorService.generateCourseReviewSummary(
      courseName,
      reviewContents
    )

    // 保存总结到数据库
    const savedSummary = await Review.createOrUpdateSummary(
      courseId,
      summaryText
    )

    res.status(200).json({
      success: true,
      data: savedSummary,
      fromCache: false,
    })
  } catch (error) {
    console.error('获取课程评价总结失败:', error)
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    })
  }
}
