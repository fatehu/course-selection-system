const fs = require('fs-extra');
const path = require('path');

class VectorStore {
  constructor(options = {}) {
    this.documents = [];
    this.embeddings = [];
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
    this.documents.push(document);
    this.embeddings.push(embedding);
    return this.documents.length - 1; // 返回文档索引
  }
  
  // 批量添加文档
  addDocuments(documents, embeddings) {
    if (documents.length !== embeddings.length) {
      throw new Error("文档数量与嵌入数量不匹配");
    }
    
    for (let i = 0; i < documents.length; i++) {
      if (embeddings[i]) { // 跳过null嵌入（处理失败的）
        this.addDocument(documents[i], embeddings[i]);
      }
    }
    
    console.log(`添加了${documents.length}个文档到向量存储`);
  }
  
  // 相似度搜索
  similaritySearch(queryEmbedding, k = 5) {
    if (this.embeddings.length === 0) {
      return [];
    }
    
    // 计算查询与所有文档的相似度
    const similarities = this.embeddings.map((embedding, index) => ({
      index,
      similarity: this.cosineSimilarity(queryEmbedding, embedding)
    }));
    
    // 排序并获取前k个结果
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
      embeddings: this.embeddings
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
      this.documents = data.documents;
      this.embeddings = data.embeddings;
      console.log(`成功加载${this.documents.length}个文档和嵌入向量`);
      return true;
    } catch (error) {
      console.error("加载向量存储失败:", error);
      return false;
    }
  }
}

module.exports = VectorStore;