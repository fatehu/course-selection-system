const advisorService = require('../services/advisor');
const conversationService = require('../services/advisor/conversationService');
const webSearchService = require('../services/webSearchService');

// 处理超时的Promise包装器
function withTimeout(promise, timeoutMs = 30000) {
  let timeoutId;
  
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('操作超时'));
    }, timeoutMs);
  });
  
  return Promise.race([
    promise,
    timeoutPromise
  ]).finally(() => {
    clearTimeout(timeoutId);
  });
}

// AI辅导员问答API
const askQuestion = async (req, res) => {
  try {
    const { question, sessionId, knowledgeBaseId, useWebSearch } = req.body;
    const userId = req.user.id;
    
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: "问题不能为空且必须是字符串" 
      });
    }
    
    console.log(`${new Date().toISOString()} - 收到问题: "${question}" 用户ID: ${userId} 会话ID: ${sessionId || '新会话'} 使用网络搜索: ${useWebSearch || false}`);
    
    // 使用超时包装器处理长时间运行的请求
    const result = await withTimeout(
      advisorService.answerQuestion(question, userId, sessionId, knowledgeBaseId, useWebSearch || false),
      60000
    );
    
    res.json({ 
      success: true, 
      sessionId: result.sessionId,
      answer: result.answer 
    });
  } catch (error) {
    console.error("回答问题出错:", error);
    
    // 区分超时错误和其他错误
    if (error.message === '操作超时') {
      res.status(503).json({
        success: false,
        error: "请求处理时间过长，请稍后再试",
        fallbackAnswer: "抱歉，您的问题需要更长时间思考。建议尝试提出更具体的问题，或稍后再试。"
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: error.message || "服务器内部错误",
        fallbackAnswer: "抱歉，AI辅导员暂时无法回答您的问题。请稍后再试。" 
      });
    }
  }
};

// AI辅导员问答API - 流式输出版本
const askQuestionStream = async (req, res) => {
  try {
    const { question, sessionId, knowledgeBaseId, useWebSearch } = req.body;
    const userId = req.user.id;
    
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: "问题不能为空且必须是字符串" 
      });
    }
    
    console.log(`${new Date().toISOString()} - 收到流式问题: "${question}" 用户ID: ${userId} 会话ID: ${sessionId || '新会话'} 使用网络搜索: ${useWebSearch || false}`);
    
    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // 发送初始化消息
    res.write('data: {"type": "start", "message": "正在处理您的问题..."}\n\n');
    
    try {
      // 调用服务获取流式回答，传递网络搜索参数
      const answerStream = advisorService.answerQuestionStream(
        question, 
        userId, 
        sessionId, 
        knowledgeBaseId, 
        useWebSearch || false
      );
      
      let isFirstChunk = true;
      let currentSessionId = null;
      
      for await (const result of answerStream) {
        // 更新会话ID
        currentSessionId = result.sessionId;
        
        // 发送每个chunk
        const data = {
          type: isFirstChunk ? 'first_chunk' : 'chunk',
          content: result.chunk,
          sessionId: currentSessionId
        };
        
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        isFirstChunk = false;
      }
      
      // 发送结束标志
      res.write(`data: {"type": "end", "sessionId": "${currentSessionId}"}\n\n`);
      
    } catch (error) {
      console.error("流式回答问题出错:", error);
      
      // 发送错误消息
      const errorMessage = {
        type: 'error',
        message: error.message === '操作超时' ? 
          "请求处理时间过长，请稍后再试" : 
          "服务器内部错误",
        fallbackAnswer: "抱歉，AI辅导员暂时无法回答您的问题。请稍后再试。"
      };
      
      res.write(`data: ${JSON.stringify(errorMessage)}\n\n`);
      res.write('data: {"type": "end"}\n\n');
    }
    
    res.end();
    
  } catch (error) {
    console.error("设置流式响应出错:", error);
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        error: error.message || "服务器内部错误",
        fallbackAnswer: "抱歉，AI辅导员暂时无法回答您的问题。请稍后再试。" 
      });
    }
  }
};

// 获取用户的会话列表
const getUserConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const conversations = await advisorService.getUserConversations(userId);
    
    res.json({
      success: true,
      conversations
    });
  } catch (error) {
    console.error("获取用户会话列表出错:", error);
    res.status(500).json({
      success: false,
      error: error.message || "服务器内部错误"
    });
  }
};

