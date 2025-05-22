const conversationModel = require('../../models/conversationModel');

class ConversationService {
  // 创建新会话
  async createConversation(userId, title = '新对话') {
    try {
      const sessionId = await conversationModel.createConversation(userId, title);
      return sessionId;
    } catch (error) {
      console.error(`创建会话失败 userId=${userId}:`, error);
      throw error;
    }
  }
  
  // 获取会话
  async getConversation(sessionId) {
    try {
      return await conversationModel.getConversation(sessionId);
    } catch (error) {
      console.error(`获取会话失败 sessionId=${sessionId}:`, error);
      return null;
    }
  }
  
  // 获取用户的所有会话
  async getUserConversations(userId) {
    try {
      return await conversationModel.getUserConversations(userId);
    } catch (error) {
      console.error(`获取用户会话失败 userId=${userId}:`, error);
      return [];
    }
  }
  
  // 更新会话标题
  async updateConversationTitle(sessionId, title) {
    try {
      return await conversationModel.updateConversationTitle(sessionId, title);
    } catch (error) {
      console.error(`更新会话标题失败 sessionId=${sessionId}:`, error);
      return false;
    }
  }
  
  // 删除会话
  async deleteConversation(sessionId) {
    try {
      return await conversationModel.deleteConversation(sessionId);
    } catch (error) {
      console.error(`删除会话失败 sessionId=${sessionId}:`, error);
      return false;
    }
  }
  
  // 添加消息到会话
  async addMessage(sessionId, message) {
    try {
      return await conversationModel.addMessage(
        sessionId, 
        message.role, 
        message.content
      );
    } catch (error) {
      console.error(`添加消息失败 sessionId=${sessionId}:`, error);
      return false;
    }
  }
  
  // 获取会话消息
  async getConversationMessages(sessionId) {
    try {
      const messages = await conversationModel.getConversationMessages(sessionId);
      return messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      }));
    } catch (error) {
      console.error(`获取会话消息失败 sessionId=${sessionId}:`, error);
      return [];
    }
  }
  
  // 获取最近的消息（用于构建上下文）
  async getRecentMessages(sessionId, count = 10) {
    try {
      const allMessages = await this.getConversationMessages(sessionId);
      return allMessages.slice(-count);
    } catch (error) {
      console.error(`获取最近消息失败 sessionId=${sessionId}:`, error);
      return [];
    }
  }
}

module.exports = new ConversationService();