/**
 * 混合向量存储实现
 * 结合LSH粗筛和聚类精确搜索，实现log级别的搜索性能
 * 完全替代原有的EnhancedVectorStore，保持API兼容性
 */
const fs = require('fs-extra');
const path = require('path');
const LSHIndex = require('./lshIndex');
const ClusterIndex = require('./clusterIndex');

class HybridVectorStore {
  constructor(options = {}) {
    this.storePath = options.storePath || path.join(process.cwd(), 'data/vector-store.json');
    
    // 核心索引组件
    this.lshIndex = new LSHIndex(1024, 16, 8); // 16个哈希表，8个哈希函数
    this.clusterIndex = new ClusterIndex({ numClusters: 128 });
    
    // 数据存储
    this.documents = [];
    this.embeddings = [];
    this.documentMap = new Map(); // id -> index 映射
    this.deletedDocuments = new Set(); // 软删除的文档ID
    this.fileDocumentMap = new Map(); // fileId -> documentIds[]
    
    // 性能配置
    this.lshThreshold = 0.1; // LSH候选筛选阈值
    this.enableLSH = true; // 是否启用LSH加速
    this.enableClustering = true; // 是否启用聚类
    this.autoRebuildThreshold = 1000; // 自动重建索引的文档数阈值
    this.rebuildCounter = 0;
    
    // 性能统计
    this.searchStats = {
      totalSearches: 0,
      lshCandidates: 0,
      avgCandidates: 0,
      searchTime: 0
    };
    
    console.log('HybridVectorStore 初始化完成');
  }
  
  /**
   * 计算余弦相似度
   */
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
  
  /**
   * 添加单个文档到存储
   */
  addDocument(document, embedding) {
    // 确保文档有唯一ID
    if (!document.id) {
      document.id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    const index = this.documents.length;
    this.documents.push(document);
    this.embeddings.push(embedding);
    this.documentMap.set(document.id, index);
    
    // 更新文件ID映射
    if (document.metadata && document.metadata.fileId) {
      const fileId = String(document.metadata.fileId);
      if (!this.fileDocumentMap.has(fileId)) {
        this.fileDocumentMap.set(fileId, []);
      }
      this.fileDocumentMap.get(fileId).push(document.id);
    }
    
    // 在线更新索引
    this.updateIndicesOnline(document, embedding);
    
    this.rebuildCounter++;
    console.log(`添加文档: ${document.id}, 当前总数: ${this.documents.length}`);
    
    return index;
  }
  
  /**
   * 批量添加文档
   */
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
    
    // 批量添加新文档
    const startIndex = this.documents.length;
    for (let i = 0; i < documents.length; i++) {
      if (embeddings[i]) {
        this.addDocument(documents[i], embeddings[i]);
      }
    }
    
    // 批量操作后重建索引（如果文档数量大于阈值）
    if (documents.length > 50 || this.rebuildCounter > this.autoRebuildThreshold) {
      this.rebuildIndices();
    }
    
    console.log(`批量添加了${documents.length}个文档到向量存储`);
  }
  
  /**
   * 在线更新索引
   */
  updateIndicesOnline(document, embedding) {
    // 更新LSH索引
    if (this.enableLSH) {
      this.lshIndex.addVector(embedding, document.id);
    }
    
    // 更新聚类索引
    if (this.enableClustering) {
      this.clusterIndex.addDocument(document, embedding);
    }
  }
  
  /**
   * 重建所有索引
   */
  rebuildIndices() {
    console.log('开始重建混合索引...');
    const startTime = Date.now();
    
    // 获取活跃文档
    const activeDocuments = [];
    const activeEmbeddings = [];
    
    for (let i = 0; i < this.documents.length; i++) {
      if (!this.deletedDocuments.has(this.documents[i].id)) {
        activeDocuments.push(this.documents[i]);
        activeEmbeddings.push(this.embeddings[i]);
      }
    }
    
    // 重建LSH索引
    if (this.enableLSH) {
      this.lshIndex = new LSHIndex(1024, 16, 8);
      for (let i = 0; i < activeDocuments.length; i++) {
        this.lshIndex.addVector(activeEmbeddings[i], activeDocuments[i].id);
      }
      console.log('LSH索引重建完成');
    }
    
    // 重建聚类索引
    if (this.enableClustering && activeDocuments.length > 0) {
      this.clusterIndex = new ClusterIndex({ numClusters: Math.min(128, Math.ceil(activeDocuments.length / 10)) });
      this.clusterIndex.performClustering(activeDocuments, activeEmbeddings);
      console.log('聚类索引重建完成');
    }
    
    this.rebuildCounter = 0;
    const rebuildTime = Date.now() - startTime;
    console.log(`索引重建完成，耗时: ${rebuildTime}ms, 活跃文档: ${activeDocuments.length}`);
  }
  
