const path = require('path');
const fs = require('fs-extra');
const knowledgeBaseModel = require('../models/knowledgeBaseModel');
const DocumentProcessor = require('./advisor/documentProcessor');
const EmbeddingService = require('./advisor/embeddingService');
const EnhancedVectorStore = require('./advisor/vectorStore');

class KnowledgeBaseService {
  constructor() {
    this.documentProcessor = new DocumentProcessor();
    this.embeddingService = new EmbeddingService();
    this.uploadsDir = path.join(process.cwd(), 'uploads/knowledge_base');

    fs.ensureDirSync(this.uploadsDir);
  }

  async getVectorStorePath(knowledgeBaseId) {
    const storeDir = path.join(process.cwd(), 'data/vector_stores');
    await fs.ensureDir(storeDir);
    return path.join(storeDir, `kb_${knowledgeBaseId}.json`);
  }

  async getVectorStore(knowledgeBaseId) {
    const storePath = await this.getVectorStorePath(knowledgeBaseId);
    const vectorStore = new EnhancedVectorStore({ storePath });
    // Load attempts to read the file. If it fails or file doesn't exist,
    // it initializes an empty store.
    await vectorStore.load();
    return vectorStore;
  }

  async createKnowledgeBase(name, description, userId) {
    return await knowledgeBaseModel.createKnowledgeBase(name, description, userId);
  }

  async getAllKnowledgeBases() {
    return await knowledgeBaseModel.getKnowledgeBases();
  }

  async getKnowledgeBase(id) {
    return await knowledgeBaseModel.getKnowledgeBase(id);
  }

  async updateKnowledgeBase(id, name, description) {
    return await knowledgeBaseModel.updateKnowledgeBase(id, name, description);
  }

  async deleteKnowledgeBase(id) {
    try {
      console.log(`开始删除知识库 ${id} 及其所有相关数据...`);
      const files = await knowledgeBaseModel.getKnowledgeBaseFiles(id);

      for (const file of files) {
        const filePath = path.join(this.uploadsDir, file.stored_path);
        if (await fs.pathExists(filePath)) {
          await fs.unlink(filePath);
          console.log(`已删除物理文件: ${filePath}`);
        }
      }
      const kbDir = path.join(this.uploadsDir, `kb_${id}`);
      if (await fs.pathExists(kbDir)) {
        await fs.remove(kbDir);
        console.log(`已删除目录: ${kbDir}`);
      }
      const storePath = await this.getVectorStorePath(id);
      if (await fs.pathExists(storePath)) {
        await fs.unlink(storePath);
        console.log(`已删除向量存储文件: ${storePath}`);
      }
      const result = await knowledgeBaseModel.deleteKnowledgeBase(id);
      console.log(`知识库 ${id} 已成功从数据库删除。`);
      return result;
    } catch (error) {
      console.error(`删除知识库失败: ${error.message}`);
      throw error;
    }
  }

  async getKnowledgeBaseFiles(knowledgeBaseId) {
    return await knowledgeBaseModel.getKnowledgeBaseFiles(knowledgeBaseId);
  }

  async saveUploadedFile(knowledgeBaseId, file) {
    const kbDir = path.join(this.uploadsDir, `kb_${knowledgeBaseId}`);
    await fs.ensureDir(kbDir);
    const timestamp = Date.now();
    const fileExtension = path.extname(file.originalname);
    const storedFilename = `${timestamp}_${path.basename(file.originalname, fileExtension)}${fileExtension}`;
    const storedPath = path.join(kbDir, storedFilename);
    await fs.writeFile(storedPath, file.buffer);
    const fileType = fileExtension.substring(1);
    // const documentProcessor = new DocumentProcessor(); // Already in constructor
    const contentHash = await this.documentProcessor.generateDocumentId(storedPath);
    return await knowledgeBaseModel.addFile(
      knowledgeBaseId,
      file.originalname,
      `kb_${knowledgeBaseId}/${storedFilename}`,
      fileType,
      file.size,
      contentHash
    );
  }

