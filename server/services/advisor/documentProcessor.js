/**
 * 现代化的文档处理器
 * 支持多种文档格式的文本提取和分块
 */
const fs = require('fs-extra');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const csv = require('csv-parser');
const crypto = require('crypto');
// 使用adm-zip代替epub库
const AdmZip = require('adm-zip');
const cheerio = require('cheerio');
// 使用node-unrtf替代rtf-to-text
const unrtf = require('node-unrtf');
const { pipeline } = require('stream/promises');

class DocumentProcessor {
  /**
   * 创建文档处理器实例
   * @param {Object} options - 配置选项
   * @param {number} options.chunkSize - 每个文本块的大小（默认1000）
   * @param {number} options.chunkOverlap - 文本块之间的重叠大小（默认200）
   * @param {string} options.cacheDir - 缓存目录路径
   */
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 1000;
    this.chunkOverlap = options.chunkOverlap || 200;
    this.cacheDir = options.cacheDir || path.join(process.cwd(), 'data/chunks');
    
    // 确保缓存目录存在
    fs.ensureDirSync(this.cacheDir);
  }
  
  /**
   * 基于文件内容生成文档ID
   * @param {string} filePath - 文件路径
   * @returns {Promise<string>} 文档ID (MD5哈希)
   */
  async generateDocumentId(filePath) {
    try {
      // 检查文件是否存在
      if (!await fs.pathExists(filePath)) {
        console.error(`文件不存在: ${filePath}`);
        return crypto.createHash('md5').update(filePath).digest('hex');
      }
      
      // 读取文件内容
      const content = await fs.readFile(filePath);
      // 基于内容生成哈希
      return crypto.createHash('md5').update(content).digest('hex');
    } catch (error) {
      console.error(`生成文档ID时出错: ${error.message}`);
      // 如果读取文件失败，回退到使用文件路径生成ID
      return crypto.createHash('md5').update(filePath).digest('hex');
    }
  }
  
  /**
   * 根据文件类型提取文本
   * @param {string} filePath - 文件路径
   * @returns {Promise<string>} 提取的文本内容
   */
  async extractTextFromFile(filePath) {
    try {
      // 检查文件是否存在
      if (!await fs.pathExists(filePath)) {
        console.error(`文件不存在: ${filePath}`);
        return '';
      }
      
      const fileExt = path.extname(filePath).toLowerCase();
      console.log(`处理文件: ${filePath}, 扩展名: ${fileExt}`);
      
      switch (fileExt) {
        case '.pdf':
          return await this.extractTextFromPDF(filePath);
        case '.txt':
          return await this.extractTextFromTXT(filePath);
        case '.docx':
        case '.doc':
          return await this.extractTextFromDOCX(filePath);
        case '.csv':
          return await this.extractTextFromCSV(filePath);
        case '.md':
        case '.markdown':
          return await this.extractTextFromTXT(filePath); // Markdown可以作为纯文本处理
        case '.epub': // 现代化EPUB处理
          return await this.extractTextFromEPUB(filePath);
        case '.rtf': // 现代化RTF处理
          return await this.extractTextFromRTF(filePath);
        default:
          console.warn(`不支持的文件类型: ${fileExt}`);
          return '';
      }
    } catch (error) {
      console.error(`提取文本失败: ${error.message}`);
      // 返回空字符串而不是抛出错误，使处理更加健壮
      return '';
    }
  }
  
  /**
   * 从PDF提取文本
   * @param {string} filePath - PDF文件路径
   * @returns {Promise<string>} 提取的文本
   */
  async extractTextFromPDF(filePath) {
    try {
      console.log(`处理PDF文件: ${filePath}`);
      const dataBuffer = await fs.readFile(filePath);
      const result = await pdfParse(dataBuffer);
      return result.text || '';
    } catch (error) {
      console.error(`解析PDF文件失败: ${error.message}`);
      return '';
    }
  }
  
  /**
   * 从TXT提取文本
   * @param {string} filePath - TXT文件路径
   * @returns {Promise<string>} 文本内容
   */
  async extractTextFromTXT(filePath) {
    try {
      console.log(`处理TXT文件: ${filePath}`);
      return await fs.readFile(filePath, 'utf8');
    } catch (error) {
      console.error(`读取TXT文件失败: ${error.message}`);
      return '';
    }
  }
  
  /**
   * 从DOCX提取文本
   * @param {string} filePath - DOCX文件路径
   * @returns {Promise<string>} 提取的文本
   */
  async extractTextFromDOCX(filePath) {
    try {
      console.log(`处理DOCX文件: ${filePath}`);
      const result = await mammoth.extractRawText({
        path: filePath
      });
      return result.value || '';
    } catch (error) {
      console.error(`解析DOCX文件失败: ${error.message}`);
      return '';
    }
  }
  
  /**
   * 从CSV提取文本
   * @param {string} filePath - CSV文件路径
   * @returns {Promise<string>} 格式化的文本内容
   */
  async extractTextFromCSV(filePath) {
    try {
      console.log(`处理CSV文件: ${filePath}`);
      const results = [];
      
      // 使用流式处理和promises pipeline
      const readStream = fs.createReadStream(filePath);
      const parser = csv();
      
      await new Promise((resolve, reject) => {
        readStream.pipe(parser)
          .on('data', (data) => {
            if (data && typeof data === 'object') {
              results.push(Object.values(data).join(' '));
            }
          })
          .on('end', resolve)
          .on('error', reject);
      });
      
      return results.join('\n') || '';
    } catch (error) {
      console.error(`处理CSV文件失败: ${error.message}`);
      return '';
    }
  }
  
  /**
   * 从EPUB提取文本 (使用adm-zip替代旧的epub库)
   * @param {string} filePath - EPUB文件路径
   * @returns {Promise<string>} 提取的文本内容
   */
  async extractTextFromEPUB(filePath) {
    console.log(`处理EPUB文件: ${filePath}`);
    try {
      // 使用adm-zip解压EPUB文件(EPUB本质上是一个ZIP文件)
      const zip = new AdmZip(filePath);
      const zipEntries = zip.getEntries();
      
      if (!zipEntries || zipEntries.length === 0) {
        console.warn(`EPUB文件没有内容: ${filePath}`);
        return '';
      }
      
      // 查找内容文件 (通常在OEBPS文件夹中的.html或.xhtml文件)
      const contentFiles = zipEntries.filter(entry => 
        entry && !entry.isDirectory && 
        (entry.entryName.endsWith('.html') || entry.entryName.endsWith('.xhtml'))
      );
      
      if (contentFiles.length === 0) {
        console.warn(`EPUB文件中没有找到HTML内容: ${filePath}`);
        return '';
      }
      
      // 提取所有内容文件的文本
      let fullText = '';
      
      for (const entry of contentFiles) {
        try {
          const content = zip.readAsText(entry);
          if (content) {
            // 使用cheerio (服务器端jQuery)解析HTML并提取文本
            const $ = cheerio.load(content);
            // 移除脚本和样式标签
            $('script, style').remove();
            // 获取纯文本内容
            const text = $.text()
              .replace(/\s+/g, ' ')
              .trim();
              
            if (text) {
              fullText += text + '\n\n';
            }
          }
        } catch (entryError) {
          console.warn(`无法读取EPUB条目 ${entry.entryName}: ${entryError.message}`);
          // 继续处理其他条目
          continue;
        }
      }
      
      return fullText || '';
    } catch (error) {
      console.error(`解析EPUB文件失败: ${error.message}`);
      return '';
    }
  }
  
  /**
   * 从RTF提取文本 (使用node-unrtf替代rtf-to-text)
   * @param {string} filePath - RTF文件路径
   * @returns {Promise<string>} 提取的文本
   */
  async extractTextFromRTF(filePath) {
    try {
      console.log(`处理RTF文件: ${filePath}`);
      // 使用node-unrtf转换RTF为纯文本
      const { text } = await unrtf(filePath, { 
        outputFormat: 'text',
        preserveImages: false
      });
      
      return text || '';
    } catch (error) {
      console.error(`解析RTF文件出错: ${error.message}`);
      return '';
    }
  }
  
  /**
   * 检测文本主要语言
   * @param {string} text - 要检测的文本
   * @returns {string} 'chinese'或'english'
   */
  detectLanguage(text) {
    // 安全检查
    if (!text) return 'english';
    
    // 改进的语言检测：中文字符比例
    const chinesePattern = /[\u4e00-\u9fa5]/g;
    const chineseChars = text.match(chinesePattern) || [];
    const chineseRatio = chineseChars.length / text.length;
    
    // 如果中文字符占比超过15%，认为是中文文档
    return chineseRatio > 0.15 ? 'chinese' : 'english';
  }
  
  /**
   * 改进的文本分块方法，支持中英文
   * @param {string} text - 待分块的文本
   * @returns {string[]} 分块后的文本数组
   */
  splitTextIntoChunks(text) {
    console.log("分块文本...");
    
    // 添加空值检查
    if (!text) {
      console.error("文本为空，无法分块");
      return []; // 返回空数组而不是尝试处理
    }
    
    // 检测文本语言
    const language = this.detectLanguage(text);
    console.log(`检测到文本语言: ${language}`);
    
    let sections = [];
    
    // 根据语言选择分隔策略
    if (language === 'chinese') {
      // 中文分块逻辑：按章节和标题分割
      console.log("使用中文分块策略");
      sections = text.split(/第[一二三四五六七八九十百千万零]{1,5}[章节篇讲单元]|[一二三四五六七八九十]{1,3}[、\.\s]|\d+[、\.\s]|[第]?\d+[章节篇]/);
    } else {
      // 英文分块逻辑：按章节和部分分割
      console.log("使用英文分块策略");
      sections = text.split(/Chapter\s+\d+|Section\s+\d+(\.\d+)*|Part\s+\d+|Appendix\s+[A-Z]|\d+\.\s+|\d+\)\s+/i);
    }
    
    // 如果没有明显的章节，尝试按段落分割
    if (!sections || sections.length <= 1) {
      console.log("未找到明显章节，按段落分割");
      sections = [text];
    }
    
    const chunks = [];
    
    for (const section of sections) {
      // 添加null检查
      if (!section || typeof section !== 'string' || !section.trim()) continue;
      
      // 如果章节不太长，保留完整章节
      if (section.length <= this.chunkSize * 1.2) {
        chunks.push(section.trim());
        continue;
      }
      
      // 否则，将章节分成重叠的块
      const paragraphs = section.split(/\n\s*\n/);
      let currentChunk = "";
      
      for (const paragraph of paragraphs) {
        // 添加安全性检查
        if (!paragraph || typeof paragraph !== 'string') continue;
        
        const trimmedParagraph = paragraph.trim();
        if (!trimmedParagraph) continue;
        
        // 如果当前块加上这个段落不会超过块大小，就添加进去
        if (currentChunk.length + trimmedParagraph.length + 2 <= this.chunkSize) {
          currentChunk += (currentChunk ? "\n\n" : "") + trimmedParagraph;
        } else {
          // 否则，保存当前块并开始新块
          if (currentChunk) {
            chunks.push(currentChunk);
            
            // 保留一部分重叠内容
            const words = currentChunk.split(/\s+/);
            const overlapStart = Math.max(0, words.length - Math.min(this.chunkOverlap / 4, words.length / 2));
            currentChunk = words.slice(overlapStart).join(' ');
          }
          
          // 添加当前段落
          currentChunk += (currentChunk ? "\n\n" : "") + trimmedParagraph;
        }
      }
      
      // 添加最后一个块
      if (currentChunk) {
        chunks.push(currentChunk);
      }
    }
    
    // 过滤掉太短的块
    const filteredChunks = chunks.filter(chunk => 
      chunk && typeof chunk === 'string' && chunk.trim().length >= 100
    );
    
    console.log(`创建了${filteredChunks.length}个文本块`);
    return filteredChunks;
  }
  
  /**
   * 处理文件并返回分块结果
   * @param {string} filePath - 文件路径
   * @returns {Promise<Array>} 处理后的文本块数组
   */
  async processFile(filePath) {
    try {
      if (!filePath || !await fs.pathExists(filePath)) {
        console.error(`文件不存在或无效: ${filePath}`);
        return [];
      }
      
      const docId = await this.generateDocumentId(filePath);
      const cacheFile = path.join(this.cacheDir, `${docId}.json`);
      
      // 检查缓存
      if (await fs.pathExists(cacheFile)) {
        try {
          console.log(`使用缓存的文本块: ${cacheFile}`);
          return JSON.parse(await fs.readFile(cacheFile, 'utf8')) || [];
        } catch (cacheError) {
          console.error(`读取缓存文件失败: ${cacheError.message}`);
          // 缓存读取失败，继续处理文件
        }
      }
      
      // 提取并处理文本
      const text = await this.extractTextFromFile(filePath);
      
      // 检查文本是否为空
      if (!text) {
        console.warn(`未能从文件中提取文本: ${filePath}`);
        return [];
      }
      
      const chunks = this.splitTextIntoChunks(text);
      
      // 检查分块是否成功
      if (!chunks || chunks.length === 0) {
        console.warn(`未能将文本分块: ${filePath}`);
        return [];
      }
      
      // 为每个块创建元数据
      const processedChunks = chunks.map((content, index) => ({
        id: `${docId}-${index}`,
        content,
        metadata: {
          source: path.basename(filePath),
          chunk: index + 1,
          totalChunks: chunks.length,
          created: new Date().toISOString()
        }
      }));
      
      // 缓存处理结果
      try {
        await fs.writeFile(cacheFile, JSON.stringify(processedChunks, null, 2));
      } catch (writeError) {
        console.error(`写入缓存文件失败: ${writeError.message}`);
        // 继续返回结果，即使缓存失败
      }
      
      return processedChunks;
    } catch (error) {
      console.error(`处理文件失败: ${filePath}`, error);
      // 返回空数组而不是抛出错误
      return [];
    }
  }
  
  /**
   * 批量处理多个文件
   * @param {string[]} filePaths - 文件路径数组
   * @returns {Promise<Array>} 所有处理后的文本块
   */
  async processMultipleFiles(filePaths) {
    if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
      console.warn('没有提供文件路径进行处理');
      return [];
    }
    
    const allChunks = [];
    const errors = [];
    
    for (const filePath of filePaths) {
      try {
        if (!filePath) {
          console.warn('跳过空文件路径');
          continue;
        }
        
        const chunks = await this.processFile(filePath);
        if (chunks && Array.isArray(chunks) && chunks.length > 0) {
          allChunks.push(...chunks);
        }
      } catch (error) {
        console.error(`处理文件失败: ${filePath}`, error);
        errors.push({ file: filePath, error: error.message });
        // 继续处理其他文件
      }
    }
    
    // 如果有错误，在返回结果中包含错误信息
    if (errors.length > 0) {
      console.warn(`处理过程中有${errors.length}个文件出错`);
    }
    
    return allChunks;
  }

  /**
   * 清理未使用的缓存
   * @returns {Promise<boolean>} 是否成功清理缓存
   */
  async cleanupUnusedCache() {
    try {
      // 获取所有文档文件路径
      const knowledgeBasePath = path.join(__dirname, '../data/knowledge_base');
      
      if (!await fs.pathExists(knowledgeBasePath)) {
        console.warn(`知识库路径不存在: ${knowledgeBasePath}`);
        return false;
      }
      
      const allDocuments = await this.getAllDocumentPaths(knowledgeBasePath);
      
      if (!allDocuments || allDocuments.length === 0) {
        console.warn('未找到任何文档文件进行缓存清理');
        return false;
      }
      
      // 生成所有文档的ID
      const validDocumentIds = await Promise.all(
        allDocuments.map(docPath => this.generateDocumentId(docPath))
      );
      
      // 获取所有缓存文件
      if (!await fs.pathExists(this.cacheDir)) {
        console.warn(`缓存目录不存在: ${this.cacheDir}`);
        return false;
      }
      
      const cacheFiles = await fs.readdir(this.cacheDir);
      const jsonCacheFiles = cacheFiles
        .filter(file => file && typeof file === 'string' && file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
      
      // 删除无效缓存
      for (const cacheId of jsonCacheFiles) {
        if (!validDocumentIds.includes(cacheId)) {
          const cacheFilePath = path.join(this.cacheDir, `${cacheId}.json`);
          await fs.remove(cacheFilePath);
          console.log(`删除未使用的缓存: ${cacheFilePath}`);
        }
      }
      
      return true;
    } catch (error) {
      console.error(`清理缓存时出错: ${error.message}`);
      return false;
    }
  }

  /**
   * 获取所有文档路径的辅助方法
   * @param {string} dir - 目录路径
   * @returns {Promise<string[]>} 文档文件路径数组
   */
  async getAllDocumentPaths(dir) {
    try {
      if (!await fs.pathExists(dir)) {
        console.warn(`目录不存在: ${dir}`);
        return [];
      }
      
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      if (!entries || entries.length === 0) {
        return [];
      }
      
      const files = await Promise.all(entries.map(async entry => {
        if (!entry) return [];
        
        const fullPath = path.join(dir, entry.name);
        
        try {
          if (entry.isDirectory()) {
            return await this.getAllDocumentPaths(fullPath);
          }
          return fullPath;
        } catch (error) {
          console.error(`读取路径失败: ${fullPath}`, error);
          return [];
        }
      }));
      
      return files.flat()
        .filter(file => {
          if (!file) return false;
          
          try {
            const ext = path.extname(file).toLowerCase();
            // 支持的文件类型
            return ['.pdf', '.txt', '.md', '.docx', '.epub', '.rtf', '.csv'].includes(ext);
          } catch (error) {
            console.error(`过滤文件扩展名失败: ${file}`, error);
            return false;
          }
        });
    } catch (error) {
      console.error(`获取文档路径时出错: ${error.message}`);
      return [];
    }
  }
}

module.exports = DocumentProcessor;