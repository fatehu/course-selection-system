// routes/announcements.js
const express = require('express')
const router = express.Router()
const announcementController = require('../controllers/announcementController')

// 定义公告相关路由
router.get('/api/announcements', announcementController.getAllAnnouncements)
router.post('/api/announcements', announcementController.createAnnouncement)
router.put('/api/announcements/:id', announcementController.updateAnnouncement)
router.delete(
  '/api/announcements/:id',
  announcementController.deleteAnnouncement
)

module.exports = router
