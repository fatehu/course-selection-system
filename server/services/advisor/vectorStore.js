const fs = require('fs-extra');
const path = require('path');

class EnhancedVectorStore {
  constructor(options = {}) {
    this.documents = [];
    this.embeddings = [];
    this.deletedDocuments = new Set(); // 记录已删除的文档ID
    this.fileDocumentMap = new Map(); // 新增：文件ID到文档ID的映射
    this.storePath = options.storePath || path.join(process.cwd(), 'data/vector-store.json');
  }
  
  // 计算余弦相似度
  cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (normA * normB);
  }
  
  // 添加文档到存储
  addDocument(document, embedding) {
    // 确保文档有唯一ID
    if (!document.id) {
      document.id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    this.documents.push(document);
    this.embeddings.push(embedding);
    
    // 更新文件ID到文档ID的映射
    if (document.metadata && document.metadata.fileId) {
      const fileId = String(document.metadata.fileId); // 统一转换为字符串
      if (!this.fileDocumentMap.has(fileId)) {
        this.fileDocumentMap.set(fileId, []);
      }
      this.fileDocumentMap.get(fileId).push(document.id);
    }
    
    return this.documents.length - 1;
  }
  
  // 批量添加文档
  addDocuments(documents, embeddings) {
    if (documents.length !== embeddings.length) {
      throw new Error("文档数量与嵌入数量不匹配");
    }
    
    // 首先检查是否有相同文件的旧文档需要删除
    if (documents.length > 0 && documents[0].metadata && documents[0].metadata.fileId) {
      const fileId = String(documents[0].metadata.fileId);
      console.log(`处理文件 ${fileId} 的文档，先删除旧文档（如果存在）`);
      this.removeDocumentsByFileId(fileId);
    }
    
    for (let i = 0; i < documents.length; i++) {
      if (embeddings[i]) {
        this.addDocument(documents[i], embeddings[i]);
      }
    }
    
    console.log(`添加了${documents.length}个文档到向量存储`);
  }
  
  // 根据文件ID删除文档（物理删除）
  removeDocumentsByFileId(fileId) {
    const fileIdStr = String(fileId);
    const documentIds = this.fileDocumentMap.get(fileIdStr) || [];
    
    if (documentIds.length === 0) {
      console.log(`没有找到文件 ${fileId} 的相关文档`);
      return 0;
    }
    
    const newDocuments = [];
    const newEmbeddings = [];
    let removedCount = 0;
    
    this.documents.forEach((doc, index) => {
      if (!documentIds.includes(doc.id)) {
        newDocuments.push(doc);
        newEmbeddings.push(this.embeddings[index]);
      } else {
        removedCount++;
      }
    });
    
    this.documents = newDocuments;
    this.embeddings = newEmbeddings;
    this.fileDocumentMap.delete(fileIdStr);
    
    console.log(`物理删除了${removedCount}个文档（文件ID: ${fileId}）`);
    return removedCount;
  }
  
  // 标记文档为已删除（软删除）
  markDocumentsAsDeleted(fileId) {
    let deletedCount = 0;
    const fileIdStr = String(fileId);
    const fileIdNum = parseInt(fileId);
    
    // 遍历所有文档，标记来自该文件的文档为已删除
    this.documents.forEach((doc, index) => {
      if (doc.metadata) {
        const docFileId = doc.metadata.fileId;
        // 比较各种可能的格式
        if (docFileId === fileId || 
            docFileId === fileIdStr || 
            docFileId === fileIdNum ||
            String(docFileId) === fileIdStr ||
            parseInt(docFileId) === fileIdNum) {
          this.deletedDocuments.add(doc.id);
          deletedCount++;
          console.log(`标记文档 ${doc.id} 为已删除 (fileId: ${docFileId})`);
        }
      }
    });
    
    console.log(`标记了${deletedCount}个来自文件${fileId}的文档为已删除`);
    return deletedCount;
  }
  
  // 物理删除已标记的文档
  purgeDeletedDocuments() {
    const newDocuments = [];
    const newEmbeddings = [];
    let purgedCount = 0;
    
    this.documents.forEach((doc, index) => {
      if (!this.deletedDocuments.has(doc.id)) {
        newDocuments.push(doc);
        newEmbeddings.push(this.embeddings[index]);
      } else {
        purgedCount++;
        // 从文件映射中移除
        if (doc.metadata && doc.metadata.fileId) {
          const fileIdStr = String(doc.metadata.fileId);
          const docIds = this.fileDocumentMap.get(fileIdStr) || [];
          const index = docIds.indexOf(doc.id);
          if (index > -1) {
            docIds.splice(index, 1);
            if (docIds.length === 0) {
              this.fileDocumentMap.delete(fileIdStr);
            }
          }
        }
      }
    });
    
    this.documents = newDocuments;
    this.embeddings = newEmbeddings;
    this.deletedDocuments.clear();
    
    console.log(`物理删除了${purgedCount}个文档`);
    return purgedCount;
  }
  
  // 相似度搜索（过滤已删除的文档）
  similaritySearch(queryEmbedding, k = 5) {
    if (this.embeddings.length === 0) {
      return [];
    }
    
    const similarities = [];
    
    this.embeddings.forEach((embedding, index) => {
      const doc = this.documents[index];
      // 跳过已删除的文档
      if (!this.deletedDocuments.has(doc.id)) {
        similarities.push({
          index,
          similarity: this.cosineSimilarity(queryEmbedding, embedding)
        });
      }
    });
    
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k)
      .map(result => ({
        document: this.documents[result.index],
        similarity: result.similarity
      }));
  }
  
  // 保存向量存储到文件
  save() {
    const data = {
      documents: this.documents,
      embeddings: this.embeddings,
      deletedDocuments: Array.from(this.deletedDocuments),
      fileDocumentMap: Array.from(this.fileDocumentMap.entries())
    };
    
    fs.ensureDirSync(path.dirname(this.storePath));
    fs.writeFileSync(this.storePath, JSON.stringify(data));
    console.log(`向量存储保存至: ${this.storePath}`);
  }
  
  // 从文件加载向量存储
  load() {
    if (!fs.existsSync(this.storePath)) {
      console.log(`向量存储文件不存在: ${this.storePath}`);
      return false;
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
      this.documents = data.documents || [];
      this.embeddings = data.embeddings || [];
      this.deletedDocuments = new Set(data.deletedDocuments || []);
      
      // 恢复文件映射
      if (data.fileDocumentMap) {
        this.fileDocumentMap = new Map(data.fileDocumentMap);
      } else {
        // 如果没有映射，从文档中重建
        this.rebuildFileDocumentMap();
      }
      
      console.log(`成功加载${this.documents.length}个文档和嵌入向量`);
      console.log(`其中${this.deletedDocuments.size}个文档被标记为已删除`);
      return true;
    } catch (error) {
      console.error("加载向量存储失败:", error);
      return false;
    }
  }
  
  // 重建文件到文档的映射
  rebuildFileDocumentMap() {
    this.fileDocumentMap.clear();
    this.documents.forEach(doc => {
      if (doc.metadata && doc.metadata.fileId) {
        const fileIdStr = String(doc.metadata.fileId);
        if (!this.fileDocumentMap.has(fileIdStr)) {
          this.fileDocumentMap.set(fileIdStr, []);
        }
        this.fileDocumentMap.get(fileIdStr).push(doc.id);
      }
    });
    console.log(`重建文件映射完成，共${this.fileDocumentMap.size}个文件`);
  }
  
  // 获取存储统计信息
  getStats() {
    const fileStats = new Map();
    this.documents.forEach(doc => {
      if (doc.metadata && doc.metadata.fileId) {
        const fileId = String(doc.metadata.fileId);
        fileStats.set(fileId, (fileStats.get(fileId) || 0) + 1);
      }
    });
    
    return {
      totalDocuments: this.documents.length,
      activeDocuments: this.documents.length - this.deletedDocuments.size,
      deletedDocuments: this.deletedDocuments.size,
      filesCount: this.fileDocumentMap.size,
      fileStats: Array.from(fileStats.entries())
    };
  }
}

module.exports = EnhancedVectorStore;