const path = require('path'); // 引入路径处理模块
const fs = require('fs-extra'); // 引入文件系统扩展模块，提供更多文件操作功能
const knowledgeBaseModel = require('../models/knowledgeBaseModel'); // 引入知识库数据模型
const DocumentProcessor = require('./advisor/documentProcessor'); // 引入文档处理器
const embeddingService = require('./advisor/embeddingService'); // 引入嵌入服务，用于生成向量
const EnhancedVectorStore = require('./advisor/vectorStore'); // 引入增强的向量存储库

/**
 * 知识库服务类 (KnowledgeBaseService)
 * 封装了与知识库相关的核心业务逻辑，包括：
 * - 知识库的增删改查 (CRUD)。
 * - 知识库文件的上传、处理、索引、删除、恢复和清除。
 * - 向量存储的管理和操作。
 * - 知识库的搜索功能。
 * - 索引重建和优化。
 */
class KnowledgeBaseService {
  /**
   * 构造函数 - 初始化服务实例。
   */
  constructor() {
    this.documentProcessor = new DocumentProcessor(); // 实例化文档处理器
    this.embeddingService = embeddingService; // 实例化嵌入服务
    this.uploadsDir = path.join(process.cwd(), 'uploads/knowledge_base'); // 定义知识库文件上传的基础目录

    fs.ensureDirSync(this.uploadsDir); // 确保上传目录存在，如果不存在则同步创建
  }

  /**
   * 获取指定知识库的向量存储文件路径。
   * @param {string|number} knowledgeBaseId - 知识库 ID。
   * @returns {Promise<string>} 向量存储文件的绝对路径。
   */
  async getVectorStorePath(knowledgeBaseId) {
    const storeDir = path.join(process.cwd(), 'data/vector_stores'); // 定义向量存储目录
    await fs.ensureDir(storeDir); // 确保向量存储目录存在（异步创建）
    return path.join(storeDir, `kb_${knowledgeBaseId}.json`); // 返回特定知识库的向量存储文件路径 (例如: data/vector_stores/kb_123.json)
  }

  /**
   * 获取或初始化指定知识库的向量存储实例。
   * @param {string|number} knowledgeBaseId - 知识库 ID。
   * @returns {Promise<EnhancedVectorStore>} 向量存储实例。
   */
  async getVectorStore(knowledgeBaseId) {
    const storePath = await this.getVectorStorePath(knowledgeBaseId); // 获取向量存储路径
    const vectorStore = new EnhancedVectorStore({ storePath }); // 创建向量存储实例
    // 尝试从文件加载向量存储。如果文件不存在或加载失败，
    // EnhancedVectorStore 内部应能处理并初始化一个空的存储。
    await vectorStore.load();
    return vectorStore; // 返回加载或初始化后的向量存储实例
  }

  /**
   * 创建一个新的知识库。
   * @param {string} name - 知识库名称。
   * @param {string} description - 知识库描述。
   * @param {string|number} userId - 创建者用户 ID。
   * @returns {Promise<object>} 创建成功的知识库对象（来自数据库）。
   */
  async createKnowledgeBase(name, description, userId) {
    return await knowledgeBaseModel.createKnowledgeBase(name, description, userId); // 调用模型层创建知识库
  }

  /**
   * 获取所有知识库列表。
   * @returns {Promise<Array<object>>} 包含所有知识库对象的数组。
   */
  async getAllKnowledgeBases() {
    return await knowledgeBaseModel.getKnowledgeBases(); // 调用模型层获取所有知识库
  }

  /**
   * 根据 ID 获取单个知识库信息。
   * @param {string|number} id - 知识库 ID。
   * @returns {Promise<object|null>} 知识库对象或 null（如果未找到）。
   */
  async getKnowledgeBase(id) {
    return await knowledgeBaseModel.getKnowledgeBase(id); // 调用模型层获取指定知识库
  }

  /**
   * 更新知识库信息。
   * @param {string|number} id - 知识库 ID。
   * @param {string} name - 新的知识库名称。
   * @param {string} description - 新的知识库描述。
   * @returns {Promise<object>} 更新后的知识库对象。
   */
  async updateKnowledgeBase(id, name, description) {
    return await knowledgeBaseModel.updateKnowledgeBase(id, name, description); // 调用模型层更新知识库
  }

