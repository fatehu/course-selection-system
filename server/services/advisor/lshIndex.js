/**
 * 局部敏感哈希(LSH)索引实现
 * 用于O(1)时间复杂度的向量相似性粗筛
 */
const crypto = require('crypto');

class LSHIndex {
  constructor(dimensions = 1024, numHashTables = 16, numHashFunctions = 8) {
    this.dimensions = dimensions;
    this.numHashTables = numHashTables;
    this.numHashFunctions = numHashFunctions;
    this.hashTables = [];
    this.randomVectors = [];
    this.buckets = new Map(); // 存储哈希桶
    
    this.initializeHashFunctions();
    console.log(`LSH索引初始化: ${numHashTables}个哈希表, ${numHashFunctions}个哈希函数`);
  }
  
  /**
   * 初始化随机投影向量
   */
  initializeHashFunctions() {
    this.randomVectors = [];
    
    for (let i = 0; i < this.numHashTables; i++) {
      const tableVectors = [];
      for (let j = 0; j < this.numHashFunctions; j++) {
        // 生成高斯随机向量
        const vector = this.generateGaussianVector(this.dimensions);
        tableVectors.push(vector);
      }
      this.randomVectors.push(tableVectors);
      this.hashTables.push(new Map());
    }
  }
  
  /**
   * 生成高斯分布随机向量
   */
  generateGaussianVector(dimension) {
    const vector = new Array(dimension);
    for (let i = 0; i < dimension; i++) {
      // Box-Muller变换生成高斯分布
      const u1 = Math.random();
      const u2 = Math.random();
      vector[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }
    return vector;
  }
  
  /**
   * 计算向量的LSH哈希值
   */
  computeHash(vector, tableIndex) {
    const tableVectors = this.randomVectors[tableIndex];
    let hashValue = '';
    
    for (let i = 0; i < this.numHashFunctions; i++) {
      const dotProduct = this.dotProduct(vector, tableVectors[i]);
      hashValue += (dotProduct >= 0) ? '1' : '0';
    }
    
    return hashValue;
  }
  
  /**
   * 向量点积计算
   */
  dotProduct(vecA, vecB) {
    let sum = 0;
    for (let i = 0; i < vecA.length; i++) {
      sum += vecA[i] * vecB[i];
    }
    return sum;
  }
  
  /**
   * 添加向量到LSH索引
   */
  addVector(vector, documentId) {
    for (let tableIndex = 0; tableIndex < this.numHashTables; tableIndex++) {
      const hashValue = this.computeHash(vector, tableIndex);
      
      if (!this.hashTables[tableIndex].has(hashValue)) {
        this.hashTables[tableIndex].set(hashValue, new Set());
      }
      
      this.hashTables[tableIndex].get(hashValue).add(documentId);
    }
  }
  
  /**
   * 获取候选向量集合
   */
  getCandidates(queryVector) {
    const candidates = new Set();
    
    for (let tableIndex = 0; tableIndex < this.numHashTables; tableIndex++) {
      const hashValue = this.computeHash(queryVector, tableIndex);
      
      if (this.hashTables[tableIndex].has(hashValue)) {
        const bucket = this.hashTables[tableIndex].get(hashValue);
        bucket.forEach(docId => candidates.add(docId));
      }
    }
    
    return Array.from(candidates);
  }
  
  /**
   * 移除向量
   */
  removeVector(documentId) {
    for (let tableIndex = 0; tableIndex < this.numHashTables; tableIndex++) {
      for (const [hashValue, bucket] of this.hashTables[tableIndex]) {
        bucket.delete(documentId);
        // 清理空桶
        if (bucket.size === 0) {
          this.hashTables[tableIndex].delete(hashValue);
        }
      }
    }
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    let totalBuckets = 0;
    let totalDocuments = 0;
    const bucketSizes = [];
    
    for (let tableIndex = 0; tableIndex < this.numHashTables; tableIndex++) {
      totalBuckets += this.hashTables[tableIndex].size;
      
      for (const [, bucket] of this.hashTables[tableIndex]) {
        const bucketSize = bucket.size;
        totalDocuments += bucketSize;
        bucketSizes.push(bucketSize);
      }
    }
    
    return {
      totalBuckets,
      totalDocuments,
      avgBucketSize: totalDocuments / totalBuckets || 0,
      maxBucketSize: Math.max(...bucketSizes, 0),
      minBucketSize: Math.min(...bucketSizes, 0)
    };
  }
  
  /**
   * 序列化为JSON
   */
  toJSON() {
    return {
      dimensions: this.dimensions,
      numHashTables: this.numHashTables,
      numHashFunctions: this.numHashFunctions,
      randomVectors: this.randomVectors,
      hashTables: Array.from({ length: this.numHashTables }, (_, i) => 
        Array.from(this.hashTables[i].entries()).map(([key, value]) => [key, Array.from(value)])
      )
    };
  }
  
  /**
   * 从JSON反序列化
   */
  static fromJSON(data) {
    const lsh = new LSHIndex(data.dimensions, data.numHashTables, data.numHashFunctions);
    lsh.randomVectors = data.randomVectors;
    
    // 重建哈希表
    for (let i = 0; i < data.numHashTables; i++) {
      lsh.hashTables[i] = new Map();
      if (data.hashTables[i]) {
        for (const [key, value] of data.hashTables[i]) {
          lsh.hashTables[i].set(key, new Set(value));
        }
      }
    }
    
    return lsh;
  }
}

module.exports = LSHIndex;