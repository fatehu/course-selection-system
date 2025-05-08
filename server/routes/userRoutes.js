const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const { validateUser, validateUserUpdate  } = require('../middleware/validationMiddleware');

// 所有用户路由都需要验证token
router.use(verifyToken);

// 获取当前用户个人信息
router.get('/profile', userController.getCurrentUser);

// 更新当前用户个人信息
router.put('/profile', userController.updateCurrentUser);

// 获取所有用户（仅限管理员）
router.get('/', checkRole(['admin']), userController.getAllUsers);

// 获取单个用户
router.get('/:id', userController.getUser);

// 创建用户（仅限管理员）
router.post('/', checkRole(['admin']), validateUser, userController.createUser);

// 更新用户
// router.put('/:id', validateUser, userController.updateUser);
router.put('/:id', validateUserUpdate, userController.updateUser);

// 删除用户（仅限管理员）
router.delete('/:id', checkRole(['admin']), userController.deleteUser);

module.exports = router;