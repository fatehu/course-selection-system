const path = require('path');
const fs = require('fs-extra');
const DocumentProcessor = require('./documentProcessor');
const EmbeddingService = require('./embeddingService');
const VectorStore = require('./vectorStore');
const DeepSeekService = require('./deepseekService');
const conversationService = require('./conversationService');
require('dotenv').config();

class AdvisorService {
  constructor() {
    this.initialized = false;
    this.initializingPromise = null;
    
    // 配置文件路径
    this.pdfPaths = [
      path.join(process.cwd(), 'data/merits.pdf'),
      // path.join(process.cwd(), 'data/public.pdf'),
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
  async answerQuestion(question, userId, sessionId = null, knowledgeBaseId = null, useWebSearch = false) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    console.log(`收到问题: "${question}" 用户ID: ${userId} 会话ID: ${sessionId || '新会话'} 知识库ID: ${knowledgeBaseId} 使用网络搜索: ${useWebSearch || false}`);
    
    // 如果没有提供会话ID，创建新会话
    if (!sessionId) {
      sessionId = await conversationService.createConversation(userId);
      console.log(`创建新会话: ${sessionId}`);
    }
    
    try {
      // 添加用户问题到会话
      await conversationService.addMessage(sessionId, {
        role: 'user',
        content: question
      });
      
      // 获取对话历史
      const conversationHistory = await conversationService.getRecentMessages(sessionId);
      
      // 为问题生成嵌入向量
      const queryEmbedding = await this.embeddingService.getEmbedding(question);
      
      // 搜索相关文档
      let searchResults = [];
      
      if (knowledgeBaseId) {
        // 使用指定知识库搜索
        const knowledgeBaseService = require('../knowledgeBaseService');
        searchResults = await knowledgeBaseService.searchKnowledgeBase(knowledgeBaseId, question, 5);
      } else {
        // 使用默认向量存储搜索
        searchResults = this.vectorStore.similaritySearch(queryEmbedding, 5);
      }
      
      console.log(`找到${searchResults.length}个相关文档片段`);
      
      // 处理网络搜索
      let webResults = [];
      let customSystemPrompt = null;
      
      if (useWebSearch) {
        console.log("执行网络搜索...");
        try {
          // 导入网络搜索服务
          const webSearchService = require('../webSearchService');
          const webSearchResults = await webSearchService.search(question, 5);
          
          if (webSearchResults && webSearchResults.success) {
            webResults = webSearchResults.results;
            console.log(`获取到${webResults.length}个网络搜索结果`);
            
            // 构建包含网络搜索结果的内容
            const webResultsText = webResults.map(result => 
              `标题: ${result.title}\n摘要: ${result.snippet}\n来源: ${result.url}`
            ).join('\n\n---\n\n');
            
            // 不替换原有提示词，而是在其基础上添加网络搜索结果
            customSystemPrompt = this.deepseekService.systemPrompt + 
              `\n\n以下是网络搜索结果，请根据这些结果回答问题，即使问题不是关于学习或选课的：\n\n${webResultsText}`;
            
            console.log("已添加网络搜索结果到系统提示");
          } else {
            console.log("网络搜索未返回结果或结果不正确");
          }
        } catch (error) {
          console.error("网络搜索出错:", error);
        }
      }
      
      // 合并文档结果，添加网络搜索结果
      const combinedResults = [...searchResults];
      if (webResults.length > 0) {
        webResults.forEach((result, index) => {
          combinedResults.push({
            document: {
              content: `标题: ${result.title}\n摘要: ${result.snippet}\n来源: ${result.url}`,
              id: `web-${index}`,
              metadata: { 
                source: 'web-search', 
                url: result.url 
              }
            },
            similarity: 0.9 - (index * 0.05) // 给网络搜索结果一个较高的初始权重
          });
        });
      }
      
      // 生成回答，传递对话历史和自定义系统提示
      const answer = await this.deepseekService.generateAnswer(
        question, 
        combinedResults,
        conversationHistory,
        customSystemPrompt // 如果有网络搜索结果，使用自定义提示词；否则使用默认提示词
      );
      
      // 添加AI回答到会话
      await conversationService.addMessage(sessionId, {
        role: 'assistant',
        content: answer
      });
      
      return { sessionId, answer };
    } catch (error) {
      console.error("回答问题出错:", error);
      return { 
        sessionId,
        answer: "抱歉，我暂时无法回答您的问题。请稍后再试。" 
      };
    }
  }

  // 流式回答问题
  async *answerQuestionStream(question, userId, sessionId = null, knowledgeBaseId = null, useWebSearch = false, useDeepThinking = false) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    console.log(`收到流式问题: "${question}" 用户ID: ${userId} 会话ID: ${sessionId || '新会话'} 知识库ID: ${knowledgeBaseId} 使用网络搜索: ${useWebSearch || false} 深度思考: ${useDeepThinking || false}`);
    
    // 如果没有提供会话ID，创建新会话
    if (!sessionId) {
      sessionId = await conversationService.createConversation(userId);
      console.log(`创建新会话: ${sessionId}`);
    }
    
    try {
      // 添加用户问题到会话
      await conversationService.addMessage(sessionId, {
        role: 'user',
        content: question
      });
      
      // 获取对话历史
      const conversationHistory = await conversationService.getRecentMessages(sessionId);
      
      // 为问题生成嵌入向量
      const queryEmbedding = await this.embeddingService.getEmbedding(question);
      
      // 搜索相关文档
      let searchResults = [];
      
      if (knowledgeBaseId) {
        // 使用指定知识库搜索
        const knowledgeBaseService = require('../knowledgeBaseService');
        searchResults = await knowledgeBaseService.searchKnowledgeBase(knowledgeBaseId, question, 5);
      } else {
        // 使用默认向量存储搜索
        searchResults = this.vectorStore.similaritySearch(queryEmbedding, 5);
      }
      
      console.log(`找到${searchResults.length}个相关文档片段`);
      
      // 处理网络搜索
      let webResults = [];
      let customSystemPrompt = null;
      
      if (useWebSearch) {
        console.log("执行流式响应的网络搜索...");
        try {
          // 导入网络搜索服务
          const webSearchService = require('../webSearchService');
          const webSearchResults = await webSearchService.search(question, 5);
          
          if (webSearchResults && webSearchResults.success) {
            webResults = webSearchResults.results;
            console.log(`获取到${webResults.length}个网络搜索结果用于流式响应`);
            
            // 构建包含网络搜索结果的内容
            const webResultsText = webResults.map(result => 
              `标题: ${result.title}\n摘要: ${result.snippet}\n来源: ${result.url}`
            ).join('\n\n---\n\n');
            
            // 不替换原有提示词，而是在其基础上添加网络搜索结果
            customSystemPrompt = this.deepseekService.systemPrompt + 
              `\n\n以下是网络搜索结果，请根据这些结果回答问题，即使问题不是关于学习或选课的：\n\n${webResultsText}`;
            
            console.log("已添加网络搜索结果到流式响应系统提示");
          } else {
            console.log("流式响应的网络搜索未返回结果或结果不正确");
          }
        } catch (error) {
          console.error("流式响应的网络搜索出错:", error);
        }
      }
      
      // 合并文档结果，添加网络搜索结果
      const combinedResults = [...searchResults];
      if (webResults.length > 0) {
        webResults.forEach((result, index) => {
          combinedResults.push({
            document: {
              content: `标题: ${result.title}\n摘要: ${result.snippet}\n来源: ${result.url}`,
              id: `web-${index}`,
              metadata: { 
                source: 'web-search', 
                url: result.url 
              }
            },
            similarity: 0.9 - (index * 0.05) // 给网络搜索结果一个较高的初始权重
          });
        });
      }
      
      // 收集完整回答
      let fullAnswer = '';
      let reasoning = '';
      
      // 根据是否使用深度思考模式选择不同的方法
      if (useDeepThinking) {
        // 使用思维链模式生成回答
        for await (const chunk of this.deepseekService.generateAnswerStreamWithReasoning(
          question, 
          combinedResults, 
          conversationHistory,
          customSystemPrompt
        )) {
          if (chunk.type === 'answer') {
            fullAnswer += chunk.content;
            yield { sessionId, chunk: chunk.content, type: 'answer' };
          } 
          else if (chunk.type === 'reasoning') {
            reasoning += chunk.content;
            console.log(`[AI辅导员] 收到思维链内容，当前长度: ${reasoning.length}`);
            yield { sessionId, chunk: chunk.content, type: 'reasoning' };
          }
          else if (chunk.type === 'error') {
            yield { sessionId, chunk: chunk.content, type: 'error' };
          }
        }
      } else {
        // 使用普通模式生成回答
        for await (const chunk of this.deepseekService.generateAnswerStream(
          question, 
          combinedResults, 
          conversationHistory,
          customSystemPrompt
        )) {
          fullAnswer += chunk;
          yield { sessionId, chunk };
        }
      }
      
      // 添加完整AI回答到会话（不包含思维链）
      await conversationService.addMessage(sessionId, {
        role: 'assistant',
        content: fullAnswer
      });
    } catch (error) {
      console.error("流式回答问题时出错:", error);
      const errorMessage = "抱歉，我暂时无法回答您的问题。请稍后再试。";
      
      // 添加错误信息到会话
      await conversationService.addMessage(sessionId, {
        role: 'assistant',
        content: errorMessage
      });
      
      yield { sessionId, chunk: errorMessage };
    }
  }
  
  // 获取会话信息
  async getConversation(sessionId) {
    return await conversationService.getConversation(sessionId);
  }
  
  // 获取用户会话列表
  async getUserConversations(userId) {
    return await conversationService.getUserConversations(userId);
  }
  
  // 获取会话消息
  async getConversationMessages(sessionId) {
    return await conversationService.getConversationMessages(sessionId);
  }

  // 生成会话标题
  async generateTitle(questionText) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // 调用DeepSeek服务生成标题
      const prompt = `请为以下问题生成一个简短的标题(10个字以内)，不要使用引号，仅返回标题本身：\n"${questionText}"`;
      
      const response = await this.deepseekService.client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "你是一个简洁标题生成器，只输出标题文本，不加任何其他内容。" },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 20
      });
      
      let title = response.choices[0].message.content.trim();
      
      // 确保标题不超过30个字符
      if (title.length > 30) {
        title = title.substring(0, 27) + '...';
      }
      
      return title;
    } catch (error) {
      console.error("生成标题失败:", error);
      // 如果生成失败，使用问题的前20个字符作为标题
      return questionText.length > 20 ? 
            questionText.substring(0, 17) + '...' : 
            questionText;
    }
  }
}

module.exports = new AdvisorService();