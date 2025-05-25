/**
 * 混合向量存储实现
 * 实现K-Means 和 LSH 参数自调优
 */
const fs = require('fs-extra');
const path = require('path');
const LSHIndex = require('./lshIndex');
const ClusterIndex = require('./clusterIndex');

class HybridVectorStore {
  constructor(options = {}) {
    this.storePath = options.storePath || path.join(process.cwd(), 'data/vector-store.json');

    // 核心索引组件
    this.lshIndex = new LSHIndex(1024, 16, 8);
    this.clusterIndex = new ClusterIndex({ numClusters: 128 });

    // 数据存储
    this.documents = [];
    this.embeddings = [];
    this.documentMap = new Map();
    this.deletedDocuments = new Set();
    this.fileDocumentMap = new Map();

    // 性能配置
    this.lshThreshold = 0.1; // LSH候选筛选阈值 (目前未使用)
    this.enableLSH = true;
    this.enableClustering = true;
    this.autoRebuildThreshold = 1000;
    this.rebuildCounter = 0;
    this.enableAutoTune = true; // 控制 rebuildIndices 是否在非 forceTune 时自动调优 K-Means
    this.minDocsForTuning = 100;

    this.tunedLSHConfig = null; // 存储 tune() 方法计算出的 LSH 参数
    this.tunedKValue = null;    // 存储 tune() 方法计算出的 K-Means K 值

    this.searchStats = {
      totalSearches: 0,
      lshCandidates: 0,
      avgCandidates: 0,
      searchTime: 0
    };

    console.log('HybridVectorStore 初始化完成');
  }

  cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    if (!vecA || !vecB || vecA.length !== vecB.length) {
        // console.error("Invalid vectors for cosine similarity", vecA, vecB);
        return 0;
    }
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

