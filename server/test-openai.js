// test-openai.js
require('dotenv').config();
const { OpenAI } = require('openai');

async function testOpenAIEmbedding() {
  console.log("测试OpenAI嵌入API...");
  
  try {
    // 初始化OpenAI客户端
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    console.log("OpenAI API密钥:", process.env.OPENAI_API_KEY ? "已设置" : "未设置");
    
    // 测试文本
    const testText = "计算机科学与技术专业需要修多少学分才能毕业？";
    console.log(`测试文本: "${testText}"`);
    
    // 请求嵌入
    console.log("发送API请求...");
    const startTime = Date.now();
    
    const response = await client.embeddings.create({
      model: "text-embedding-3-large",
      input: testText,
      // dimensions: 1024  // 可选参数，默认1536
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // 检查响应
    console.log(`请求成功! 耗时: ${duration}秒`);
    console.log(`嵌入向量维度: ${response.data[0].embedding.length}`);
    console.log(`模型: ${response.model}`);
    console.log(`使用的Tokens: ${response.usage.total_tokens}`);
    console.log(`前5个向量值: [${response.data[0].embedding.slice(0, 5).join(', ')}]`);
    
    // 批量测试
    console.log("\n测试批量嵌入...");
    const batchTexts = [
      "计算机科学与技术专业需要修多少学分才能毕业？",
      "电子信息工程专业的核心课程有哪些？"
    ];
    
    const batchResponse = await client.embeddings.create({
      model: "text-embedding-3-large",
      input: batchTexts
    });
    
    console.log(`批量处理: 成功返回${batchResponse.data.length}个嵌入向量`);
    
    return true;
  } catch (error) {
    console.error("OpenAI API请求失败:", error.message);
    if (error.response) {
      console.error("HTTP状态码:", error.response.status);
      try {
        console.error("错误类型:", error.response.data.error.type);
        console.error("错误消息:", error.response.data.error.message);
      } catch (e) {
        console.error("完整错误响应:", error.response.data);
      }
    }
    return false;
  }
}

// 执行测试
testOpenAIEmbedding().then(result => {
  console.log(`\n测试${result ? '成功' : '失败'}`);
});