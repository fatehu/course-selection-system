const { pool } = require('../config/db')

class Announcement {
  // 获取所有公告
  static async getAll() {
    try {
      const [rows] = await pool.query(`
        SELECT a.*, u.name as publisher_name 
        FROM announcements a
        JOIN users u ON a.publisher_id = u.id
        ORDER BY a.publish_time DESC
      `)
      return rows
    } catch (error) {
      throw error
    }
  }

  // 通过ID获取公告
  static async getById(id) {
    try {
      const [rows] = await pool.query(
        `
        SELECT a.*, u.name as publisher_name 
        FROM announcements a
        JOIN users u ON a.publisher_id = u.id
        WHERE a.id = ?
      `,
        [id]
      )

      return rows[0]
    } catch (error) {
      throw error
    }
  }

  // 创建公告
  static async create(announcementData) {
    try {
      const { title, content, publisher_id, category, is_published } =
        announcementData

      const [result] = await pool.query(
        'INSERT INTO announcements (title, content, publisher_id, category, is_published) VALUES (?, ?, ?, ?, ?)',
        [title, content, publisher_id, category, is_published]
      )

      return {
        id: result.insertId,
        title,
        content,
        publisher_id,
        publish_time: new Date(),
        category,
        is_published,
      }
    } catch (error) {
      throw error
    }
  }

  // 更新公告
  static async update(id, announcementData) {
    try {
      const { title, content, category, is_published } = announcementData

      const [result] = await pool.query(
        'UPDATE announcements SET title = ?, content = ?, category = ?, is_published = ? WHERE id = ?',
        [title, content, category, is_published, id]
      )

      return result.affectedRows > 0
    } catch (error) {
      throw error
    }
  }

  // 删除公告
  static async delete(id) {
    try {
      const [result] = await pool.query(
        'DELETE FROM announcements WHERE id = ?',
        [id]
      )
      return result.affectedRows > 0
    } catch (error) {
      throw error
    }
  }
}

module.exports = Announcement
