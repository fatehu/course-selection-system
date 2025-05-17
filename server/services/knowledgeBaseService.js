const path = require('path');
const fs = require('fs-extra');
const knowledgeBaseModel = require('../models/knowledgeBaseModel');
const DocumentProcessor = require('./advisor/documentProcessor');
const EmbeddingService = require('./advisor/embeddingService');
const EnhancedVectorStore = require('./advisor/vectorStore');

class KnowledgeBaseService {
  constructor() {
    this.documentProcessor = new DocumentProcessor();
    this.embeddingService = new EmbeddingService();
    this.uploadsDir = path.join(process.cwd(), 'uploads/knowledge_base');
    
    // 确保上传目录存在
    fs.ensureDirSync(this.uploadsDir);
  }
  
  // 获取知识库的向量存储路径
  getVectorStorePath(knowledgeBaseId) {
    const storeDir = path.join(process.cwd(), 'data/vector_stores');
    fs.ensureDirSync(storeDir);
    return path.join(storeDir, `kb_${knowledgeBaseId}.json`);
  }
  
  // 获取知识库的向量存储（使用增强版本）
  getVectorStore(knowledgeBaseId) {
    const storePath = this.getVectorStorePath(knowledgeBaseId);
    const vectorStore = new EnhancedVectorStore({ storePath });
    vectorStore.load(); // 尝试加载现有数据
    return vectorStore;
  }
  
  // 创建知识库
  async createKnowledgeBase(name, description, userId) {
    return await knowledgeBaseModel.createKnowledgeBase(name, description, userId);
  }
  
  // 获取所有知识库
  async getAllKnowledgeBases() {
    return await knowledgeBaseModel.getKnowledgeBases();
  }
  
  // 获取单个知识库
  async getKnowledgeBase(id) {
    return await knowledgeBaseModel.getKnowledgeBase(id);
  }
  
  // 更新知识库
  async updateKnowledgeBase(id, name, description) {
    return await knowledgeBaseModel.updateKnowledgeBase(id, name, description);
  }
  