  addDocument(document, embedding) {
    if (!document.id) {
      document.id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    const index = this.documents.length;
    this.documents.push(document);
    this.embeddings.push(embedding);
    this.documentMap.set(document.id, index);

    if (document.metadata && document.metadata.fileId) {
      const fileId = String(document.metadata.fileId);
      if (!this.fileDocumentMap.has(fileId)) {
        this.fileDocumentMap.set(fileId, []);
      }
      this.fileDocumentMap.get(fileId).push(document.id);
    }
    this.updateIndicesOnline(document, embedding);
    this.rebuildCounter++;
    return index;
  }

  async addDocuments(documents, embeddings) {
    if (documents.length !== embeddings.length) {
      throw new Error("文档数量与嵌入数量不匹配");
    }
    if (documents.length > 0 && documents[0].metadata && documents[0].metadata.fileId) {
      const fileId = String(documents[0].metadata.fileId);
      console.log(`处理文件 ${fileId} 的文档，先删除旧文档（如果存在）`);
      this.removeDocumentsByFileId(fileId); // 注意：这里是同步的，如果removeDocumentsByFileId 改为 async，需要 await
    }
    for (let i = 0; i < documents.length; i++) {
      if (embeddings[i]) {
        this.addDocument(documents[i], embeddings[i]);
      }
    }
    if (documents.length > 50 || this.rebuildCounter > this.autoRebuildThreshold) {
      console.log(`达到 addDocuments 重建阈值 (docs: ${documents.length}, counter: ${this.rebuildCounter})，将执行 rebuildIndices(false)`);
      await this.rebuildIndices(false); // 默认不强制调优，但会使用 enableAutoTune
    }
    console.log(`批量添加了${documents.length}个文档到向量存储`);
  }

  updateIndicesOnline(document, embedding) {
    if (this.enableLSH && this.lshIndex) {
      this.lshIndex.addVector(embedding, document.id);
    }
    if (this.enableClustering && this.clusterIndex) {
      this.clusterIndex.addDocument(document, embedding);
    }
  }

  async rebuildIndices(forceTune = false) {
    console.log(`开始重建混合索引... (forceTune: ${forceTune})`);
    const startTime = Date.now();

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
      let lshTables = this.lshIndex ? this.lshIndex.numHashTables : 16;
      let lshFuncs = this.lshIndex ? this.lshIndex.numHashFunctions : 8;

      if (this.tunedLSHConfig) { // 优先使用 tune() 方法提供的LSH参数
        lshTables = this.tunedLSHConfig.numHashTables;
        lshFuncs = this.tunedLSHConfig.numHashFunctions;
        console.log(`使用 tune() 方法提供的 LSH 参数: Tables=${lshTables}, Functions=${lshFuncs}`);
      }
      this.lshIndex = new LSHIndex(1024, lshTables, lshFuncs);
      if (activeDocuments.length > 0) {
        for (let i = 0; i < activeDocuments.length; i++) {
          if (activeEmbeddings[i] && activeDocuments[i]) {
            this.lshIndex.addVector(activeEmbeddings[i], activeDocuments[i].id);
          }
        }
      }
      console.log('LSH索引重建完成');
    }

    // 重建聚类索引
    if (this.enableClustering && activeDocuments.length > 0) {
      let numClusters;

      if (this.tunedKValue !== null && this.tunedKValue !== undefined && !forceTune) {
        numClusters = this.tunedKValue;
        console.log(`使用 tune() 方法提供的 K = ${numClusters}`);
        // this.tunedKValue = null; // 在 tune 方法调用完 rebuildIndices 后清除，或在 tune 方法开始时清除
      } else if (this.clusterIndex && this.clusterIndex.numClusters > 0 && !forceTune && !this.enableAutoTune) {
        numClusters = this.clusterIndex.numClusters;
        console.log(`使用现有的聚类数量 K = ${numClusters} (非强制调优, 非自动调优)`);
      } else if ((forceTune || this.enableAutoTune) && activeDocuments.length >= this.minDocsForTuning) {
        console.log(`rebuildIndices: 启动K-Means参数自调优 (肘线法)... (forceTune: ${forceTune}, enableAutoTune: ${this.enableAutoTune})`);
        try {
          const tuner = new ClusterIndex();
          numClusters = await tuner.tune(activeEmbeddings);
          console.log(`rebuildIndices: K-Means自调优完成，最佳聚类数量 K = ${numClusters}`);
        } catch (tuneError) {
          console.error('rebuildIndices: K-Means参数调优失败，将使用动态调整值:', tuneError);
          numClusters = Math.max(1, Math.min(128, Math.ceil(activeDocuments.length / 20)));
        }
      } else if (activeDocuments.length < this.minDocsForTuning) {
        console.log(`文档数量 (${activeDocuments.length}) 少于 ${this.minDocsForTuning} (K-Means)，跳过调优，使用动态调整。`);
        numClusters = Math.max(1, Math.min(128, Math.ceil(activeDocuments.length / 20)));
      } else {
        console.log('未启用K-Means调优或条件不满足，使用动态调整的 K 值。');
        numClusters = (this.clusterIndex && this.clusterIndex.numClusters > 0) ? this.clusterIndex.numClusters : Math.max(1, Math.min(128, Math.ceil(activeDocuments.length / 20)));
      }
      
      numClusters = Math.max(1, numClusters);

      this.clusterIndex = new ClusterIndex({ numClusters });
      this.clusterIndex.performClustering(activeDocuments, activeEmbeddings);
      console.log(`聚类索引重建完成, ${this.clusterIndex.clusterCenters.length} 个聚类`);
    } else if (this.enableClustering) {
      this.clusterIndex = new ClusterIndex({ numClusters: 0 });
      console.log('没有活跃文档，聚类索引已重置。');
    }

    this.rebuildCounter = 0;
    const rebuildTime = Date.now() - startTime;
    console.log(`索引重建完成，耗时: ${rebuildTime}ms, 活跃文档: ${activeDocuments.length}`);
  }

