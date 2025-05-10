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

module.exports = {
  askQuestion
};