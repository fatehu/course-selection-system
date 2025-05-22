/**
 * 聚类索引实现
 * 用于第二阶段精确搜索的K-means聚类管理
 */

class ClusterIndex {
  constructor(options = {}) {
    this.numClusters = options.numClusters || 128;
    this.maxIterations = options.maxIterations || 50;
    this.tolerance = options.tolerance || 1e-6;
    this.clusterCenters = [];
    this.clusterAssignments = new Map(); // documentId -> clusterId
    this.clusters = new Map(); // clusterId -> {documents: [], embeddings: []}
    this.dimensions = null;
  }
  
  /**
   * 初始化聚类中心 (K-means++)
   */
  initializeCenters(embeddings) {
    if (embeddings.length === 0) return;
    
    this.dimensions = embeddings[0].length;
    this.clusterCenters = [];
    
    // 第一个中心：随机选择
    const firstIndex = Math.floor(Math.random() * embeddings.length);
    this.clusterCenters.push([...embeddings[firstIndex]]);
    
    // 后续中心：K-means++ 算法
    for (let i = 1; i < Math.min(this.numClusters, embeddings.length); i++) {
      const distances = embeddings.map(embedding => {
        return Math.min(...this.clusterCenters.map(center => 
          this.euclideanDistance(embedding, center)
        ));
      });
      
      // 按距离加权随机选择
      const weights = distances.map(d => d * d);
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);
      const threshold = Math.random() * totalWeight;
      
      let weightSum = 0;
      for (let j = 0; j < weights.length; j++) {
        weightSum += weights[j];
        if (weightSum >= threshold) {
          this.clusterCenters.push([...embeddings[j]]);
          break;
        }
      }
    }
    