  /**
   * 删除一个知识库及其所有相关数据（物理文件、向量存储、数据库记录）。
   * 这是一个 **硬删除** 操作，会彻底移除所有数据。
   * @param {string|number} id - 要删除的知识库 ID。
   * @returns {Promise<object>} 删除操作的结果（来自数据库）。
   */
  async deleteKnowledgeBase(id) {
    try {
      console.log(`开始删除知识库 ${id} 及其所有相关数据...`);
      const files = await knowledgeBaseModel.getKnowledgeBaseFiles(id); // 获取知识库下的所有文件记录

      // 1. 删除与该知识库关联的所有物理文件
      for (const file of files) {
        const filePath = path.join(this.uploadsDir, file.stored_path);
        if (await fs.pathExists(filePath)) {
          await fs.unlink(filePath);
          console.log(`已删除物理文件: ${filePath}`);
        }
      }

      // 2. 删除该知识库的上传子目录
      const kbDir = path.join(this.uploadsDir, `kb_${id}`);
      if (await fs.pathExists(kbDir)) {
        await fs.remove(kbDir); // 使用 fs.remove 可以删除目录及其内容
        console.log(`已删除目录: ${kbDir}`);
      }

      // 3. 删除向量存储文件
      const storePath = await this.getVectorStorePath(id);
      if (await fs.pathExists(storePath)) {
        await fs.unlink(storePath);
        console.log(`已删除向量存储文件: ${storePath}`);
      }

      // 4. 从数据库删除知识库记录（假设数据库设置了级联删除，会同时删除关联的文件记录）
      const result = await knowledgeBaseModel.deleteKnowledgeBase(id);
      console.log(`知识库 ${id} 已成功从数据库删除。`);
      return result;
    } catch (error) {
      console.error(`删除知识库失败: ${error.message}`);
      throw error; // 向上层抛出错误，以便进行处理
    }
  }

  /**
   * 获取指定知识库下的所有文件记录。
   * @param {string|number} knowledgeBaseId - 知识库 ID。
   * @returns {Promise<Array<object>>} 文件记录对象数组。
   */
  async getKnowledgeBaseFiles(knowledgeBaseId) {
    return await knowledgeBaseModel.getKnowledgeBaseFiles(knowledgeBaseId); // 调用模型层获取文件列表
  }

  /**
   * 保存上传的文件到指定知识库目录，并生成内容哈希，最后在数据库中创建文件记录。
   * @param {string|number} knowledgeBaseId - 知识库 ID。
   * @param {object} file - 上传的文件对象 (通常来自 multer 或类似库，包含 originalname, buffer, size 等属性)。
   * @returns {Promise<object>} 创建成功的文件记录对象。
   */
  async saveUploadedFile(knowledgeBaseId, file) {
    const kbDir = path.join(this.uploadsDir, `kb_${knowledgeBaseId}`); // 构建知识库专属的上传目录路径
    await fs.ensureDir(kbDir); // 确保目录存在

    const timestamp = Date.now(); // 使用当前时间戳作为文件名的一部分，避免冲突
    const fileExtension = path.extname(file.originalname); // 获取原始文件的扩展名 (例如: .pdf)
    // 从原始文件名中移除扩展名，以构建新的存储文件名
    const baseName = path.basename(file.originalname, fileExtension);
    const storedFilename = `${timestamp}_${baseName}${fileExtension}`; // 生成存储文件名 (例如: 1678886400000_document.pdf)
    const storedPath = path.join(kbDir, storedFilename); // 完整的物理存储路径

    await fs.writeFile(storedPath, file.buffer); // 将上传文件的缓冲区内容写入磁盘

    const fileType = fileExtension.substring(1); // 获取文件类型（去掉开头的点，例如: pdf）
    // 使用文档处理器生成文件的内容哈希 (MD5 或 SHA)，用于识别重复文件
    const contentHash = await this.documentProcessor.generateDocumentId(storedPath);

    // 调用模型层将文件信息添加到数据库
    return await knowledgeBaseModel.addFile(
      knowledgeBaseId,
      file.originalname, // 原始文件名
      `kb_${knowledgeBaseId}/${storedFilename}`, // 存储相对路径 (相对于 uploadsDir)
      fileType, // 文件类型
      file.size, // 文件大小
      contentHash // 内容哈希
    );
  }

