// server/services/advisor/index.js
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { SimpleVectorStore } = require('./vectorStore');
const { callDeepSeek } = require('./deepseekService');

class AdvisorService {
  constructor() {
    this.vectorStore = new SimpleVectorStore();
    this.initialized = false;
    this.initializingPromise = null;
    this.pdfPaths = [
      path.join(__dirname, '../../data/merits.pdf'),
      path.join(__dirname, '../../data/public.pdf')
    ];
    this.vectorStorePath = path.join(__dirname, '../../data/vector-store.json');
  }
  
  async initialize() {
    if (this.initialized) return;
    
    if (this.initializingPromise) {
      await this.initializingPromise;
      return;
    }
    
    this.initializingPromise = (async () => {
      console.log("初始化AI辅导员服务...");
      
      // 创建data目录（如果不存在）
      const dataDir = path.join(__dirname, '../../data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      // 尝试加载现有的向量存储
      const loaded = await this.vectorStore.load(this.vectorStorePath);
      
      if (!loaded) {
        // 检查PDF文件是否存在
        const pdfExists = this.pdfPaths.some(pdfPath => fs.existsSync(pdfPath));
        if (!pdfExists) {
          throw new Error("找不到必要的PDF文件，请确保培养方案和学生手册PDF已放置在正确位置");
        }
        
        // 提取PDF文本并分割为段落
        const paragraphs = [];
        
        for (const pdfPath of this.pdfPaths) {
          if (fs.existsSync(pdfPath)) {
            console.log(`处理PDF: ${pdfPath}`);
            const dataBuffer = fs.readFileSync(pdfPath);
            const data = await pdfParse(dataBuffer);
            
            // 分割PDF文本成段落
            const pdfParagraphs = data.text
              .split(/\n\s*\n/)
              .map(p => p.trim())
              .filter(p => p.length > 10);  // 过滤太短的段落
            
            paragraphs.push(...pdfParagraphs);
            console.log(`从${pdfPath}提取了${pdfParagraphs.length}个段落`);
          }
        }
        
        if (paragraphs.length === 0) {
          throw new Error("无法从PDF文件中提取有效内容");
        }
        
        // 为段落生成嵌入向量并添加到向量存储
        await this.vectorStore.addDocuments(paragraphs);
        
        // 保存向量存储到文件
        await this.vectorStore.save(this.vectorStorePath);
      }
      
      this.initialized = true;
      console.log("AI辅导员服务初始化完成");
    })();
    
    await this.initializingPromise;
  }
  
  async answerQuestion(question) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    console.log(`收到问题: "${question}"`);
    
    try {
      // 使用向量存储检索相关文档
      const searchResults = await this.vectorStore.similaritySearch(question, 5);
      
      // 提取相关内容
      const relevantContent = searchResults
        .map(result => `[相似度: ${result.similarity.toFixed(2)}] ${result.pageContent}`)
        .join("\n\n");
      
      console.log(`找到${searchResults.length}个相关段落`);
      
      // 调用DeepSeek API
      const answer = await callDeepSeek(question, relevantContent);
      return answer;
    } catch (error) {
      console.error("回答问题出错:", error);
      return "抱歉，我暂时无法回答您的问题。请稍后再试。";
    }
  }
}

module.exports = new AdvisorService();