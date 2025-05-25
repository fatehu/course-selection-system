/**
 * 聚类索引实现
 * 用于第二阶段精确搜索的K-means聚类管理
 * 新增：WCSS计算、肘线图调优方法
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
    // 确保聚类数不超过嵌入向量数
    const actualNumClusters = Math.min(this.numClusters, embeddings.length);

    for (let i = 1; i < actualNumClusters; i++) {
        const distances = embeddings.map(embedding => {
            // 计算每个点到 *最近* 已选中心的距离
            return Math.min(...this.clusterCenters.map(center =>
                this.euclideanDistance(embedding, center) ** 2 // 使用平方距离 (D^2)
            ));
        });

        // 按距离加权随机选择
        const totalWeight = distances.reduce((sum, d) => sum + d, 0);

        // 如果权重为0（例如所有点都相同），则随机选择一个点
        if (totalWeight === 0) {
            const nextIndex = Math.floor(Math.random() * embeddings.length);
            this.clusterCenters.push([...embeddings[nextIndex]]);
            continue;
        }

        const threshold = Math.random() * totalWeight;

        let weightSum = 0;
        for (let j = 0; j < distances.length; j++) {
            weightSum += distances[j];
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

    // 如果没有文档，创建虚拟文档
    const useDummyDocs = !documents || documents.length === 0;
    const currentDocuments = useDummyDocs ? embeddings.map((_, i) => ({ id: `temp_${i}` })) : documents;

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
      for (let i = 0; i < currentDocuments.length; i++) {
        const closestCluster = this.findClosestCluster(embeddings[i]);
        this.assignToCluster(currentDocuments[i], embeddings[i], closestCluster);
      }

      // 更新聚类中心
      this.updateClusterCenters();

      // 检查收敛性 (确保 previousCenters 长度与当前中心一致)
      converged = this.checkConvergence(previousCenters);
      iteration++;
    }

    console.log(`K=${this.numClusters}, 聚类完成，迭代 ${iteration} 次${converged ? '收敛' : '达到最大迭代次数'}`);
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
    // 检查聚类中心数量是否发生变化 (K-means++ 可能会产生少于 K 的中心)
    if (this.clusterCenters.length !== previousCenters.length) {
        return false;
    }

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
   * 计算簇内平方和 (WCSS - Within-Cluster Sum of Squares)
   * @returns {number} WCSS 值
   */
  calculateWCSS() {
    let wcss = 0;
    for (const [clusterId, cluster] of this.clusters.entries()) {
      // 确保 clusterId 在 clusterCenters 的有效范围内
      if (clusterId < this.clusterCenters.length) {
        const center = this.clusterCenters[clusterId];
        for (const embedding of cluster.embeddings) {
          const dist = this.euclideanDistance(embedding, center);
          wcss += dist * dist;
        }
      }
    }
    return wcss;
  }

  /**
   * 使用肘线法寻找最佳 K 值
   * @param {Array<Array<number>>} embeddings - 嵌入向量数组
   * @param {number} minK - 最小 K 值
   * @param {number} maxK - 最大 K 值
   * @param {number} step - K 值步长
   * @returns {Promise<number>} 最佳 K 值
   */
  async tune(embeddings, minK = 5, maxK = 150, step = 10) {
      console.log(`开始肘线法调优，K 从 ${minK} 到 ${maxK}，步长 ${step}`);
      if (!embeddings || embeddings.length < minK) {
          console.warn("嵌入向量不足，无法进行调优，返回默认值 128");
          return 128;
      }

      const wcssValues = [];
      const kValues = [];
      const actualMaxK = Math.min(maxK, embeddings.length - 1); // K 不能超过样本数

      // 创建虚拟文档用于聚类
      const dummyDocs = embeddings.map((_, i) => ({ id: `tune_${i}` }));

      for (let k = minK; k <= actualMaxK; k += step) {
          try {
              console.log(`正在测试 K = ${k}...`);
              const tempCluster = new ClusterIndex({ numClusters: k, maxIterations: 30 }); // 减少迭代次数加速调优
              // 使用虚拟文档进行聚类
              tempCluster.performClustering(dummyDocs, embeddings);
              const wcss = tempCluster.calculateWCSS();

              // 仅在 WCSS 有效时添加 (避免 NaN 或 Infinity)
              if (Number.isFinite(wcss) && wcss > 0) {
                  wcssValues.push(wcss);
                  kValues.push(k);
                  console.log(`  K = ${k}, WCSS = ${wcss.toFixed(2)}`);
              } else {
                  console.warn(`  K = ${k}, WCSS 无效 (${wcss})，跳过`);
              }
          } catch (error) {
              console.error(`  测试 K = ${k} 时出错:`, error.message);
          }
          // 短暂暂停以避免可能的 API 限制或 CPU 过载 (如果需要)
          // await new Promise(resolve => setTimeout(resolve, 50));
      }

      if (kValues.length < 2) {
          console.warn("无法生成足够的 WCSS 数据点，返回默认 K=128");
          return 128; // 如果点太少，无法找到肘部
      }

      return this.findElbowPoint(kValues, wcssValues);
  }

  /**
   * 查找肘部点 (距离法)
   * @param {Array<number>} kValues - K 值数组
   * @param {Array<number>} wcssValues - WCSS 值数组
   * @returns {number} 最佳 K 值
   */
  findElbowPoint(kValues, wcssValues) {
    if (kValues.length < 2) {
        return kValues[0] || 128;
    }

    const n = kValues.length;
    const firstK = kValues[0];
    const firstWcss = wcssValues[0];
    const lastK = kValues[n - 1];
    const lastWcss = wcssValues[n - 1];

    // 归一化 (可选，但有助于稳定性)
    const normalize = (arr) => {
        const min = Math.min(...arr);
        const max = Math.max(...arr);
        if (max === min) return arr.map(() => 0.5); // 如果都一样，返回 0.5
        return arr.map(val => (val - min) / (max - min));
    };

    const kNorm = normalize(kValues);
    const wcssNorm = normalize(wcssValues);

    const p1 = { x: kNorm[0], y: wcssNorm[0] };
    const p2 = { x: kNorm[n - 1], y: wcssNorm[n - 1] };

    let maxDistance = -1;
    let elbowIndex = 0;

    // 计算每个点到连接首尾两点的直线的距离
    for (let i = 1; i < n - 1; i++) {
        const p0 = { x: kNorm[i], y: wcssNorm[i] };
        // 向量 AB = (x2-x1, y2-y1)
        const AB = { x: p2.x - p1.x, y: p2.y - p1.y };
        // 向量 AP = (x0-x1, y0-y1)
        const AP = { x: p0.x - p1.x, y: p0.y - p1.y };
        // 计算投影长度 t = (AP . AB) / |AB|^2
        const dot = AP.x * AB.x + AP.y * AB.y;
        const lenSqAB = AB.x * AB.x + AB.y * AB.y;
        // 如果 lenSqAB 为 0，说明首尾点相同，距离为0
        const t = (lenSqAB === 0) ? 0 : dot / lenSqAB;
        // 找到垂足 C
        let C;
        if (t < 0) {
            C = p1;
        } else if (t > 1) {
            C = p2;
        } else {
            C = { x: p1.x + t * AB.x, y: p1.y + t * AB.y };
        }
        // 计算距离 |P0C|
        const dist = Math.sqrt((p0.x - C.x) ** 2 + (p0.y - C.y) ** 2);

        if (dist > maxDistance) {
            maxDistance = dist;
            elbowIndex = i;
        }
    }

    // 如果找不到明显肘部 (例如 WCSS 几乎不变)，选择一个中间值或默认值
    if (maxDistance <= 0 || elbowIndex === 0) {
        console.warn("未能找到明显肘部点，选择中间 K 值。");
        return kValues[Math.floor(n / 2)] || 128;
    }

    const optimalK = kValues[elbowIndex];
    console.log(`找到肘部点: K = ${optimalK} (距离 = ${maxDistance.toFixed(4)})`);
    return optimalK;
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