const { pool } = require('../config/db');

// 创建新会话
const createConversation = async (userId, title = '新对话') => {
  const sessionId = `${userId}-${Date.now()}`;
  const sql = 'INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)';
  
  try {
    await pool.query(sql, [sessionId, userId, title]);
    return sessionId;
  } catch (error) {
    console.error('创建会话失败:', error);
    throw error;
  }
};

// 获取会话信息
const getConversation = async (sessionId) => {
  const sql = 'SELECT * FROM conversations WHERE id = ?';
  
  try {
    const [rows] = await pool.query(sql, [sessionId]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('获取会话失败:', error);
    throw error;
  }
};

// 获取用户所有会话
const getUserConversations = async (userId) => {
  const sql = `
    SELECT c.*, 
           (SELECT content FROM conversation_messages 
            WHERE conversation_id = c.id AND role = 'user' 
            ORDER BY timestamp ASC LIMIT 1) as first_message
    FROM conversations c
    WHERE c.user_id = ?
    ORDER BY c.updated_at DESC
  `;
  
  try {
    const [rows] = await pool.query(sql, [userId]);
    return rows.map(row => ({
      id: row.id,
      title: row.title || row.first_message?.substring(0, 30) || '新对话',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  } catch (error) {
    console.error('获取用户会话列表失败:', error);
    throw error;
  }
};

// 更新会话标题
const updateConversationTitle = async (sessionId, title) => {
  const sql = 'UPDATE conversations SET title = ? WHERE id = ?';
  
  try {
    const [result] = await pool.query(sql, [title, sessionId]);
    return result.affectedRows > 0;
  } catch (error) {
    console.error('更新会话标题失败:', error);
    throw error;
  }
};

// 删除会话
const deleteConversation = async (sessionId) => {
  const sql = 'DELETE FROM conversations WHERE id = ?';
  
  try {
    const [result] = await pool.query(sql, [sessionId]);
    return result.affectedRows > 0;
  } catch (error) {
    console.error('删除会话失败:', error);
    throw error;
  }
};

// 添加消息到会话
const addMessage = async (sessionId, role, content) => {
  const sql = 'INSERT INTO conversation_messages (conversation_id, role, content) VALUES (?, ?, ?)';
  
  try {
    await pool.query(sql, [sessionId, role, content]);
    // 更新会话的updated_at时间戳
    await pool.query('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [sessionId]);
    return true;
  } catch (error) {
    console.error('添加消息失败:', error);
    throw error;
  }
};

// 获取会话消息
const getConversationMessages = async (sessionId) => {
  const sql = 'SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY timestamp ASC';
  
  try {
    const [rows] = await pool.query(sql, [sessionId]);
    return rows;
  } catch (error) {
    console.error('获取会话消息失败:', error);
    throw error;
  }
};

module.exports = {
  createConversation,
  getConversation,
  getUserConversations,
  updateConversationTitle,
  deleteConversation,
  addMessage,
  getConversationMessages
};