const { pool } = require('../config/db');

// 创建知识库
const createKnowledgeBase = async (name, description, userId = null) => {
  const sql = 'INSERT INTO knowledge_bases (name, description, user_id) VALUES (?, ?, ?)';
  
  try {
    const [result] = await pool.query(sql, [name, description, userId]);
    return result.insertId;
  } catch (error) {
    console.error('创建知识库失败:', error);
    throw error;
  }
};

// 获取知识库列表
const getKnowledgeBases = async () => {
  const sql = `
    SELECT kb.*, 
           COUNT(kf.id) as file_count,
           SUM(CASE WHEN kf.status = 'indexed' THEN 1 ELSE 0 END) as indexed_count
    FROM knowledge_bases kb
    LEFT JOIN knowledge_files kf ON kb.id = kf.knowledge_base_id
    GROUP BY kb.id
    ORDER BY kb.created_at DESC
  `;
  
  try {
    const [rows] = await pool.query(sql);
    return rows;
  } catch (error) {
    console.error('获取知识库列表失败:', error);
    throw error;
  }
};

// 获取单个知识库
const getKnowledgeBase = async (id) => {
  const sql = 'SELECT * FROM knowledge_bases WHERE id = ?';
  
  try {
    const [rows] = await pool.query(sql, [id]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('获取知识库失败:', error);
    throw error;
  }
};

// 更新知识库
const updateKnowledgeBase = async (id, name, description) => {
  const sql = 'UPDATE knowledge_bases SET name = ?, description = ? WHERE id = ?';
  
  try {
    const [result] = await pool.query(sql, [name, description, id]);
    return result.affectedRows > 0;
  } catch (error) {
    console.error('更新知识库失败:', error);
    throw error;
  }
};

// 删除知识库
const deleteKnowledgeBase = async (id) => {
  const sql = 'DELETE FROM knowledge_bases WHERE id = ?';
  
  try {
    const [result] = await pool.query(sql, [id]);
    return result.affectedRows > 0;
  } catch (error) {
    console.error('删除知识库失败:', error);
    throw error;
  }
};

// 添加文件到知识库
const addFile = async (knowledgeBaseId, originalFilename, storedPath, fileType, fileSize = 0) => {
  const sql = `
    INSERT INTO knowledge_files 
    (knowledge_base_id, original_filename, stored_path, file_type, file_size, status) 
    VALUES (?, ?, ?, ?, ?, 'pending')
  `;
  
  try {
    const [result] = await pool.query(sql, [
      knowledgeBaseId, 
      originalFilename, 
      storedPath, 
      fileType,
      fileSize
    ]);
    return result.insertId;
  } catch (error) {
    console.error('添加文件失败:', error);
    throw error;
  }
};

// 更新文件状态
const updateFileStatus = async (fileId, status, chunkCount = 0) => {
  const sql = 'UPDATE knowledge_files SET status = ?, chunk_count = ? WHERE id = ?';
  
  try {
    const [result] = await pool.query(sql, [status, chunkCount, fileId]);
    return result.affectedRows > 0;
  } catch (error) {
    console.error('更新文件状态失败:', error);
    throw error;
  }
};

// 获取知识库文件列表
const getKnowledgeBaseFiles = async (knowledgeBaseId) => {
  const sql = 'SELECT * FROM knowledge_files WHERE knowledge_base_id = ? ORDER BY created_at DESC';
  
  try {
    const [rows] = await pool.query(sql, [knowledgeBaseId]);
    return rows;
  } catch (error) {
    console.error('获取知识库文件列表失败:', error);
    throw error;
  }
};

// 获取单个文件
const getFile = async (fileId) => {
  const sql = 'SELECT * FROM knowledge_files WHERE id = ?';
  
  try {
    const [rows] = await pool.query(sql, [fileId]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('获取文件失败:', error);
    throw error;
  }
};

// 删除文件
const deleteFile = async (fileId) => {
  const sql = 'DELETE FROM knowledge_files WHERE id = ?';
  
  try {
    const [result] = await pool.query(sql, [fileId]);
    return result.affectedRows > 0;
  } catch (error) {
    console.error('删除文件失败:', error);
    throw error;
  }
};

module.exports = {
  createKnowledgeBase,
  getKnowledgeBases,
  getKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  addFile,
  updateFileStatus,
  getKnowledgeBaseFiles,
  getFile,
  deleteFile
};