  /**
   * 处理（索引）单个文件。
   * 流程：
   * 1. 获取文件信息并检查状态。
   * 2. 更新状态为 'processing'。
   * 3. 检查物理文件是否存在。
   * 4. 使用 DocumentProcessor 提取文本块 (chunks)。
   * 5. 如果没有文本块，标记为 'failed'。
   * 6. 获取向量存储实例。
   * 7. 批量生成文本块的嵌入向量 (embeddings)。
   * 8. 过滤无效的嵌入向量。
   * 9. 如果没有有效的嵌入向量，标记为 'failed'。
   * 10. 从向量存储中移除该文件旧的文档（确保更新）。
   * 11. 将新的有效文档和向量添加到向量存储。
   * 12. 更新文件状态为 'indexed' 并记录块数。
   * @param {string|number} fileId - 要处理的文件 ID。
   * @returns {Promise<boolean>} 处理成功返回 true，失败返回 false。
   */
  async processFile(fileId) {
    const fileInfo = await knowledgeBaseModel.getFile(fileId); // 从数据库获取文件信息
    if (!fileInfo) throw new Error(`文件未找到: ID ${fileId}`);
    if (fileInfo.status === 'deleted') throw new Error(`文件 ${fileId} 已被删除，无法处理。`);

    try {
      await knowledgeBaseModel.updateFileStatus(fileId, 'processing'); // 更新数据库状态为处理中
      const filePath = path.join(this.uploadsDir, fileInfo.stored_path); // 获取文件的完整物理路径

      // 检查文件是否真的存在于磁盘上
      if (!(await fs.pathExists(filePath))) {
        console.error(`(单个) 文件物理路径不存在: ${filePath}`);
        await knowledgeBaseModel.updateFileStatus(fileId, 'failed'); // 更新状态为失败
        throw new Error(`文件物理路径不存在: ${filePath}`);
      }

      // 使用文档处理器处理文件，提取文本块 (chunks)
      const chunks = await this.documentProcessor.processFile(filePath);
      // 如果未能提取任何文本块 (可能是空文件、不支持的格式或提取失败)
      if (!chunks || chunks.length === 0) {
        console.warn(`(单个) 文件 ${fileInfo.original_filename} 未能提取有效文本块，标记为失败。`);
        await knowledgeBaseModel.updateFileStatus(fileId, 'failed', 0); // 更新状态为失败，块数为 0
        return false;
      }

      const vectorStore = await this.getVectorStore(fileInfo.knowledge_base_id); // 获取该知识库的向量存储实例
      const contentsOnly = chunks.map(chunk => chunk.content); // 仅提取文本块的内容，用于生成嵌入
      const embeddings = await this.embeddingService.getBatchEmbeddings(contentsOnly); // 批量生成嵌入向量

      const validChunks = []; // 存储有效的文本块
      const validEmbeddings = []; // 存储有效的嵌入向量
      // 为每个文本块添加唯一的 ID 和包含文件信息的元数据
      const enhancedChunks = chunks.map((chunk, index) => ({
        ...chunk,
        id: `file_${fileInfo.id}_chunk_${index}`, // 生成唯一的块 ID，格式: file_文件ID_chunk_索引
        metadata: { ...chunk.metadata, fileId: String(fileInfo.id), fileName: fileInfo.original_filename } // 在元数据中加入文件 ID 和原始文件名
      }));

      // 过滤掉生成失败或包含 NaN (Not a Number) 的无效嵌入向量
      for(let i = 0; i < embeddings.length; i++) {
        if (embeddings[i] && !embeddings[i].some(isNaN)) {
          validChunks.push(enhancedChunks[i]);
          validEmbeddings.push(embeddings[i]);
        } else { console.warn(`(单个) 块 ${enhancedChunks[i].id} 嵌入失败或无效，跳过。`); }
      }

      // 如果所有块的嵌入都失败了
      if (validChunks.length === 0) {
        console.warn(`(单个) 文件 ${fileInfo.original_filename} 所有块嵌入失败，标记为失败。`);
        await knowledgeBaseModel.updateFileStatus(fileId, 'failed', 0);
        return false;
      }

      // 在添加新文档之前，先移除与此文件 ID 相关的所有旧文档，以处理文件更新的情况
      vectorStore.removeDocumentsByFileId(String(fileId));
      // 将有效的文本块和它们对应的嵌入向量添加到向量存储中
      await vectorStore.addDocuments(validChunks, validEmbeddings);
      // 注意: EnhancedVectorStore 的 addDocuments 方法可能包含保存逻辑 (例如达到一定数量后自动保存)。
      // 如果不包含，或者为了确保每次处理都保存，可能需要在这里取消注释并调用:
      // await vectorStore.save();

      // 更新数据库中的文件状态为 'indexed'，并记录成功处理的文本块数量
      await knowledgeBaseModel.updateFileStatus(fileId, 'indexed', validChunks.length);
      console.log(`(单个) 文件处理成功: ${fileInfo.original_filename}, 创建/更新了 ${validChunks.length} 个文本块`);
      return true; // 处理成功
    } catch (error) {
      console.error(`(单个) 处理文件失败: ${error.message}`);
      await knowledgeBaseModel.updateFileStatus(fileId, 'failed'); // 发生任何错误，都将状态标记为失败
      throw error; // 向上抛出错误
    }
  }

