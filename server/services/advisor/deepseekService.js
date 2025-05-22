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

在回答问题时，请参考提供的参考文档，提供准确、全面且易于理解的解答。如果学生询问的信息不在提供的文档中，请礼貌地告知并建议他们咨询教务处或相关学院。

请记住我们之前的对话内容，保持连贯性。如果学生的问题涉及到之前讨论过的内容，请基于之前的对话进行回答。`;
  }
  
  // 生成回答
  async generateAnswer(question, relevantDocs, conversationHistory = [], customSystemPrompt = null, aiParams = {}) {
    try {
      // 提取相关文档的内容
      const context = relevantDocs
        .map(doc => doc.document.content || doc.document)
        .join("\n\n---\n\n");
      
      console.log(`向DeepSeek发送请求，问题长度: ${question.length}, 上下文长度: ${context.length}, 对话历史: ${conversationHistory.length}条`);
      
      // 使用自定义系统提示或默认提示
      const systemPrompt = customSystemPrompt || this.systemPrompt;
      
      // 构建消息数组，包含系统提示、对话历史和当前问题
      const messages = [
        { role: "system", content: systemPrompt }
      ];
      
      // 添加对话历史 - 移除了硬编码的10条限制
      if (conversationHistory && conversationHistory.length > 0) {
        // 使用所有传入的历史消息
        conversationHistory.forEach(msg => {
          messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          });
        });
      }
      
      // 添加当前问题和参考文档
      messages.push({
        role: "user", 
        content: `基于以下参考文档回答问题:\n\n${context}\n\n学生问题: ${question}`
      });
      
      // 使用默认参数与用户自定义参数合并
      const finalParams = {
        model: "deepseek-chat",
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
        ...aiParams // 合并用户自定义参数
      };
      
      const completion = await this.client.chat.completions.create(finalParams);
      
      console.log("DeepSeek响应成功");
      return completion.choices[0].message.content;
    } catch (error) {
      console.error("DeepSeek API调用失败:", error.message);
      return "抱歉，AI服务暂时不可用，请稍后再试。如有紧急问题，请联系教务处。";
    }
  }

  // 流式生成回答（带思维链）
  async *generateAnswerStreamWithReasoning(question, relevantDocs, conversationHistory = [], customSystemPrompt = null, aiParams = {}) {
    try {
      // 提取相关文档的内容
      const context = relevantDocs
        .map(doc => doc.document.content || doc.document)
        .join("\n\n---\n\n");
      
      console.log(`向DeepSeek发送流式请求(思维链模式)，问题长度: ${question.length}, 上下文长度: ${context.length}, 对话历史: ${conversationHistory.length}条`);
      
      // 使用自定义系统提示或默认提示
      const systemPrompt = customSystemPrompt || this.systemPrompt;
      
      // 构建消息数组，从系统提示开始
      const messages = [
        { role: "system", content: systemPrompt }
      ];
      
      // 使用完整的用户-助手对话对
      if (conversationHistory && conversationHistory.length >= 2) {
        // 收集完整的用户-助手对话对
        let userAssistantPairs = [];
        
        for (let i = 0; i < conversationHistory.length - 1; i++) {
          if (conversationHistory[i].role === 'user' && 
              conversationHistory[i+1].role === 'assistant') {
            userAssistantPairs.push({
              user: conversationHistory[i],
              assistant: conversationHistory[i+1]
            });
            i++; // 跳过已处理的助手消息
          }
        }
        
        // 使用所有对话对，不再限制为最多2对
        const recentPairs = userAssistantPairs;
        
        // 添加完整的对话对到消息中
        for (const pair of recentPairs) {
          messages.push({ role: 'user', content: pair.user.content });
          messages.push({ role: 'assistant', content: pair.assistant.content });
        }
      }
      
      // 添加当前问题和参考文档 - 确保与最后一条消息角色不同
      if (messages.length > 1 && messages[messages.length - 1].role === 'user') {
        // 如果最后一条消息是用户的，添加一个简短的助手回复
        messages.push({ 
          role: 'assistant', 
          content: '我了解了。请继续。' 
        });
      }
      
      // 现在添加当前问题
      messages.push({
        role: "user", 
        content: `基于以下参考文档回答问题:\n\n${context}\n\n学生问题: ${question}`
      });

      // 打印处理后的消息序列用于调试
      console.log("处理后的消息序列:", messages.map(m => m.role).join(', '));
      
      // 最终检查：确保没有连续的相同角色消息
      for (let i = 1; i < messages.length - 1; i++) {
        if (messages[i].role === messages[i + 1].role) {
          console.log(`检测到连续消息问题: ${i}和${i+1}都是${messages[i].role}`);
          // 移除第二条相同角色的消息
          messages.splice(i + 1, 1);
          i--; // 调整索引继续检查
        }
      }
      
      // 再次打印消息序列以验证
      console.log("最终消息序列:", messages.map(m => m.role).join(', '));
      
      // 使用默认参数与用户自定义参数合并
      const finalParams = {
        model: "deepseek-reasoner", // 使用带思维链的模型
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: true,
        ...aiParams // 合并用户自定义参数
      };
      
      // stream必须为true
      finalParams.stream = true;
      
      try {
        const stream = await this.client.chat.completions.create(finalParams);
        
        console.log("DeepSeek开始流式响应(思维链模式)");
        
        for await (const chunk of stream) {
          // 处理带 delta 结构的流式数据块
          const content = chunk.choices[0]?.delta?.content;
          const reasoning = chunk.choices[0]?.delta?.reasoning_content;
          
          // 处理非流式或不同响应结构
          if (!content && !reasoning && chunk.choices[0]?.message) {
            const message = chunk.choices[0].message;
            
            if (message.content) {
              yield { type: 'answer', content: message.content };
            }
            
            if (message.reasoning_content) {
              yield { type: 'reasoning', content: message.reasoning_content };
            }
          } else {
            // 原始流处理
            if (content) {
              yield { type: 'answer', content };
            }
            
            if (reasoning) {
              console.log(`[DeepSeek思维链] 收到思维链内容: ${reasoning.substring(0, 50)}...`);
              yield { type: 'reasoning', content: reasoning };
            }
          }
        }
        
        console.log("DeepSeek流式响应结束(思维链模式)");
      } catch (error) {
        console.error("DeepSeek 请求失败:", error.message);
        yield { 
          type: 'error',
          content: "深度思考模式暂时不可用，已切换到标准模式。" 
        };
      }
    } catch (error) {
      console.error("DeepSeek API调用失败(思维链模式):", error.message);
      yield { 
        type: 'error',
        content: "抱歉，深度思考模式暂时不可用，已切换到标准回答模式。" 
      };
    }
  }

  // 流式生成回答
  async *generateAnswerStream(question, relevantDocs, conversationHistory = [], customSystemPrompt = null, aiParams = {}) {
    try {
      // 提取相关文档的内容
      const context = relevantDocs
        .map(doc => doc.document.content || doc.document)
        .join("\n\n---\n\n");
      
      console.log(`向DeepSeek发送流式请求，问题长度: ${question.length}, 上下文长度: ${context.length}, 对话历史: ${conversationHistory.length}条`);
      
      // 使用自定义系统提示或默认提示
      const systemPrompt = customSystemPrompt || this.systemPrompt;
      
      // 构建消息数组，包含系统提示、对话历史和当前问题
      const messages = [
        { role: "system", content: systemPrompt }
      ];
      
      // 添加对话历史
      if (conversationHistory && conversationHistory.length > 0) {
        // 使用所有传入的历史消息
        conversationHistory.forEach(msg => {
          messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          });
        });
      }
      
      // 添加当前问题和参考文档
      messages.push({
        role: "user", 
        content: `基于以下参考文档回答问题:\n\n${context}\n\n学生问题: ${question}`
      });
      
      // 使用默认参数与用户自定义参数合并
      const finalParams = {
        model: "deepseek-chat", // 使用标准聊天模型
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: true,
        ...aiParams // 合并用户自定义参数
      };
      
      // stream必须为true
      finalParams.stream = true;
      
      const stream = await this.client.chat.completions.create(finalParams);
      
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
  }
}

module.exports = DeepSeekService;