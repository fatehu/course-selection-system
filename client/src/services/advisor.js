import axios from 'axios';

export default {
  /**
   * 向AI辅导员提问 - 非流式版本
   * @param {string} question - 用户问题
   * @param {string} sessionId - 会话ID（可选）
   * @returns {Promise} - 返回AI回答
   */
  askQuestion(question, sessionId = null) {
    // 确保与后端路由匹配：app.use('/api/advisor', advisorRoutes)
    return axios.post('/api/advisor/ask', { question, sessionId });
  },
  
  /**
   * 向AI辅导员提问 - 流式版本
   * @param {string} question - 用户问题
   * @param {string} sessionId - 会话ID（可选）
   * @returns {Promise} - 返回流式响应
   */
  askQuestionStream(question, sessionId = null) {
    // 流式接口的完整路径
    return fetch('/api/advisor/ask-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ question, sessionId })
    });
  },
  
  /**
   * 获取用户的会话列表
   * @returns {Promise} - 返回会话列表
   */
  getUserConversations() {
    return axios.get('/api/advisor/conversations');
  },
  
  /**
   * 获取指定会话的消息历史
   * @param {string} sessionId - 会话ID
   * @returns {Promise} - 返回会话消息
   */
  getConversationMessages(sessionId) {
    return axios.get(`/api/advisor/conversations/${sessionId}`);
  }
};