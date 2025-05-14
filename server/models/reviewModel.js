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
  // 获取课程评价总结
  static async getSummary(courseId) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM course_review_summaries WHERE course_id = ?',
        [courseId]
      )
      return rows.length > 0 ? rows[0] : null
    } catch (error) {
      throw error
    }
  }

  // 创建或更新课程评价总结
  static async createOrUpdateSummary(courseId, summary) {
    try {
      // 检查是否已存在总结
      const existingSummary = await this.getSummary(courseId)
      
      if (existingSummary) {
        // 更新现有总结
        await pool.query(
          'UPDATE course_review_summaries SET summary = ?, updated_at = NOW() WHERE course_id = ?',
          [summary, courseId]
        )
        return {
          ...existingSummary,
          summary,
          updated_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
        }
      } else {
        // 创建新总结
        const [result] = await pool.query(
          'INSERT INTO course_review_summaries (course_id, summary) VALUES (?, ?)',
          [courseId, summary]
        )
        
        return {
          id: result.insertId,
          course_id: courseId,
          summary,
          created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          updated_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
        }
      }
    } catch (error) {
      throw error
    }
  }

  // 判断总结是否需要更新（例如，总结超过7天或有新评价）
  static async isSummaryOutdated(courseId) {
    try {
      const [summaries] = await pool.query(
        'SELECT * FROM course_review_summaries WHERE course_id = ?',
        [courseId]
      )
      
      if (summaries.length === 0) {
        return true // 不存在总结，需要创建
      }
      
      const summary = summaries[0]
      const summaryDate = dayjs(summary.updated_at)
      const currentDate = dayjs()
      
      // 检查总结是否超过7天
      if (currentDate.diff(summaryDate, 'day') > 7) {
        return true
      }
      
      // 检查总结后是否有新评价
      const [reviews] = await pool.query(
        'SELECT COUNT(*) as count FROM reviews WHERE course_id = ? AND created_at > ?',
        [courseId, summary.updated_at]
      )
      
      return reviews[0].count > 0
    } catch (error) {
      throw error
    }
  }

  static async getCourseName(courseId) {
    try {
      const [rows] = await pool.query(
        'SELECT name FROM courses WHERE id = ?',
        [courseId]
      );
      return rows.length > 0 ? rows[0].name : `课程${courseId}`;
    } catch (error) {
      throw error;
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
