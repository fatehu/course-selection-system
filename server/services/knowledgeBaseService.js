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
    
    // Ensure upload directory exists
    fs.ensureDirSync(this.uploadsDir);
  }
  
  // Get vector store storage path for a knowledge base
  getVectorStorePath(knowledgeBaseId) {
    const storeDir = path.join(process.cwd(), 'data/vector_stores');
    fs.ensureDirSync(storeDir);
    return path.join(storeDir, `kb_${knowledgeBaseId}.json`);
  }
  
  // Get vector store for a knowledge base (using enhanced version)
  getVectorStore(knowledgeBaseId) {
    const storePath = this.getVectorStorePath(knowledgeBaseId);
    const vectorStore = new EnhancedVectorStore({ storePath });
    vectorStore.load(); // Try to load existing data
    return vectorStore;
  }
  
  // Create knowledge base
  async createKnowledgeBase(name, description, userId) {
    return await knowledgeBaseModel.createKnowledgeBase(name, description, userId);
  }
  
  // Get all knowledge bases
  async getAllKnowledgeBases() {
    return await knowledgeBaseModel.getKnowledgeBases();
  }
  
  // Get single knowledge base
  async getKnowledgeBase(id) {
    return await knowledgeBaseModel.getKnowledgeBase(id);
  }
  
  // Update knowledge base
  async updateKnowledgeBase(id, name, description) {
    return await knowledgeBaseModel.updateKnowledgeBase(id, name, description);
  }
  
  // Delete knowledge base
  async deleteKnowledgeBase(id) {
    try {
      // Get all files in the knowledge base
      const files = await knowledgeBaseModel.getKnowledgeBaseFiles(id);
      
      // Delete all physical files
      for (const file of files) {
        const filePath = path.join(this.uploadsDir, file.stored_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      
      // Delete knowledge base folder
      const kbDir = path.join(this.uploadsDir, `kb_${id}`);
      if (fs.existsSync(kbDir)) {
        fs.removeSync(kbDir);
      }
      
      // Delete vector store file
      const storePath = this.getVectorStorePath(id);
      if (fs.existsSync(storePath)) {
        fs.unlinkSync(storePath);
      }
      
      // Delete database records (cascade deletes all related file records)
      return await knowledgeBaseModel.deleteKnowledgeBase(id);
    } catch (error) {
      console.error(`Failed to delete knowledge base: ${error.message}`);
      throw error;
    }
  }
  
  // Get knowledge base files list
  async getKnowledgeBaseFiles(knowledgeBaseId) {
    return await knowledgeBaseModel.getKnowledgeBaseFiles(knowledgeBaseId);
  }
  
  // Save uploaded file
  async saveUploadedFile(knowledgeBaseId, file) {
    // Create knowledge base folder if it doesn't exist
    const kbDir = path.join(this.uploadsDir, `kb_${knowledgeBaseId}`);
    fs.ensureDirSync(kbDir);
    
    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = path.extname(file.originalname);
    const storedFilename = `${timestamp}_${path.basename(file.originalname, fileExtension)}${fileExtension}`;
    const storedPath = path.join(kbDir, storedFilename);
    
    // Save file
    fs.writeFileSync(storedPath, file.buffer);
    
    // Get file type
    const fileType = fileExtension.substring(1); // Remove dot
    
    // Save file record to database
    return await knowledgeBaseModel.addFile(
      knowledgeBaseId,
      file.originalname,
      `kb_${knowledgeBaseId}/${storedFilename}`,
      fileType,
      file.size
    );
  }
  
  // Process file and add to vector store
  async processFile(fileId) {
    // Get file info
    const fileInfo = await knowledgeBaseModel.getFile(fileId);
    if (!fileInfo) {
      throw new Error(`File not found: ID ${fileId}`);
    }
    
    try {
      // Update status to processing
      await knowledgeBaseModel.updateFileStatus(fileId, 'processing');
      
      // Full file path
      const filePath = path.join(this.uploadsDir, fileInfo.stored_path);
      
      // Process file and split into chunks
      const chunks = await this.documentProcessor.processFile(filePath);
      
      // Get vector store
      const vectorStore = this.getVectorStore(fileInfo.knowledge_base_id);
      
      // Generate embeddings
      const contentsOnly = chunks.map(chunk => chunk.content);
      const embeddings = await this.embeddingService.getBatchEmbeddings(contentsOnly);
      
      // Enhance chunks with file metadata and unique IDs
      const enhancedChunks = chunks.map((chunk, index) => ({
        ...chunk,
        id: `file_${fileInfo.id}_chunk_${index}`, // Add unique ID
        metadata: {
          ...chunk.metadata,
          fileId: fileInfo.id, // Ensure this is the numeric ID from database
          fileName: fileInfo.original_filename
        }
      }));
      
      // Add to vector store (this will automatically remove old documents from same file)
      vectorStore.addDocuments(enhancedChunks, embeddings);
      
      // Save vector store
      vectorStore.save();
      
      // Update file status to indexed
      await knowledgeBaseModel.updateFileStatus(fileId, 'indexed', chunks.length);
      
      console.log(`File processed successfully: ${fileInfo.original_filename}, created ${chunks.length} chunks`);
      return true;
    } catch (error) {
      console.error(`Failed to process file: ${error.message}`);
      await knowledgeBaseModel.updateFileStatus(fileId, 'failed');
      throw error;
    }
  }
  
  // Delete file (complete implementation)
  async deleteFile(fileId) {
    try {
      // Get file info
      const fileInfo = await knowledgeBaseModel.getFile(fileId);
      if (!fileInfo) {
        throw new Error(`File not found: ID ${fileId}`);
      }
      
      // Get vector store and mark documents as deleted
      const vectorStore = this.getVectorStore(fileInfo.knowledge_base_id);
      const deletedCount = vectorStore.markDocumentsAsDeleted(fileId);
      
      // Save updated vector store
      if (deletedCount > 0) {
        vectorStore.save();
        console.log(`Marked ${deletedCount} documents as deleted from vector store`);
      }
      
      // Delete physical file
      const filePath = path.join(this.uploadsDir, fileInfo.stored_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted physical file: ${filePath}`);
      }
      
      // Delete database record
      const success = await knowledgeBaseModel.deleteFile(fileId);
      
      console.log(`File deletion successful: ${fileInfo.original_filename}`);
      return success;
    } catch (error) {
      console.error(`Failed to delete file: ${error.message}`);
      throw error;
    }
  }
  
  // Rebuild knowledge base index (including cleanup of deleted documents)
  async rebuildKnowledgeBaseIndex(knowledgeBaseId) {
    try {
      console.log(`Starting rebuild of knowledge base ${knowledgeBaseId} index`);
      
      // Get all files in the knowledge base
      const files = await knowledgeBaseModel.getKnowledgeBaseFiles(knowledgeBaseId);
      
      // Delete existing vector store
      const storePath = this.getVectorStorePath(knowledgeBaseId);
      if (fs.existsSync(storePath)) {
        fs.unlinkSync(storePath);
        console.log(`Deleted old vector store: ${storePath}`);
      }
      
      // Create new vector store
      const vectorStore = this.getVectorStore(knowledgeBaseId);
      
      // Process each file
      let successCount = 0;
      let failCount = 0;
      
      for (const file of files) {
        // Reset file status
        await knowledgeBaseModel.updateFileStatus(file.id, 'pending', 0);
        
        // Reprocess file
        try {
          await this.processFile(file.id);
          successCount++;
        } catch (error) {
          console.error(`Failed to process file during rebuild: ${file.original_filename}`, error);
          failCount++;
          // Continue processing other files
        }
      }
      
      console.log(`Index rebuild complete: ${successCount} successful, ${failCount} failed`);
      return { success: successCount, failed: failCount };
    } catch (error) {
      console.error(`Failed to rebuild knowledge base index: ${error.message}`);
      throw error;
    }
  }
  
  // Search knowledge base (automatically filters deleted documents)
  async searchKnowledgeBase(knowledgeBaseId, query, topK = 5) {
    try {
      // Get vector store
      const vectorStore = this.getVectorStore(knowledgeBaseId);
      
      // Get statistics
      const stats = vectorStore.getStats();
      console.log(`Searching knowledge base ${knowledgeBaseId}: ${stats.activeDocuments} active documents, ${stats.deletedDocuments} deleted documents`);
      
      // Generate embedding for query
      const queryEmbedding = await this.embeddingService.getEmbedding(query);
      
      // Search for related documents (automatically filters deleted ones)
      const results = vectorStore.similaritySearch(queryEmbedding, topK);
      
      console.log(`Found ${results.length} related documents`);
      return results;
    } catch (error) {
      console.error(`Failed to search knowledge base: ${error.message}`);
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

  // Clean up knowledge base (physically delete all documents marked as deleted)
  async cleanupKnowledgeBase(knowledgeBaseId) {
    try {
      const vectorStore = this.getVectorStore(knowledgeBaseId);
      const purgedCount = vectorStore.purgeDeletedDocuments();
      
      if (purgedCount > 0) {
        vectorStore.save();
        console.log(`Cleaned up knowledge base ${knowledgeBaseId}: physically deleted ${purgedCount} documents`);
      }
      
      return purgedCount;
    } catch (error) {
      console.error(`Failed to clean up knowledge base: ${error.message}`);
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
      console.log(`找到${deletedFiles.length}个已删除文件需要清理`);
      
      // 获取向量存储
      const vectorStore = this.getVectorStore(knowledgeBaseId);
      
      // 彻底删除已标记为删除的文档
      const purgedCount = vectorStore.purgeDeletedDocuments();
      console.log(`从向量存储中删除了${purgedCount}个文档`);
      vectorStore.save();
      
      // 删除物理文件、chunk文件和数据库记录
      let deletedCount = 0;
      for (const file of deletedFiles) {
        try {
          // 1. 处理原始文件
          const filePath = path.join(this.uploadsDir, file.stored_path);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`删除了原始文件: ${filePath}`);
          }
          
          // 2. 处理chunk文件目录
          const fileDir = path.dirname(filePath);
          const fileName = path.basename(filePath);
          const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));
          
          // 查找可能的chunk目录命名模式
          const possibleChunkDirs = [
            path.join(fileDir, `${fileNameWithoutExt}_chunks`),
            path.join(fileDir, `${file.id}_chunks`),
            path.join(fileDir, `file_${file.id}_chunks`)
          ];
          
          // 检查并删除chunk目录
          for (const chunkDir of possibleChunkDirs) {
            if (fs.existsSync(chunkDir) && fs.statSync(chunkDir).isDirectory()) {
              console.log(`找到chunk目录: ${chunkDir}`);
              
              // 删除目录中的所有文件
              const chunkFiles = fs.readdirSync(chunkDir);
              console.log(`该目录包含${chunkFiles.length}个chunk文件`);
              
              for (const chunkFile of chunkFiles) {
                fs.unlinkSync(path.join(chunkDir, chunkFile));
              }
              
              // 删除空目录
              fs.rmdirSync(chunkDir);
              console.log(`成功删除chunk目录及其所有文件`);
              break; // 找到并处理一个目录后退出
            }
          }
          
          // 3. 从数据库中删除记录
          await knowledgeBaseModel.deleteFile(file.id);
          console.log(`从数据库中删除记录: ID ${file.id}`);
          
          deletedCount++;
        } catch (error) {
          console.error(`处理文件删除失败 ID:${file.id}`, error);
          // 继续处理其他文件
        }
      }
      
      console.log(`总共删除了${deletedCount}个文件及其相关资源`);
      return deletedCount;
    } catch (error) {
      console.error(`彻底删除文件失败: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new KnowledgeBaseService();