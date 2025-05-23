const axios = require('axios');
require('dotenv').config();

class WebSearchService {
  constructor() {
    // 支持的搜索引擎配置 - 使用免费API
    this.searchEngines = {
      yandex: {
        name: 'Yandex',
        enabled: process.env.SERPAPI_KEY ? true : false,
        apiKey: process.env.SERPAPI_KEY,
        endpoint: 'https://serpapi.com/search',
        parseResults: this.parseYandexResults,
        description: 'Yandex搜索引擎，免费层每月100次搜索'
      },
      serper: {
        name: 'Google',
        enabled: process.env.SERPER_API_KEY ? true : false,
        apiKey: process.env.SERPER_API_KEY,
        endpoint: 'https://google.serper.dev/search',
        parseResults: this.parseSerperResults,
        description: '免费层2500次搜索'
      }
    };
    
    // 默认激活的搜索引擎 - 自动选择第一个可用的
    this.activeEngines = [];
    const availableEngines = this.getAvailableEngines();
    if (availableEngines.length > 0) {
      this.activeEngines = [availableEngines[0].id];
    }
  }
  
  // 获取可用搜索引擎列表
  getAvailableEngines() {
    return Object.entries(this.searchEngines)
      .filter(([_, config]) => config.enabled)
      .map(([id, config]) => ({
        id,
        name: config.name,
        description: config.description
      }));
  }
  
  // 设置激活的搜索引擎
  setActiveEngines(engineIds) {
    // 过滤出可用的搜索引擎
    this.activeEngines = engineIds.filter(id => 
      this.searchEngines[id] && this.searchEngines[id].enabled
    );
    
    // 确保至少有一个搜索引擎
    if (this.activeEngines.length === 0) {
      const availableEngines = this.getAvailableEngines();
      if (availableEngines.length > 0) {
        this.activeEngines = [availableEngines[0].id];
      }
    }
    
    return this.activeEngines;
  }
  
  // 综合搜索 - 调用多个搜索引擎并合并结果
  async search(query, limit = 10) {
    if (!query || query.trim() === '') {
      return { success: false, error: '搜索查询不能为空' };
    }
    
    // 确保有激活的搜索引擎
    if (this.activeEngines.length === 0) {
      const availableEngines = this.getAvailableEngines();
      if (availableEngines.length > 0) {
        this.activeEngines = [availableEngines[0].id];
      } else {
        return { success: false, error: '没有可用的搜索引擎' };
      }
    }
    
    try {
      // 从每个激活的搜索引擎获取结果
      const searchPromises = this.activeEngines.map(engineId => 
        this.searchWithEngine(engineId, query, Math.ceil(limit / this.activeEngines.length))
      );
      
      // 等待所有搜索完成
      const results = await Promise.allSettled(searchPromises);
      
      // 合并成功的搜索结果
      const allResults = [];
      const enginesUsed = [];
      
      results.forEach((result, index) => {
        const engineId = this.activeEngines[index];
        
        if (result.status === 'fulfilled' && result.value.success) {
          enginesUsed.push(this.searchEngines[engineId].name);
          allResults.push(...result.value.results);
        } else {
          console.error(`${engineId} 搜索失败:`, result.reason || result.value.error);
        }
      });
      
      // 对结果进行去重和排序
      const uniqueResults = this.deduplicateResults(allResults);
      const limitedResults = uniqueResults.slice(0, limit);
      
      return {
        success: limitedResults.length > 0,
        enginesUsed,
        results: limitedResults,
        totalResults: uniqueResults.length
      };
    } catch (error) {
      console.error('综合搜索失败:', error);
      return { success: false, error: '搜索请求失败' };
    }
  }
  
  // 使用特定搜索引擎搜索
  async searchWithEngine(engineId, query, limit = 10) {
    const engine = this.searchEngines[engineId];
    
    if (!engine || !engine.enabled) {
      return { success: false, error: `搜索引擎 ${engineId} 不可用` };
    }
    
    try {
      console.log(`使用 ${engine.name} 搜索: "${query}"`);
      
      let response;
      
      // 根据不同搜索引擎构建请求
      switch (engineId) {
        case 'yandex':
          response = await axios.get(engine.endpoint, {
            params: {
              engine: 'yandex',        // 指定使用Yandex引擎
              text: query,             // Yandex使用text参数而不是q
              api_key: engine.apiKey,
              num: limit,
              lr: '134',               // 地区代码：134为中国，可以改为其他地区
              lang: 'zh'               // 搜索语言：中文
            }
          });
          break;
          
        case 'serper':
          response = await axios.post(engine.endpoint, {
            q: query,
            location: 'China', 
            num: limit,         
            hl: 'zh-cn',
            tbs: 'qdr:d' 
          }, {
            headers: {
              'X-API-KEY': engine.apiKey,
              'Content-Type': 'application/json'
            }
          });
          break;
          
        default:
          return { success: false, error: `未知搜索引擎: ${engineId}` };
      }
      
      // 解析结果
      const results = engine.parseResults(response.data, limit);
      
      return {
        success: true,
        engineName: engine.name,
        results: results
      };
    } catch (error) {
      console.error(`${engineId} 搜索失败:`, error.message);
      return { success: false, error: `${engine.name} 搜索失败: ${error.message}` };
    }
  }
  
  // 解析Yandex搜索结果
  parseYandexResults(data, limit) {
    // Yandex的结果结构与Google略有不同
    if (!data.organic_results || !Array.isArray(data.organic_results)) {
      return [];
    }
    
    return data.organic_results.slice(0, limit).map(item => ({
      title: item.title,
      snippet: item.snippet || item.text || '', // Yandex可能使用text字段
      url: item.link,
      source: 'Yandex'
    }));
  }
  
  // 解析Serper搜索结果（保持不变）
  parseSerperResults(data, limit) {
    if (!data.organic || !Array.isArray(data.organic)) {
      return [];
    }
    
    return data.organic.slice(0, limit).map(item => ({
      title: item.title,
      snippet: item.snippet,
      url: item.link,
      source: 'Serper'
    }));
  }
  
  // 结果去重
  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(item => {
      // 使用URL作为唯一标识
      const key = item.url.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
  
  // 直接调用免费的Web搜索API (无需API密钥的后备方案)
  async fallbackSearch(query, limit = 10) {
    try {
      console.log(`使用后备搜索方案: "${query}"`);
      
      // 使用免费的API代理
      const response = await axios.get('https://ddg-api.herokuapp.com/search', {
        params: {
          query: query,
          limit: limit
        }
      });
      
      if (response.data && Array.isArray(response.data)) {
        return {
          success: true,
          enginesUsed: ['DuckDuckGo'],
          results: response.data.map(item => ({
            title: item.title,
            snippet: item.snippet,
            url: item.link,
            source: 'DuckDuckGo'
          })),
          totalResults: response.data.length
        };
      } else {
        return { success: false, error: '无搜索结果' };
      }
    } catch (error) {
      console.error('后备搜索失败:', error);
      return { success: false, error: '后备搜索请求失败' };
    }
  }
}

module.exports = new WebSearchService();