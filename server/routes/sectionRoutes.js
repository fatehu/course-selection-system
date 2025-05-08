const express = require('express');
const router = express.Router();
const sectionController = require('../controllers/sectionController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const { validateSection } = require('../middleware/validationMiddleware');

// 所有路由都需要验证token
router.use(verifyToken);

// 获取所有课程安排
router.get('/', sectionController.getAllSections);

// 获取可用的课程安排
router.get('/available', sectionController.getAvailableSections);

// 按课程ID获取课程安排
router.get('/course/:courseId', sectionController.getSectionsByCourse);

// 按教师ID获取课程安排
router.get('/teacher/:teacherId', sectionController.getSectionsByTeacher);

// 获取单个课程安排
router.get('/:id', sectionController.getSection);

// 创建课程安排（仅限管理员和教师）
router.post('/', 
  checkRole(['admin', 'teacher']), 
  validateSection, 
  sectionController.createSection
);

// 更新课程安排
router.put('/:id', 
  validateSection, 
  sectionController.updateSection
);

// 删除课程安排（仅限管理员）
router.delete('/:id', 
  checkRole(['admin']), 
  sectionController.deleteSection
);

module.exports = router;