  async processFile(fileId) {
    const fileInfo = await knowledgeBaseModel.getFile(fileId);
    if (!fileInfo) throw new Error(`文件未找到: ID ${fileId}`);
    if (fileInfo.status === 'deleted') throw new Error(`文件 ${fileId} 已被删除，无法处理。`);

    try {
      await knowledgeBaseModel.updateFileStatus(fileId, 'processing');
      const filePath = path.join(this.uploadsDir, fileInfo.stored_path);
      if (!(await fs.pathExists(filePath))) {
        console.error(`(单个) 文件物理路径不存在: ${filePath}`);
        await knowledgeBaseModel.updateFileStatus(fileId, 'failed');
        throw new Error(`文件物理路径不存在: ${filePath}`);
      }
      const chunks = await this.documentProcessor.processFile(filePath);
      if (!chunks || chunks.length === 0) {
        console.warn(`(单个) 文件 ${fileInfo.original_filename} 未能提取有效文本块，标记为失败。`);
        await knowledgeBaseModel.updateFileStatus(fileId, 'failed', 0);
        return false;
      }

      const vectorStore = await this.getVectorStore(fileInfo.knowledge_base_id);
      const contentsOnly = chunks.map(chunk => chunk.content);
      const embeddings = await this.embeddingService.getBatchEmbeddings(contentsOnly);
      const validChunks = [];
      const validEmbeddings = [];
      const enhancedChunks = chunks.map((chunk, index) => ({
        ...chunk,
        id: `file_${fileInfo.id}_chunk_${index}`,
        metadata: { ...chunk.metadata, fileId: String(fileInfo.id), fileName: fileInfo.original_filename }
      }));

      for(let i = 0; i < embeddings.length; i++) {
        if (embeddings[i] && !embeddings[i].some(isNaN)) {
          validChunks.push(enhancedChunks[i]);
          validEmbeddings.push(embeddings[i]);
        } else { console.warn(`(单个) 块 ${enhancedChunks[i].id} 嵌入失败或无效，跳过。`); }
      }
      if (validChunks.length === 0) {
        console.warn(`(单个) 文件 ${fileInfo.original_filename} 所有块嵌入失败，标记为失败。`);
        await knowledgeBaseModel.updateFileStatus(fileId, 'failed', 0);
        return false;
      }

      vectorStore.removeDocumentsByFileId(String(fileId));
      await vectorStore.addDocuments(validChunks, validEmbeddings); // addDocuments is async now
      // await vectorStore.save(); // addDocuments might save if threshold met, or a final save might be needed if not.
                                // For single file processing, an explicit save after addDocuments is safer.
      await knowledgeBaseModel.updateFileStatus(fileId, 'indexed', validChunks.length);
      console.log(`(单个) 文件处理成功: ${fileInfo.original_filename}, 创建/更新了 ${validChunks.length} 个文本块`);
      return true;
    } catch (error) {
      console.error(`(单个) 处理文件失败: ${error.message}`);
      await knowledgeBaseModel.updateFileStatus(fileId, 'failed');
      throw error;
    }
  }

  async markFileAsDeleted(fileId) {
    try {
      const fileInfo = await knowledgeBaseModel.getFile(fileId);
      if (!fileInfo) throw new Error(`文件不存在: ID ${fileId}`);
      const success = await knowledgeBaseModel.markFileAsDeleted(fileId);
      if (!success) throw new Error(`在数据库中标记文件删除失败: ID ${fileId}`);
      const vectorStore = await this.getVectorStore(fileInfo.knowledge_base_id);
      const deletedCount = vectorStore.markDocumentsAsDeleted(String(fileId));
      if (deletedCount > 0) {
        await vectorStore.save();
        console.log(`已从向量存储中标记 ${deletedCount} 个文档为已删除`);
      } else {
        console.log(`向量存储中没有找到文件 ${fileId} 的文档进行标记。`);
      }
      return true;
    } catch (error) {
      console.error(`标记文件为删除状态失败: ${error.message}`);
      throw error;
    }
  }

  async deleteFile(fileId) {
    console.log(`执行软删除文件: ${fileId}`);
    return await this.markFileAsDeleted(fileId);
  }

  async restoreFile(fileId) {
    try {
      const fileInfo = await knowledgeBaseModel.getFile(fileId);
      if (!fileInfo) throw new Error(`文件不存在: ID ${fileId}`);
      const success = await knowledgeBaseModel.restoreDeletedFile(fileId);
      if (!success) throw new Error(`恢复文件失败: ID ${fileId}`);
      const vectorStore = await this.getVectorStore(fileInfo.knowledge_base_id);
      const restoredCount = vectorStore.restoreDocuments(String(fileId));
      if (restoredCount > 0) {
        await vectorStore.save();
        console.log(`已恢复${restoredCount}个文档`);
      } else {
        console.warn(`文件 ${fileId} 已在数据库恢复，但向量库无数据，建议重新处理或重建索引。`);
      }
      return true;
    } catch (error) {
      console.error(`恢复文件失败: ${error.message}`);
      throw error;
    }
  }