// 获取指定会话的消息
const getConversationMessages = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    
    const conversation = await advisorService.getConversation(sessionId);
    
    // 验证会话存在且属于当前用户
    if (!conversation || conversation.user_id !== userId) {
      return res.status(404).json({
        success: false,
        error: "会话不存在或无权访问"
      });
    }
    
    const messages = await advisorService.getConversationMessages(sessionId);
    
    res.json({
      success: true,
      conversation: {
        ...conversation,
        messages
      }
    });
  } catch (error) {
    console.error("获取会话消息出错:", error);
    res.status(500).json({
      success: false,
      error: error.message || "服务器内部错误"
    });
  }
};

// 重命名会话
const renameConversation = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title } = req.body;
    const userId = req.user.id;
    
    // 验证会话是否属于当前用户
    const conversation = await advisorService.getConversation(sessionId);
    if (!conversation || conversation.user_id !== userId) {
      return res.status(404).json({
        success: false,
        error: "会话不存在或无权访问"
      });
    }
    
    const success = await conversationService.updateConversationTitle(sessionId, title);
    
    res.json({
      success,
      message: success ? "会话重命名成功" : "会话重命名失败"
    });
  } catch (error) {
    console.error("重命名会话出错:", error);
    res.status(500).json({
      success: false,
      error: error.message || "服务器内部错误"
    });
  }
};

// 删除会话
const deleteConversation = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    
    // 验证会话是否属于当前用户
    const conversation = await advisorService.getConversation(sessionId);
    if (!conversation || conversation.user_id !== userId) {
      return res.status(404).json({
        success: false,
        error: "会话不存在或无权访问"
      });
    }
    
    const success = await conversationService.deleteConversation(sessionId);
    
    res.json({
      success,
      message: success ? "会话删除成功" : "会话删除失败"
    });
  } catch (error) {
    console.error("删除会话出错:", error);
    res.status(500).json({
      success: false,
      error: error.message || "服务器内部错误"
    });
  }
};

const generateTitle = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    
    // 验证会话存在且属于当前用户
    const conversation = await advisorService.getConversation(sessionId);
    if (!conversation || conversation.user_id !== userId) {
      return res.status(404).json({
        success: false,
        error: "会话不存在或无权访问"
      });
    }
    
    // 获取该会话的第一条用户消息
    const messages = await advisorService.getConversationMessages(sessionId);
    const firstUserMessage = messages.find(msg => msg.role === 'user');
    
    if (!firstUserMessage) {
      return res.status(400).json({
        success: false,
        error: "会话中没有用户消息"
      });
    }
    
    // 使用AI生成标题
    const title = await advisorService.generateTitle(firstUserMessage.content);
    
    // 更新会话标题
    const success = await conversationService.updateConversationTitle(sessionId, title);
    
    res.json({
      success,
      title,
      message: success ? "标题生成成功" : "标题生成失败"
    });
  } catch (error) {
    console.error("生成标题出错:", error);
    res.status(500).json({
      success: false,
      error: error.message || "服务器内部错误"
    });
  }
};

// 获取可用搜索引擎列表
const getSearchEngines = async (req, res) => {
  try {
    const availableEngines = webSearchService.getAvailableEngines();
    const activeEngines = webSearchService.activeEngines;
    
    res.json({
      success: true,
      availableEngines,
      activeEngines
    });
  } catch (error) {
    console.error("获取搜索引擎列表出错:", error);
    res.status(500).json({
      success: false,
      error: error.message || "服务器内部错误"
    });
  }
};

// 设置激活的搜索引擎
const setActiveEngines = async (req, res) => {
  try {
    const { engineIds } = req.body;
    
    if (!Array.isArray(engineIds)) {
      return res.status(400).json({
        success: false,
        error: "引擎ID列表必须是数组"
      });
    }
    
    const activeEngines = webSearchService.setActiveEngines(engineIds);
    
    res.json({
      success: true,
      activeEngines
    });
  } catch (error) {
    console.error("设置搜索引擎出错:", error);
    res.status(500).json({
      success: false,
      error: error.message || "服务器内部错误"
    });
  }
};

// 执行网络搜索
const searchWeb = async (req, res) => {
  try {
    const { query, limit } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: "搜索查询不能为空且必须是字符串"
      });
    }
    
    console.log(`执行网络搜索: "${query}"`);
    const searchLimit = limit && !isNaN(parseInt(limit)) ? parseInt(limit) : 10;
    
    const results = await webSearchService.search(query, searchLimit);
    
    res.json(results);
  } catch (error) {
    console.error("网络搜索出错:", error);
    res.status(500).json({
      success: false,
      error: error.message || "服务器内部错误"
    });
  }
};

module.exports = {
  askQuestion,
  askQuestionStream,
  getUserConversations,
  getConversationMessages,
  renameConversation,
  deleteConversation,
  generateTitle,
  getSearchEngines,
  setActiveEngines,
  searchWeb
};