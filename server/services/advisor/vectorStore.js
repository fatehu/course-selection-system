// server/services/advisor/vectorStore.js
const fs = require('fs');
const path = require('path');
const { generateEmbedding } = require('./embeddingService');

class SimpleVectorStore {
  constructor() {
    this.documents = []; // 存储文档内容
    this.embeddings = []; // 存储对应的嵌入向量
  }
  
  // 添加文档和对应的嵌入向量
  async addDocument(document, embedding) {
    this.documents.push(document);
    this.embeddings.push(embedding);
    return this.documents.length - 1; // 返回文档ID
  }
  
  // 批量添加文档
  async addDocuments(documents) {
    console.log(`正在为${documents.length}个文档生成嵌入向量...`);
    
    for (let i = 0; i < documents.length; i++) {
      // 每添加10个文档记录一次进度
      if (i % 10 === 0) {
        console.log(`进度: ${i}/${documents.length}`);
      }
      
      const embedding = await generateEmbedding(documents[i]);
      await this.addDocument(documents[i], embedding);
    }
    
    console.log(`成功添加${documents.length}个文档到向量存储`);
  }
  
  // 计算两个向量的余弦相似度
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
  
  // 相似度搜索
  async similaritySearch(query, k = 5) {
    // 为查询生成嵌入向量
    const queryEmbedding = await generateEmbedding(query);
    
    // 计算所有文档与查询的相似度
    const similarities = this.embeddings.map((embedding, index) => ({
      documentIndex: index,
      similarity: this.cosineSimilarity(queryEmbedding, embedding)
    }));
    
    // 按相似度降序排序并取前k个
    const topResults = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
    
    // 返回相关文档
    return topResults.map(result => ({
      pageContent: this.documents[result.documentIndex],
      similarity: result.similarity
    }));
  }
  
  // 保存向量存储到文件
  async save(filePath) {
    const data = {
      documents: this.documents,
      embeddings: this.embeddings
    };
    
    fs.writeFileSync(filePath, JSON.stringify(data));
    console.log(`向量存储已保存到: ${filePath}`);
  }
  
  // 从文件加载向量存储
  async load(filePath) {
    if (!fs.existsSync(filePath)) {
      console.warn(`文件不存在: ${filePath}`);
      return false;
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      this.documents = data.documents;
      this.embeddings = data.embeddings;
      console.log(`从文件加载了${this.documents.length}个文档和向量`);
      return true;
    } catch (error) {
      console.error(`加载向量存储失败: ${error.message}`);
      return false;
    }
  }
}

module.exports = {
  SimpleVectorStore
};