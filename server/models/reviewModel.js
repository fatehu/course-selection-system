// course-selection-system/server/models/reviewModel.js
const { pool } = require('../config/db')
const dayjs = require('dayjs')

class Review {
  // 获取指定课程的所有评价
  static async getByCourse(courseId) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM reviews WHERE course_id = ?',
        [courseId]
      )
      return rows
    } catch (error) {
      throw error
    }
  }

  // 创建课程评价
  static async create(reviewData) {
    try {
      console.log(reviewData)

      const { course_id, user_id, content } = reviewData
      const [result] = await pool.query(
        'INSERT INTO reviews (course_id, user_id, content) VALUES (?, ?, ?)',
        [course_id, user_id, content]
      )

      return {
        id: result.insertId,
        ...reviewData,
        created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      }
    } catch (error) {
      throw error
    }
  }
}

module.exports = Review
