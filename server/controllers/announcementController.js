const Announcement = require('../models/announcementModel')

// 获取所有公告
exports.getAllAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.getAll()

    res.status(200).json({
      success: true,
      count: announcements.length,
      data: announcements,
    })
  } catch (error) {
    console.error('获取公告列表失败:', error)
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    })
  }
}

// 获取单个公告
exports.getAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.getById(req.params.id)

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: '公告不存在',
      })
    }

    res.status(200).json({
      success: true,
      data: announcement,
    })
  } catch (error) {
    console.error('获取公告失败:', error)
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    })
  }
}

// 创建公告
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, content, category, is_published } = req.body
    const publisher_id = req.user.id // 从JWT中获取当前用户ID

    const newAnnouncement = await Announcement.create({
      title,
      content,
      publisher_id,
      category,
      is_published,
    })

    res.status(201).json({
      success: true,
      message: '公告发布成功',
      data: newAnnouncement,
    })
  } catch (error) {
    console.error('发布公告失败:', error)
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    })
  }
}

// 更新公告
exports.updateAnnouncement = async (req, res) => {
  try {
    const announcementId = req.params.id

    // 检查公告是否存在
    const announcement = await Announcement.getById(announcementId)

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: '公告不存在',
      })
    }

    // 只有管理员或发布者本人可以更新公告
    if (
      req.user.role !== 'admin' &&
      req.user.id !== announcement.publisher_id
    ) {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作',
      })
    }

    const success = await Announcement.update(announcementId, req.body)

    if (!success) {
      return res.status(500).json({
        success: false,
        message: '更新公告失败',
      })
    }

    // 获取更新后的公告
    const updatedAnnouncement = await Announcement.getById(announcementId)

    res.status(200).json({
      success: true,
      message: '公告更新成功',
      data: updatedAnnouncement,
    })
  } catch (error) {
    console.error('更新公告失败:', error)
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    })
  }
}

// 删除公告
exports.deleteAnnouncement = async (req, res) => {
  try {
    const announcementId = req.params.id

    // 检查公告是否存在
    const announcement = await Announcement.getById(announcementId)

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: '公告不存在',
      })
    }

    // 只有管理员或发布者本人可以删除公告
    if (
      req.user.role !== 'admin' &&
      req.user.id !== announcement.publisher_id
    ) {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作',
      })
    }

    const success = await Announcement.delete(announcementId)

    if (!success) {
      return res.status(500).json({
        success: false,
        message: '删除公告失败',
      })
    }

    res.status(200).json({
      success: true,
      message: '公告删除成功',
    })
  } catch (error) {
    console.error('删除公告失败:', error)
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    })
  }
}
