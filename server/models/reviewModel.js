// course-selection-system/server/models/reviewModel.js
const { pool } = require('../config/db')

class Review {
  // 获取所有课程评价
  static async getAll() {
    try {
      const [reviews] = await pool.query('SELECT * FROM reviews')
      return reviews
    } catch (error) {
      throw error
    }
  }

  // 获取单个课程评价
  static async getById(id) {
    try {
      const [reviews] = await pool.query('SELECT * FROM reviews WHERE id = ?', [
        id,
      ])
      return reviews[0]
    } catch (error) {
      throw error
    }
  }

  // 创建课程评价
  static async create(reviewData) {
    try {
      const { course_id, reviewer_id, content, rating } = reviewData
      const [result] = await pool.query(
        'INSERT INTO reviews (course_id, reviewer_id, content, rating) VALUES (?, ?, ?, ?)',
        [course_id, reviewer_id, content, rating]
      )
      return {
        id: result.insertId,
        ...reviewData,
      }
    } catch (error) {
      throw error
    }
  }

  // 更新课程评价
  static async update(id, reviewData) {
    try {
      const { content, rating } = reviewData
      const [result] = await pool.query(
        'UPDATE reviews SET content = ?, rating = ? WHERE id = ?',
        [content, rating, id]
      )
      return result.affectedRows > 0
    } catch (error) {
      throw error
    }
  }

  // 删除课程评价
  static async delete(id) {
    try {
      const [result] = await pool.query('DELETE FROM reviews WHERE id = ?', [
        id,
      ])
      return result.affectedRows > 0
    } catch (error) {
      throw error
    }
  }

  // 根据课程 ID 获取课程评价
  static async getByCourseId(course_id) {
    try {
      const [reviews] = await pool.query(
        'SELECT * FROM reviews WHERE course_id = ?',
        [course_id]
      )
      return reviews
    } catch (error) {
      throw error
    }
  }

  // 根据评价者 ID 获取课程评价
  static async getByReviewerId(reviewer_id) {
    try {
      const [reviews] = await pool.query(
        'SELECT * FROM reviews WHERE reviewer_id = ?',
        [reviewer_id]
      )
      return reviews
    } catch (error) {
      throw error
    }
  }
}

module.exports = Review
