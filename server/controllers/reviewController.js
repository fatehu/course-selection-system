// course-selection-system/server/controllers/reviewController.js
const Review = require('../models/reviewModel')

// 获取所有课程评价
exports.getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.getAll()

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews,
    })
  } catch (error) {
    console.error('获取课程评价列表失败:', error)
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    })
  }
}

// 获取单个课程评价
exports.getReview = async (req, res) => {
  try {
    const review = await Review.getById(req.params.id)
    console.log(review)

    if (!review) {
      return res.status(404).json({
        success: false,
        message: '课程评价不存在',
      })
    }

    res.status(200).json({
      success: true,
      data: review,
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
    const { course_id, content, rating } = req.body
    const reviewer_id = req.user.id // 从JWT中获取当前用户ID

    const newReview = await Review.create({
      course_id,
      content,
      rating,
      reviewer_id,
    })

    res.status(201).json({
      success: true,
      message: '课程评价发布成功',
      data: newReview,
    })
  } catch (error) {
    console.error('发布课程评价失败:', error)
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    })
  }
}

// 更新课程评价
exports.updateReview = async (req, res) => {
  try {
    const reviewId = req.params.id

    // 检查课程评价是否存在
    const review = await Review.getById(reviewId)

    if (!review) {
      return res.status(404).json({
        success: false,
        message: '课程评价不存在',
      })
    }

    // 只有管理员或评价发布者本人可以更新评价
    if (req.user.role !== 'admin' && req.user.id !== review.reviewer_id) {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作',
      })
    }

    const success = await Review.update(reviewId, req.body)

    if (!success) {
      return res.status(500).json({
        success: false,
        message: '更新课程评价失败',
      })
    }

    // 获取更新后的课程评价
    const updatedReview = await Review.getById(reviewId)

    res.status(200).json({
      success: true,
      message: '课程评价更新成功',
      data: updatedReview,
    })
  } catch (error) {
    console.error('更新课程评价失败:', error)
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    })
  }
}

// 删除课程评价
exports.deleteReview = async (req, res) => {
  try {
    const reviewId = req.params.id

    // 检查课程评价是否存在
    const review = await Review.getById(reviewId)

    if (!review) {
      return res.status(404).json({
        success: false,
        message: '课程评价不存在',
      })
    }

    // 只有管理员或评价发布者本人可以删除评价
    if (req.user.role !== 'admin' && req.user.id !== review.reviewer_id) {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作',
      })
    }

    const success = await Review.delete(reviewId)

    if (!success) {
      return res.status(500).json({
        success: false,
        message: '删除课程评价失败',
      })
    }

    res.status(200).json({
      success: true,
      message: '课程评价删除成功',
    })
  } catch (error) {
    console.error('删除课程评价失败:', error)
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    })
  }
}
