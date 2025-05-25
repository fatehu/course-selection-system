const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batchController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const multer = require('multer');

const upload = multer({ dest: 'uploads_csv/' });
// 批量插入学生，仅限管理员
router.post(
  '/students',
  verifyToken,
  checkRole(['admin']),
  batchController.batchInsertStudents
);

// 从 CSV 批量插入学生的路由
router.post(
    '/students/csv',
    verifyToken,
    checkRole(['admin']), 
    upload.single('csvFile'), 
    batchController.batchInsertStudentsFromCSV
);

module.exports = router;