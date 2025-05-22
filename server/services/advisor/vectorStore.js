/**
 * 向量存储入口文件
 * 使用混合索引实现，保持API兼容性
 */
const HybridVectorStore = require('./hybridVectorStore');

// 为了保持向后兼容，导出HybridVectorStore作为EnhancedVectorStore
class EnhancedVectorStore extends HybridVectorStore {
  constructor(options = {}) {
    super(options);
    console.log('EnhancedVectorStore (基于混合索引) 初始化完成');
  }
}

module.exports = EnhancedVectorStore;