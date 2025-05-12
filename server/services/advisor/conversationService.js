const fs = require('fs-extra');
const path = require('path');

class ConversationService {
  constructor() {
    // 存储会话数据的目录
    this.storageDir = path.join(process.cwd(), 'data/conversations');
    fs.ensureDirSync(this.storageDir);
    
    // 内存中的活跃对话缓存 (sessionId -> 对话历史)
    this.activeConversations = new Map();
    
    // 设置会话过期时间 (24小时)
    this.expirationTime = 24 * 60 * 60 * 1000;
  }
  
  // 创建新会话
  createConversation(userId) {
    const sessionId = `${userId}-${Date.now()}`;
    const conversation = {
      id: sessionId,
      userId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    this.activeConversations.set(sessionId, conversation);
    this._saveConversation(conversation);
    
    return sessionId;
  }
  
  // 获取会话
  getConversation(sessionId) {
    // 先从内存缓存获取
    if (this.activeConversations.has(sessionId)) {
      return this.activeConversations.get(sessionId);
    }
    
    // 如果不在内存中，尝试从文件加载
    const filePath = this._getConversationPath(sessionId);
    if (fs.existsSync(filePath)) {
      try {
        const conversation = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        this.activeConversations.set(sessionId, conversation);
        return conversation;
      } catch (error) {
        console.error(`加载会话失败 ${sessionId}:`, error);
      }
    }
    
    return null;
  }
  
  // 获取用户的所有会话
  getUserConversations(userId) {
    try {
      const files = fs.readdirSync(this.storageDir);
      const conversations = [];
      
      for (const file of files) {
        if (file.startsWith(userId) && file.endsWith('.json')) {
          try {
            const filePath = path.join(this.storageDir, file);
            const conversation = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            conversations.push({
              id: conversation.id,
              createdAt: conversation.createdAt,
              updatedAt: conversation.updatedAt,
              // 取第一条用户消息作为标题，如果没有则使用默认标题
              title: conversation.messages.find(m => m.role === 'user')?.content.substring(0, 30) || '新对话'
            });
          } catch (error) {
            console.error(`解析会话文件失败 ${file}:`, error);
          }
        }
      }
      
      // 按更新时间排序，最新的在前面
      return conversations.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
      console.error(`获取用户会话失败 ${userId}:`, error);
      return [];
    }
  }
  
  // 添加消息到会话
  addMessage(sessionId, message) {
    const conversation = this.getConversation(sessionId);
    if (!conversation) {
      return false;
    }
    
    conversation.messages.push(message);
    conversation.updatedAt = Date.now();
    
    this._saveConversation(conversation);
    return true;
  }
  
  // 获取最近的消息（用于构建上下文）
  getRecentMessages(sessionId, count = 10) {
    const conversation = this.getConversation(sessionId);
    if (!conversation) {
      return [];
    }
    
    return conversation.messages.slice(-count);
  }
  
  // 清理过期会话
  cleanupExpiredConversations() {
    const now = Date.now();
    
    // 清理内存中的过期会话
    for (const [sessionId, conversation] of this.activeConversations.entries()) {
      if (now - conversation.updatedAt > this.expirationTime) {
        this.activeConversations.delete(sessionId);
      }
    }
    
    // 可以定期清理文件系统中的过期会话
    // 这里为了简单起见，暂不实现文件清理
  }
  
  // 保存会话到文件
  _saveConversation(conversation) {
    const filePath = this._getConversationPath(conversation.id);
    try {
      fs.writeFileSync(filePath, JSON.stringify(conversation, null, 2));
    } catch (error) {
      console.error(`保存会话失败 ${conversation.id}:`, error);
    }
  }
  
  // 获取会话文件路径
  _getConversationPath(sessionId) {
    return path.join(this.storageDir, `${sessionId}.json`);
  }
}

module.exports = new ConversationService();