  removeDocumentsByFileId(fileId) {
    const fileIdStr = String(fileId);
    const documentIds = this.fileDocumentMap.get(fileIdStr) || [];
    if (documentIds.length === 0) return 0;

    const newDocuments = [];
    const newEmbeddings = [];
    const newDocumentMap = new Map();
    let removedCount = 0;

    for (let i = 0; i < this.documents.length; i++) {
      const doc = this.documents[i];
      if (!documentIds.includes(doc.id)) {
        newDocuments.push(doc);
        newEmbeddings.push(this.embeddings[i]);
        newDocumentMap.set(doc.id, newDocuments.length - 1);
      } else {
        if (this.enableLSH && this.lshIndex) this.lshIndex.removeVector(doc.id);
        if (this.enableClustering && this.clusterIndex) this.clusterIndex.removeDocument(doc.id);
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

  markDocumentsAsDeleted(fileId) {
    let deletedCount = 0;
    const fileIdStr = String(fileId);
    for (const doc of this.documents) {
      if (doc.metadata && String(doc.metadata.fileId) === fileIdStr) {
        if (!this.deletedDocuments.has(doc.id)) {
          this.deletedDocuments.add(doc.id);
          deletedCount++;
        }
      }
    }
    console.log(`标记了${deletedCount}个来自文件${fileId}的文档为已删除`);
    return deletedCount;
  }

  async purgeDeletedDocuments() {
    if (this.deletedDocuments.size === 0) {
      console.log("没有已标记为删除的文档需要清理。");
      return 0;
    }
    const newDocuments = [];
    const newEmbeddings = [];
    const newDocumentMap = new Map();
    let purgedCount = 0;

    for (let i = 0; i < this.documents.length; i++) {
      const doc = this.documents[i];
      if (!this.deletedDocuments.has(doc.id)) {
        newDocuments.push(doc);
        newEmbeddings.push(this.embeddings[i]);
        newDocumentMap.set(doc.id, newDocuments.length - 1);
      } else {
        purgedCount++;
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
    this.documents = newDocuments;
    this.embeddings = newEmbeddings;
    this.documentMap = newDocumentMap;
    this.deletedDocuments.clear();
    await this.rebuildIndices(false);
    console.log(`物理删除了${purgedCount}个文档`);
    return purgedCount;
  }

  similaritySearch(queryEmbedding, k = 5) {
    const startTime = Date.now();
    if (!this.embeddings || this.embeddings.length === 0) return [];

    this.searchStats.totalSearches++;
    let lshCandidateSet = new Set();

    if (this.enableLSH && this.lshIndex && this.documents.length > 100) {
      const candidateIds = this.lshIndex.getCandidates(queryEmbedding);
      candidateIds.forEach(id => lshCandidateSet.add(id));
      console.log(`[流水线] LSH 筛选出 ${lshCandidateSet.size} 个潜在候选`);
    } else {
      console.log('[流水线] LSH 未启用、无索引或文档数不足。');
    }

    let results = [];
    const searchedIds = new Set();

    if (this.enableClustering && this.clusterIndex && this.clusterIndex.clusterCenters && this.clusterIndex.clusterCenters.length > 0) {
      console.log('[流水线] K-means 已启用，开始聚类搜索...');
      const numClustersToSearch = Math.min(10, this.clusterIndex.clusterCenters.length);
      const topClusters = this.findTopClusters(queryEmbedding, numClustersToSearch);
      console.log(`[流水线] 定位到 Top ${topClusters.length} 个聚类`);
      for (const clusterId of topClusters) {
        const clusterResults = this.clusterIndex.searchInCluster(clusterId, queryEmbedding, k * 10);
        for (const result of clusterResults) {
          if (this.deletedDocuments.has(result.document.id) || searchedIds.has(result.document.id)) continue;
          results.push(result);
          searchedIds.add(result.document.id);
        }
      }
      console.log(`[流水线] K-means 搜索得到 ${results.length} 个结果`);
    } else {
       console.log('[流水线] K-means 未启用、无索引或无聚类数据。');
    }

    if (results.length < k && this.documents.length > 0) {
      console.log(`[流水线] 结果不足 (${results.length}/${k})，执行 O(n) 补充搜索...`);
      const additionalSimilarities = [];
      for (let i = 0; i < this.documents.length; i++) {
        const docId = this.documents[i].id;
        if (!searchedIds.has(docId) && !this.deletedDocuments.has(docId)) {
          if (this.embeddings[i] && queryEmbedding) {
            const similarity = this.cosineSimilarity(queryEmbedding, this.embeddings[i]);
            additionalSimilarities.push({ document: this.documents[i], similarity: similarity });
          }
        }
      }
      results.push(...additionalSimilarities);
      console.log(`[流水线] O(n) 补充后总共 ${results.length} 个结果`);
    }

    const uniqueResultsMap = new Map();
    results.forEach(res => {
      if (!uniqueResultsMap.has(res.document.id) || uniqueResultsMap.get(res.document.id).similarity < res.similarity) {
        uniqueResultsMap.set(res.document.id, res);
      }
    });
    const finalResults = Array.from(uniqueResultsMap.values()).sort((a, b) => b.similarity - a.similarity).slice(0, k);
    const searchTime = Date.now() - startTime;
    this.searchStats.searchTime += searchTime;
    console.log(`[流水线] 优化后混合搜索完成，耗时: ${searchTime}ms, 返回 ${finalResults.length} 个结果`);
    return finalResults;
  }

  findTopClusters(queryEmbedding, topK) {
    const clusterSimilarities = [];
    if (!this.clusterIndex || !this.clusterIndex.clusterCenters || this.clusterIndex.clusterCenters.length === 0) return [];
    for (let i = 0; i < this.clusterIndex.clusterCenters.length; i++) {
      const center = this.clusterIndex.clusterCenters[i];
      if (center && center.length === queryEmbedding.length) {
        const similarity = this.cosineSimilarity(queryEmbedding, center);
        clusterSimilarities.push({ clusterId: i, similarity });
      }
    }
    return clusterSimilarities.sort((a, b) => b.similarity - a.similarity).slice(0, topK).map(item => item.clusterId);
  }

  restoreDocuments(fileId) {
    let restoredCount = 0;
    const fileIdStr = String(fileId);
    const idsToRestore = [];

    this.deletedDocuments.forEach(docId => {
      const docIndex = this.documentMap.get(docId);
      if (docIndex !== undefined && this.documents[docIndex]) {
        const doc = this.documents[docIndex];
        if (doc.metadata && String(doc.metadata.fileId) === fileIdStr) {
          idsToRestore.push(docId);
        }
      }
    });

    idsToRestore.forEach(docId => {
        this.deletedDocuments.delete(docId);
        restoredCount++;
    });

    console.log(`恢复了${restoredCount}个来自文件${fileId}的文档`);
    return restoredCount;
  }

  async save() {
    const data = {
      version: '2.2.1', // Minor update for logic refinement
      documents: this.documents,
      embeddings: this.embeddings,
      deletedDocuments: Array.from(this.deletedDocuments),
      fileDocumentMap: Array.from(this.fileDocumentMap.entries()),
      lshIndex: (this.enableLSH && this.lshIndex) ? this.lshIndex.toJSON() : null,
      clusterIndex: (this.enableClustering && this.clusterIndex) ? this.clusterIndex.toJSON() : null,
      config: {
        enableLSH: this.enableLSH,
        enableClustering: this.enableClustering,
        autoRebuildThreshold: this.autoRebuildThreshold,
        enableAutoTune: this.enableAutoTune,
        minDocsForTuning: this.minDocsForTuning,
        tunedLSHConfig: this.tunedLSHConfig || null,
        // numClusters is stored within clusterIndex.toJSON()
      },
      stats: this.searchStats,
      savedAt: new Date().toISOString()
    };
    try {
      await fs.ensureDir(path.dirname(this.storePath));
      await fs.writeJson(this.storePath, data, { spaces: 2 });
      console.log(`混合向量存储保存至: ${this.storePath}`);
    } catch(error) {
      console.error(`保存向量存储失败: ${error.message}`);
      throw error;
    }
  }

  async load() {
    if (!(await fs.pathExists(this.storePath))) {
      console.log(`向量存储文件不存在: ${this.storePath}, 将创建一个新的空存储。`);
      this.lshIndex = new LSHIndex(1024, 16, 8);
      this.clusterIndex = new ClusterIndex({ numClusters: 128 });
      this.tunedLSHConfig = null;
      this.tunedKValue = null;
      return false;
    }
    try {
      const data = await fs.readJson(this.storePath, { encoding: 'utf8' });
      this.documents = data.documents || [];
      this.embeddings = data.embeddings || [];
      this.deletedDocuments = new Set(data.deletedDocuments || []);
      this.documentMap.clear();
      for (let i = 0; i < this.documents.length; i++) {
        this.documentMap.set(this.documents[i].id, i);
      }
      if (data.fileDocumentMap) {
        this.fileDocumentMap = new Map(data.fileDocumentMap);
      } else {
        this.rebuildFileDocumentMap();
      }

      if (data.config) {
        this.enableLSH = data.config.enableLSH !== false;
        this.enableClustering = data.config.enableClustering !== false;
        this.autoRebuildThreshold = data.config.autoRebuildThreshold || 1000;
        this.enableAutoTune = data.config.enableAutoTune !== false;
        this.minDocsForTuning = data.config.minDocsForTuning || 100;
        this.tunedLSHConfig = data.config.tunedLSHConfig || null;
      } else { // Default config if not present
        this.enableLSH = true;
        this.enableClustering = true;
        this.autoRebuildThreshold = 1000;
        this.enableAutoTune = true;
        this.minDocsForTuning = 100;
        this.tunedLSHConfig = null;
      }


      if (data.stats) this.searchStats = { ...this.searchStats, ...data.stats };

      // Initialize or load LSHIndex
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

      // Initialize or load ClusterIndex
      if (data.clusterIndex && this.enableClustering) {
        this.clusterIndex = ClusterIndex.fromJSON(data.clusterIndex);
        console.log('聚类索引加载完成');
        this.tunedKValue = this.clusterIndex.numClusters; // Store loaded K as potentially "tuned"
      } else if (this.enableClustering) {
        this.clusterIndex = new ClusterIndex({ numClusters: 128 }); // Default if not in JSON
        this.tunedKValue = 128;
        console.log('聚类索引从默认值初始化。');
      } else {
        this.clusterIndex = null;
        this.tunedKValue = null;
      }

      console.log(`成功加载${this.documents.length}个文档和嵌入向量`);
      console.log(`其中${this.deletedDocuments.size}个文档被标记为已删除`);
      return true;
    } catch (error) {
      console.error("加载向量存储失败:", error);
      this.lshIndex = new LSHIndex(1024, 16, 8);
      this.clusterIndex = new ClusterIndex({ numClusters: 128 });
      this.tunedLSHConfig = null;
      this.tunedKValue = null;
      return false;
    }
  }

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

  getStats() {
    // ... (stats logic, ensure this.clusterIndex and this.lshIndex are checked for null)
    const lshStats = (this.enableLSH && this.lshIndex) ? this.lshIndex.getStats() : {note: "LSH disabled or not initialized"};
    const clusterData = (this.enableClustering && this.clusterIndex) ? this.clusterIndex.getClustersStats() : {note: "Clustering disabled or not initialized"};

    return {
      version: '2.2.1',
      totalDocuments: this.documents.length,
      activeDocuments: this.documents.length - this.deletedDocuments.size,
      deletedDocuments: this.deletedDocuments.size,
      filesCount: this.fileDocumentMap.size,
      // ...
      lshStats,
      clusterStats: clusterData,
      config: {
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

  async tune() {
    console.log('开始强制性能调优...');
    this.tunedKValue = null; // Reset before tuning
    this.tunedLSHConfig = null; // Reset before tuning

    const activeDocuments = [];
    const activeEmbeddings = [];
    for (let i = 0; i < this.documents.length; i++) {
      if (!this.deletedDocuments.has(this.documents[i].id)) {
        activeDocuments.push(this.documents[i]);
        activeEmbeddings.push(this.embeddings[i]);
      }
    }

    if (activeDocuments.length < this.minDocsForTuning) {
      console.warn(`文档数量 (${activeDocuments.length}) 太少 (少于 ${this.minDocsForTuning})，无法进行有意义的调优。将使用默认参数重建。`);
      // Set default K if clustering enabled, otherwise LSH rebuilds with its defaults
      if (this.enableClustering) {
        this.tunedKValue = Math.max(1, Math.min(128, Math.ceil(activeDocuments.length / 20)));
      }
      await this.rebuildIndices(false); // Rebuild with defaults or calculated K
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
      this.tunedKValue = kMeansTunedKForRebuild; // Store for rebuildIndices
    }

    // 2. LSH 调优
    let bestLSHConfig = {
      numHashTables: this.lshIndex ? this.lshIndex.numHashTables : 16,
      numHashFunctions: this.lshIndex ? this.lshIndex.numHashFunctions : 8,
    };
    if (this.enableLSH && activeEmbeddings.length > 0) {
      console.log('LSH 参数调优...');
      const numHashTablesOptions = [8, 16, 32, 48]; // Adjusted options
      const numHashFunctionsOptions = [6, 10, 14, 18, 22]; // Adjusted options
      const sampleSize = Math.min(100, Math.floor(activeEmbeddings.length * 0.1), 300); // Adjusted sample
      
      const shuffledEmbeddings = [...activeEmbeddings].sort(() => 0.5 - Math.random());
      const sampleQueryEmbeddings = shuffledEmbeddings.slice(0, sampleSize);

      let currentBestAvgCandidates = Infinity;
      let foundSuitableLSH = false;

      // Adjusted target candidate range
      const kForLSHHeuristic = kMeansTunedKForRebuild > 0 ? kMeansTunedKForRebuild : (this.clusterIndex ? this.clusterIndex.numClusters : 30);
      let targetMinCandidates = Math.max(10, Math.floor(activeEmbeddings.length * 0.005), kForLSHHeuristic);
      let targetMaxCandidates = Math.min(300, Math.floor(activeEmbeddings.length * 0.08), kForLSHHeuristic * 10);
      if (targetMinCandidates > targetMaxCandidates) targetMinCandidates = Math.max(10, Math.floor(targetMaxCandidates / 2));


      console.log(`LSH 调优目标候选范围: [${targetMinCandidates} - ${targetMaxCandidates}]`);

      for (const tables of numHashTablesOptions) {
        for (const funcs of numHashFunctionsOptions) {
          if (tables * funcs > 256 && tables * funcs > activeEmbeddings.length * 0.5) continue;

          console.log(`  测试 LSH: Tables=${tables}, Functions=${funcs}`);
          const tempLSHIndex = new LSHIndex(1024, tables, funcs);
          activeEmbeddings.forEach((emb, idx) => {
            if (activeDocuments[idx] && emb) { // Ensure doc and emb exist
              tempLSHIndex.addVector(emb, activeDocuments[idx].id);
            }
          });

          let totalCandidates = 0;
          if (sampleQueryEmbeddings.length > 0) {
            for (const queryEmb of sampleQueryEmbeddings) {
              if(queryEmb) { // Ensure query embedding is valid
                const candidates = tempLSHIndex.getCandidates(queryEmb);
                totalCandidates += candidates.length;
              }
            }
            const avgCandidates = totalCandidates / sampleQueryEmbeddings.length;
            console.log(`    平均候选者数量: ${avgCandidates.toFixed(2)}`);

            if (avgCandidates >= targetMinCandidates && avgCandidates <= targetMaxCandidates) {
              if (!foundSuitableLSH || avgCandidates < currentBestAvgCandidates) {
                currentBestAvgCandidates = avgCandidates;
                bestLSHConfig = { numHashTables: tables, numHashFunctions: funcs };
                foundSuitableLSH = true;
              }
            } else if (!foundSuitableLSH && avgCandidates > targetMaxCandidates && avgCandidates < currentBestAvgCandidates) {
              currentBestAvgCandidates = avgCandidates;
              bestLSHConfig = { numHashTables: tables, numHashFunctions: funcs };
            }
          }
        }
      }
      if (foundSuitableLSH || currentBestAvgCandidates !== Infinity) { // Take best found even if not "ideal"
        console.log(`LSH 参数调优完成，选择配置: Tables=${bestLSHConfig.numHashTables}, Functions=${bestLSHConfig.numHashFunctions}, 平均候选者: ${currentBestAvgCandidates.toFixed(2)}`);
      } else {
        console.log('LSH 参数调优未能找到理想配置，将保留或使用默认。');
      }
      this.tunedLSHConfig = bestLSHConfig;
    }

    // 3. 使用调优后的参数重建索引
    console.log(`Tune 方法完成，将使用 K=${this.tunedKValue} 和 LSH 配置调用 rebuildIndices(false)`);
    await this.rebuildIndices(false); // forceTune is false, it will use this.tunedKValue

    // Clear the temporary tunedKValue after rebuildIndices has used it
    // this.tunedKValue = null; // Already cleared inside rebuildIndices if used

    console.log('性能调优完成');
  }
}

module.exports = HybridVectorStore;