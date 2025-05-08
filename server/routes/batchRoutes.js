const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batchController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

// 批量插入学生，仅限管理员
router.post('/students', verifyToken, checkRole(['admin']), batchController.batchInsertStudents);

module.exports = router;