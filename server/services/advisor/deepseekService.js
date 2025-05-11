const { OpenAI } = require('openai');
require('dotenv').config();

class DeepSeekService {
  constructor() {
    this.client = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY
    });
  }
  
  // 系统提示词
  get systemPrompt() {
    return `你是一名专业的学校辅导员，专门帮助学生解答选课和专业学习相关的问题。你掌握了各专业的培养方案、课程设置和学分要求等信息。

你的职责是：
1. 帮助学生了解各专业的培养方案、课程设置和学分要求
2. 解答学生关于选课、课程内容、学分要求等问题
3. 提供合理的学习规划和建议
4. 解释课程之间的关联和先修要求

请根据学生的问题和提供的参考文档，提供准确、全面且易于理解的解答。如果学生询问的信息不在提供的文档中，请礼貌地告知并建议他们咨询教务处或相关学院。`;
  }
  
  // 生成回答
  async generateAnswer(question, relevantDocs) {
    try {
      // 提取相关文档的内容
      const context = relevantDocs
        .map(doc => doc.document.content || doc.document)
        .join("\n\n---\n\n");
      
      console.log(`向DeepSeek发送请求，问题长度: ${question.length}, 上下文长度: ${context.length}`);
      
      const completion = await this.client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: this.systemPrompt },
          { role: "user", content: `基于以下参考文档回答问题:\n\n${context}\n\n学生问题: ${question}` }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });
      
      console.log("DeepSeek响应成功");
      return completion.choices[0].message.content;
    } catch (error) {
      console.error("DeepSeek API调用失败:", error.message);
      return "抱歉，AI服务暂时不可用，请稍后再试。如有紧急问题，请联系教务处。";
    }
  };

  // 流式生成回答
  async *generateAnswerStream(question, relevantDocs) {
    try {
      // 提取相关文档的内容
      const context = relevantDocs
        .map(doc => doc.document.content || doc.document)
        .join("\n\n---\n\n");
      
      console.log(`向DeepSeek发送流式请求，问题长度: ${question.length}, 上下文长度: ${context.length}`);
      
      const stream = await this.client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: this.systemPrompt },
          { role: "user", content: `基于以下参考文档回答问题:\n\n${context}\n\n学生问题: ${question}` }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        stream: true,
      });
      
      console.log("DeepSeek开始流式响应");
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
      
      console.log("DeepSeek流式响应结束");
    } catch (error) {
      console.error("DeepSeek API调用失败:", error.message);
      yield "抱歉，AI服务暂时不可用，请稍后再试。如有紧急问题，请联系教务处。";
    }
  };
}

module.exports = DeepSeekService;