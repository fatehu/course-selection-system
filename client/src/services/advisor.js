// 为AI辅导员创建特殊的axios实例
import axios from '@/api/axiosForAssistant';  // 使用专门配置的axios实例

const API_PATH = '/advisor';  // 正确的路径前缀

export default {
  /**
   * 向AI辅导员提问 - 非流式版本
   * @param {string} question - 用户问题
   * @param {string} sessionId - 会话ID（可选）
   * @param {string} knowledgeBaseId - 知识库ID（可选）
   * @returns {Promise} - 返回AI回答
   */
  askQuestion(question, sessionId = null, knowledgeBaseId = null) {
    return axios.post(`${API_PATH}/ask`, { 
      question, 
      sessionId,
      knowledgeBaseId 
    });
  },
  
  /**
   * 向AI辅导员提问 - 流式版本
   * 注意：此方法返回fetch的原始Response对象，需自行处理流
   * @param {string} question - 用户问题
   * @param {string} sessionId - 会话ID（可选）
   * @param {string} knowledgeBaseId - 知识库ID（可选）
   * @returns {Promise} - 返回流式响应
   */
  askQuestionStream(question, sessionId = null, knowledgeBaseId = null) {
    // 获取baseURL，已经包含了 /api
    const baseURL = axios.defaults.baseURL || '';
    
    return fetch(`${baseURL}${API_PATH}/ask-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ 
        question, 
        sessionId,
        knowledgeBaseId 
      })
    });
  },
  
  /**
   * 获取用户的会话列表
   * @returns {Promise} - 返回会话列表
   */
  getUserConversations() {
    console.log('获取会话历史，API路径:', `${API_PATH}/conversations`);
    return axios.get(`${API_PATH}/conversations`);
  },
  
  /**
   * 获取指定会话的消息历史
   * @param {string} sessionId - 会话ID
   * @returns {Promise} - 返回会话消息
   */
  getConversationMessages(sessionId) {
    return axios.get(`${API_PATH}/conversations/${sessionId}`);
  },

  /**
   * 重命名会话
   * @param {string} sessionId - 会话ID
   * @param {string} newTitle - 新标题
   * @returns {Promise} - 返回操作结果
   */
  renameConversation(sessionId, newTitle) {
    return axios.put(`${API_PATH}/conversations/${sessionId}/rename`, { title: newTitle });
  },

  /**
   * 删除会话
   * @param {string} sessionId - 会话ID
   * @returns {Promise} - 返回操作结果
   */
  deleteConversation(sessionId) {
    return axios.delete(`${API_PATH}/conversations/${sessionId}`);
  },

  /**
   * 生成会话标题
   * @param {string} sessionId - 会话ID
   * @returns {Promise} - 返回生成的标题
   */
  generateConversationTitle(sessionId) {
    return axios.post(`${API_PATH}/conversations/${sessionId}/generate-title`);
  },

  /**
   * 获取可用的搜索引擎列表
   * @returns {Promise} - 返回搜索引擎列表
   */
  getSearchEngines() {
    return axios.get(`${API_PATH}/search/engines`);
  },
  
  /**
   * 设置激活的搜索引擎
   * @param {Array} engineIds - 搜索引擎ID数组
   * @returns {Promise} - 返回操作结果
   */
  setActiveEngines(engineIds) {
    return axios.post(`${API_PATH}/search/engines`, { engineIds });
  },
  
  /**
   * 直接执行网络搜索
   * @param {string} query - 搜索查询
   * @param {number} limit - 结果数量限制（可选）
   * @returns {Promise} - 返回搜索结果
   */
  searchWeb(query, limit = 10) {
    return axios.post(`${API_PATH}/search/web`, { query, limit });
  }
};