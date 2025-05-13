const fs = require('fs-extra');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const csv = require('csv-parser');
const crypto = require('crypto');

class DocumentProcessor {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 1000;
    this.chunkOverlap = options.chunkOverlap || 200;
    this.cacheDir = options.cacheDir || path.join(process.cwd(), 'data/chunks');
    
    // 确保缓存目录存在
    fs.ensureDirSync(this.cacheDir);
  }
  
  // 生成文档哈希ID
  generateDocumentId(filePath) {
    const fileName = path.basename(filePath);
    const stats = fs.statSync(filePath);
    const hashInput = `${fileName}-${stats.size}-${stats.mtime.toISOString()}`;
    return crypto.createHash('md5').update(hashInput).digest('hex');
  }
  
  // 根据文件类型提取文本
  async extractTextFromFile(filePath) {
    const fileExt = path.extname(filePath).toLowerCase();
    console.log(`处理文件: ${filePath}, 扩展名: ${fileExt}`);
    
    try {
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
        default:
          throw new Error(`不支持的文件类型: ${fileExt}`);
      }
    } catch (error) {
      console.error(`提取文本失败: ${error.message}`);
      throw error;
    }
  }
  
  // 从PDF提取文本
  async extractTextFromPDF(filePath) {
    console.log(`处理PDF文件: ${filePath}`);
    const dataBuffer = fs.readFileSync(filePath);
    const result = await pdfParse(dataBuffer);
    return result.text;
  }
  
  // 从TXT提取文本
  async extractTextFromTXT(filePath) {
    console.log(`处理TXT文件: ${filePath}`);
    const text = fs.readFileSync(filePath, 'utf8');
    return text;
  }
  
  // 从DOCX提取文本
  async extractTextFromDOCX(filePath) {
    console.log(`处理DOCX文件: ${filePath}`);
    const result = await mammoth.extractRawText({
      path: filePath
    });
    return result.value;
  }
  
  // 从CSV提取文本
  async extractTextFromCSV(filePath) {
    console.log(`处理CSV文件: ${filePath}`);
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(Object.values(data).join(' ')))
        .on('end', () => {
          resolve(results.join('\n'));
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }
  
  // 检测文本主要语言
  detectLanguage(text) {
    // 简单语言检测：中文字符比例
    const chinesePattern = /[\u4e00-\u9fa5]/g;
    const chineseChars = text.match(chinesePattern) || [];
    const chineseRatio = chineseChars.length / text.length;
    
    // 如果中文字符占比超过15%，认为是中文文档
    return chineseRatio > 0.15 ? 'chinese' : 'english';
  }
  
  // 改进的文本分块方法，支持中英文
  splitTextIntoChunks(text) {
    console.log("分块文本...");
    
    // 检测文本语言
    const language = this.detectLanguage(text);
    console.log(`检测到文本语言: ${language}`);
    
    let sections = [];
    
    // 根据语言选择分隔策略
    if (language === 'chinese') {
      // 中文分块逻辑：按章节分割
      console.log("使用中文分块策略");
      sections = text.split(/第[一二三四五六七八九十百千万零]{1,5}[章节篇讲单元]|[一二三四五六七八九十]{1,3}[、\.\s]/);
    } else {
      // 英文分块逻辑：按章节和部分分割
      console.log("使用英文分块策略");
      sections = text.split(/Chapter\s+\d+|Section\s+\d+(\.\d+)*|Part\s+\d+|Appendix\s+[A-Z]/i);
    }
    
    // 如果没有明显的章节，尝试按段落分割
    if (sections.length <= 1) {
      console.log("未找到明显章节，按段落分割");
      sections = [text];
    }
    
    const chunks = [];
    
    for (const section of sections) {
      if (!section.trim()) continue;
      
      // 如果章节不太长，保留完整章节
      if (section.length <= this.chunkSize * 1.2) {
        chunks.push(section.trim());
        continue;
      }
      
      // 否则，将章节分成重叠的块
      const paragraphs = section.split(/\n\s*\n/);
      let currentChunk = "";
      
      for (const paragraph of paragraphs) {
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
            const words = currentChunk.split('');
            const overlapStart = Math.max(0, words.length - this.chunkOverlap);
            currentChunk = words.slice(overlapStart).join('');
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
    
    console.log(`创建了${chunks.length}个文本块`);
    return chunks.filter(chunk => chunk.length >= 100); // 过滤太短的块
  }
  
  // 处理文件并返回分块结果
  async processFile(filePath) {
    const docId = this.generateDocumentId(filePath);
    const cacheFile = path.join(this.cacheDir, `${docId}.json`);
    
    // 检查缓存
    if (fs.existsSync(cacheFile)) {
      console.log(`使用缓存的文本块: ${cacheFile}`);
      return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    }
    
    // 提取并处理文本
    try {
      const text = await this.extractTextFromFile(filePath);
      const chunks = this.splitTextIntoChunks(text);
      
      // 为每个块创建元数据
      const processedChunks = chunks.map((content, index) => ({
        id: `${docId}-${index}`,
        content,
        metadata: {
          source: path.basename(filePath),
          chunk: index + 1,
          totalChunks: chunks.length
        }
      }));
      
      // 缓存处理结果
      fs.writeFileSync(cacheFile, JSON.stringify(processedChunks));
      
      return processedChunks;
    } catch (error) {
      console.error(`处理文件失败: ${filePath}`, error);
      throw error;
    }
  }
  
  // 批量处理多个文件
  async processMultipleFiles(filePaths) {
    const allChunks = [];
    
    for (const filePath of filePaths) {
      try {
        const chunks = await this.processFile(filePath);
        allChunks.push(...chunks);
      } catch (error) {
        console.error(`处理文件失败: ${filePath}`, error);
        // 继续处理其他文件
      }
    }
    
    return allChunks;
  }
}

module.exports = DocumentProcessor;