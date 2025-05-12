const express = require('express');
const router = express.Router();
const { 
  askQuestion, 
  askQuestionStream, 
  getUserConversations, 
  getConversationMessages 
} = require('../controllers/advisorController');
const { verifyToken } = require('../middleware/authMiddleware');

// 所有路由都需要验证token
router.use(verifyToken);

// AI辅导员问答接口
router.post('/ask', askQuestion);

// AI辅导员问答接口 - 流式版本
router.post('/ask-stream', askQuestionStream);

// 获取用户的会话列表
router.get('/conversations', getUserConversations);

// 获取指定会话的消息
router.get('/conversations/:sessionId', getConversationMessages);

module.exports = router;