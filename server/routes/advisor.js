const express = require('express');
const router = express.Router();
const advisorController = require('../controllers/advisorController');
const advisorSettingsController = require('../controllers/advisorSettingsController');
const { verifyToken , checkRole} = require('../middleware/authMiddleware');

// 所有路由都需要验证token
router.use(verifyToken);

// 使用对象解构语法，确保所有控制器方法都被正确导入
const {
  askQuestion,
  askQuestionStream,
  getUserConversations,
  getConversationMessages,
  renameConversation,
  deleteConversation,
  generateTitle,
  getSearchEngines,
  setActiveEngines,
  searchWeb,
  rebuildDefaultKnowledgeBase,
  checkDefaultKnowledgeBase,
  clearProcessingCache
} = advisorController;

// AI辅导员问答接口
router.post('/ask', askQuestion);

// AI辅导员问答接口 - 流式版本
router.post('/ask-stream', askQuestionStream);

// 获取用户的会话列表
router.get('/conversations', getUserConversations);

// 获取指定会话的消息
router.get('/conversations/:sessionId', getConversationMessages);

// 重命名会话
router.put('/conversations/:sessionId/rename', renameConversation);

// 删除会话
router.delete('/conversations/:sessionId', deleteConversation);

// 生成会话标题
router.post('/conversations/:sessionId/generate-title', generateTitle);

// 获取可用搜索引擎
router.get('/search/engines', getSearchEngines);

// 设置活跃搜索引擎
router.post('/search/engines', setActiveEngines);

// 执行网络搜索
router.post('/search/web', searchWeb);

// AI辅导员设置相关路由
router.get('/settings', advisorSettingsController.getSettings);
router.post('/settings', advisorSettingsController.saveSettings);
router.delete('/settings', advisorSettingsController.resetSettings);

// 管理默认知识库相关路由
router.get('/admin/knowledge-base/status',checkRole(['admin']), checkDefaultKnowledgeBase);
router.post('/admin/knowledge-base/rebuild',checkRole(['admin']), rebuildDefaultKnowledgeBase);
router.post('/admin/cache/clear',checkRole(['admin']), clearProcessingCache);

module.exports = router;