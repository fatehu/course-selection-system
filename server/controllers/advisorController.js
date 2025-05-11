const advisorService = require('../services/advisor');

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
    const { question } = req.body;
    
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: "问题不能为空且必须是字符串" 
      });
    }
    
    console.log(`${new Date().toISOString()} - 收到问题: "${question}"`);
    
    // 使用超时包装器处理长时间运行的请求
    const answer = await withTimeout(
      advisorService.answerQuestion(question),
      6000000 // 60秒超时
    );
    
    res.json({ 
      success: true, 
      answer 
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
    const { question } = req.body;
    
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: "问题不能为空且必须是字符串" 
      });
    }
    
    console.log(`${new Date().toISOString()} - 收到流式问题: "${question}"`);
    
    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // 发送初始化消息
    res.write('data: {"type": "start", "message": "正在处理您的问题..."}\n\n');
    
    try {
      // 调用服务获取流式回答
      const answerStream = advisorService.answerQuestionStream(question);
      
      let isFirstChunk = true;
      for await (const chunk of answerStream) {
        // 发送每个chunk
        const data = {
          type: isFirstChunk ? 'first_chunk' : 'chunk',
          content: chunk
        };
        
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        isFirstChunk = false;
      }
      
      // 发送结束标志
      res.write('data: {"type": "end"}\n\n');
      
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

module.exports = {
  askQuestion,
  askQuestionStream
};