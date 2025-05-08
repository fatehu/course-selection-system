const express = require('express');
const router = express.Router();
const enrollmentController = require('../controllers/enrollmentController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const { validateEnrollment } = require('../middleware/validationMiddleware');

// 所有路由都需要验证token
router.use(verifyToken);

// 获取所有选课记录（仅限管理员和教师）
router.get('/', 
  checkRole(['admin', 'teacher']), 
  enrollmentController.getAllEnrollments
);

// 获取学生的所有选课记录
router.get('/student/:studentId', enrollmentController.getStudentEnrollments);

// 获取课程安排的所有选课记录（仅限管理员和教师）
router.get('/section/:sectionId', 
  checkRole(['admin', 'teacher']), 
  enrollmentController.getSectionEnrollments
);

// 获取单个选课记录
router.get('/:id', enrollmentController.getEnrollment);

// 学生选课
router.post('/', 
  checkRole(['student']), 
  validateEnrollment, 
  enrollmentController.enrollCourse
);

// 更新选课状态（仅限管理员）
router.put('/:id/status', 
  checkRole(['admin']), 
  enrollmentController.updateEnrollmentStatus
);

// 退课
router.put('/:id/drop', enrollmentController.dropCourse);

// 删除选课记录（仅限管理员）
router.delete('/:id', 
  checkRole(['admin']), 
  enrollmentController.deleteEnrollment
);

module.exports = router;