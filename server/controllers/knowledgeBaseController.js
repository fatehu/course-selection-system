const knowledgeBaseService = require('../services/knowledgeBaseService');
const multer = require('multer');
const path = require('path');

// 内存存储，用于处理文件上传
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB限制
  },
  fileFilter: (req, file, cb) => {
    const allowedFileTypes = ['.pdf', '.txt', '.doc', '.docx', '.csv', '.md', '.markdown'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedFileTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
}).single('file');

// 创建知识库
const createKnowledgeBase = async (req, res) => {
  try {
    const { name, description } = req.body;
    const userId = req.user ? req.user.id : null;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: "知识库名称不能为空"
      });
    }
    
    const knowledgeBaseId = await knowledgeBaseService.createKnowledgeBase(name, description, userId);
    
    res.status(201).json({
      success: true,
      knowledgeBaseId,
      message: "知识库创建成功"
    });
  } catch (error) {
    console.error("创建知识库失败:", error);
    res.status(500).json({
      success: false,
      error: error.message || "服务器内部错误"
    });
  }
};

// 获取所有知识库
const getAllKnowledgeBases = async (req, res) => {
  try {
    const knowledgeBases = await knowledgeBaseService.getAllKnowledgeBases();
    
    res.json({
      success: true,
      knowledgeBases
    });
  } catch (error) {
    console.error("获取知识库列表失败:", error);
    res.status(500).json({
      success: false,
      error: error.message || "服务器内部错误"
    });
  }
};

// 获取单个知识库
const getKnowledgeBase = async (req, res) => {
  try {
    const { id } = req.params;
    const knowledgeBase = await knowledgeBaseService.getKnowledgeBase(id);
    
    if (!knowledgeBase) {
      return res.status(404).json({
        success: false,
        error: "知识库不存在"
      });
    }
    
    // 获取知识库文件
    const files = await knowledgeBaseService.getKnowledgeBaseFiles(id);
    
    res.json({
      success: true,
      knowledgeBase,
      files
    });
  } catch (error) {
    console.error("获取知识库失败:", error);
    res.status(500).json({
      success: false,
      error: error.message || "服务器内部错误"
    });
  }
};

// 更新知识库
const updateKnowledgeBase = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: "知识库名称不能为空"
      });
    }
    
    const success = await knowledgeBaseService.updateKnowledgeBase(id, name, description);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: "知识库不存在或更新失败"
      });
    }
    
    res.json({
      success: true,
      message: "知识库更新成功"
    });
  } catch (error) {
    console.error("更新知识库失败:", error);
    res.status(500).json({
      success: false,
      error: error.message || "服务器内部错误"
    });
  }
};

// 删除知识库
const deleteKnowledgeBase = async (req, res) => {
  try {
    const { id } = req.params;
    const success = await knowledgeBaseService.deleteKnowledgeBase(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: "知识库不存在或删除失败"
      });
    }
    
    res.json({
      success: true,
      message: "知识库删除成功"
    });
  } catch (error) {
    console.error("删除知识库失败:", error);
    res.status(500).json({
      success: false,
      error: error.message || "服务器内部错误"
    });
  }
};

// 上传文件到知识库
const uploadFile = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "没有上传文件"
        });
      }
      
      const { id } = req.params; // 知识库ID
      
      // 保存文件
      const fileId = await knowledgeBaseService.saveUploadedFile(id, req.file);
      
      // 异步处理文件
      knowledgeBaseService.processFile(fileId)
        .catch(error => console.error(`文件处理失败(ID: ${fileId}):`, error));
      
      res.status(201).json({
        success: true,
        fileId,
        message: "文件上传成功，正在处理中"
      });
    });
  } catch (error) {
    console.error("上传文件失败:", error);
    res.status(500).json({
      success: false,
      error: error.message || "服务器内部错误"
    });
  }
};

// 获取知识库文件列表
const getFiles = async (req, res) => {
  try {
    const { id } = req.params; // 知识库ID
    const files = await knowledgeBaseService.getKnowledgeBaseFiles(id);
    
    res.json({
      success: true,
      files
    });
  } catch (error) {
    console.error("获取文件列表失败:", error);
    res.status(500).json({
      success: false,
      error: error.message || "服务器内部错误"
    });
  }
};

// 删除文件
const deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const success = await knowledgeBaseService.deleteFile(fileId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: "文件不存在或删除失败"
      });
    }
    
    res.json({
      success: true,
      message: "文件删除成功"
    });
  } catch (error) {
    console.error("删除文件失败:", error);
    res.status(500).json({
      success: false,
      error: error.message || "服务器内部错误"
    });
  }
};

// 重建知识库索引
const rebuildIndex = async (req, res) => {
  try {
    const { id } = req.params; // 知识库ID
    
    // 异步重建索引
    knowledgeBaseService.rebuildKnowledgeBaseIndex(id)
      .catch(error => console.error(`重建索引失败(ID: ${id}):`, error));
    
    res.json({
      success: true,
      message: "索引重建已启动"
    });
  } catch (error) {
    console.error("启动索引重建失败:", error);
    res.status(500).json({
      success: false,
      error: error.message || "服务器内部错误"
    });
  }
};

// 测试知识库搜索
const testSearch = async (req, res) => {
  try {
    const { id } = req.params; // 知识库ID
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: "搜索查询不能为空"
      });
    }
    
    const results = await knowledgeBaseService.searchKnowledgeBase(id, query, 5);
    
    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error("搜索知识库失败:", error);
    res.status(500).json({
      success: false,
      error: error.message || "服务器内部错误"
    });
  }
};

module.exports = {
  createKnowledgeBase,
  getAllKnowledgeBases,
  getKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  uploadFile,
  getFiles,
  deleteFile,
  rebuildIndex,
  testSearch
};