  /**
   * 将文件标记为已删除（软删除）。
   * 这会将数据库中的文件状态更新为 'deleted'，并在向量存储中将相关文档标记为已删除（但不会立即移除）。
   * @param {string|number} fileId - 要标记的文件 ID。
   * @returns {Promise<boolean>} 成功返回 true。
   */
  async markFileAsDeleted(fileId) {
    try {
      const fileInfo = await knowledgeBaseModel.getFile(fileId); // 获取文件信息
      if (!fileInfo) throw new Error(`文件不存在: ID ${fileId}`);

      // 1. 在数据库中将文件状态更新为 'deleted'
      const success = await knowledgeBaseModel.markFileAsDeleted(fileId);
      if (!success) throw new Error(`在数据库中标记文件删除失败: ID ${fileId}`);

      // 2. 在向量存储中标记与该文件 ID 关联的所有文档为已删除
      const vectorStore = await this.getVectorStore(fileInfo.knowledge_base_id);
      const deletedCount = vectorStore.markDocumentsAsDeleted(String(fileId));

      // 3. 如果有文档被标记，则保存向量存储以持久化更改
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

  /**
   * 执行文件的软删除（对外暴露的接口）。
   * @param {string|number} fileId - 要删除的文件 ID。
   * @returns {Promise<boolean>} 软删除操作的结果。
   */
  async deleteFile(fileId) {
    console.log(`执行软删除文件: ${fileId}`);
    return await this.markFileAsDeleted(fileId); // 内部调用 markFileAsDeleted 实现软删除
  }

  /**
   * 恢复已软删除的文件。
   * 这会将数据库中的文件状态从 'deleted' 恢复为之前的状态（通常是 'indexed' 或 'pending'），
   * 并在向量存储中取消相关文档的删除标记。
   * @param {string|number} fileId - 要恢复的文件 ID。
   * @returns {Promise<boolean>} 成功返回 true。
   */
  async restoreFile(fileId) {
    try {
      const fileInfo = await knowledgeBaseModel.getFile(fileId); // 获取文件信息
      if (!fileInfo) throw new Error(`文件不存在: ID ${fileId}`);

      // 1. 在数据库中恢复文件（通常是将 status 改回 'indexed' 或 'pending'）
      const success = await knowledgeBaseModel.restoreDeletedFile(fileId);
      if (!success) throw new Error(`恢复文件失败: ID ${fileId}`);

      // 2. 在向量存储中取消与该文件 ID 关联的所有文档的删除标记
      const vectorStore = await this.getVectorStore(fileInfo.knowledge_base_id);
      const restoredCount = vectorStore.restoreDocuments(String(fileId));

      // 3. 如果有文档被恢复，则保存向量存储
      if (restoredCount > 0) {
        await vectorStore.save();
        console.log(`已恢复 ${restoredCount} 个文档`);
      } else {
        // 如果数据库已恢复但向量库中没有找到对应的文档（可能之前未索引或已清除），
        // 给出警告，提示用户可能需要重新处理该文件。
        console.warn(`文件 ${fileId} 已在数据库恢复，但向量库无数据，建议重新处理或重建索引。`);
      }
      return true;
    } catch (error) {
      console.error(`恢复文件失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 彻底清除知识库中已软删除的文件。
   * 这是一个 **硬删除** 过程，但只针对已标记为 'deleted' 的文件：
   * 1. 获取所有 'deleted' 状态的文件记录。
   * 2. 从向量存储中永久移除这些已标记删除的文档（purge）。
   * 3. 遍历这些文件记录，删除对应的物理文件。
   * 4. 从数据库中永久删除这些文件记录。
   * @param {string|number} knowledgeBaseId - 知识库 ID。
   * @returns {Promise<number>} 清除的文件数量。
   */
  async purgeDeletedFiles(knowledgeBaseId) {
    try {
      console.log(`开始彻底清除知识库 ${knowledgeBaseId} 中已软删除的文件...`);
      // 1. 获取所有状态为 'deleted' 的文件记录
      const deletedFiles = await knowledgeBaseModel.getDeletedFiles(knowledgeBaseId);

      if (deletedFiles.length === 0) {
        console.log("没有需要清除的文件。");
        return 0; // 如果没有软删除的文件，则直接返回 0
      }

      const vectorStore = await this.getVectorStore(knowledgeBaseId);
      // 2. 从向量存储中彻底清除所有已标记删除的文档
      const purgedCount = await vectorStore.purgeDeletedDocuments();
      // purgeDeletedDocuments 内部应该会重建索引并保存，所以这里不需要再调用 save()
      if (purgedCount > 0) {
        console.log(`已从向量存储中彻底删除 ${purgedCount} 个文档`);
      }

      let deletedDbCount = 0; // 记录成功删除的文件数量
      // 3. 遍历并删除物理文件和数据库记录
      for (const file of deletedFiles) {
        try {
          const filePath = path.join(this.uploadsDir, file.stored_path);
          // 3a. 删除物理文件
          if (await fs.pathExists(filePath)) {
            await fs.unlink(filePath);
          }
          // 3b. 从数据库中物理删除文件记录
          await knowledgeBaseModel.deleteFile(file.id);
          deletedDbCount++;
        } catch (error) {
          // 如果单个文件删除失败，记录错误并继续处理下一个
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

  /**
   * （内部辅助方法）为重建索引流程处理单个文件。
   * 主要区别在于它返回处理结果（文档和向量），而不是直接修改向量存储。
   * 并且会更新文件状态。
   * @param {object} file - 文件信息对象。
   * @returns {Promise<object|null>} 包含 { documents, embeddings } 的对象，或 null（如果处理失败）。
   * @private
   */
  async _processSingleFileForRebuild(file) {
    try {
      const filePath = path.join(this.uploadsDir, file.stored_path);
      // 检查物理文件是否存在，不存在则标记失败并返回 null
      if (!(await fs.pathExists(filePath))) {
        console.warn(`[Rebuild] 文件物理路径不存在，跳过: ${filePath}`);
        await knowledgeBaseModel.updateFileStatus(file.id, 'failed', 0);
        return null;
      }
      // 处理文件，提取文本块
      const chunks = await this.documentProcessor.processFile(filePath);
      // 未能提取文本块，标记失败并返回 null
      if (!chunks || chunks.length === 0) {
        console.warn(`[Rebuild] 文件 ${file.original_filename} 未能提取有效文本块，标记为失败。`);
        await knowledgeBaseModel.updateFileStatus(file.id, 'failed', 0);
        return null;
      }
      // 提取内容并批量生成嵌入向量
      const contentsOnly = chunks.map(chunk => chunk.content);
      const embeddings = await this.embeddingService.getBatchEmbeddings(contentsOnly);

      const validDocuments = [];
      const validEmbeddings = [];
      // 增强文本块信息
      const enhancedChunks = chunks.map((chunk, index) => ({
        ...chunk,
        id: `file_${file.id}_chunk_${index}`,
        metadata: { ...chunk.metadata, fileId: String(file.id), fileName: file.original_filename }
      }));
      // 过滤无效嵌入
      for (let i = 0; i < embeddings.length; i++) {
        if (embeddings[i] && !embeddings[i].some(isNaN)) {
          validDocuments.push(enhancedChunks[i]);
          validEmbeddings.push(embeddings[i]);
        } else {
          console.warn(`[Rebuild] 跳过 file ${file.id} chunk ${enhancedChunks[i] ? enhancedChunks[i].id : 'unknown'} 的空或无效嵌入向量。`);
        }
      }
      // 如果有有效文档，更新状态为 'indexed' 并返回结果
      if (validDocuments.length > 0) {
        await knowledgeBaseModel.updateFileStatus(file.id, 'indexed', validDocuments.length);
        return { documents: validDocuments, embeddings: validEmbeddings };
      } else {
        // 如果没有有效文档，标记失败并返回 null
        console.warn(`[Rebuild] 文件 ${file.original_filename} 未产生任何有效嵌入块。`);
        await knowledgeBaseModel.updateFileStatus(file.id, 'failed', 0);
        return null;
      }
    } catch (error) {
      // 发生任何错误，标记失败并返回 null
      console.error(`[Rebuild] 处理文件 ${file.original_filename} 失败:`, error);
      await knowledgeBaseModel.updateFileStatus(file.id, 'failed', 0);
      return null;
    }
  }

  /**
   * 重建知识库的向量索引。
   * 这是一个耗时操作，通常在以下情况使用：
   * - 向量存储损坏或需要升级。
   * - 嵌入模型更新。
   * - 需要进行全面的性能优化（调用 `vectorStore.tune()`）。
   * 流程：
   * 1. 删除旧的向量存储文件。
   * 2. 创建一个全新的向量存储实例。
   * 3. 遍历知识库中所有非 'deleted' 状态的文件。
   * 4. 逐个重新处理这些文件（调用 `_processSingleFileForRebuild`）。
   * 5. 收集所有有效的文档和嵌入向量。
   * 6. 如果没有有效文档，中止重建。
   * 7. 将所有文档和向量加载到新的向量存储实例中。
   * 8. 调用 `vectorStore.tune()` 进行优化和索引构建。
   * 9. 保存新的向量存储文件。
   * @param {string|number} knowledgeBaseId - 知识库 ID。
   * @returns {Promise<object>} 重建结果的统计信息，包括成功/失败文件数、总块数、聚类数和 LSH 配置。
   */
  async rebuildKnowledgeBaseIndex(knowledgeBaseId) {
    try {
      console.log(`[Rebuild] 开始重建知识库 ${knowledgeBaseId} 的索引 (调用全面调优)`);
      const files = await knowledgeBaseModel.getKnowledgeBaseFiles(knowledgeBaseId); // 获取所有文件记录
      const storePath = await this.getVectorStorePath(knowledgeBaseId); // 获取存储路径

      // 1. 删除旧的向量存储文件
      if (await fs.pathExists(storePath)) {
        await fs.unlink(storePath);
        console.log(`[Rebuild] 已删除旧向量存储: ${storePath}`);
      }

      // 2. 创建一个全新的向量存储实例
      const vectorStore = new EnhancedVectorStore({ storePath });
      console.log("[Rebuild] 创建了全新的 VectorStore 实例。");

      console.log("[Rebuild] 重新处理所有文件...");
      let successCount = 0;
      let failCount = 0;
      const allDocuments = []; // 存储所有文档
      const allEmbeddings = []; // 存储所有向量

      // 3. 遍历并处理每个文件
      for (const file of files) {
        // 3a. 跳过已软删除的文件
        if (file.status === 'deleted') {
          console.log(`[Rebuild] 跳过已软删除文件: ${file.original_filename}`);
          continue;
        }
        // 3b. 更新状态为待处理
        await knowledgeBaseModel.updateFileStatus(file.id, 'pending', 0);
        // 3c. 处理文件并收集结果
        const result = await this._processSingleFileForRebuild(file);
        if (result && result.documents.length > 0) {
          allDocuments.push(...result.documents);
          allEmbeddings.push(...result.embeddings);
          successCount++;
        } else {
          failCount++;
        }
      }

      // 4. 如果没有任何有效文档，中止重建
      if (allDocuments.length === 0) {
        console.error(`[Rebuild] 知识库 ${knowledgeBaseId} 未能收集到任何有效文档，重建中止。`);
        await vectorStore.save(); // 保存一个空的存储，避免下次加载出错
        return { success: 0, failed: failCount, totalChunks: 0, finalK: 0, lshConfig: null, message: "No valid documents found." };
      }

      console.log(`[Rebuild] 收集到 ${allDocuments.length} 个有效文档块，准备构建索引...`);
      // 5. 将所有数据加载到向量存储实例中
      vectorStore.documents = allDocuments;
      vectorStore.embeddings = allEmbeddings;
      vectorStore.documentMap.clear(); // 清空旧的映射
      // 重新构建 documentMap 和 fileDocumentMap
      for (let i = 0; i < vectorStore.documents.length; i++) {
        vectorStore.documentMap.set(vectorStore.documents[i].id, i);
      }
      vectorStore.rebuildFileDocumentMap();
      vectorStore.deletedDocuments.clear(); // 确保删除列表为空

      // 6. 调用 EnhancedVectorStore 的 tune 方法进行优化和构建索引
      console.log("[Rebuild] 开始调用 vectorStore.tune() 进行全面参数调优和索引重建...");
      await vectorStore.tune();
      console.log("[Rebuild] vectorStore.tune() 调用完成。");

      // 7. 保存重建后的向量存储
      console.log("[Rebuild] 开始调用 save()...");
      await vectorStore.save();
      console.log("[Rebuild] save() 调用完成。");

      console.log(`[Rebuild] 索引重建完成: ${successCount} 个文件成功, ${failCount} 个文件失败`);
      // 8. 返回重建统计信息
      return {
        success: successCount,
        failed: failCount,
        totalChunks: allDocuments.length,
        finalK: vectorStore.clusterIndex ? vectorStore.clusterIndex.numClusters : 0, // 聚类数量
        lshConfig: vectorStore.tunedLSHConfig // LSH 配置
      };
    } catch (error) {
      console.error(`[Rebuild] 重建知识库索引失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 在知识库中执行相似性搜索。
   * @param {string|number} knowledgeBaseId - 知识库 ID。
   * @param {string} query - 搜索查询文本。
   * @param {number} [topK=5] - 返回最相似结果的数量，默认为 5。
   * @returns {Promise<Array<object>>} 搜索结果数组，每个结果包含文档内容、元数据和相似度得分。
   */
  async searchKnowledgeBase(knowledgeBaseId, query, topK = 5) {
    try {
      const vectorStore = await this.getVectorStore(knowledgeBaseId); // 获取向量存储
      const stats = vectorStore.getStats(); // 获取统计信息用于日志记录
      console.log(`搜索知识库 ${knowledgeBaseId}: ${stats.activeDocuments} 个活跃文档, ${stats.deletedDocuments} 个已删除文档, ${stats.clusterStats?.totalClusters || (stats.clusterStats?.note ? 0 : 'N/A')} 个聚类`);

      // 如果知识库中没有活动的文档，直接返回空数组
      if (stats.activeDocuments === 0) {
        console.warn(`知识库 ${knowledgeBaseId} 中没有活动的文档，搜索将返回空结果。`);
        return [];
      }

      const queryEmbedding = await this.embeddingService.getEmbedding(query); // 将查询文本转换为嵌入向量
      const results = vectorStore.similaritySearch(queryEmbedding, topK); // 在向量存储中执行相似性搜索
      console.log(`找到 ${results.length} 个相关文档`);
      return results; // 返回搜索结果
    } catch (error) {
      console.error(`搜索知识库失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 根据内容哈希检查文件是否已存在于知识库中（且未被删除）。
   * **注意**: 此方法依赖一个名为 `pool` 的数据库连接池变量。
   * 这个变量需要在使用此方法之前在某处定义和初始化。
   * 如果 `pool` 未定义，此方法将返回 null 并发出警告。
   * @param {string|number} knowledgeBaseId - 知识库 ID。
   * @param {string} contentId - 文件的内容哈希。
   * @returns {Promise<object|null>} 如果存在，返回文件记录对象；否则返回 null。
   */
  async checkFileExistsByContent(knowledgeBaseId, contentId) {
    // 检查数据库连接池是否存在
    if (typeof pool === 'undefined' || pool === null) {
      console.warn("数据库连接池 'pool' 未定义或未初始化，无法执行 checkFileExistsByContent。");
      return null; // 返回 null 表示无法检查
    }
    try {
      // 构建 SQL 查询语句，查找指定知识库中具有相同内容哈希且状态不是 'deleted' 的文件
      const sql = `
        SELECT * FROM knowledge_files
        WHERE knowledge_base_id = ?
        AND content_hash = ?
        AND status != 'deleted'
      `;
      // 执行 SQL 查询
      const [rows] = await pool.query(sql, [knowledgeBaseId, contentId]);
      // 如果查询结果不为空，则表示文件已存在，返回第一条记录；否则返回 null
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error(`检查文件是否存在失败: ${error.message}`);
      return null; // 发生数据库错误时返回 null
    }
  }
}

// 导出 KnowledgeBaseService 的单例实例。
// 这意味着在整个应用程序中，所有引用此模块的地方都将使用同一个 KnowledgeBaseService 对象。
module.exports = new KnowledgeBaseService();