  /**
   * 根据文件ID删除文档（物理删除）
   */
  removeDocumentsByFileId(fileId) {
    const fileIdStr = String(fileId);
    const documentIds = this.fileDocumentMap.get(fileIdStr) || [];
    
    if (documentIds.length === 0) {
      console.log(`没有找到文件 ${fileId} 的相关文档`);
      return 0;
    }
    
    const newDocuments = [];
    const newEmbeddings = [];
    const newDocumentMap = new Map();
    let removedCount = 0;
    
    for (let i = 0; i < this.documents.length; i++) {
      const doc = this.documents[i];
      if (!documentIds.includes(doc.id)) {
        const newIndex = newDocuments.length;
        newDocuments.push(doc);
        newEmbeddings.push(this.embeddings[i]);
        newDocumentMap.set(doc.id, newIndex);
      } else {
        // 从LSH索引中移除
        if (this.enableLSH) {
          this.lshIndex.removeVector(doc.id);
        }
        // 从聚类索引中移除
        if (this.enableClustering) {
          this.clusterIndex.removeDocument(doc.id);
        }
        removedCount++;
      }
    }
    
    this.documents = newDocuments;
    this.embeddings = newEmbeddings;
    this.documentMap = newDocumentMap;
    this.fileDocumentMap.delete(fileIdStr);
    
    console.log(`物理删除了${removedCount}个文档（文件ID: ${fileId}）`);
    return removedCount;
  }
  
