import axios from 'axios';

export default {
  /**
   * 向AI辅导员提问
   * @param {string} question - 用户问题
   * @returns {Promise} - 返回AI回答
   */
  askQuestion(question) {
    return axios.post('/api/advisor/ask', { question });
  }
};