  // 删除知识库
  async deleteKnowledgeBase(id) {
    try {
      // 获取知识库中的所有文件
      const files = await knowledgeBaseModel.getKnowledgeBaseFiles(id);
      
      // 删除所有物理文件
      for (const file of files) {
        const filePath = path.join(this.uploadsDir, file.stored_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      
      // 删除知识库文件夹
      const kbDir = path.join(this.uploadsDir, `kb_${id}`);
      if (fs.existsSync(kbDir)) {
        fs.removeSync(kbDir);
      }
      
      // 删除向量存储文件
      const storePath = this.getVectorStorePath(id);
      if (fs.existsSync(storePath)) {
        fs.unlinkSync(storePath);
      }
      
      // 删除数据库记录（级联删除所有相关文件记录）
      return await knowledgeBaseModel.deleteKnowledgeBase(id);
    } catch (error) {
      console.error(`删除知识库失败: ${error.message}`);
      throw error;
    }
  }
  
  // 获取知识库文件列表
  async getKnowledgeBaseFiles(knowledgeBaseId) {
    return await knowledgeBaseModel.getKnowledgeBaseFiles(knowledgeBaseId);
  }
  
  // 保存上传的文件
  async saveUploadedFile(knowledgeBaseId, file) {
    // 如果知识库文件夹不存在则创建
    const kbDir = path.join(this.uploadsDir, `kb_${knowledgeBaseId}`);
    fs.ensureDirSync(kbDir);
    
    // 生成唯一文件名
    const timestamp = Date.now();
    const fileExtension = path.extname(file.originalname);
    const storedFilename = `${timestamp}_${path.basename(file.originalname, fileExtension)}${fileExtension}`;
    const storedPath = path.join(kbDir, storedFilename);
    
    // 保存文件
    fs.writeFileSync(storedPath, file.buffer);
    
    // 获取文件类型
    const fileType = fileExtension.substring(1); // 移除点号
    
    // 计算文件内容哈希
    const documentProcessor = new DocumentProcessor();
    const contentHash = await documentProcessor.generateDocumentId(storedPath);
    
    // 保存文件记录到数据库
    return await knowledgeBaseModel.addFile(
      knowledgeBaseId,
      file.originalname,
      `kb_${knowledgeBaseId}/${storedFilename}`,
      fileType,
      file.size,
      contentHash //新增文件哈希值
    );
  }
  
  // 处理文件并添加到向量存储
  async processFile(fileId) {
    // 获取文件信息
    const fileInfo = await knowledgeBaseModel.getFile(fileId);
    if (!fileInfo) {
      throw new Error(`文件未找到: ID ${fileId}`);
    }
    
    try {
      // 更新状态为处理中
      await knowledgeBaseModel.updateFileStatus(fileId, 'processing');
      
      // 完整文件路径
      const filePath = path.join(this.uploadsDir, fileInfo.stored_path);
      
      // 处理文件并分割成块
      const chunks = await this.documentProcessor.processFile(filePath);
      
      // 获取向量存储
      const vectorStore = this.getVectorStore(fileInfo.knowledge_base_id);
      
      // 生成嵌入向量
      const contentsOnly = chunks.map(chunk => chunk.content);
      const embeddings = await this.embeddingService.getBatchEmbeddings(contentsOnly);
      
      // 增强块，添加文件元数据和唯一ID
      const enhancedChunks = chunks.map((chunk, index) => ({
        ...chunk,
        id: `file_${fileInfo.id}_chunk_${index}`, // 添加唯一ID
        metadata: {
          ...chunk.metadata,
          fileId: fileInfo.id, // 确保这是来自数据库的数字ID
          fileName: fileInfo.original_filename
        }
      }));
      
      // 添加到向量存储（这将自动删除同一文件的旧文档）
      vectorStore.addDocuments(enhancedChunks, embeddings);
      
      // 保存向量存储
      vectorStore.save();
      
      // 更新文件状态为已索引
      await knowledgeBaseModel.updateFileStatus(fileId, 'indexed', chunks.length);
      
      console.log(`文件处理成功: ${fileInfo.original_filename}, 创建了 ${chunks.length} 个文本块`);
      return true;
    } catch (error) {
      console.error(`处理文件失败: ${error.message}`);
      await knowledgeBaseModel.updateFileStatus(fileId, 'failed');
      throw error;
    }
  }
  
  // 删除文件（完整实现）
  async deleteFile(fileId) {
    try {
      // 获取文件信息
      const fileInfo = await knowledgeBaseModel.getFile(fileId);
      if (!fileInfo) {
        throw new Error(`文件未找到: ID ${fileId}`);
      }
      
      // 获取向量存储并标记文档为已删除
      const vectorStore = this.getVectorStore(fileInfo.knowledge_base_id);
      const deletedCount = vectorStore.markDocumentsAsDeleted(fileId);
      
      // 保存更新的向量存储
      if (deletedCount > 0) {
        vectorStore.save();
        console.log(`已从向量存储中标记 ${deletedCount} 个文档为已删除`);
      }
      
      // 删除物理文件
      const filePath = path.join(this.uploadsDir, fileInfo.stored_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`已删除物理文件: ${filePath}`);
      }
      
      // 删除数据库记录
      const success = await knowledgeBaseModel.deleteFile(fileId);
      
      console.log(`文件删除成功: ${fileInfo.original_filename}`);
      return success;
    } catch (error) {
      console.error(`删除文件失败: ${error.message}`);
      throw error;
    }
  }
  
  // 重建知识库索引（包括清理已删除的文档）
  async rebuildKnowledgeBaseIndex(knowledgeBaseId) {
    try {
      console.log(`开始重建知识库 ${knowledgeBaseId} 的索引`);
      
      // 获取知识库中的所有文件
      const files = await knowledgeBaseModel.getKnowledgeBaseFiles(knowledgeBaseId);
      
      // 删除现有向量存储
      const storePath = this.getVectorStorePath(knowledgeBaseId);
      if (fs.existsSync(storePath)) {
        fs.unlinkSync(storePath);
        console.log(`已删除旧向量存储: ${storePath}`);
      }
      
      // 创建新向量存储
      const vectorStore = this.getVectorStore(knowledgeBaseId);
      
      // 处理每个文件
      let successCount = 0;
      let failCount = 0;
      
      for (const file of files) {
        // 重置文件状态
        await knowledgeBaseModel.updateFileStatus(file.id, 'pending', 0);
        
        // 重新处理文件
        try {
          await this.processFile(file.id);
          successCount++;
        } catch (error) {
          console.error(`重建过程中处理文件失败: ${file.original_filename}`, error);
          failCount++;
          // 继续处理其他文件
        }
      }
      
      console.log(`索引重建完成: ${successCount} 个成功, ${failCount} 个失败`);
      return { success: successCount, failed: failCount };
    } catch (error) {
      console.error(`重建知识库索引失败: ${error.message}`);
      throw error;
    }
  }
  
  // 搜索知识库（自动过滤已删除的文档）
  async searchKnowledgeBase(knowledgeBaseId, query, topK = 5) {
    try {
      // 获取向量存储
      const vectorStore = this.getVectorStore(knowledgeBaseId);
      
      // 获取统计信息
      const stats = vectorStore.getStats();
      console.log(`搜索知识库 ${knowledgeBaseId}: ${stats.activeDocuments} 个活跃文档, ${stats.deletedDocuments} 个已删除文档`);
      
      // 为查询生成嵌入向量
      const queryEmbedding = await this.embeddingService.getEmbedding(query);
      
      // 搜索相关文档（自动过滤已删除的文档）
      const results = vectorStore.similaritySearch(queryEmbedding, topK);
      
      console.log(`找到 ${results.length} 个相关文档`);
      return results;
    } catch (error) {
      console.error(`搜索知识库失败: ${error.message}`);
      throw error;
    }
  }

  // 将文件标记为已删除（软删除）
  async markFileAsDeleted(fileId) {
    try {
      // 获取文件信息
      const fileInfo = await knowledgeBaseModel.getFile(fileId);
      if (!fileInfo) {
        throw new Error(`文件不存在: ID ${fileId}`);
      }
      
      // 先在数据库中标记文件为删除状态
      const success = await knowledgeBaseModel.markFileAsDeleted(fileId);
      
      if (!success) {
        throw new Error(`标记文件删除失败: ID ${fileId}`);
      }
      
      // 获取向量存储并标记文档为已删除
      const vectorStore = this.getVectorStore(fileInfo.knowledge_base_id);
      const deletedCount = vectorStore.markDocumentsAsDeleted(fileId);
      
      // 保存更新后的向量存储
      if (deletedCount > 0) {
        vectorStore.save();
        console.log(`标记了${deletedCount}个文档为已删除`);
      }
      
      return true;
    } catch (error) {
      console.error(`标记文件为删除状态失败: ${error.message}`);
      throw error;
    }
  }

  // 清理知识库（物理删除所有标记为已删除的文档）
  async cleanupKnowledgeBase(knowledgeBaseId) {
    try {
      const vectorStore = this.getVectorStore(knowledgeBaseId);
      const purgedCount = vectorStore.purgeDeletedDocuments();
      
      if (purgedCount > 0) {
        vectorStore.save();
        console.log(`已清理知识库 ${knowledgeBaseId}: 物理删除了 ${purgedCount} 个文档`);
      }
      
      return purgedCount;
    } catch (error) {
      console.error(`清理知识库失败: ${error.message}`);
      throw error;
    }
  }
  
  // 恢复被软删除的文件
  async restoreFile(fileId) {
    try {
      // 获取文件信息
      const fileInfo = await knowledgeBaseModel.getFile(fileId);
      if (!fileInfo) {
        throw new Error(`文件不存在: ID ${fileId}`);
      }
      
      // 在数据库中恢复文件状态
      const success = await knowledgeBaseModel.restoreDeletedFile(fileId);
      
      if (!success) {
        throw new Error(`恢复文件失败: ID ${fileId}`);
      }
      
      // 获取向量存储并将文档从已删除集合中移除
      const vectorStore = this.getVectorStore(fileInfo.knowledge_base_id);
      const restoredCount = vectorStore.restoreDocuments(fileId);
      
      // 保存更新后的向量存储
      if (restoredCount > 0) {
        vectorStore.save();
        console.log(`已恢复${restoredCount}个文档`);
      }
      
      return true;
    } catch (error) {
      console.error(`恢复文件失败: ${error.message}`);
      throw error;
    }
  }

  // 彻底删除已软删除的文件
  async purgeDeletedFiles(knowledgeBaseId) {
    try {
      // 获取知识库中已删除的文件
      const deletedFiles = await knowledgeBaseModel.getDeletedFiles(knowledgeBaseId);
      
      // 获取向量存储
      const vectorStore = this.getVectorStore(knowledgeBaseId);
      
      // 彻底删除已标记为删除的文档
      const purgedCount = vectorStore.purgeDeletedDocuments();
      
      // 保存更新后的向量存储
      if (purgedCount > 0) {
        vectorStore.save();
        console.log(`已彻底删除${purgedCount}个文档`);
      }
      
      // 删除物理文件并从数据库中删除记录
      let deletedCount = 0;
      for (const file of deletedFiles) {
        try {
          // 删除物理文件
          const filePath = path.join(this.uploadsDir, file.stored_path);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          
          // 从数据库中删除记录
          await knowledgeBaseModel.deleteFile(file.id);
          deletedCount++;
        } catch (error) {
          console.error(`删除文件失败: ${file.id}`, error);
          // 继续处理其他文件
        }
      }
      
      return deletedCount;
    } catch (error) {
      console.error(`彻底删除文件失败: ${error.message}`);
      throw error;
    }
  }

  // 根据内容ID检查文件是否存在
  async checkFileExistsByContent(knowledgeBaseId, contentId) {
    try {
      // 直接通过哈希值查询数据库
      const sql = `
        SELECT * FROM knowledge_files 
        WHERE knowledge_base_id = ? 
        AND content_hash = ? 
        AND status != 'deleted'
      `;
      
      const [rows] = await pool.query(sql, [knowledgeBaseId, contentId]);
      
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error(`检查文件是否存在失败: ${error.message}`);
      return null;
    }
  }
}

module.exports = new KnowledgeBaseService();