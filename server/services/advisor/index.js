const path = require('path');
const fs = require('fs-extra');
const DocumentProcessor = require('./documentProcessor');
const EmbeddingService = require('./embeddingService');
const VectorStore = require('./vectorStore');
const DeepSeekService = require('./deepseekService');
require('dotenv').config();

class AdvisorService {
  constructor() {
    this.initialized = false;
    this.initializingPromise = null;
    
    // 配置文件路径
    this.pdfPaths = [
      path.join(process.cwd(), 'data/merits.pdf'),
      path.join(process.cwd(), 'data/public.pdf'),
      path.join(process.cwd(), 'data/student.pdf')
    ];
    
    this.vectorStorePath = process.env.VECTOR_STORE_PATH || 
                           path.join(process.cwd(), 'data/vector-store.json');
    
    // 初始化组件
    this.documentProcessor = new DocumentProcessor();
    this.embeddingService = new EmbeddingService();
    this.vectorStore = new VectorStore({ storePath: this.vectorStorePath });
    this.deepseekService = new DeepSeekService();
  }
  
  // 初始化服务
  async initialize() {
    if (this.initialized) return;
    
    if (this.initializingPromise) {
      await this.initializingPromise;
      return;
    }
    
    this.initializingPromise = (async () => {
      console.log("初始化AI辅导员服务...");
      
      // 尝试加载现有向量存储
      const loaded = this.vectorStore.load();
      
      if (loaded) {
        console.log("成功加载现有向量存储");
      } else {
        console.log("需要创建新的向量存储");
        
        // 检查PDF文件是否存在
        const pdfExists = this.pdfPaths.some(pdfPath => fs.existsSync(pdfPath));
        if (!pdfExists) {
          throw new Error("找不到必要的PDF文件，请确保培养方案和学生手册PDF已放置在正确位置");
        }
        
        // 处理PDF文件
        const allChunks = await this.documentProcessor.processMultiplePDFs(this.pdfPaths);
        console.log(`成功处理${allChunks.length}个文本块`);
        
        // 生成嵌入向量
        const contentsOnly = allChunks.map(chunk => chunk.content);
        const embeddings = await this.embeddingService.getBatchEmbeddings(contentsOnly);
        
        // 添加到向量存储
        this.vectorStore.addDocuments(allChunks, embeddings);
        
        // 保存向量存储
        this.vectorStore.save();
      }
      
      this.initialized = true;
      console.log("AI辅导员服务初始化完成");
    })();
    
    await this.initializingPromise;
  }
  
  // 回答问题
  async answerQuestion(question) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    console.log(`收到问题: "${question}"`);
    
    try {
      // 为问题生成嵌入向量
      const queryEmbedding = await this.embeddingService.getEmbedding(question);
      
      // 搜索相关文档
      const searchResults = this.vectorStore.similaritySearch(queryEmbedding, 5);
      console.log(`找到${searchResults.length}个相关文档片段`);
      
      // 生成回答
      const answer = await this.deepseekService.generateAnswer(question, searchResults);
      
      return answer;
    } catch (error) {
      console.error("回答问题时出错:", error);
      return "抱歉，我暂时无法回答您的问题。请稍后再试。";
    }
  }

  // 流式回答问题
  async *answerQuestionStream(question) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    console.log(`收到流式问题: "${question}"`);
    
    try {
      // 为问题生成嵌入向量
      const queryEmbedding = await this.embeddingService.getEmbedding(question);
      
      // 搜索相关文档
      const searchResults = this.vectorStore.similaritySearch(queryEmbedding, 5);
      console.log(`找到${searchResults.length}个相关文档片段`);
      
      // 流式生成回答
      for await (const chunk of this.deepseekService.generateAnswerStream(question, searchResults)) {
        yield chunk;
      }
    } catch (error) {
      console.error("流式回答问题时出错:", error);
      yield "抱歉，我暂时无法回答您的问题。请稍后再试。";
    }
  }
}

module.exports = new AdvisorService();