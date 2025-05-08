const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateLogin } = require('../middleware/validationMiddleware');
const { verifyToken } = require('../middleware/authMiddleware');

// 用户登录
router.post('/login', validateLogin, authController.login);

// 获取当前用户信息
router.get('/me', verifyToken, authController.getCurrentUser);

module.exports = router;