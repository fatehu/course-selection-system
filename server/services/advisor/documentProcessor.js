const fs = require('fs-extra');
const path = require('path');
const pdfParse = require('pdf-parse');
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
  
  // 从PDF提取文本
  async extractTextFromPDF(filePath) {
    console.log(`处理PDF文件: ${filePath}`);
    const dataBuffer = fs.readFileSync(filePath);
    const result = await pdfParse(dataBuffer);
    return result.text;
  }
  
  // 优化的中文分块策略
  splitTextIntoChunks(text) {
    console.log("分块文本...");
    
    // 首先尝试按章节分割
    let sections = text.split(/第[一二三四五六七八九十]+[章节]|[一二三四五六七八九十]+[、\.\s]/);
    
    // 如果没有明显的章节，尝试按段落分割
    if (sections.length <= 1) {
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
  
  // 处理PDF文件并返回分块结果
  async processPDF(filePath) {
    const docId = this.generateDocumentId(filePath);
    const cacheFile = path.join(this.cacheDir, `${docId}.json`);
    
    // 检查缓存
    if (fs.existsSync(cacheFile)) {
      console.log(`使用缓存的文本块: ${cacheFile}`);
      return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    }
    
    // 提取并处理文本
    const text = await this.extractTextFromPDF(filePath);
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
  }
  
  // 批量处理多个PDF文件
  async processMultiplePDFs(filePaths) {
    const allChunks = [];
    
    for (const filePath of filePaths) {
      const chunks = await this.processPDF(filePath);
      allChunks.push(...chunks);
    }
    
    return allChunks;
  }
}

module.exports = DocumentProcessor;