    console.log(`初始化了 ${this.clusterCenters.length} 个聚类中心`);
  }
  
  /**
   * 执行K-means聚类
   */
  performClustering(documents, embeddings) {
    if (embeddings.length === 0) return;
    
    // 初始化聚类中心
    this.initializeCenters(embeddings);
    
    let converged = false;
    let iteration = 0;
    
    while (!converged && iteration < this.maxIterations) {
      const previousCenters = this.clusterCenters.map(center => [...center]);
      
      // 清空聚类分配
      this.clusters.clear();
      this.clusterAssignments.clear();
      
      // 分配文档到最近的聚类
      for (let i = 0; i < documents.length; i++) {
        const closestCluster = this.findClosestCluster(embeddings[i]);
        this.assignToCluster(documents[i], embeddings[i], closestCluster);
      }
      
      // 更新聚类中心
      this.updateClusterCenters();
      
      // 检查收敛性
      converged = this.checkConvergence(previousCenters);
      iteration++;
    }
    
    console.log(`聚类完成，迭代 ${iteration} 次${converged ? '收敛' : '达到最大迭代次数'}`);
    return this.getClustersStats();
  }
  
  /**
   * 查找最近的聚类中心
   */
  findClosestCluster(embedding) {
    let minDistance = Infinity;
    let closestCluster = 0;
    
    for (let i = 0; i < this.clusterCenters.length; i++) {
      const distance = this.euclideanDistance(embedding, this.clusterCenters[i]);
      if (distance < minDistance) {
        minDistance = distance;
        closestCluster = i;
      }
    }
    
    return closestCluster;
  }
  
  /**
   * 将文档分配到聚类
   */
  assignToCluster(document, embedding, clusterId) {
    this.clusterAssignments.set(document.id, clusterId);
    
    if (!this.clusters.has(clusterId)) {
      this.clusters.set(clusterId, {
        documents: [],
        embeddings: []
      });
    }
    
    this.clusters.get(clusterId).documents.push(document);
    this.clusters.get(clusterId).embeddings.push(embedding);
  }
  
  /**
   * 更新聚类中心
   */
  updateClusterCenters() {
    for (let clusterId = 0; clusterId < this.clusterCenters.length; clusterId++) {
      if (this.clusters.has(clusterId)) {
        const clusterEmbeddings = this.clusters.get(clusterId).embeddings;
        if (clusterEmbeddings.length > 0) {
          const newCenter = this.calculateCentroid(clusterEmbeddings);
          this.clusterCenters[clusterId] = newCenter;
        }
      }
    }
  }
  
  /**
   * 计算向量质心
   */
  calculateCentroid(embeddings) {
    const dimensions = embeddings[0].length;
    const centroid = new Array(dimensions).fill(0);
    
    for (const embedding of embeddings) {
      for (let i = 0; i < dimensions; i++) {
        centroid[i] += embedding[i];
      }
    }
    
    for (let i = 0; i < dimensions; i++) {
      centroid[i] /= embeddings.length;
    }
    
    return centroid;
  }
  
  /**
   * 检查收敛性
   */
  checkConvergence(previousCenters) {
    for (let i = 0; i < this.clusterCenters.length; i++) {
      const distance = this.euclideanDistance(
        this.clusterCenters[i], 
        previousCenters[i]
      );
      if (distance > this.tolerance) {
        return false;
      }
    }
    return true;
  }
  
  /**
   * 欧几里得距离计算
   */
  euclideanDistance(vecA, vecB) {
    let sum = 0;
    for (let i = 0; i < vecA.length; i++) {
      const diff = vecA[i] - vecB[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }
  
  /**
   * 余弦相似度计算
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
   * 在聚类内搜索
   */
  searchInCluster(clusterId, queryEmbedding, k) {
    if (!this.clusters.has(clusterId)) {
      return [];
    }
    
    const cluster = this.clusters.get(clusterId);
    const similarities = [];
    
    for (let i = 0; i < cluster.documents.length; i++) {
      const similarity = this.cosineSimilarity(queryEmbedding, cluster.embeddings[i]);
      similarities.push({
        document: cluster.documents[i],
        similarity: similarity,
        embedding: cluster.embeddings[i]
      });
    }
    
    // 按相似度排序并返回top-k
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);
  }
  
  /**
   * 在线添加文档到聚类
   */
  addDocument(document, embedding) {
    if (this.clusterCenters.length === 0) {
      // 如果没有聚类中心，暂存文档等待重新聚类
      return -1;
    }
    
    const clusterId = this.findClosestCluster(embedding);
    this.assignToCluster(document, embedding, clusterId);
    
    // 在线更新聚类中心（简化版）
    this.updateClusterCenter(clusterId);
    
    return clusterId;
  }
  
  /**
   * 更新单个聚类中心
   */
  updateClusterCenter(clusterId) {
    if (this.clusters.has(clusterId)) {
      const clusterEmbeddings = this.clusters.get(clusterId).embeddings;
      if (clusterEmbeddings.length > 0) {
        this.clusterCenters[clusterId] = this.calculateCentroid(clusterEmbeddings);
      }
    }
  }
  
  /**
   * 移除文档
   */
  removeDocument(documentId) {
    const clusterId = this.clusterAssignments.get(documentId);
    if (clusterId !== undefined && this.clusters.has(clusterId)) {
      const cluster = this.clusters.get(clusterId);
      const index = cluster.documents.findIndex(doc => doc.id === documentId);
      
      if (index !== -1) {
        cluster.documents.splice(index, 1);
        cluster.embeddings.splice(index, 1);
        this.clusterAssignments.delete(documentId);
        
        // 更新聚类中心
        this.updateClusterCenter(clusterId);
      }
    }
  }
  
  /**
   * 获取聚类统计信息
   */
  getClustersStats() {
    const stats = {
      totalClusters: this.clusterCenters.length,
      activeClusters: this.clusters.size,
      clusterSizes: [],
      avgClusterSize: 0,
      totalDocuments: 0
    };
    
    for (const [clusterId, cluster] of this.clusters) {
      const size = cluster.documents.length;
      stats.clusterSizes.push(size);
      stats.totalDocuments += size;
    }
    
    stats.avgClusterSize = stats.totalDocuments / stats.activeClusters || 0;
    
    return stats;
  }
  
  /**
   * 序列化为JSON
   */
  toJSON() {
    const clustersData = {};
    for (const [clusterId, cluster] of this.clusters) {
      clustersData[clusterId] = {
        documents: cluster.documents,
        embeddings: cluster.embeddings
      };
    }
    
    return {
      numClusters: this.numClusters,
      clusterCenters: this.clusterCenters,
      clusterAssignments: Object.fromEntries(this.clusterAssignments),
      clusters: clustersData,
      dimensions: this.dimensions
    };
  }
  
  /**
   * 从JSON反序列化
   */
  static fromJSON(data) {
    const cluster = new ClusterIndex({ numClusters: data.numClusters });
    cluster.clusterCenters = data.clusterCenters || [];
    cluster.clusterAssignments = new Map(Object.entries(data.clusterAssignments || {}));
    cluster.dimensions = data.dimensions;
    
    // 重建聚类
    cluster.clusters = new Map();
    for (const [clusterId, clusterData] of Object.entries(data.clusters || {})) {
      cluster.clusters.set(parseInt(clusterId), {
        documents: clusterData.documents || [],
        embeddings: clusterData.embeddings || []
      });
    }
    
    return cluster;
  }
}

module.exports = ClusterIndex;