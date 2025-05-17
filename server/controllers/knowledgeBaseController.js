const knowledgeBaseService = require('../services/knowledgeBaseService');
const multer = require('multer');
const path = require('path');
const knowledgeBaseModel = require('../models/knowledgeBaseModel'); 
const fs = require('fs-extra'); // 使用 fs-extra 而不是原生 fs，因为它有 ensureDirSync 方法
const DocumentProcessor = require('../services/advisor/documentProcessor');

// 内存存储，用于处理文件上传
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 10MB限制
  },
  fileFilter: (req, file, cb) => {
    const allowedFileTypes = ['.pdf', '.txt', '.doc', '.docx', '.csv', '.md', '.markdown', '.epub','rtf'];
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
    const includeDeleted = req.query.includeDeleted === 'true'; // 是否包含已删除文件
    
    const knowledgeBase = await knowledgeBaseService.getKnowledgeBase(id);
    
    if (!knowledgeBase) {
      return res.status(404).json({
        success: false,
        error: "知识库不存在"
      });
    }
    
    // 获取知识库文件
    const files = await knowledgeBaseService.getKnowledgeBaseFiles(id);
    
    // 获取已删除文件（如果需要）
    let deletedFiles = [];
    if (includeDeleted) {
      deletedFiles = await knowledgeBaseModel.getDeletedFiles(id);
    }
    
    res.json({
      success: true,
      knowledgeBase,
      files,
      deletedFiles
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
    
    console.log(`开始删除知识库: ${id}`);
    const success = await knowledgeBaseService.deleteKnowledgeBase(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: "知识库不存在或删除失败"
      });
    }
    
    res.json({
      success: true,
      message: "知识库及其所有文件已成功删除"
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
      
      // 检查文件是否已存在
      // 保存临时文件
      const tempDir = path.join(process.cwd(), 'temp');
      fs.ensureDirSync(tempDir);
      const tempFilePath = path.join(tempDir, req.file.originalname);
      
      try {
        fs.writeFileSync(tempFilePath, req.file.buffer);
        
        // 使用DocumentProcessor生成基于内容的ID
        const documentProcessor = new DocumentProcessor();
        const contentId = await documentProcessor.generateDocumentId(tempFilePath);
        
        // 检查知识库中是否存在相同内容的文件
        const exists = await knowledgeBaseService.checkFileExistsByContent(id, contentId);
        
        // 如果文件已存在，直接拒绝上传
        if (exists) {
          return res.status(409).json({
            success: false,
            error: "文件重复",
            message: "文件内容已存在于知识库中，请勿重复上传",
            fileInfo: exists
          });
        }
      } catch (error) {
        console.error("检查文件是否存在时出错:", error);
        // 出错时可以选择继续处理上传，不中断流程
      } finally {
        // 删除临时文件
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
      
      console.log(`上传文件到知识库 ${id}: ${req.file.originalname}`);
      
      // 保存文件
      const fileId = await knowledgeBaseService.saveUploadedFile(id, req.file);
      
      // 异步处理文件
      knowledgeBaseService.processFile(fileId)
        .then(() => console.log(`文件处理完成: ${fileId}`))
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

// 删除文件（支持软删除和彻底删除）
const deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const purge = req.query.purge === 'true'; // 是否彻底删除
    
    console.log(`${purge ? '彻底删除' : '软删除'}文件: ${fileId}`);
    
    if (purge) {
      // 彻底删除
      const success = await knowledgeBaseService.deleteFile(fileId, true);
      
      if (!success) {
        return res.status(404).json({
          success: false,
          error: "文件不存在或删除失败"
        });
      }
      
      res.json({
        success: true,
        message: "文件已彻底删除"
      });
    } else {
      // 软删除
      const success = await knowledgeBaseService.markFileAsDeleted(fileId);
      
      if (!success) {
        return res.status(404).json({
          success: false,
          error: "文件不存在或删除失败"
        });
      }
      
      res.json({
        success: true,
        message: "文件已移至回收站"
      });
    }
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
    
    console.log(`开始重建知识库 ${id} 的索引`);
    
    // 异步重建索引
    knowledgeBaseService.rebuildKnowledgeBaseIndex(id)
      .then(result => {
        console.log(`知识库 ${id} 索引重建完成:`, result);
      })
      .catch(error => console.error(`重建索引失败(ID: ${id}):`, error));
    
    res.json({
      success: true,
      message: "索引重建已启动，这将清理所有已删除的文档并重新索引现有文件"
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
    
    console.log(`搜索知识库 ${id}: "${query}"`);
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

// 清理知识库（物理删除所有已标记为删除的文档）
const cleanupKnowledgeBase = async (req, res) => {
  try {
    const { id } = req.params; // 知识库ID
    
    console.log(`开始清理知识库 ${id}`);
    const purgedCount = await knowledgeBaseService.cleanupKnowledgeBase(id);
    
    res.json({
      success: true,
      message: `知识库清理完成，物理删除了${purgedCount}个文档`,
      purgedCount
    });
  } catch (error) {
    console.error("清理知识库失败:", error);
    res.status(500).json({
      success: false,
      error: error.message || "服务器内部错误"
    });
  }
};

// 恢复已删除的文件
const restoreFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    
    console.log(`开始恢复文件: ${fileId}`);
    const success = await knowledgeBaseService.restoreFile(fileId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: "文件不存在或恢复失败"
      });
    }
    
    res.json({
      success: true,
      message: "文件已成功恢复"
    });
  } catch (error) {
    console.error("恢复文件失败:", error);
    res.status(500).json({
      success: false,
      error: error.message || "服务器内部错误"
    });
  }
};

// 彻底删除已软删除的文件
const purgeDeletedFiles = async (req, res) => {
  try {
    const { id } = req.params; // 知识库ID
    
    console.log(`开始彻底删除知识库 ${id} 中的已删除文件`);
    const purgedCount = await knowledgeBaseService.purgeDeletedFiles(id);
    
    res.json({
      success: true,
      message: `已彻底删除${purgedCount}个文件`,
      purgedCount
    });
  } catch (error) {
    console.error("彻底删除文件失败:", error);
    res.status(500).json({
      success: false,
      error: error.message || "服务器内部错误"
    });
  }
};

// 检查文件是否已存在于知识库中
const checkFileExists = async (req, res) => {
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
      
      // 创建临时目录并保存临时文件
      const tempDir = path.join(process.cwd(), 'temp');
      fs.ensureDirSync(tempDir);
      const tempFilePath = path.join(tempDir, req.file.originalname);
      
      try {
        fs.writeFileSync(tempFilePath, req.file.buffer);
        
        // 使用DocumentProcessor生成基于内容的ID
        const documentProcessor = new DocumentProcessor();
        const contentId = await documentProcessor.generateDocumentId(tempFilePath);
        
        // 检查知识库中是否存在相同内容的文件
        const exists = await knowledgeBaseService.checkFileExistsByContent(id, contentId);
        
        return res.json({
          success: true,
          exists: !!exists,
          message: exists ? "文件内容已存在于知识库中" : "",
          fileInfo: exists || null
        });
      } catch (error) {
        console.error("处理文件时出错:", error);
        return res.status(500).json({
          success: false,
          error: "处理文件时出错"
        });
      } finally {
        // 确保清理临时文件
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });
  } catch (error) {
    console.error("检查文件是否存在失败:", error);
    return res.status(500).json({
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
  testSearch,
  cleanupKnowledgeBase,
  restoreFile,
  purgeDeletedFiles,
  checkFileExists
};