  /**
   * 标记文档为已删除（软删除）
   */
  markDocumentsAsDeleted(fileId) {
    let deletedCount = 0;
    const fileIdStr = String(fileId);
    const fileIdNum = parseInt(fileId);
    
    for (const doc of this.documents) {
      if (doc.metadata) {
        const docFileId = doc.metadata.fileId;
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
    }
    
    console.log(`标记了${deletedCount}个来自文件${fileId}的文档为已删除`);
    return deletedCount;
  }
  
  /**
   * 物理删除已标记的文档
   */
  purgeDeletedDocuments() {
    const newDocuments = [];
    const newEmbeddings = [];
    const newDocumentMap = new Map();
    let purgedCount = 0;
    
    for (let i = 0; i < this.documents.length; i++) {
      const doc = this.documents[i];
      if (!this.deletedDocuments.has(doc.id)) {
        const newIndex = newDocuments.length;
        newDocuments.push(doc);
        newEmbeddings.push(this.embeddings[i]);
        newDocumentMap.set(doc.id, newIndex);
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
    }
    
    this.documents = newDocuments;
    this.embeddings = newEmbeddings;
    this.documentMap = newDocumentMap;
    this.deletedDocuments.clear();
    
    // 重建索引
    this.rebuildIndices();
    
    console.log(`物理删除了${purgedCount}个文档`);
    return purgedCount;
  }
  
  /**
   * 混合相似度搜索（核心算法）
   */
  similaritySearch(queryEmbedding, k = 5) {
    const startTime = Date.now();
    
    if (this.embeddings.length === 0) {
      return [];
    }
    
    this.searchStats.totalSearches++;
    
    let candidateIndices = [];
    
    // 第一阶段：LSH粗筛 (O(1))
    if (this.enableLSH && this.documents.length > 100) {
      const candidateIds = this.lshIndex.getCandidates(queryEmbedding);
      candidateIndices = candidateIds
        .map(id => this.documentMap.get(id))
        .filter(index => index !== undefined && !this.deletedDocuments.has(this.documents[index].id));
      
      this.searchStats.lshCandidates += candidateIndices.length;
      
      console.log(`LSH筛选出 ${candidateIndices.length} 个候选文档`);
      
      // 如果候选太少，回退到全搜索
      if (candidateIndices.length < k * 2) {
        candidateIndices = [];
        for (let i = 0; i < this.documents.length; i++) {
          if (!this.deletedDocuments.has(this.documents[i].id)) {
            candidateIndices.push(i);
          }
        }
        console.log('LSH候选数量不足，回退到全搜索');
      }
    } else {
      // 全搜索模式
      for (let i = 0; i < this.documents.length; i++) {
        if (!this.deletedDocuments.has(this.documents[i].id)) {
          candidateIndices.push(i);
        }
      }
    }
    
    // 第二阶段：聚类精确搜索 (O(log m))
    let results = [];
    
    if (this.enableClustering && this.clusterIndex.clusterCenters.length > 0) {
      // 找到最相关的聚类
      const topClusters = this.findTopClusters(queryEmbedding, Math.min(3, this.clusterIndex.clusterCenters.length));
      
      for (const clusterId of topClusters) {
        const clusterResults = this.clusterIndex.searchInCluster(clusterId, queryEmbedding, k * 2);
        results.push(...clusterResults);
      }
      
      console.log(`聚类搜索返回 ${results.length} 个结果`);
    } else {
      // 传统相似度搜索
      const similarities = [];
      
      for (const index of candidateIndices) {
        const similarity = this.cosineSimilarity(queryEmbedding, this.embeddings[index]);
        similarities.push({
          index,
          similarity: similarity,
          document: this.documents[index]
        });
      }
      
      results = similarities.map(item => ({
        document: item.document,
        similarity: item.similarity
      }));
    }
    
    // 全局排序并返回top-k
    const finalResults = results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
    
    const searchTime = Date.now() - startTime;
    this.searchStats.searchTime += searchTime;
    this.searchStats.avgCandidates = this.searchStats.lshCandidates / this.searchStats.totalSearches;
    
    console.log(`混合搜索完成，耗时: ${searchTime}ms, 返回 ${finalResults.length} 个结果`);
    
    return finalResults;
  }
  
  /**
   * 查找最相关的聚类
   */
  findTopClusters(queryEmbedding, topK) {
    const clusterSimilarities = [];
    
    for (let i = 0; i < this.clusterIndex.clusterCenters.length; i++) {
      const similarity = this.cosineSimilarity(queryEmbedding, this.clusterIndex.clusterCenters[i]);
      clusterSimilarities.push({ clusterId: i, similarity });
    }
    
    return clusterSimilarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .map(item => item.clusterId);
  }
  
  /**
   * 恢复文档（从已删除集合中移除）
   */
  restoreDocuments(fileId) {
    let restoredCount = 0;
    const fileIdStr = String(fileId);
    const fileIdNum = parseInt(fileId);
    
    for (const doc of this.documents) {
      if (doc.metadata && doc.metadata.fileId) {
        const docFileId = doc.metadata.fileId;
        if ((docFileId === fileId || 
            docFileId === fileIdStr || 
            docFileId === fileIdNum ||
            String(docFileId) === fileIdStr ||
            parseInt(docFileId) === fileIdNum) && 
            this.deletedDocuments.has(doc.id)) {
          this.deletedDocuments.delete(doc.id);
          restoredCount++;
          console.log(`恢复文档 ${doc.id} (fileId: ${docFileId})`);
        }
      }
    }
    
    console.log(`恢复了${restoredCount}个来自文件${fileId}的文档`);
    return restoredCount;
  }
  
  /**
   * 保存向量存储到文件
   */
  save() {
    const data = {
      version: '2.0.0', // 标识为混合索引版本
      documents: this.documents,
      embeddings: this.embeddings,
      deletedDocuments: Array.from(this.deletedDocuments),
      fileDocumentMap: Array.from(this.fileDocumentMap.entries()),
      lshIndex: this.enableLSH ? this.lshIndex.toJSON() : null,
      clusterIndex: this.enableClustering ? this.clusterIndex.toJSON() : null,
      config: {
        enableLSH: this.enableLSH,
        enableClustering: this.enableClustering,
        autoRebuildThreshold: this.autoRebuildThreshold
      },
      stats: this.searchStats,
      savedAt: new Date().toISOString()
    };
    
    fs.ensureDirSync(path.dirname(this.storePath));
    fs.writeFileSync(this.storePath, JSON.stringify(data));
    console.log(`混合向量存储保存至: ${this.storePath}`);
  }
  
  /**
   * 从文件加载向量存储
   */
  load() {
    if (!fs.existsSync(this.storePath)) {
      console.log(`向量存储文件不存在: ${this.storePath}`);
      return false;
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
      
      // 加载基础数据
      this.documents = data.documents || [];
      this.embeddings = data.embeddings || [];
      this.deletedDocuments = new Set(data.deletedDocuments || []);
      
      // 重建映射
      this.documentMap.clear();
      for (let i = 0; i < this.documents.length; i++) {
        this.documentMap.set(this.documents[i].id, i);
      }
      
      // 恢复文件映射
      if (data.fileDocumentMap) {
        this.fileDocumentMap = new Map(data.fileDocumentMap);
      } else {
        this.rebuildFileDocumentMap();
      }
      
      // 加载配置
      if (data.config) {
        this.enableLSH = data.config.enableLSH !== false;
        this.enableClustering = data.config.enableClustering !== false;
        this.autoRebuildThreshold = data.config.autoRebuildThreshold || 1000;
      }
      
      // 加载统计信息
      if (data.stats) {
        this.searchStats = { ...this.searchStats, ...data.stats };
      }
      
      // 加载或重建索引
      if (data.version === '2.0.0') {
        // 加载混合索引
        if (data.lshIndex && this.enableLSH) {
          this.lshIndex = LSHIndex.fromJSON(data.lshIndex);
          console.log('LSH索引加载完成');
        }
        
        if (data.clusterIndex && this.enableClustering) {
          this.clusterIndex = ClusterIndex.fromJSON(data.clusterIndex);
          console.log('聚类索引加载完成');
        }
      } else {
        // 从旧版本迁移，重建索引
        console.log('检测到旧版本数据，重建混合索引...');
        this.rebuildIndices();
      }
      
      console.log(`成功加载${this.documents.length}个文档和嵌入向量`);
      console.log(`其中${this.deletedDocuments.size}个文档被标记为已删除`);
      
      return true;
    } catch (error) {
      console.error("加载向量存储失败:", error);
      return false;
    }
  }
  
  /**
   * 重建文件到文档的映射
   */
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
  
  /**
   * 获取存储统计信息
   */
  getStats() {
    const fileStats = new Map();
    this.documents.forEach(doc => {
      if (doc.metadata && doc.metadata.fileId) {
        const fileId = String(doc.metadata.fileId);
        fileStats.set(fileId, (fileStats.get(fileId) || 0) + 1);
      }
    });
    
    const lshStats = this.enableLSH ? this.lshIndex.getStats() : {};
    const clusterStats = this.enableClustering ? this.clusterIndex.getClustersStats() : {};
    
    return {
      version: '2.0.0',
      totalDocuments: this.documents.length,
      activeDocuments: this.documents.length - this.deletedDocuments.size,
      deletedDocuments: this.deletedDocuments.size,
      filesCount: this.fileDocumentMap.size,
      fileStats: Array.from(fileStats.entries()),
      searchStats: this.searchStats,
      lshStats,
      clusterStats,
      config: {
        enableLSH: this.enableLSH,
        enableClustering: this.enableClustering,
        autoRebuildThreshold: this.autoRebuildThreshold
      }
    };
  }
  
  /**
   * 性能调优方法
   */
  tune() {
    const stats = this.getStats();
    console.log('开始性能调优...');
    
    // 根据文档数量调整参数
    if (stats.activeDocuments > 10000) {
      this.lshIndex = new LSHIndex(1024, 64, 20); // 增加哈希表数量
      this.autoRebuildThreshold = 2000;
    } else if (stats.activeDocuments < 1000) {
      this.enableLSH = false; // 小数据集不需要LSH
    }
    
    // 重建索引
    this.rebuildIndices();
    
    console.log('性能调优完成');
  }
}

module.exports = HybridVectorStore;