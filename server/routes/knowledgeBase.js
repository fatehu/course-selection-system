const express = require('express');
const router = express.Router();
const knowledgeBaseController = require('../controllers/knowledgeBaseController');
const { verifyToken } = require('../middleware/authMiddleware');

// 所有路由都需要验证token
router.use(verifyToken);

// 知识库管理
router.post('/', knowledgeBaseController.createKnowledgeBase);
router.get('/', knowledgeBaseController.getAllKnowledgeBases);
router.get('/:id', knowledgeBaseController.getKnowledgeBase);
router.put('/:id', knowledgeBaseController.updateKnowledgeBase);
router.delete('/:id', knowledgeBaseController.deleteKnowledgeBase);

// 文件管理
router.post('/:id/files', knowledgeBaseController.uploadFile);
router.get('/:id/files', knowledgeBaseController.getFiles);
router.delete('/files/:fileId', knowledgeBaseController.deleteFile);

// 知识库索引管理
router.post('/:id/rebuild', knowledgeBaseController.rebuildIndex);

// 清理知识库（删除已标记的文档）
router.post('/:id/cleanup', knowledgeBaseController.cleanupKnowledgeBase);

// 测试搜索
router.post('/:id/search', knowledgeBaseController.testSearch);

module.exports = router;