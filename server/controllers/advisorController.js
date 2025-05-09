// server/controllers/advisorController.js
const advisorService = require('../services/advisor');

const askQuestion = async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: "问题不能为空且必须是字符串" });
    }
    
    const answer = await advisorService.answerQuestion(question);
    
    res.json({ success: true, answer });
  } catch (error) {
    console.error("回答问题出错:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "服务器内部错误" 
    });
  }
};

module.exports = {
  askQuestion
};