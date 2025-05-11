const express = require('express');
const router = express.Router();
const { askQuestion, askQuestionStream } = require('../controllers/advisorController');
const { verifyToken } = require('../middleware/authMiddleware');

// 所有路由都需要验证token
router.use(verifyToken);

// AI辅导员问答接口
router.post('/ask', askQuestion);

// AI辅导员问答接口 - 流式版本
router.post('/ask-stream', askQuestionStream);

module.exports = router;