  async purgeDeletedFiles(knowledgeBaseId) {
    try {
      console.log(`开始彻底清除知识库 ${knowledgeBaseId} 中已软删除的文件...`);
      const deletedFiles = await knowledgeBaseModel.getDeletedFiles(knowledgeBaseId);
      if (deletedFiles.length === 0) {
        console.log("没有需要清除的文件。");
        return 0;
      }
      const vectorStore = await this.getVectorStore(knowledgeBaseId);
      const purgedCount = await vectorStore.purgeDeletedDocuments();
      if (purgedCount > 0) {
        // purgeDeletedDocuments in VectorStore already calls rebuildIndices and saves.
        // await vectorStore.save(); // Not needed if purgeDeletedDocuments saves.
        console.log(`已从向量存储中彻底删除 ${purgedCount} 个文档`);
      }
      let deletedDbCount = 0;
      for (const file of deletedFiles) {
        try {
          const filePath = path.join(this.uploadsDir, file.stored_path);
          if (await fs.pathExists(filePath)) {
            await fs.unlink(filePath);
          }
          await knowledgeBaseModel.deleteFile(file.id); // Physical delete from DB
          deletedDbCount++;
        } catch (error) {
          console.error(`物理删除文件记录失败: ${file.id}`, error);
        }
      }
      console.log(`已从数据库和物理存储中删除 ${deletedDbCount} 个文件记录`);
      return deletedDbCount;
    } catch (error) {
      console.error(`彻底删除文件失败: ${error.message}`);
      throw error;
    }
  }

  async _processSingleFileForRebuild(file) {
    try {
      const filePath = path.join(this.uploadsDir, file.stored_path);
      if (!(await fs.pathExists(filePath))) {
        console.warn(`[Rebuild] 文件物理路径不存在，跳过: ${filePath}`);
        await knowledgeBaseModel.updateFileStatus(file.id, 'failed', 0); // Ensure status is updated
        return null;
      }
      const chunks = await this.documentProcessor.processFile(filePath);
      if (!chunks || chunks.length === 0) {
        console.warn(`[Rebuild] 文件 ${file.original_filename} 未能提取有效文本块，标记为失败。`);
        await knowledgeBaseModel.updateFileStatus(file.id, 'failed', 0);
        return null;
      }
      const contentsOnly = chunks.map(chunk => chunk.content);
      const embeddings = await this.embeddingService.getBatchEmbeddings(contentsOnly);
      const validDocuments = [];
      const validEmbeddings = [];
      const enhancedChunks = chunks.map((chunk, index) => ({
        ...chunk,
        id: `file_${file.id}_chunk_${index}`,
        metadata: { ...chunk.metadata, fileId: String(file.id), fileName: file.original_filename }
      }));
      for (let i = 0; i < embeddings.length; i++) {
        if (embeddings[i] && !embeddings[i].some(isNaN)) {
          validDocuments.push(enhancedChunks[i]);
          validEmbeddings.push(embeddings[i]);
        } else {
          console.warn(`[Rebuild] 跳过 file ${file.id} chunk ${enhancedChunks[i] ? enhancedChunks[i].id : 'unknown'} 的空或无效嵌入向量。`);
        }
      }
      if (validDocuments.length > 0) {
        await knowledgeBaseModel.updateFileStatus(file.id, 'indexed', validDocuments.length);
        return { documents: validDocuments, embeddings: validEmbeddings };
      } else {
        console.warn(`[Rebuild] 文件 ${file.original_filename} 未产生任何有效嵌入块。`);
        await knowledgeBaseModel.updateFileStatus(file.id, 'failed', 0);
        return null;
      }
    } catch (error) {
      console.error(`[Rebuild] 处理文件 ${file.original_filename} 失败:`, error);
      await knowledgeBaseModel.updateFileStatus(file.id, 'failed', 0); // Ensure status is updated on error
      return null;
    }
  }

