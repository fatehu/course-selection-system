const Announcement = require('../models/announcementModel')
const redis = require('../config/redis')

// 获取所有公告
exports.getAllAnnouncements = async (req, res) => {
  try {
    const cacheKey = 'announcements:all'

    // 检查 Redis 缓存
    const cachedAnnouncements = await redis.get(cacheKey)
    if (cachedAnnouncements) {
      console.log('从 Redis 缓存中获取公告列表')
      return res.status(200).json({
        success: true,
        count: JSON.parse(cachedAnnouncements).length,
        data: JSON.parse(cachedAnnouncements),
      })
    }

    // 如果缓存不存在，从数据库查询
    const announcements = await Announcement.getAll()

    // 将结果存入 Redis，设置过期时间为 1 小时
    await redis.set(cacheKey, JSON.stringify(announcements), 'EX', 3600)

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
    const announcementId = req.params.id
    const cacheKey = `announcement:${announcementId}`

    // 检查 Redis 缓存
    const cachedAnnouncement = await redis.get(cacheKey)
    if (cachedAnnouncement) {
      console.log(`从 Redis 缓存中获取公告 ID: ${announcementId}`)
      return res.status(200).json({
        success: true,
        data: JSON.parse(cachedAnnouncement),
      })
    }

    // 如果缓存不存在，从数据库查询
    const announcement = await Announcement.getById(announcementId)

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: '公告不存在',
      })
    }

    // 将结果存入 Redis，设置过期时间为 1 小时
    await redis.set(cacheKey, JSON.stringify(announcement), 'EX', 3600)

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

    // 清理 Redis 缓存
    await redis.del('announcements:all') // 删除公告列表缓存

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

    // 清理 Redis 缓存
    const cacheKey = `announcement:${announcementId}`
    await redis.del(cacheKey) // 删除单个公告缓存
    await redis.del('announcements:all') // 删除公告列表缓存

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

    // 删除公告
    const success = await Announcement.delete(announcementId)

    if (!success) {
      return res.status(500).json({
        success: false,
        message: '删除公告失败',
      })
    }

    // 清理 Redis 缓存
    const cacheKey = `announcement:${announcementId}`
    await redis.del(cacheKey) // 删除单个公告缓存
    await redis.del('announcements:all') // 删除公告列表缓存

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
