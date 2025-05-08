const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { verifyToken } = require('../middleware/authMiddleware');

// 所有路由都需要验证token
router.use(verifyToken);

// 获取仪表盘统计数据
router.get('/stats', dashboardController.getDashboardStats);

// 获取最近课程列表
router.get('/recent-courses', dashboardController.getRecentCourses);

// 获取教师的课程安排
router.get('/teacher-sections/:teacherId', dashboardController.getTeacherSections);

// 获取学生的选课记录
router.get('/student-enrollments/:studentId', dashboardController.getStudentEnrollments);

module.exports = router;