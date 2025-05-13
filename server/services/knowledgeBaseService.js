const path = require('path');
const fs = require('fs-extra');
const knowledgeBaseModel = require('../models/knowledgeBaseModel');
const DocumentProcessor = require('./advisor/documentProcessor');
const EmbeddingService = require('./advisor/embeddingService');
const VectorStore = require('./advisor/vectorStore');

class KnowledgeBaseService {
  constructor() {
    this.documentProcessor = new DocumentProcessor();
    this.embeddingService = new EmbeddingService();
    this.uploadsDir = path.join(process.cwd(), 'uploads/knowledge_base');
    
    // 确保上传目录存在
    fs.ensureDirSync(this.uploadsDir);
  }
  
  // 为知识库创建vector store存储路径
  getVectorStorePath(knowledgeBaseId) {
    const storeDir = path.join(process.cwd(), 'data/vector_stores');
    fs.ensureDirSync(storeDir);
    return path.join(storeDir, `kb_${knowledgeBaseId}.json`);
  }
  
  // 获取知识库的向量存储
  getVectorStore(knowledgeBaseId) {
    const storePath = this.getVectorStorePath(knowledgeBaseId);
    const vectorStore = new VectorStore({ storePath });
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
    // 删除向量存储文件
    const storePath = this.getVectorStorePath(id);
    if (fs.existsSync(storePath)) {
      fs.unlinkSync(storePath);
    }
    
    // 删除数据库记录
    return await knowledgeBaseModel.deleteKnowledgeBase(id);
  }
  
  // 获取知识库文件列表
  async getKnowledgeBaseFiles(knowledgeBaseId) {
    return await knowledgeBaseModel.getKnowledgeBaseFiles(knowledgeBaseId);
  }
  
  // 保存上传的文件
  async saveUploadedFile(knowledgeBaseId, file) {
    // 创建知识库文件夹（如果不存在）
    const kbDir = path.join(this.uploadsDir, `kb_${knowledgeBaseId}`);
    fs.ensureDirSync(kbDir);
    
    // 生成唯一文件名
    const timestamp = Date.now();
    const fileExtension = path.extname(file.originalname);
    const storedFilename = `${timestamp}_${path.basename(file.originalname, fileExtension)}${fileExtension}`;
    const storedPath = path.join(kbDir, storedFilename);
    
    // 移动文件
    fs.writeFileSync(storedPath, file.buffer);
    
    // 获取文件类型
    const fileType = fileExtension.substring(1); // 移除点号
    
    // 保存文件记录到数据库
    return await knowledgeBaseModel.addFile(
      knowledgeBaseId,
      file.originalname,
      `kb_${knowledgeBaseId}/${storedFilename}`,
      fileType,
      file.size
    );
  }
  
  // 处理文件并添加到向量存储
  async processFile(fileId) {
    // 获取文件信息
    const fileInfo = await knowledgeBaseModel.getFile(fileId);
    if (!fileInfo) {
      throw new Error(`文件不存在: ID ${fileId}`);
    }
    
    try {
      // 更新状态为处理中
      await knowledgeBaseModel.updateFileStatus(fileId, 'processing');
      
      // 文件完整路径
      const filePath = path.join(this.uploadsDir, fileInfo.stored_path);
      
      // 处理文件并分块
      const chunks = await this.documentProcessor.processFile(filePath);
      
      // 创建向量存储
      const vectorStore = this.getVectorStore(fileInfo.knowledge_base_id);
      
      // 生成嵌入向量
      const contentsOnly = chunks.map(chunk => chunk.content);
      const embeddings = await this.embeddingService.getBatchEmbeddings(contentsOnly);
      
      // 为每个文档添加文件来源信息
      const enhancedChunks = chunks.map((chunk, index) => ({
        ...chunk,
        metadata: {
          ...chunk.metadata,
          fileId: fileInfo.id,
          fileName: fileInfo.original_filename
        }
      }));
      
      // 添加到向量存储
      vectorStore.addDocuments(enhancedChunks, embeddings);
      
      // 保存向量存储
      vectorStore.save();
      
      // 更新文件状态为已索引
      await knowledgeBaseModel.updateFileStatus(fileId, 'indexed', chunks.length);
      
      return true;
    } catch (error) {
      console.error(`处理文件失败: ${error.message}`);
      await knowledgeBaseModel.updateFileStatus(fileId, 'failed');
      throw error;
    }
  }
  
  // 删除文件
  async deleteFile(fileId) {
    // 获取文件信息
    const fileInfo = await knowledgeBaseModel.getFile(fileId);
    if (!fileInfo) {
      throw new Error(`文件不存在: ID ${fileId}`);
    }
    
    // 物理文件路径
    const filePath = path.join(this.uploadsDir, fileInfo.stored_path);
    
    // 如果文件存在，则删除
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // 删除数据库记录
    return await knowledgeBaseModel.deleteFile(fileId);
    
    // 注意：这里并没有从向量存储中删除该文件的向量
    // 要实现完整的删除，需要重新构建整个知识库的向量存储
  }
  
  // 重建知识库索引
  async rebuildKnowledgeBaseIndex(knowledgeBaseId) {
    // 获取知识库所有文件
    const files = await knowledgeBaseModel.getKnowledgeBaseFiles(knowledgeBaseId);
    
    // 删除现有向量存储
    const storePath = this.getVectorStorePath(knowledgeBaseId);
    if (fs.existsSync(storePath)) {
      fs.unlinkSync(storePath);
    }
    
    // 创建新的向量存储
    const vectorStore = this.getVectorStore(knowledgeBaseId);
    
    // 处理每一个文件
    for (const file of files) {
      // 重置文件状态
      await knowledgeBaseModel.updateFileStatus(file.id, 'pending', 0);
      
      // 重新处理文件
      try {
        await this.processFile(file.id);
      } catch (error) {
        console.error(`重建索引时处理文件失败: ${file.original_filename}`, error);
        // 继续处理其他文件
      }
    }
    
    return true;
  }
  
  // 搜索知识库
  async searchKnowledgeBase(knowledgeBaseId, query, topK = 5) {
    // 获取向量存储
    const vectorStore = this.getVectorStore(knowledgeBaseId);
    
    // 为查询生成嵌入向量
    const queryEmbedding = await this.embeddingService.getEmbedding(query);
    
    // 搜索相关文档
    return vectorStore.similaritySearch(queryEmbedding, topK);
  }
}

module.exports = new KnowledgeBaseService();