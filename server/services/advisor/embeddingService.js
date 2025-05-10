const { OpenAI } = require('openai');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

class EmbeddingService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.DASHSCOPE_API_KEY,
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    });
    
    this.cacheDir = process.env.CACHE_DIRECTORY || path.join(process.cwd(), 'data/cache');
    fs.ensureDirSync(this.cacheDir);
    
    this.embeddingCache = this._loadCache();
  }
  
  // 加载向量缓存
  _loadCache() {
    const cacheFile = path.join(this.cacheDir, 'embedding-cache.json');
    if (fs.existsSync(cacheFile)) {
      try {
        console.log("加载嵌入缓存...");
        const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        console.log(`成功加载${Object.keys(cache).length}个缓存向量`);
        return cache;
      } catch (error) {
        console.error("加载缓存失败:", error);
      }
    }
    return {};
  }
  
  // 保存向量缓存
  _saveCache() {
    const cacheFile = path.join(this.cacheDir, 'embedding-cache.json');
    try {
      fs.writeFileSync(cacheFile, JSON.stringify(this.embeddingCache));
      console.log(`缓存保存成功，共${Object.keys(this.embeddingCache).length}个向量`);
    } catch (error) {
      console.error("保存缓存失败:", error);
    }
  }
  
  // 生成文本哈希用于缓存
  _hashText(text) {
    return crypto.createHash('md5').update(text).digest('hex');
  }
  
  // 获取单个文本的嵌入向量
  async getEmbedding(text) {
    const hash = this._hashText(text);
    
    // 检查缓存
    if (this.embeddingCache[hash]) {
      return this.embeddingCache[hash];
    }
    
    try {
      console.log(`为文本生成嵌入: "${text.substring(0, 50)}..."`);
      
      const response = await this.openai.embeddings.create({
        model: "text-embedding-v3",
        input: text,
        dimensions: 1024
      });
      
      const embedding = response.data[0].embedding;
      
      // 更新缓存
      this.embeddingCache[hash] = embedding;
      
      // 每处理10个新向量保存一次缓存
      if (Object.keys(this.embeddingCache).length % 10 === 0) {
        this._saveCache();
      }
      
      return embedding;
    } catch (error) {
      console.error("获取嵌入失败:", error.message);
      throw error;
    }
  }
  
  // 批量获取嵌入
  async getBatchEmbeddings(texts, batchSize = 10) {
    console.log(`处理${texts.length}个文本批次，每批${batchSize}个`);
    
    const results = [];
    const missingTexts = [];
    const missingIndices = [];
    
    // 首先检查缓存
    for (let i = 0; i < texts.length; i++) {
      const hash = this._hashText(texts[i]);
      
      if (this.embeddingCache[hash]) {
        results[i] = this.embeddingCache[hash];
      } else {
        missingTexts.push(texts[i]);
        missingIndices.push(i);
      }
    }
    
    // 如果有缺失的文本，批量获取它们的嵌入
    if (missingTexts.length > 0) {
      console.log(`需要为${missingTexts.length}个文本生成嵌入`);
      
      for (let i = 0; i < missingTexts.length; i += batchSize) {
        const batch = missingTexts.slice(i, i + batchSize);
        const batchIndices = missingIndices.slice(i, i + batchSize);
        
        console.log(`处理批次${Math.floor(i/batchSize) + 1}/${Math.ceil(missingTexts.length/batchSize)}`);
        
        try {
          const response = await this.openai.embeddings.create({
            model: "text-embedding-v3",
            input: batch
          });
          
          // 处理响应
          for (let j = 0; j < batch.length; j++) {
            const embedding = response.data[j].embedding;
            const hash = this._hashText(batch[j]);
            
            // 更新缓存和结果
            this.embeddingCache[hash] = embedding;
            results[batchIndices[j]] = embedding;
          }
        } catch (error) {
          console.error(`批次${Math.floor(i/batchSize) + 1}处理失败:`, error.message);
          
          // 单独处理每个文本
          for (let j = 0; j < batch.length; j++) {
            try {
              const embedding = await this.getEmbedding(batch[j]);
              results[batchIndices[j]] = embedding;
            } catch (innerError) {
              console.error(`文本处理失败:`, innerError.message);
              results[batchIndices[j]] = null; // 标记为失败
            }
          }
        }
      }
      
      // 保存更新后的缓存
      this._saveCache();
    }
    
    return results;
  }
  
  // 关闭服务
  close() {
    this._saveCache();
  }
}

module.exports = EmbeddingService;