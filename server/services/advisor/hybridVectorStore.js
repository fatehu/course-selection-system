/**
 * 混合向量存储实现 (HybridVectorStore.js)
 * 目标：结合 LSH (局部敏感哈希) 和 K-Means 聚类，提供一个高效且支持参数自调优的向量存储和搜索方案。
 * LSH 用于快速召回候选集，K-Means 用于结构化数据并进行更精确的范围搜索。
 */
const fs = require('fs-extra'); // 用于文件系统操作，特别是 JSON 的读写和目录创建
const path = require('path');     // 用于处理文件和目录路径
const LSHIndex = require('./lshIndex'); // 引入 LSH 索引实现
const ClusterIndex = require('./clusterIndex'); // 引入 K-Means 聚类索引实现

class HybridVectorStore {
  /**
   * 构造函数 - 初始化混合向量存储
   * @param {object} options - 配置选项
   * @param {string} options.storePath - 向量存储文件的保存路径
   */
  constructor(options = {}) {
    // 存储路径配置，默认为当前工作目录下的 'data/vector-store.json'
    this.storePath = options.storePath || path.join(process.cwd(), 'data/vector-store.json');

    // --- 核心索引组件 ---
    // LSH 索引实例 (默认 1024 维, 16 个哈希表, 每个表 8 个哈希函数)
    // 1024 是 LSHIndex 的维度，这里可能需要根据实际 embedding 维度调整或让 LSHIndex 内部自适应
    this.lshIndex = new LSHIndex(1024, 16, 8);
    // K-Means 聚类索引实例 (默认 128 个簇)
    this.clusterIndex = new ClusterIndex({ numClusters: 128 });

    // --- 数据存储 ---
    this.documents = []; // 存储所有文档对象 { id: ..., content: ..., metadata: ... }
    this.embeddings = []; // 存储所有文档对应的向量，与 this.documents 一一对应
    this.documentMap = new Map(); // 存储文档 ID 到其在数组中索引的映射，用于快速查找
    this.deletedDocuments = new Set(); // 存储被“软删除”的文档 ID，这些文档在重建索引前不会被物理删除
    this.fileDocumentMap = new Map(); // 存储文件 ID 到其包含的所有文档 ID 列表的映射

    // --- 性能与行为配置 ---
    this.lshThreshold = 0.1; // LSH 候选筛选阈值 (目前在 searchInCluster 中未使用，可能为未来预留)
    this.enableLSH = false; // 是否启用 LSH 索引
    this.enableClustering = false; // 是否启用 K-Means 聚类索引
    this.autoRebuildThreshold = 1000; // 自动触发重建索引的文档变动次数阈值
    this.rebuildCounter = 0; // 文档变动（添加）计数器
    this.enableAutoTune = true; // 控制 rebuildIndices 是否在非强制调优时自动进行 K-Means 调优
    this.minDocsForTuning = 100; // 进行参数调优所需的最少文档数量

    // --- 调优参数存储 ---
    this.tunedLSHConfig = null; // 存储 tune() 方法计算出的 LSH 参数 ({ numHashTables, numHashFunctions })
    this.tunedKValue = null;    // 存储 tune() 方法计算出的 K-Means K 值

    // --- 搜索统计（预留使用） ---
    this.searchStats = {
      totalSearches: 0, // 总搜索次数
      lshCandidates: 0, // LSH 产生的候选总数
      avgCandidates: 0, // 平均候选数
      searchTime: 0     // 总搜索耗时
    };

    console.log('HybridVectorStore 初始化完成');
  }

