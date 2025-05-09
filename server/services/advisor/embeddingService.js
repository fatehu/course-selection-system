// server/services/advisor/embeddingService.js
const { OpenAI } = require('openai');
require('dotenv').config();

// 初始化OpenAI SDK但指向DeepSeek API
const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY
});

// 生成文本嵌入向量
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "deepseek-embeddings", // 使用DeepSeek的嵌入模型
      input: text
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error("生成嵌入向量失败:", error.message);
    
    // 如果DeepSeek不支持嵌入API，返回一个简单的替代方案
    // 这是一个备选方案，使用简单的哈希函数生成假"向量"
    console.warn("使用备用方法生成嵌入");
    return generateFallbackEmbedding(text);
  }
}

// 备用方法：生成简单的文本特征向量
// 这不是真正的嵌入向量，但可以在API不可用时作为临时替代
function generateFallbackEmbedding(text) {
  // 创建一个1536维的向量（与OpenAI嵌入大小相同）
  const embedding = new Array(1536).fill(0);
  
  // 提取文本中的词
  const words = text.toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .split(/\s+/);
  
  // 对每个词进行简单的特征提取
  for (const word of words) {
    // 使用词的字符编码来生成一个特征
    for (let i = 0; i < word.length; i++) {
      const charCode = word.charCodeAt(i);
      const index = (charCode * 11 + i * 7) % embedding.length;
      embedding[index] += 1;
    }
    
    // 词长度特征
    const lengthIndex = (word.length * 17) % embedding.length;
    embedding[lengthIndex] += 1;
  }
  
  // 归一化向量
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }
  
  return embedding;
}

module.exports = {
  generateEmbedding
};