// server/services/advisor/deepseekService.js
const { OpenAI } = require('openai');
require('dotenv').config();

// 初始化OpenAI SDK但指向DeepSeek API
const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY
});

// 系统提示词，定义AI辅导员的身份和行为
const SYSTEM_PROMPT = `你是一名专业的学校辅导员，专门帮助学生解答选课和专业学习相关的问题。你掌握了各专业的培养方案、课程设置和学分要求等信息。

你的职责是：
1. 帮助学生了解各专业的培养方案、课程设置和学分要求
2. 解答学生关于选课、课程内容、学分要求等问题
3. 提供合理的学习规划和建议
4. 解释课程之间的关联和先修要求

请根据学生的问题，提供准确、全面且易于理解的解答。如果学生询问的信息不在你的知识范围内，请礼貌地告知并建议他们咨询教务处或相关学院。`;

// 调用DeepSeek API
async function callDeepSeek(prompt, context) {
  try {
    console.log(`向DeepSeek发送请求，问题长度: ${prompt.length}, 上下文长度: ${context.length}`);
    
    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `基于以下信息回答问题:\n\n${context}\n\n问题: ${prompt}` }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    console.log("DeepSeek响应成功");
    return completion.choices[0].message.content;
  } catch (error) {
    console.error("DeepSeek API调用失败:", error.message);
    if (error.response) {
      console.error("错误详情:", error.response.data);
    }
    
    // 如果API调用失败，提供一个基本回答
    return "抱歉，AI服务暂时不可用，请稍后再试。如有紧急问题，请联系教务处。";
  }
}

module.exports = {
  callDeepSeek
};