  /**
   * 计算两个向量之间的余弦相似度
   * @param {Array<number>} vecA - 向量 A
   * @param {Array<number>} vecB - 向量 B
   * @returns {number} 余弦相似度值 (0 到 1 之间，越高越相似)
   */
  cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    // 安全检查：确保向量有效且长度一致
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      return 0; // 无效输入返回 0
    }
    // 计算点积和模长的平方
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    // 计算模长
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    // 安全检查：防止除以 0
    if (normA === 0 || normB === 0) {
      return 0;
    }
    // 返回余弦相似度
    return dotProduct / (normA * normB);
  }

  /**
   * 添加单个文档及其向量
   * @param {object} document - 文档对象
   * @param {Array<number>} embedding - 对应的向量
   * @returns {number} 文档在数组中的索引
   */
  addDocument(document, embedding) {
    // 如果文档没有 ID，则生成一个唯一的 ID
    if (!document.id) {
      document.id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    // 获取新文档的索引
    const index = this.documents.length;
    // 添加到主存储
    this.documents.push(document);
    this.embeddings.push(embedding);
    // 更新 ID 到索引的映射
    this.documentMap.set(document.id, index);

    // 如果文档有关联的文件 ID，则更新文件到文档的映射
    if (document.metadata && document.metadata.fileId) {
      const fileId = String(document.metadata.fileId);
      if (!this.fileDocumentMap.has(fileId)) {
        this.fileDocumentMap.set(fileId, []);
      }
      this.fileDocumentMap.get(fileId).push(document.id);
    }
    // 在线更新 LSH 和 K-Means 索引
    this.updateIndicesOnline(document, embedding);
    // 增加重建计数器
    this.rebuildCounter++;
    return index;
  }

  /**
   * 批量添加文档（推荐方式，尤其是在添加来自同一文件的文档时）
   * @param {Array<object>} documents - 文档对象数组
   * @param {Array<Array<number>>} embeddings - 对应的向量数组
   */
  async addDocuments(documents, embeddings) {
    if (documents.length !== embeddings.length) {
      throw new Error("文档数量与嵌入数量不匹配");
    }
    // 如果这批文档来自同一个文件，先删除该文件之前可能存在的旧文档，确保更新
    if (documents.length > 0 && documents[0].metadata && documents[0].metadata.fileId) {
      const fileId = String(documents[0].metadata.fileId);
      console.log(`处理文件 ${fileId} 的文档，先删除旧文档（如果存在）`);
      this.removeDocumentsByFileId(fileId); // 注意：这里是同步调用
    }
    // 循环添加每个文档
    for (let i = 0; i < documents.length; i++) {
      if (embeddings[i]) { // 确保向量存在
        this.addDocument(documents[i], embeddings[i]);
      }
    }
    // 检查是否达到自动重建索引的阈值
    if (documents.length > 50 || this.rebuildCounter > this.autoRebuildThreshold) {
      console.log(`达到 addDocuments 重建阈值 (docs: ${documents.length}, counter: ${this.rebuildCounter})，将执行 rebuildIndices(false)`);
      await this.rebuildIndices(false); // 触发重建，但不强制进行参数调优
    }
    console.log(`批量添加了 ${documents.length} 个文档到向量存储`);
  }

  /**
   * 在线（增量）更新 LSH 和 K-Means 索引
   * @param {object} document - 文档对象
   * @param {Array<number>} embedding - 对应的向量
   */
  updateIndicesOnline(document, embedding) {
    // 如果 LSH 启用，则添加向量到 LSH 索引
    if (this.enableLSH && this.lshIndex) {
      this.lshIndex.addVector(embedding, document.id);
    }
    // 如果 K-Means 启用，则添加文档到 K-Means 索引（并可能更新中心）
    if (this.enableClustering && this.clusterIndex) {
      this.clusterIndex.addDocument(document, embedding);
    }
  }

  /**
   * 重建所有索引（LSH 和 K-Means）
   * 这是一个耗时操作，但能确保索引的准确性和性能。
   * @param {boolean} forceTune - 是否强制进行参数调优，即使之前已经调优过。
   */
  async rebuildIndices(forceTune = false) {
    console.log(`开始重建混合索引... (forceTune: ${forceTune})`);
    const startTime = Date.now();

    // 1. 筛选出所有未被删除的 "活跃" 文档和向量
    const activeDocuments = [];
    const activeEmbeddings = [];
    for (let i = 0; i < this.documents.length; i++) {
      if (!this.deletedDocuments.has(this.documents[i].id)) {
        activeDocuments.push(this.documents[i]);
        activeEmbeddings.push(this.embeddings[i]);
      }
    }

    // 2. 重建 LSH 索引
    if (this.enableLSH) {
      // 获取 LSH 参数（优先使用调优后的，其次是现有的）
      let lshTables = this.lshIndex ? this.lshIndex.numHashTables : 16;
      let lshFuncs = this.lshIndex ? this.lshIndex.numHashFunctions : 8;

      if (this.tunedLSHConfig) {
        lshTables = this.tunedLSHConfig.numHashTables;
        lshFuncs = this.tunedLSHConfig.numHashFunctions;
        console.log(`使用 tune() 方法提供的 LSH 参数: Tables=${lshTables}, Functions=${lshFuncs}`);
      }
      // 创建新的 LSH 实例并填充数据
      this.lshIndex = new LSHIndex(1024, lshTables, lshFuncs);
      if (activeDocuments.length > 0) {
        for (let i = 0; i < activeDocuments.length; i++) {
          if (activeEmbeddings[i] && activeDocuments[i]) {
            this.lshIndex.addVector(activeEmbeddings[i], activeDocuments[i].id);
          }
        }
      }
      console.log('LSH 索引重建完成');
    }

    // 3. 重建 K-Means 聚类索引
    if (this.enableClustering && activeDocuments.length > 0) {
      let numClusters;

      // 决定 K 值的复杂逻辑：
      // a. 如果有调优过的 K 值，且不是强制调优，则使用它。
      if (this.tunedKValue !== null && this.tunedKValue !== undefined && !forceTune) {
        numClusters = this.tunedKValue;
        console.log(`使用 tune() 方法提供的 K = ${numClusters}`);
      }
      // b. 如果没有调优值，不强制调优，且不自动调优，则使用现有的 K。
      else if (this.clusterIndex && this.clusterIndex.numClusters > 0 && !forceTune && !this.enableAutoTune) {
        numClusters = this.clusterIndex.numClusters;
        console.log(`使用现有的聚类数量 K = ${numClusters} (非强制调优, 非自动调优)`);
      }
      // c. 如果强制调优或自动调优开启，且文档数足够，则运行肘线法。
      else if ((forceTune || this.enableAutoTune) && activeDocuments.length >= this.minDocsForTuning) {
        console.log(`rebuildIndices: 启动K-Means参数自调优 (肘线法)...`);
        try {
          const tuner = new ClusterIndex(); // 创建临时实例进行调优
          numClusters = await tuner.tune(activeEmbeddings);
          console.log(`rebuildIndices: K-Means自调优完成，最佳聚类数量 K = ${numClusters}`);
        } catch (tuneError) {
          console.error('rebuildIndices: K-Means参数调优失败，将使用动态调整值:', tuneError);
          // 调优失败时的备用 K 值计算
          numClusters = Math.max(1, Math.min(128, Math.ceil(activeDocuments.length / 20)));
        }
      }
      // d. 如果文档数不足，则动态计算 K 值。
      else if (activeDocuments.length < this.minDocsForTuning) {
        console.log(`文档数量 (${activeDocuments.length}) 少于 ${this.minDocsForTuning} (K-Means)，跳过调优，使用动态调整。`);
        numClusters = Math.max(1, Math.min(128, Math.ceil(activeDocuments.length / 20)));
      }
      // e. 其他情况（例如从未设置 K），也动态计算。
      else {
        console.log('未启用K-Means调优或条件不满足，使用动态调整的 K 值。');
        numClusters = (this.clusterIndex && this.clusterIndex.numClusters > 0) ? this.clusterIndex.numClusters : Math.max(1, Math.min(128, Math.ceil(activeDocuments.length / 20)));
      }

      // 确保 K 值至少为 1
      numClusters = Math.max(1, numClusters);

      // 创建新的 K-Means 实例并运行聚类
      this.clusterIndex = new ClusterIndex({ numClusters });
      this.clusterIndex.performClustering(activeDocuments, activeEmbeddings);
      console.log(`聚类索引重建完成, ${this.clusterIndex.clusterCenters.length} 个聚类`);
    } else if (this.enableClustering) {
      // 如果启用聚类但没有活跃文档，则重置索引。
      this.clusterIndex = new ClusterIndex({ numClusters: 0 });
      console.log('没有活跃文档，聚类索引已重置。');
    }

    // 4. 重置重建计数器并记录时间
    this.rebuildCounter = 0;
    const rebuildTime = Date.now() - startTime;
    console.log(`索引重建完成，耗时: ${rebuildTime}ms, 活跃文档: ${activeDocuments.length}`);
  }

  /**
   * （物理）删除指定文件 ID 关联的所有文档
   * 注意：这是一个耗时的操作，因为它会重建主存储数组。
   * @param {string|number} fileId - 要删除的文件 ID
   * @returns {number} 被删除的文档数量
   */
  removeDocumentsByFileId(fileId) {
    const fileIdStr = String(fileId);
    const documentIds = this.fileDocumentMap.get(fileIdStr) || [];
    if (documentIds.length === 0) return 0;

    const newDocuments = [];
    const newEmbeddings = [];
    const newDocumentMap = new Map();
    let removedCount = 0;

    // 遍历所有文档，只保留那些不属于要删除文件 ID 的文档
    for (let i = 0; i < this.documents.length; i++) {
      const doc = this.documents[i];
      if (!documentIds.includes(doc.id)) {
        newDocuments.push(doc);
        newEmbeddings.push(this.embeddings[i]);
        newDocumentMap.set(doc.id, newDocuments.length - 1);
      } else {
        // 对于被删除的文档，尝试从 LSH 和 K-Means 中在线移除 (如果支持)
        // 注意：这部分可能在后续重建时变得多余，但可以提供一些即时性
        if (this.enableLSH && this.lshIndex) this.lshIndex.removeVector(doc.id);
        if (this.enableClustering && this.clusterIndex) this.clusterIndex.removeDocument(doc.id);
        removedCount++;
      }
    }
    // 更新主存储和映射
    this.documents = newDocuments;
    this.embeddings = newEmbeddings;
    this.documentMap = newDocumentMap;
    // 从文件映射中删除该文件 ID
    this.fileDocumentMap.delete(fileIdStr);
    console.log(`物理删除了 ${removedCount} 个文档（文件ID: ${fileId}）`);
    return removedCount;
  }

  /**
   * 标记指定文件 ID 关联的所有文档为“已删除”（软删除）
   * 这种方式比物理删除快，但被删除的文档仍在存储中，直到 `purgeDeletedDocuments` 被调用。
   * 搜索时会跳过这些文档。
   * @param {string|number} fileId - 文件 ID
   * @returns {number} 被标记的数量
   */
  markDocumentsAsDeleted(fileId) {
    let deletedCount = 0;
    const fileIdStr = String(fileId);
    // 遍历所有文档，找到匹配文件 ID 的，并将其 ID 添加到 deletedDocuments 集合中
    for (const doc of this.documents) {
      if (doc.metadata && String(doc.metadata.fileId) === fileIdStr) {
        if (!this.deletedDocuments.has(doc.id)) {
          this.deletedDocuments.add(doc.id);
          deletedCount++;
        }
      }
    }
    console.log(`标记了 ${deletedCount} 个来自文件 ${fileId} 的文档为已删除`);
    return deletedCount;
  }

  /**
   * 清理（物理删除）所有被标记为“已删除”的文档，并重建索引。
   */
  async purgeDeletedDocuments() {
    if (this.deletedDocuments.size === 0) {
      console.log("没有已标记为删除的文档需要清理。");
      return 0;
    }
    const newDocuments = [];
    const newEmbeddings = [];
    const newDocumentMap = new Map();
    let purgedCount = 0;

    // 遍历所有文档，只保留那些不在 deletedDocuments 集合中的文档
    for (let i = 0; i < this.documents.length; i++) {
      const doc = this.documents[i];
      if (!this.deletedDocuments.has(doc.id)) {
        newDocuments.push(doc);
        newEmbeddings.push(this.embeddings[i]);
        newDocumentMap.set(doc.id, newDocuments.length - 1);
      } else {
        purgedCount++;
        // 同时清理 fileDocumentMap
        if (doc.metadata && doc.metadata.fileId) {
          const fileIdStr = String(doc.metadata.fileId);
          const docIdsInFile = this.fileDocumentMap.get(fileIdStr);
          if (docIdsInFile) {
            const idx = docIdsInFile.indexOf(doc.id);
            if (idx > -1) docIdsInFile.splice(idx, 1);
            if (docIdsInFile.length === 0) this.fileDocumentMap.delete(fileIdStr);
          }
        }
      }
    }
    // 更新主存储和映射
    this.documents = newDocuments;
    this.embeddings = newEmbeddings;
    this.documentMap = newDocumentMap;
    // 清空软删除集合
    this.deletedDocuments.clear();
    // 清理后必须重建索引
    await this.rebuildIndices(false);
    console.log(`物理删除了 ${purgedCount} 个文档`);
    return purgedCount;
  }

  /**
   * 执行相似性搜索
   * @param {Array<number>} queryEmbedding - 查询向量
   * @param {number} k - 希望返回的结果数量
   * @returns {Array<object>} 相似度最高的 K 个结果，每个结果包含 { document, similarity }
   */
  // similaritySearch(queryEmbedding, k = 5) {
  //   const startTime = Date.now();
  //   if (!this.embeddings || this.embeddings.length === 0) return [];

  //   this.searchStats.totalSearches++; // 增加搜索次数统计
  //   let lshCandidateSet = new Set(); // LSH 候选集

  //   // 1. LSH 阶段 (如果启用)
  //   if (this.enableLSH && this.lshIndex && this.documents.length > 100) {
  //     const candidateIds = this.lshIndex.getCandidates(queryEmbedding);
  //     candidateIds.forEach(id => lshCandidateSet.add(id));
  //     console.log(`[流水线] LSH 筛选出 ${lshCandidateSet.size} 个潜在候选`);
  //   } else {
  //     console.log('[流水线] LSH 未启用、无索引或文档数不足。');
  //   }

  //   let results = []; // 存储初步结果
  //   const searchedIds = new Set(); // 存储已经处理过的文档ID，避免重复计算

  //   // 2. K-Means 阶段 (如果启用)
  //   if (this.enableClustering && this.clusterIndex && this.clusterIndex.clusterCenters && this.clusterIndex.clusterCenters.length > 0) {
  //     console.log('[流水线] K-means 已启用，开始聚类搜索...');
  //     // 确定要搜索的簇数量 (最多 10 个或实际簇数)
  //     const numClustersToSearch = Math.min(10, this.clusterIndex.clusterCenters.length);
  //     // 找到与查询最相似的几个簇
  //     const topClusters = this.findTopClusters(queryEmbedding, numClustersToSearch);
  //     console.log(`[流水线] 定位到 Top ${topClusters.length} 个聚类`);
  //     // 在这些簇内进行搜索
  //     for (const clusterId of topClusters) {
  //       // 在每个簇内搜索 k*10 个结果，以提高召回率
  //       const clusterResults = this.clusterIndex.searchInCluster(clusterId, queryEmbedding, k * 10);
  //       // 处理簇内搜索结果
  //       for (const result of clusterResults) {
  //         // 跳过已删除或已处理的文档
  //         if (this.deletedDocuments.has(result.document.id) || searchedIds.has(result.document.id)) continue;
  //         results.push(result);
  //         searchedIds.add(result.document.id);
  //       }
  //     }
  //     console.log(`[流水线] K-means 搜索得到 ${results.length} 个结果`);
  //   } else {
  //     console.log('[流水线] K-means 未启用、无索引或无聚类数据。');
  //   }

  //   // 3. 补充搜索阶段 (如果结果不足 K)
  //   if (results.length < k && this.documents.length > 0) {
  //     console.log(`[流水线] 结果不足 (${results.length}/${k})，执行 O(n) 补充搜索...`);
  //     const additionalSimilarities = [];
  //     // 遍历所有文档
  //     for (let i = 0; i < this.documents.length; i++) {
  //       const docId = this.documents[i].id;
  //       // 只对那些未被 K-Means 搜索到且未被删除的文档进行计算
  //       if (!searchedIds.has(docId) && !this.deletedDocuments.has(docId)) {
  //         if (this.embeddings[i] && queryEmbedding) {
  //           const similarity = this.cosineSimilarity(queryEmbedding, this.embeddings[i]);
  //           additionalSimilarities.push({ document: this.documents[i], similarity: similarity });
  //         }
  //       }
  //     }
  //     // 将补充结果添加到总结果中
  //     results.push(...additionalSimilarities);
  //     console.log(`[流水线] O(n) 补充后总共 ${results.length} 个结果`);
  //   }

  //   // 4. 结果去重与最终排序
  //   const uniqueResultsMap = new Map();
  //   // 使用 Map 去重，确保每个文档只出现一次，并保留最高相似度
  //   results.forEach(res => {
  //     if (!uniqueResultsMap.has(res.document.id) || uniqueResultsMap.get(res.document.id).similarity < res.similarity) {
  //       uniqueResultsMap.set(res.document.id, res);
  //     }
  //   });
  //   // 将 Map 转回数组，按相似度降序排序，并取前 k 个
  //   const finalResults = Array.from(uniqueResultsMap.values())
  //     .sort((a, b) => b.similarity - a.similarity)
  //     .slice(0, k);

  //   // 记录搜索时间和日志
  //   const searchTime = Date.now() - startTime;
  //   this.searchStats.searchTime += searchTime;
  //   console.log(`[流水线] 优化后混合搜索完成，耗时: ${searchTime}ms, 返回 ${finalResults.length} 个结果`);
  //   return finalResults;
  // }


  /**
   * 执行增强的混合相似性搜索
   * 策略：LSH 初筛 + K-Means 区域深搜 -> 合并候选 -> 精确重排 -> Top-K
   * @param {Array<number>} queryEmbedding - 查询向量
   * @param {number} k - 希望返回的结果数量，默认为 5
   * @returns {Promise<Array<object>>} 相似度最高的 K 个结果，每个结果包含 { document, similarity }
   */
  async similaritySearch(queryEmbedding, k = 5) {
      const startTime = Date.now();

      // 0. 初始检查与设置
      if (!this.embeddings || this.embeddings.length === 0 || !queryEmbedding || queryEmbedding.length === 0) {
          console.warn('[流水线] 输入查询向量无效或向量存储为空，返回空数组。');
          return [];
      }
      this.searchStats.totalSearches++;

      // 使用 Map 存储候选者，键为 docId，值为 { document, embedding }
      // 这样可以自然去重，并方便后续获取 document 和 embedding 进行重排
      const candidatePool = new Map();

      // --- 阶段 1: LSH 候选者召回 ---
      if (this.enableLSH && this.lshIndex && this.documents.length > 50) { // 文档太少时LSH意义不大
          const lshCandidateIds = this.lshIndex.getCandidates(queryEmbedding);
          console.log(`[流水线] LSH 初筛 ${lshCandidateIds.length} 个潜在候选 ID`);
          for (const docId of lshCandidateIds) {
              // 跳过已删除或已在候选池中的文档
              if (this.deletedDocuments.has(docId) || candidatePool.has(docId)) continue;
              
              const docIndex = this.documentMap.get(docId); // 通过 documentMap 快速获取索引
              if (docIndex !== undefined && this.documents[docIndex] && this.embeddings[docIndex]) {
                  candidatePool.set(docId, {
                      document: this.documents[docIndex],
                      embedding: this.embeddings[docIndex]
                  });
              }
          }
          console.log(`[流水线] LSH 阶段后，候选池大小: ${candidatePool.size}`);
      } else {
          console.log('[流水线] LSH 未启用、无索引或文档数不足，跳过 LSH 阶段。');
      }

      // --- 阶段 2: K-Means 候选者召回 ---
      if (this.enableClustering && this.clusterIndex && this.clusterIndex.clusterCenters && this.clusterIndex.clusterCenters.length > 0) {
          console.log('[流水线] K-means 已启用，开始聚类搜索...');
          
          let numClustersToSearch = Math.min(3, this.clusterIndex.clusterCenters.length); // 基础搜索3个簇
          // 如果 LSH 提供的候选太少，可以考虑搜索更多的 K-Means 簇
          const lshEffectivenessThreshold = k * 2; 
          if (candidatePool.size < lshEffectivenessThreshold && this.clusterIndex.clusterCenters.length > numClustersToSearch) {
              numClustersToSearch = Math.min(5, this.clusterIndex.clusterCenters.length);
              console.log(`[流水线] LSH 候选较少 (${candidatePool.size}), K-Means 探索簇数量增加至: ${numClustersToSearch}`);
          }

          const topClusters = this.findTopClusters(queryEmbedding, numClustersToSearch);
          console.log(`[流水线] K-Means 定位到 Top ${topClusters.length} 个聚类`);

          // 从每个选中的簇中获取的候选数量，例如 k*3 或固定值如15，取较大者
          const candidatesPerCluster = Math.max(k * 3, 15); 

          for (const clusterId of topClusters) {
              // searchInCluster 返回 { document, similarity, embedding } 对象的数组
              const clusterResults = this.clusterIndex.searchInCluster(clusterId, queryEmbedding, candidatesPerCluster);
              for (const result of clusterResults) {
                  if (this.deletedDocuments.has(result.document.id) || candidatePool.has(result.document.id)) continue;
                  candidatePool.set(result.document.id, { // 使用 result 中的数据
                      document: result.document,
                      embedding: result.embedding 
                  });
              }
          }
          console.log(`[流水线] K-Means 阶段后，总候选池大小: ${candidatePool.size}`);
      } else {
          console.log('[流水线] K-means 未启用、无索引或无聚类数据，跳过 K-Means 阶段。');
      }

      // --- 阶段 3: 后备补充搜索 (如果候选池太空或太小) ---
      const minRequiredCandidates = k; // 至少需要 k 个候选才可能满足最终需求
      if (candidatePool.size < minRequiredCandidates && this.documents.length > 0 && k > 0) {
          console.warn(`[流水线] LSH 和 K-Means 候选不足 (${candidatePool.size}/${k})，执行全局补充搜索...`);
          const maxFallbackCandidatesToAdd = k * 10; // 补充搜索时，最多额外添加这么多候选
          let fallbackAddedCount = 0;

          for (let i = 0; i < this.documents.length; i++) {
              // 如果已经通过补充找到了足够多的候选，或者候选池本身已满足需求，则停止
              if (fallbackAddedCount >= maxFallbackCandidatesToAdd && candidatePool.size >= minRequiredCandidates) break;

              const docId = this.documents[i].id;
              // 跳过已删除、已在池中
              if (!this.deletedDocuments.has(docId) && !candidatePool.has(docId)) {
                  if (this.embeddings[i] && queryEmbedding && this.embeddings[i].length === queryEmbedding.length) {
                      candidatePool.set(docId, {
                          document: this.documents[i],
                          embedding: this.embeddings[i]
                      });
                      fallbackAddedCount++;
                  }
              }
          }
          console.log(`[流水线] 全局补充搜索后，总候选池大小: ${candidatePool.size}`);
      }


      // --- 阶段 4: 对合并后的候选池进行精确计算和重排序 ---
      let rankedResults = []; // 确保是数组
      if (candidatePool.size > 0) {
          console.log(`[流水线] 对 ${candidatePool.size} 个合并候选者进行最终精确排序...`);
          const tempResults = [];
          for (const data of candidatePool.values()) { // 从 Map 中获取 {document, embedding}
              // 再次确保 embedding 有效且维度匹配
              if (data.embedding && data.embedding.length === queryEmbedding.length) {
                  const similarity = this.cosineSimilarity(queryEmbedding, data.embedding);
                  tempResults.push({
                      document: data.document,
                      similarity: similarity,
                  });
              } else {
                  console.warn(`[流水线] 候选者 ${data.document.id} 的向量无效或维度不匹配。查询维度: ${queryEmbedding.length}, 文档向量维度: ${data.embedding ? data.embedding.length : 'N/A'}`);
              }
          }
          // 按相似度降序排序
          tempResults.sort((a, b) => b.similarity - a.similarity);
          rankedResults = tempResults; // 将排序后的结果赋给 rankedResults
      }


      // --- 阶段 5: 返回 Top-K 结果 ---
      const finalRankedResults = rankedResults.slice(0, k); // 对 rankedResults (必然是数组) 进行 slice

      const searchTime = Date.now() - startTime;
      this.searchStats.searchTime += searchTime; 
      console.log(`[流水线] 混合搜索(LSH+KMeans Rerank)完成，耗时: ${searchTime}ms, 候选池大小: ${candidatePool.size}, 精确排序数量: ${rankedResults.length}, 最终返回: ${finalRankedResults.length} 个结果`);
      
      return finalRankedResults; // 总是返回一个数组 (可能是空数组)
  }

  /**
   * 查找与查询向量最相似的 Top K 个聚类中心
   * @param {Array<number>} queryEmbedding - 查询向量
   * @param {number} topK - 希望返回的聚类数量
   * @returns {Array<number>} 最相似的 K 个聚类中心的 ID 列表
   */
  findTopClusters(queryEmbedding, topK) {
    const clusterSimilarities = [];
    // 检查聚类索引和中心是否存在
    if (!this.clusterIndex || !this.clusterIndex.clusterCenters || this.clusterIndex.clusterCenters.length === 0) return [];
    // 遍历所有聚类中心
    for (let i = 0; i < this.clusterIndex.clusterCenters.length; i++) {
      const center = this.clusterIndex.clusterCenters[i];
      // 检查中心有效且维度匹配
      if (center && center.length === queryEmbedding.length) {
        // 计算查询与中心的余弦相似度
        const similarity = this.cosineSimilarity(queryEmbedding, center);
        clusterSimilarities.push({ clusterId: i, similarity });
      }
    }
    // 按相似度排序并返回 Top K 个 clusterId
    return clusterSimilarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .map(item => item.clusterId);
  }

  /**
   * 恢复被标记为“已删除”的文档（反软删除）
   * @param {string|number} fileId - 要恢复的文件 ID
   * @returns {number} 恢复的文档数量
   */
  restoreDocuments(fileId) {
    let restoredCount = 0;
    const fileIdStr = String(fileId);
    const idsToRestore = [];

    // 遍历 deletedDocuments 集合，找到属于该 fileId 的文档 ID
    this.deletedDocuments.forEach(docId => {
      const docIndex = this.documentMap.get(docId); // 需要检查 documentMap 是否是最新的
      // 这里有个潜在问题：如果文档被物理删除后，documentMap 可能不包含这个 ID。
      // 这个函数应该只用于软删除的恢复。
      // 更好的做法可能是直接遍历 this.documents，检查 metadata 和 deletedDocuments 集合。
      // 当前实现依赖于 docId 仍在 documentMap 中，这可能不总是成立。
      // 调整后的逻辑: 直接遍历 deletedDocuments 并查找其在 documents 中的信息。
      // 假设即使软删除，documentMap 仍然保留 ID (当前实现是这样)
      if (docIndex !== undefined && this.documents[docIndex]) {
        const doc = this.documents[docIndex];
        if (doc.metadata && String(doc.metadata.fileId) === fileIdStr) {
          idsToRestore.push(docId);
        }
      }
    });

    // 从 deletedDocuments 集合中移除这些 ID
    idsToRestore.forEach(docId => {
      this.deletedDocuments.delete(docId);
      restoredCount++;
    });

    console.log(`恢复了 ${restoredCount} 个来自文件 ${fileId} 的文档`);
    return restoredCount;
  }

  /**
   * 保存当前向量存储的状态到文件
   */
  async save() {
    // 准备要保存的数据对象
    const data = {
      version: '2.2.1', // 版本号，方便未来升级
      documents: this.documents,
      embeddings: this.embeddings,
      deletedDocuments: Array.from(this.deletedDocuments), // 将 Set 转为 Array
      fileDocumentMap: Array.from(this.fileDocumentMap.entries()), // 将 Map 转为 Array of [key, value]
      lshIndex: (this.enableLSH && this.lshIndex) ? this.lshIndex.toJSON() : null,
      clusterIndex: (this.enableClustering && this.clusterIndex) ? this.clusterIndex.toJSON() : null,
      config: { // 保存配置信息
        enableLSH: this.enableLSH,
        enableClustering: this.enableClustering,
        autoRebuildThreshold: this.autoRebuildThreshold,
        enableAutoTune: this.enableAutoTune,
        minDocsForTuning: this.minDocsForTuning,
        tunedLSHConfig: this.tunedLSHConfig || null,
      },
      stats: this.searchStats, // 保存统计信息
      savedAt: new Date().toISOString() // 保存时间戳
    };
    try {
      // 确保目录存在
      await fs.ensureDir(path.dirname(this.storePath));
      // 将数据以 JSON 格式写入文件 (带缩进)
      await fs.writeJson(this.storePath, data, { spaces: 2 });
      console.log(`混合向量存储保存至: ${this.storePath}`);
    } catch (error) {
      console.error(`保存向量存储失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 从文件加载向量存储的状态
   * @returns {Promise<boolean>} 是否加载成功
   */
  async load() {
    // 检查文件是否存在
    if (!(await fs.pathExists(this.storePath))) {
      console.log(`向量存储文件不存在: ${this.storePath}, 将创建一个新的空存储。`);
      // 如果不存在，则使用默认值初始化
      this.lshIndex = new LSHIndex(1024, 16, 8);
      this.clusterIndex = new ClusterIndex({ numClusters: 128 });
      this.tunedLSHConfig = null;
      this.tunedKValue = null;
      return false;
    }
    try {
      // 读取 JSON 文件
      const data = await fs.readJson(this.storePath, { encoding: 'utf8' });
      // 加载基本数据
      this.documents = data.documents || [];
      this.embeddings = data.embeddings || [];
      this.deletedDocuments = new Set(data.deletedDocuments || []);
      // 重建 documentMap
      this.documentMap.clear();
      for (let i = 0; i < this.documents.length; i++) {
        this.documentMap.set(this.documents[i].id, i);
      }
      // 加载或重建 fileDocumentMap
      if (data.fileDocumentMap) {
        this.fileDocumentMap = new Map(data.fileDocumentMap);
      } else {
        this.rebuildFileDocumentMap(); // 兼容旧版本
      }

      // 加载配置
      if (data.config) {
        this.enableLSH = data.config.enableLSH !== false;
        this.enableClustering = data.config.enableClustering !== false;
        this.autoRebuildThreshold = data.config.autoRebuildThreshold || 1000;
        this.enableAutoTune = data.config.enableAutoTune !== false;
        this.minDocsForTuning = data.config.minDocsForTuning || 100;
        this.tunedLSHConfig = data.config.tunedLSHConfig || null;
      } else {
        // 如果没有配置，使用默认值
        this.enableLSH = true;
        this.enableClustering = true;
        this.autoRebuildThreshold = 1000;
        this.enableAutoTune = true;
        this.minDocsForTuning = 100;
        this.tunedLSHConfig = null;
      }

      // 加载统计信息
      if (data.stats) this.searchStats = { ...this.searchStats, ...data.stats };

      // 加载或初始化 LSH 索引
      if (data.lshIndex && this.enableLSH) {
        this.lshIndex = LSHIndex.fromJSON(data.lshIndex);
        console.log('LSH索引加载完成');
      } else if (this.enableLSH) {
        const lshConf = this.tunedLSHConfig || { numHashTables: 16, numHashFunctions: 8 };
        this.lshIndex = new LSHIndex(1024, lshConf.numHashTables, lshConf.numHashFunctions);
        console.log('LSH索引从配置或默认值初始化。');
      } else {
        this.lshIndex = null;
      }

      // 加载或初始化 K-Means 索引
      if (data.clusterIndex && this.enableClustering) {
        this.clusterIndex = ClusterIndex.fromJSON(data.clusterIndex);
        console.log('聚类索引加载完成');
        this.tunedKValue = this.clusterIndex.numClusters; // 将加载的 K 值视为"已调优"
      } else if (this.enableClustering) {
        this.clusterIndex = new ClusterIndex({ numClusters: 128 });
        this.tunedKValue = 128;
        console.log('聚类索引从默认值初始化。');
      } else {
        this.clusterIndex = null;
        this.tunedKValue = null;
      }

      console.log(`成功加载 ${this.documents.length} 个文档和嵌入向量`);
      console.log(`其中 ${this.deletedDocuments.size} 个文档被标记为已删除`);
      return true;
    } catch (error) {
      console.error("加载向量存储失败:", error);
      // 加载失败时，也进行默认初始化，防止系统崩溃
      this.lshIndex = new LSHIndex(1024, 16, 8);
      this.clusterIndex = new ClusterIndex({ numClusters: 128 });
      this.tunedLSHConfig = null;
      this.tunedKValue = null;
      return false;
    }
  }

  /**
   * 重建文件到文档 ID 的映射（主要用于从旧版本加载数据时）
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
    console.log(`重建文件映射完成，共 ${this.fileDocumentMap.size} 个文件`);
  }

  /**
   * 获取当前的统计信息
   * @returns {object} 包含各种统计数据的对象
   */
  getStats() {
    // 获取 LSH 和 K-Means 的统计信息 (检查是否为空)
    const lshStats = (this.enableLSH && this.lshIndex) ? this.lshIndex.getStats() : { note: "LSH disabled or not initialized" };
    const clusterData = (this.enableClustering && this.clusterIndex) ? this.clusterIndex.getClustersStats() : { note: "Clustering disabled or not initialized" };

    // 返回一个包含整体和子索引统计信息的对象
    return {
      version: '2.2.1',
      totalDocuments: this.documents.length,
      activeDocuments: this.documents.length - this.deletedDocuments.size,
      deletedDocuments: this.deletedDocuments.size,
      filesCount: this.fileDocumentMap.size,
      lshStats,
      clusterStats: clusterData,
      config: { // 返回当前配置
        enableLSH: this.enableLSH,
        enableClustering: this.enableClustering,
        autoRebuildThreshold: this.autoRebuildThreshold,
        enableAutoTune: this.enableAutoTune,
        minDocsForTuning: this.minDocsForTuning,
        numClusters: (this.enableClustering && this.clusterIndex) ? this.clusterIndex.numClusters : 0,
        tunedLSHConfig: this.tunedLSHConfig
      }
    };
  }

  /**
   * 执行强制的 LSH 和 K-Means 参数调优，并重建索引。
   */
  async tune() {
    console.log('开始强制性能调优...');
    // 重置已调优的参数，准备重新计算
    this.tunedKValue = null;
    this.tunedLSHConfig = null;

    // 获取活跃文档
    const activeDocuments = [];
    const activeEmbeddings = [];
    for (let i = 0; i < this.documents.length; i++) {
      if (!this.deletedDocuments.has(this.documents[i].id)) {
        activeDocuments.push(this.documents[i]);
        activeEmbeddings.push(this.embeddings[i]);
      }
    }

    // 检查文档数量是否足够
    if (activeDocuments.length < this.minDocsForTuning) {
      console.warn(`文档数量 (${activeDocuments.length}) 太少 (少于 ${this.minDocsForTuning})，无法进行有意义的调优。将使用默认参数重建。`);
      if (this.enableClustering) {
        this.tunedKValue = Math.max(1, Math.min(128, Math.ceil(activeDocuments.length / 20)));
      }
      await this.rebuildIndices(false); // 使用计算出的 K 或 LSH 默认值重建
      console.log('性能调优因数据不足而跳过，已使用默认参数重建。');
      return;
    }

    // 1. K-Means 调优
    let kMeansTunedKForRebuild = this.clusterIndex ? this.clusterIndex.numClusters : 128;
    if (this.enableClustering) {
      console.log('K-Means 参数调优...');
      const tuner = new ClusterIndex();
      kMeansTunedKForRebuild = await tuner.tune(activeEmbeddings);
      console.log(`K-Means 调优完成，最佳 K = ${kMeansTunedKForRebuild}`);
      this.tunedKValue = kMeansTunedKForRebuild; // 存储结果，供 rebuildIndices 使用
    }

    // 2. LSH 调优 (这是一个启发式过程)
    let bestLSHConfig = { // 默认值
      numHashTables: this.lshIndex ? this.lshIndex.numHashTables : 16,
      numHashFunctions: this.lshIndex ? this.lshIndex.numHashFunctions : 8,
    };
    if (this.enableLSH && activeEmbeddings.length > 0) {
      console.log('LSH 参数调优...');
      // 定义 LSH 参数的候选范围
      const numHashTablesOptions = [8, 16, 32, 48];
      const numHashFunctionsOptions = [6, 10, 14, 18, 22];
      // 随机抽取一部分向量作为查询样本
      const sampleSize = Math.min(100, Math.floor(activeEmbeddings.length * 0.1), 300);
      const shuffledEmbeddings = [...activeEmbeddings].sort(() => 0.5 - Math.random());
      const sampleQueryEmbeddings = shuffledEmbeddings.slice(0, sampleSize);

      let currentBestAvgCandidates = Infinity;
      let foundSuitableLSH = false;

      // 定义 LSH 调优的目标候选数量范围
      const kForLSHHeuristic = kMeansTunedKForRebuild > 0 ? kMeansTunedKForRebuild : (this.clusterIndex ? this.clusterIndex.numClusters : 30);
      let targetMinCandidates = Math.max(10, Math.floor(activeEmbeddings.length * 0.005), kForLSHHeuristic);
      let targetMaxCandidates = Math.min(300, Math.floor(activeEmbeddings.length * 0.08), kForLSHHeuristic * 10);
      if (targetMinCandidates > targetMaxCandidates) targetMinCandidates = Math.max(10, Math.floor(targetMaxCandidates / 2));
      console.log(`LSH 调优目标候选范围: [${targetMinCandidates} - ${targetMaxCandidates}]`);

      // 遍历所有参数组合 (网格搜索)
      for (const tables of numHashTablesOptions) {
        for (const funcs of numHashFunctionsOptions) {
          // 剪枝：避免过于庞大的 LSH 配置
          if (tables * funcs > 256 && tables * funcs > activeEmbeddings.length * 0.5) continue;

          console.log(`  测试 LSH: Tables=${tables}, Functions=${funcs}`);
          // 创建临时 LSH 索引
          const tempLSHIndex = new LSHIndex(1024, tables, funcs);
          activeEmbeddings.forEach((emb, idx) => {
            if (activeDocuments[idx] && emb) {
              tempLSHIndex.addVector(emb, activeDocuments[idx].id);
            }
          });

          // 使用样本查询测试 LSH 性能
          let totalCandidates = 0;
          if (sampleQueryEmbeddings.length > 0) {
            for (const queryEmb of sampleQueryEmbeddings) {
              if (queryEmb) {
                const candidates = tempLSHIndex.getCandidates(queryEmb);
                totalCandidates += candidates.length;
              }
            }
            const avgCandidates = totalCandidates / sampleQueryEmbeddings.length;
            console.log(`      平均候选者数量: ${avgCandidates.toFixed(2)}`);

            // 检查平均候选数量是否在目标范围内
            if (avgCandidates >= targetMinCandidates && avgCandidates <= targetMaxCandidates) {
              // 如果在范围内，且比当前最好的还好，则更新
              if (!foundSuitableLSH || avgCandidates < currentBestAvgCandidates) {
                currentBestAvgCandidates = avgCandidates;
                bestLSHConfig = { numHashTables: tables, numHashFunctions: funcs };
                foundSuitableLSH = true;
              }
            } else if (!foundSuitableLSH && avgCandidates > targetMaxCandidates && avgCandidates < currentBestAvgCandidates) {
              // 如果还没找到合适的，且当前这个虽然大了点但比之前的好，也暂时选它
              currentBestAvgCandidates = avgCandidates;
              bestLSHConfig = { numHashTables: tables, numHashFunctions: funcs };
            }
          }
        }
      }
      // 输出 LSH 调优结果
      if (foundSuitableLSH || currentBestAvgCandidates !== Infinity) {
        console.log(`LSH 参数调优完成，选择配置: Tables=${bestLSHConfig.numHashTables}, Functions=${bestLSHConfig.numHashFunctions}, 平均候选者: ${currentBestAvgCandidates.toFixed(2)}`);
      } else {
        console.log('LSH 参数调优未能找到理想配置，将保留或使用默认。');
      }
      // 存储结果，供 rebuildIndices 使用
      this.tunedLSHConfig = bestLSHConfig;
    }

    // 3. 使用调优后的参数重建索引
    console.log(`Tune 方法完成，将使用 K=${this.tunedKValue} 和 LSH 配置调用 rebuildIndices(false)`);
    await this.rebuildIndices(false); // 调用重建，它会使用我们刚刚设置的 tuned 值

    console.log('性能调优完成');
  }
}

// 导出 HybridVectorStore 类
module.exports = HybridVectorStore;