import axios from 'axios';

export default {
  /**
   * 向AI辅导员提问 - 非流式版本
   * @param {string} question - 用户问题
   * @returns {Promise} - 返回AI回答
   */
  askQuestion(question) {
    // 确保与后端路由匹配：app.use('/api/advisor', advisorRoutes)
    return axios.post('/api/advisor/ask', { question });
  },
  
  /**
   * 向AI辅导员提问 - 流式版本
   * @param {string} question - 用户问题
   * @returns {Promise} - 返回流式响应
   */
  askQuestionStream(question) {
    // 流式接口的完整路径
    return fetch('/api/advisor/ask-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question })
    });
  }
};