  async rebuildKnowledgeBaseIndex(knowledgeBaseId) {
    try {
      console.log(`[Rebuild] 开始重建知识库 ${knowledgeBaseId} 的索引 (调用全面调优)`);
      const files = await knowledgeBaseModel.getKnowledgeBaseFiles(knowledgeBaseId);
      const storePath = await this.getVectorStorePath(knowledgeBaseId);

      if (await fs.pathExists(storePath)) {
        await fs.unlink(storePath);
        console.log(`[Rebuild] 已删除旧向量存储: ${storePath}`);
      }

      const vectorStore = new EnhancedVectorStore({ storePath }); // Creates a new instance, load will be called internally by tune if needed, but tune should clear it.
      console.log("[Rebuild] 创建了全新的 VectorStore 实例。");

      console.log("[Rebuild] 重新处理所有文件...");
      let successCount = 0;
      let failCount = 0;
      const allDocuments = [];
      const allEmbeddings = [];

      for (const file of files) {
        if (file.status === 'deleted') {
          console.log(`[Rebuild] 跳过已软删除文件: ${file.original_filename}`);
          continue;
        }
        await knowledgeBaseModel.updateFileStatus(file.id, 'pending', 0);
        const result = await this._processSingleFileForRebuild(file);
        if (result && result.documents.length > 0) { // Ensure result has documents
          allDocuments.push(...result.documents);
          allEmbeddings.push(...result.embeddings);
          successCount++;
        } else {
          failCount++;
        }
      }

      if (allDocuments.length === 0) {
        console.error(`[Rebuild] 知识库 ${knowledgeBaseId} 未能收集到任何有效文档，重建中止。`);
        await vectorStore.save(); // Save an empty store to prevent load errors
        return { success: 0, failed: failCount, totalChunks: 0, finalK: 0, lshConfig: null, message: "No valid documents found." };
      }

      console.log(`[Rebuild] 收集到 ${allDocuments.length} 个有效文档块，准备构建索引...`);
      vectorStore.documents = allDocuments;
      vectorStore.embeddings = allEmbeddings;
      vectorStore.documentMap.clear();
      for (let i = 0; i < vectorStore.documents.length; i++) {
        vectorStore.documentMap.set(vectorStore.documents[i].id, i);
      }
      vectorStore.rebuildFileDocumentMap();
      vectorStore.deletedDocuments.clear();

      console.log("[Rebuild] 开始调用 vectorStore.tune() 进行全面参数调优和索引重建...");
      await vectorStore.tune();
      console.log("[Rebuild] vectorStore.tune() 调用完成。");

      console.log("[Rebuild] 开始调用 save()...");
      await vectorStore.save();
      console.log("[Rebuild] save() 调用完成。");

      console.log(`[Rebuild] 索引重建完成: ${successCount} 个文件成功, ${failCount} 个文件失败`);
      return {
        success: successCount,
        failed: failCount,
        totalChunks: allDocuments.length,
        finalK: vectorStore.clusterIndex ? vectorStore.clusterIndex.numClusters : 0,
        lshConfig: vectorStore.tunedLSHConfig
      };
    } catch (error) {
      console.error(`[Rebuild] 重建知识库索引失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  async searchKnowledgeBase(knowledgeBaseId, query, topK = 5) {
    try {
      const vectorStore = await this.getVectorStore(knowledgeBaseId);
      const stats = vectorStore.getStats();
      console.log(`搜索知识库 ${knowledgeBaseId}: ${stats.activeDocuments} 个活跃文档, ${stats.deletedDocuments} 个已删除文档, ${stats.clusterStats?.totalClusters || (stats.clusterStats?.note ? 0 : 'N/A')} 个聚类`);
      if (stats.activeDocuments === 0) {
        console.warn(`知识库 ${knowledgeBaseId} 中没有活动的文档，搜索将返回空结果。`);
        return [];
      }
      const queryEmbedding = await this.embeddingService.getEmbedding(query);
      const results = vectorStore.similaritySearch(queryEmbedding, topK);
      console.log(`找到 ${results.length} 个相关文档`);
      return results;
    } catch (error) {
      console.error(`搜索知识库失败: ${error.message}`);
      throw error;
    }
  }

  async checkFileExistsByContent(knowledgeBaseId, contentId) {
    if (typeof pool === 'undefined' || pool === null) {
      console.warn("数据库连接池 'pool' 未定义或未初始化，无法执行 checkFileExistsByContent。");
      return null;
    }
    try {
      const sql = `
        SELECT * FROM knowledge_files
        WHERE knowledge_base_id = ?
        AND content_hash = ?
        AND status != 'deleted'
      `;
      const [rows] = await pool.query(sql, [knowledgeBaseId, contentId]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error(`检查文件是否存在失败: ${error.message}`);
      return null;
    }
  }
}

module.exports = new KnowledgeBaseService();