const express = require('express')
const router = express.Router()
const announcementController = require('../controllers/announcementController')
const { verifyToken, checkRole } = require('../middleware/authMiddleware')

router.use(verifyToken)

router.get(
  '/',
  checkRole(['admin']),
  announcementController.getAllAnnouncements
)

// 定义公告相关路由
// router.get('/', announcementController.getAllAnnouncements)
router.post(
  '/',
  checkRole(['admin']),
  announcementController.createAnnouncement
)
router.put(
  '/:id',
  checkRole(['admin']),
  announcementController.updateAnnouncement
)
router.delete(
  '/:id',
  checkRole(['admin']),
  announcementController.deleteAnnouncement
)

module.exports = router
