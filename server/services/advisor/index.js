const path = require('path');
const fs = require('fs-extra'); // 使用 fs-extra 的 Promise 版本
const DocumentProcessor = require('./documentProcessor');
const embeddingService = require('./embeddingService');
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
    this.embeddingService = embeddingService;
    this.vectorStore = new VectorStore({ storePath: this.vectorStorePath });
    this.deepseekService = new DeepSeekService();

    // 重排配置
    this.rerankingConfig = {
      enabled: process.env.ENABLE_RERANKING !== 'false', // 默认启用
      topK: 10, // 初始检索的文档数量
      finalK: 5, // 重排后保留的文档数量
      batchSize: 5 // 每批评估的文档数量
    };
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

      // 尝试加载现有向量存储 (异步)
      const loaded = await this.vectorStore.load(); // <--- 修改: 使用 await

      if (loaded) {
        console.log("成功加载现有向量存储");
      } else {
        console.log("需要创建新的向量存储");

        // 检查PDF文件是否存在 (异步)
        const pdfChecks = await Promise.all(this.pdfPaths.map(pdfPath => fs.pathExists(pdfPath)));
        const pdfExists = pdfChecks.some(exists => exists);

        if (!pdfExists) {
          throw new Error("找不到必要的PDF文件，请确保培养方案和学生手册PDF已放置在正确位置");
        }

        // 处理PDF文件 (已经是异步)
        const allChunks = await this.documentProcessor.processMultipleFiles(this.pdfPaths);
        console.log(`成功处理${allChunks.length}个文本块`);

        // 生成嵌入向量 (已经是异步)
        const contentsOnly = allChunks.map(chunk => chunk.content);
        const embeddings = await this.embeddingService.getBatchEmbeddings(contentsOnly);

        // 添加到向量存储 (同步)
        this.vectorStore.addDocuments(allChunks, embeddings);

        // 保存向量存储 (异步)
        await this.vectorStore.save(); // <--- 修改: 使用 await
      }

      this.initialized = true;
      console.log("AI辅导员服务初始化完成");
    })();

    await this.initializingPromise;
  }

  // ... (optimizeSearchQuery 保持不变)
  async optimizeSearchQuery(originalQuery, context = '') {
    try {
      console.log(`优化搜索查询: "${originalQuery}"`);

      // 构建优化提示词
      const systemPrompt = `你是一个搜索查询优化专家。你的任务是将用户的自然语言问题转换为更有效的搜索关键词。

优化规则：
1. 提取核心关键词，去除无关的词汇和语气词
2. 添加相关的同义词或专业术语
3. 保持查询简洁但信息丰富
4. 如果是中文查询，可以考虑添加英文关键词以获得更全面的结果
5. 针对不同类型的问题使用不同的优化策略
6. 对于技术问题，添加相关的技术术语
7. 对于时事问题，添加时间相关的关键词

示例：
- "怎么学好编程？" → "编程学习方法 programming learning tips 初学者"
- "北京天气怎么样？" → "北京天气预报 Beijing weather forecast 今日"
- "人工智能的发展趋势" → "人工智能发展趋势 AI development trends 2024 未来"
- "最新的iPhone怎么样？" → "iPhone 15 评测 review 最新款 性能测试"

请只返回优化后的搜索关键词，不要添加任何解释或引号。`;

      const userPrompt = context ?
        `基于以下对话上下文：${context}\n\n请优化搜索查询：${originalQuery}` :
        `请优化以下搜索查询：${originalQuery}`;

      const response = await this.deepseekService.client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 150
      });

      const optimizedQuery = response.choices[0].message.content.trim();

      // 确保优化后的查询不为空且合理
      if (!optimizedQuery || optimizedQuery.length === 0 || optimizedQuery.length > 200) {
        console.log('查询优化返回异常结果，使用原查询');
        return originalQuery;
      }

      console.log(`查询优化完成: "${originalQuery}" → "${optimizedQuery}"`);
      return optimizedQuery;
    } catch (error) {
      console.error('查询优化失败:', error.message);
      // 如果优化失败，返回原查询
      return originalQuery;
    }
  }


  // 获取用户自定义设置的方法
  async getUserSettings(userId) {
    const SETTINGS_DIR = path.join(process.cwd(), 'data/settings');
    const settingsPath = path.join(SETTINGS_DIR, `advisor-settings-${userId}.json`);

    // 确保目录存在
    await fs.ensureDir(SETTINGS_DIR);

    // 读取用户设置
    if (await fs.pathExists(settingsPath)) {
      try {
        const settings = await fs.readJson(settingsPath);
        return settings;
      } catch (error) {
        console.error('读取用户设置失败:', error);
      }
    }

    // 如果读取失败或文件不存在，返回默认设置
    return null;
  }

  // ... (answerQuestion, answerQuestionStream, getConversation, getUserConversations, getConversationMessages, generateTitle, generateCourseReviewSummary 保持不变, 但内部调用已变为异步)
  // 回答问题
  async answerQuestion(question, userId, sessionId = null, knowledgeBaseId = null, useWebSearch = false) {
    if (!this.initialized) {
      await this.initialize();
    }

    console.log(`收到问题: "${question}" 用户ID: ${userId} 会话ID: ${sessionId || '新会话'} 知识库ID: ${knowledgeBaseId} 使用网络搜索: ${useWebSearch || false}`);

    // 获取用户自定义设置 (已异步)
    const userSettings = await this.getUserSettings(userId);

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

      // 获取对话历史 - 使用用户设置的历史长度
      const historyLength = userSettings?.historyLength || 10;
      const conversationHistory = await conversationService.getRecentMessages(sessionId, historyLength);

      // 为问题生成嵌入向量 (已异步)
      const queryEmbedding = await this.embeddingService.getEmbedding(question);

      // 搜索相关文档
      let searchResults = [];

      if (knowledgeBaseId) {
        // 使用指定知识库搜索
        const knowledgeBaseService = require('../knowledgeBaseService');
        // 如果启用重排，检索更多文档
        const searchK = this.rerankingConfig.enabled ? this.rerankingConfig.topK : 5;
        searchResults = await knowledgeBaseService.searchKnowledgeBase(knowledgeBaseId, question, searchK);
      } else {
        // 使用默认向量存储搜索
        const searchK = this.rerankingConfig.enabled ? this.rerankingConfig.topK : 5;
        searchResults = this.vectorStore.similaritySearch(queryEmbedding, searchK);
      }

      console.log(`找到${searchResults.length}个相关文档片段`);

      // 对搜索结果进行重排 (已异步)
      if (this.rerankingConfig.enabled && searchResults.length > 0) {
        console.log('开始对搜索结果进行LLM重排...');

        // 根据文档数量选择重排策略
        if (searchResults.length > 5) {
          // 文档较多时使用高级批量评分方法
          searchResults = await this.rerankDocumentsAdvanced(question, searchResults);
        } else {
          // 文档较少时使用简单排序方法
          searchResults = await this.rerankDocuments(question, searchResults);
        }

        // 保留重排后的前K个文档
        searchResults = searchResults.slice(0, this.rerankingConfig.finalK);
        console.log(`重排后保留${searchResults.length}个最相关文档`);
      }

      // 处理网络搜索
      let webResults = [];
      let customSystemPrompt = null;

      if (useWebSearch) {
        console.log("执行网络搜索...");
        try {
          // 导入网络搜索服务
          const webSearchService = require('../webSearchService');

          // 构建上下文用于查询优化
          const searchContext = conversationHistory.length > 0 ?
            `最近的对话: ${conversationHistory.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('; ')}` : '';

          // 优化搜索查询 (已异步)
          const optimizedQuery = await this.optimizeSearchQuery(question, searchContext);
          console.log(`使用优化后的查询进行搜索: "${optimizedQuery}"`);

          // 使用优化后的查询进行搜索
          const webSearchResults = await webSearchService.search(optimizedQuery, 5);

          if (webSearchResults && webSearchResults.success) {
            webResults = webSearchResults.results;
            console.log(`获取到${webResults.length}个网络搜索结果`);

            // 构建包含网络搜索结果的内容
            const webResultsText = webResults.map(result =>
              `标题: ${result.title}\n摘要: ${result.snippet}\n来源: ${result.url}`
            ).join('\n\n---\n\n');

            // 使用用户自定义系统提示词，如果存在的话
            if (userSettings?.systemPrompt) {
              customSystemPrompt = userSettings.systemPrompt +
                `\n\n以下是基于优化查询"${optimizedQuery}"的网络搜索结果，请根据这些结果回答问题，即使问题不是关于学习或选课的：\n\n${webResultsText}`;
            } else {
              // 否则使用默认提示词
              customSystemPrompt = this.deepseekService.systemPrompt +
                `\n\n以下是基于优化查询"${optimizedQuery}"的网络搜索结果，请根据这些结果回答问题，即使问题不是关于学习或选课的：\n\n${webResultsText}`;
            }

            console.log("已添加网络搜索结果到系统提示");
          } else {
            console.log("网络搜索未返回结果或结果不正确");
          }
        } catch (error) {
          console.error("网络搜索出错:", error);
        }
      } else if (userSettings?.systemPrompt) {
        // 如果没有网络搜索但有自定义提示词，使用自定义提示词
        customSystemPrompt = userSettings.systemPrompt;
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

      // 设置AI参数
      const aiParams = {
        temperature: userSettings?.temperature || 0.7,
        max_tokens: userSettings?.maxTokens || 1000
      };

      // 生成回答，传递对话历史、自定义系统提示和参数 (已异步)
      const answer = await this.deepseekService.generateAnswer(
        question,
        combinedResults,
        conversationHistory,
        customSystemPrompt, // 如果有自定义提示词，使用自定义提示词；否则使用默认提示词
        aiParams        // 传递AI参数
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

    // 获取用户自定义设置 (已异步)
    const userSettings = await this.getUserSettings(userId);

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

      // 获取对话历史 - 使用用户设置的历史长度
      const historyLength = userSettings?.historyLength || 10;
      const conversationHistory = await conversationService.getRecentMessages(sessionId, historyLength);

      // 为问题生成嵌入向量 (已异步)
      const queryEmbedding = await this.embeddingService.getEmbedding(question);

      // 搜索相关文档
      let searchResults = [];

      if (knowledgeBaseId) {
        // 使用指定知识库搜索
        const knowledgeBaseService = require('../knowledgeBaseService');
        // 如果启用重排，检索更多文档
        const searchK = this.rerankingConfig.enabled ? this.rerankingConfig.topK : 5;
        searchResults = await knowledgeBaseService.searchKnowledgeBase(knowledgeBaseId, question, searchK);
      } else {
        // 使用默认向量存储搜索
        const searchK = this.rerankingConfig.enabled ? this.rerankingConfig.topK : 5;
        searchResults = this.vectorStore.similaritySearch(queryEmbedding, searchK);
      }

      console.log(`找到${searchResults.length}个相关文档片段`);

      // 对搜索结果进行重排 (已异步)
      if (this.rerankingConfig.enabled && searchResults.length > 0) {
        console.log('开始对搜索结果进行LLM重排...');

        // 根据文档数量选择重排策略
        if (searchResults.length > 5) {
          // 文档较多时使用高级批量评分方法
          searchResults = await this.rerankDocumentsAdvanced(question, searchResults);
        } else {
          // 文档较少时使用简单排序方法
          searchResults = await this.rerankDocuments(question, searchResults);
        }

        // 保留重排后的前K个文档
        searchResults = searchResults.slice(0, this.rerankingConfig.finalK);
        console.log(`重排后保留${searchResults.length}个最相关文档`);
      }

      // 处理网络搜索
      let webResults = [];
      let customSystemPrompt = null;

      if (useWebSearch) {
        // 网络搜索逻辑，与非流式版本类似
        console.log("执行流式响应的网络搜索...");
        try {
          const webSearchService = require('../webSearchService');

          // 构建上下文用于查询优化
          const searchContext = conversationHistory.length > 0 ?
            `最近的对话: ${conversationHistory.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('; ')}` : '';

          // 优化搜索查询 (已异步)
          const optimizedQuery = await this.optimizeSearchQuery(question, searchContext);
          console.log(`流式响应使用优化后的查询进行搜索: "${optimizedQuery}"`);

          // 使用优化后的查询进行搜索
          const webSearchResults = await webSearchService.search(optimizedQuery, 5);

          if (webSearchResults && webSearchResults.success) {
            webResults = webSearchResults.results;
            console.log(`获取到${webResults.length}个网络搜索结果用于流式响应`);

            const webResultsText = webResults.map(result =>
              `标题: ${result.title}\n摘要: ${result.snippet}\n来源: ${result.url}`
            ).join('\n\n---\n\n');

            // 使用用户自定义系统提示词，如果存在的话
            if (userSettings?.systemPrompt) {
              customSystemPrompt = userSettings.systemPrompt +
                `\n\n以下是基于优化查询"${optimizedQuery}"的网络搜索结果，请根据这些结果回答问题，即使问题不是关于学习或选课的：\n\n${webResultsText}`;
            } else {
              // 否则使用默认提示词
              customSystemPrompt = this.deepseekService.systemPrompt +
                `\n\n以下是基于优化查询"${optimizedQuery}"的网络搜索结果，请根据这些结果回答问题，即使问题不是关于学习或选课的：\n\n${webResultsText}`;
            }

            console.log("已添加网络搜索结果到流式响应系统提示");
          } else {
            console.log("流式响应的网络搜索未返回结果或结果不正确");
          }
        } catch (error) {
          console.error("流式响应的网络搜索出错:", error);
        }
      } else if (userSettings?.systemPrompt) {
        // 如果没有网络搜索但有自定义提示词，使用自定义提示词
        customSystemPrompt = userSettings.systemPrompt;
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

      // 设置AI参数
      const aiParams = {
        temperature: userSettings?.temperature || 0.7,
        max_tokens: userSettings?.maxTokens || 1000
      };

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
          customSystemPrompt,
          aiParams
        )) {
          if (chunk.type === 'answer') {
            fullAnswer += chunk.content;
            yield { sessionId, chunk: chunk.content, type: 'answer' };
          }
          else if (chunk.type === 'reasoning') {
            reasoning += chunk.content;
            // console.log(`[AI辅导员] 收到思维链内容，当前长度: ${reasoning.length}`); // 减少日志
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
          customSystemPrompt,
          aiParams
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

  // 生成课程评价总结
  async generateCourseReviewSummary(courseName, reviewContents) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log(`生成"${courseName}"的评价总结，评价数量: ${reviewContents.split('\n\n').length}`);

      const prompt = `你是一名课程评价分析专家。请总结以下关于"${courseName}"课程的学生评价，提炼出课程的优点、可能的不足以及整体评价。请以分点形式组织回答，确保内容全面且客观。评价内容如下：\n\n${reviewContents}`;

      const response = await this.deepseekService.client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "你是一个精通教育评价分析的AI助手，擅长整理和分析学生对课程的评价，提供客观、准确的总结。"
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 800
      });

      const summary = response.choices[0].message.content.trim();
      console.log(`总结生成成功，长度: ${summary.length} 字符`);

      return summary;
    } catch (error) {
      console.error("生成评价总结失败:", error.message);
      throw new Error(`生成评价总结失败: ${error.message}`);
    }
  }

  // 强制重建默认知识库 (异步)
  async rebuildDefaultKnowledgeBase() {
    console.log("开始重建默认知识库...");

    try {
      // 清空现有向量存储
      this.vectorStore = new VectorStore({ storePath: this.vectorStorePath });

      // 检查PDF文件是否存在 (异步)
      const pdfChecks = await Promise.all(this.pdfPaths.map(pdfPath => fs.pathExists(pdfPath)));
      const pdfExists = pdfChecks.some(exists => exists);
      if (!pdfExists) {
        throw new Error("找不到必要的PDF文件，请确保培养方案和学生手册PDF已放置在正确位置");
      }

      console.log("重新处理PDF文件...");
      // 重新处理PDF文件 (已异步)
      const allChunks = await this.documentProcessor.processMultipleFiles(this.pdfPaths);
      console.log(`重新处理了${allChunks.length}个文本块`);

      // 重新生成嵌入向量 (已异步)
      console.log("重新生成嵌入向量...");
      const contentsOnly = allChunks.map(chunk => chunk.content);
      const embeddings = await this.embeddingService.getBatchEmbeddings(contentsOnly);

      // 添加到向量存储 (同步)
      console.log("重新构建向量索引...");
      this.vectorStore.addDocuments(allChunks, embeddings);

      // 保存向量存储 (异步)
      await this.vectorStore.save();

      console.log("默认知识库重建完成");
      return { success: true, message: "默认知识库重建成功", chunksCount: allChunks.length };
    } catch (error) {
      console.error("重建默认知识库失败:", error);
      throw error;
    }
  }

  // 检查默认知识库状态 (异步)
  async checkDefaultKnowledgeBaseStatus() {
    try {
        const stats = this.vectorStore.getStats();
        const pdfFiles = await Promise.all(this.pdfPaths.map(async (pdfPath) => {
            const exists = await fs.pathExists(pdfPath); // <--- 修改: 使用 await fs.pathExists
            let fileStat = null;
            if(exists) {
                try {
                    fileStat = await fs.stat(pdfPath); // <--- 修改: 使用 await fs.stat
                } catch(statError) {
                    console.error(`获取文件状态失败 ${pdfPath}:`, statError);
                }
            }
            return {
                path: pdfPath,
                exists: exists,
                size: fileStat ? fileStat.size : 0,
                modified: fileStat ? fileStat.mtime : null
            };
        }));

        return {
            vectorStore: stats,
            pdfFiles: pdfFiles,
            needsRebuild: stats.totalDocuments === 0 || stats.activeDocuments === 0
        };
    } catch (error) {
        console.error("检查默认知识库状态失败:", error);
        return {
            vectorStore: null,
            pdfFiles: [],
            needsRebuild: true,
            error: error.message
        };
    }
  }


  // 清理缓存 (异步)
  async clearProcessingCache() {
    try {
      // 清理文档处理缓存 (已异步)
      await this.documentProcessor.cleanupUnusedCache();

      // 清理嵌入缓存（如果需要完全重建）
      const cacheFile = path.join(this.embeddingService.cacheDir, 'embedding-cache.json');
      if (await fs.pathExists(cacheFile)) { // <--- 修改: 使用 await fs.pathExists
        await fs.remove(cacheFile); // <--- 修改: 使用 await fs.remove
        console.log("已清理嵌入缓存");
      }

      return { success: true, message: "缓存清理完成" };
    } catch (error) {
      console.error("清理缓存失败:", error);
      throw error;
    }
  }

  // ... (rerankDocuments, rerankDocumentsAdvanced 保持不变, 因为它们调用的是 DeepSeek, 已经是异步)
  /**
   * 使用LLM重排文档
   * @param {string} query - 用户查询
   * @param {Array} documents - 候选文档列表
   * @returns {Promise<Array>} 重排后的文档列表
   */
  async rerankDocuments(query, documents) {
    try {
      if (!documents || documents.length === 0) {
        return documents;
      }

      console.log(`开始重排 ${documents.length} 个文档...`);

      // 准备重排提示词
      const systemPrompt = `你是一个文档相关性评估专家。你的任务是评估给定文档与用户查询的相关性，并按相关度从高到低排序。

评估标准：
1. 内容相关性：文档是否直接回答了用户的问题
2. 信息完整性：文档是否包含用户需要的完整信息
3. 准确性：文档信息是否准确可靠
4. 具体性：文档是否提供了具体的细节而非泛泛而谈

请仔细分析每个文档，返回排序后的文档编号列表（JSON格式）。`;

      // 构建文档列表
      const documentsText = documents.map((doc, index) => {
        const content = doc.document ? doc.document.content : doc.content;
        const source = doc.document?.metadata?.source || doc.metadata?.source || '未知来源';
        return `文档${index + 1} (来源: ${source}):\n${content.substring(0, 500)}${content.length > 500 ? '...' : ''}`;
      }).join('\n\n---\n\n');

      const userPrompt = `用户查询：${query}\n\n需要评估的文档：\n\n${documentsText}\n\n请按相关性从高到低排序这些文档，返回格式为JSON数组，例如：[3, 1, 5, 2, 4]`;

      const response = await this.deepseekService.client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 200
      });

      const responseText = response.choices[0].message.content.trim();

      // 解析排序结果
      let rankings;
      try {
        // 提取JSON数组
        const jsonMatch = responseText.match(/\[[\d,\s]+\]/);
        if (jsonMatch) {
          rankings = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("未找到有效的排序结果");
        }
      } catch (parseError) {
        console.error('解析重排结果失败:', parseError);
        // 如果解析失败，返回原始顺序
        return documents;
      }

      // 验证排序结果
      if (!Array.isArray(rankings) || rankings.some(r => typeof r !== 'number') || Math.max(...rankings) > documents.length || new Set(rankings).size !== documents.length) {
          console.warn('重排结果无效 (格式或内容错误)，保持原始顺序');
          return documents;
      }

      // 按照新顺序重排文档
      const rerankedDocuments = [];
      const usedIndices = new Set();

      for (const rank of rankings) {
        const index = rank - 1; // 转换为0基索引
        if (index >= 0 && index < documents.length && !usedIndices.has(index)) {
          rerankedDocuments.push(documents[index]);
          usedIndices.add(index);
        }
      }

      // 如果重排后文档数量不对，返回原始文档
      if (rerankedDocuments.length !== documents.length) {
        console.warn('重排后文档数量不匹配，保持原始顺序');
        return documents;
      }


      console.log(`重排完成，新顺序: ${rankings.join(', ')}`);
      return rerankedDocuments;
    } catch (error) {
      console.error('文档重排失败:', error.message);
      // 如果重排失败，返回原始文档顺序
      return documents;
    }
  }

  /**
   * 使用LLM重排文档（高级版本，支持批量评分）
   * @param {string} query - 用户查询
   * @param {Array} documents - 候选文档列表
   * @returns {Promise<Array>} 重排后的文档列表
   */
  async rerankDocumentsAdvanced(query, documents) {
    try {
      if (!documents || documents.length === 0) {
        return documents;
      }

      console.log(`开始高级重排 ${documents.length} 个文档...`);

      // 准备批量评分提示词
      const systemPrompt = `你是一个文档相关性评估专家。你的任务是评估给定文档与用户查询的相关性。

评分标准（0-10分）：
- 10分：文档完美回答了用户的问题，包含所有需要的信息
- 8-9分：文档很好地回答了问题，包含大部分相关信息
- 6-7分：文档部分回答了问题，包含一些有用信息
- 4-5分：文档与问题有一定相关性，但信息有限
- 2-3分：文档仅有轻微相关性
- 0-1分：文档与问题无关

请为每个文档评分，返回JSON格式：{"scores": [8, 5, 9, 3, 7]}`;

      // 构建文档列表
      const documentsText = documents.map((doc, index) => {
        const content = doc.document ? doc.document.content : doc.content;
        const source = doc.document?.metadata?.source || doc.metadata?.source || '未知来源';
        // 限制每个文档的长度以避免超出token限制
        const truncatedContent = content.length > 600 ?
          content.substring(0, 600) + '...' : content;
        return `文档${index + 1} (来源: ${source}):\n${truncatedContent}`;
      }).join('\n\n---\n\n');

      const userPrompt = `用户查询：${query}\n\n需要评分的文档：\n\n${documentsText}\n\n请为每个文档评分（0-10分），返回JSON格式。`;

      const response = await this.deepseekService.client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 300 // 增加token限制以容纳更多文档的评分
      });

      const responseText = response.choices[0].message.content.trim();

      // 解析评分结果
      let scores;
      try {
        const jsonMatch = responseText.match(/\{[^}]*"scores"[^}]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          scores = parsed.scores;
        } else {
          throw new Error("未找到有效的评分结果");
        }
      } catch (parseError) {
        console.error('解析评分结果失败:', parseError);
        // 如果解析失败，使用简单重排
        return this.rerankDocuments(query, documents);
      }

      // 验证评分结果
      if (!Array.isArray(scores) || scores.length !== documents.length) {
        console.warn('评分结果无效，使用简单重排');
        return this.rerankDocuments(query, documents);
      }

      // 将分数附加到文档上并排序
      const scoredDocuments = documents.map((doc, index) => ({
        ...doc,
        rerankScore: scores[index] || 0,
        originalSimilarity: doc.similarity || 0
      }));

      // 按照重排分数降序排序
      scoredDocuments.sort((a, b) => {
        // 首先按重排分数排序
        if (b.rerankScore !== a.rerankScore) {
          return b.rerankScore - a.rerankScore;
        }
        // 如果重排分数相同，使用原始相似度
        return b.originalSimilarity - a.originalSimilarity;
      });

      console.log(`高级重排完成，分数分布: ${scores.join(', ')}`);
      return scoredDocuments;
    } catch (error) {
      console.error('高级文档重排失败:', error.message);
      // 如果失败，尝试简单重排
      return this.rerankDocuments(query, documents);
    }
  }
}

module.exports = new AdvisorService();