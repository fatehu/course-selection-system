/**
 * 混合索引性能测试脚本
 * 运行方式: node server/scripts/performanceTest.js
 */
const path = require('path');
const HybridVectorStore = require('../services/advisor/hybridVectorStore');

class PerformanceTest {
  constructor() {
    this.testResults = [];
  }

  /**
   * 生成随机向量
   */
  generateRandomVector(dimension = 1024) {
    return new Array(dimension).fill(0).map(() => Math.random() * 2 - 1);
  }

  /**
   * 生成测试文档
   */
  generateTestDocuments(count, dimension = 1024) {
    const documents = [];
    const embeddings = [];
    
    for (let i = 0; i < count; i++) {
      documents.push({
        id: `test_doc_${i}`,
        content: `这是测试文档 ${i} 的内容，用于性能测试。`,
        metadata: {
          fileId: Math.floor(i / 100), // 每100个文档一个文件
          chunk: i % 100,
          source: `test_file_${Math.floor(i / 100)}.txt`
        }
      });
      
      embeddings.push(this.generateRandomVector(dimension));
    }
    
    return { documents, embeddings };
  }

  /**
   * 测试搜索性能
   */
  async testSearchPerformance(store, queryCount = 100, k = 5) {
    console.log(`🔍 测试搜索性能 (${queryCount} 次查询, top-${k})...`);
    
    const searchTimes = [];
    const queryEmbeddings = [];
    
    // 生成查询向量
    for (let i = 0; i < queryCount; i++) {
      queryEmbeddings.push(this.generateRandomVector());
    }
    
    // 预热
    for (let i = 0; i < 5; i++) {
      store.similaritySearch(queryEmbeddings[0], k);
    }
    
    // 正式测试
    const startTime = Date.now();
    
    for (let i = 0; i < queryCount; i++) {
      const queryStart = Date.now();
      const results = store.similaritySearch(queryEmbeddings[i], k);
      const queryTime = Date.now() - queryStart;
      
      searchTimes.push(queryTime);
      
      if (results.length === 0) {
        console.warn(`查询 ${i} 未返回结果`);
      }
    }
    
    const totalTime = Date.now() - startTime;
    
    // 计算统计数据
    const avgTime = searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length;
    const minTime = Math.min(...searchTimes);
    const maxTime = Math.max(...searchTimes);
    const p95Time = searchTimes.sort((a, b) => a - b)[Math.floor(searchTimes.length * 0.95)];
    
    return {
      totalTime,
      avgTime,
      minTime,
      maxTime,
      p95Time,
      qps: queryCount / (totalTime / 1000)
    };
  }

  /**
   * 测试批量添加性能
   */
  async testBatchAddPerformance(store, batchSize = 1000) {
    console.log(`📝 测试批量添加性能 (${batchSize} 文档)...`);
    
    const { documents, embeddings } = this.generateTestDocuments(batchSize);
    
    const startTime = Date.now();
    store.addDocuments(documents, embeddings);
    const addTime = Date.now() - startTime;
    
    return {
      batchSize,
      addTime,
      avgTimePerDoc: addTime / batchSize
    };
  }

  /**
   * 测试内存使用
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024) // MB
    };
  }

  /**
   * 比较不同配置的性能
   */
  async compareConfigurations() {
    console.log('🏁 开始配置性能比较测试...\n');
    
    const configs = [
      { name: '仅LSH', enableLSH: true, enableClustering: false },
      { name: '仅聚类', enableLSH: false, enableClustering: true },
      { name: '混合索引', enableLSH: true, enableClustering: true },
      { name: '无索引', enableLSH: false, enableClustering: false }
    ];
    
    const testSizes = [1000, 5000, 10000];
    const results = [];
    
    for (const size of testSizes) {
      console.log(`📊 测试规模: ${size} 文档`);
      
      for (const config of configs) {
        console.log(`  🔧 配置: ${config.name}`);
        
        // 创建临时存储
        const tempStore = new HybridVectorStore({
          storePath: `/tmp/test_${Date.now()}.json`
        });
        
        tempStore.enableLSH = config.enableLSH;
        tempStore.enableClustering = config.enableClustering;
        
        const memoryBefore = this.getMemoryUsage();
        
        // 添加测试数据
        const addResult = await this.testBatchAddPerformance(tempStore, size);
        
        const memoryAfter = this.getMemoryUsage();
        
        // 测试搜索性能
        const searchResult = await this.testSearchPerformance(tempStore, 50, 5);
        
        // 获取统计信息
        const stats = tempStore.getStats();
        
        results.push({
          size,
          config: config.name,
          addTime: addResult.addTime,
          avgSearchTime: searchResult.avgTime,
          p95SearchTime: searchResult.p95Time,
          qps: searchResult.qps,
          memoryUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
          lshStats: stats.lshStats,
          clusterStats: stats.clusterStats
        });
        
        console.log(`    ✅ 添加时间: ${addResult.addTime}ms`);
        console.log(`    ✅ 平均搜索时间: ${searchResult.avgTime.toFixed(2)}ms`);
        console.log(`    ✅ QPS: ${searchResult.qps.toFixed(2)}`);
        console.log(`    ✅ 内存增长: ${memoryAfter.heapUsed - memoryBefore.heapUsed}MB\n`);
      }
    }
    
    return results;
  }

  /**
   * 生成性能报告
   */
  generateReport(results) {
    console.log('\n📊 性能测试报告');
    console.log('==========================================');
    
    // 按文档数量分组
    const groupedResults = {};
    results.forEach(result => {
      if (!groupedResults[result.size]) {
        groupedResults[result.size] = [];
      }
      groupedResults[result.size].push(result);
    });
    
    // 生成表格
    for (const [size, sizeResults] of Object.entries(groupedResults)) {
      console.log(`\n📈 文档数量: ${size}`);
      console.log('配置名称'.padEnd(12) + 
                 '添加时间(ms)'.padEnd(12) + 
                 '搜索时间(ms)'.padEnd(12) + 
                 'QPS'.padEnd(8) + 
                 '内存(MB)'.padEnd(10));
      console.log('-'.repeat(60));
      
      sizeResults.forEach(result => {
        console.log(
          result.config.padEnd(12) +
          result.addTime.toString().padEnd(12) +
          result.avgSearchTime.toFixed(2).padEnd(12) +
          result.qps.toFixed(1).padEnd(8) +
          result.memoryUsed.toString().padEnd(10)
        );
      });
    }
    
    // 性能提升分析
    console.log('\n🚀 性能提升分析');
    console.log('==========================================');
    
    for (const [size, sizeResults] of Object.entries(groupedResults)) {
      const baseline = sizeResults.find(r => r.config === '无索引');
      const hybrid = sizeResults.find(r => r.config === '混合索引');
      
      if (baseline && hybrid) {
        const searchSpeedup = baseline.avgSearchTime / hybrid.avgSearchTime;
        const qpsImprovement = hybrid.qps / baseline.qps;
        
        console.log(`📊 ${size} 文档规模:`);
        console.log(`  🔥 搜索速度提升: ${searchSpeedup.toFixed(2)}x`);
        console.log(`  📈 QPS提升: ${qpsImprovement.toFixed(2)}x`);
        console.log(`  ⚡ 搜索时间: ${baseline.avgSearchTime.toFixed(2)}ms → ${hybrid.avgSearchTime.toFixed(2)}ms`);
      }
    }
    
    // 推荐配置
    console.log('\n💡 配置推荐');
    console.log('==========================================');
    
    for (const [size, sizeResults] of Object.entries(groupedResults)) {
      const best = sizeResults.reduce((best, current) => 
        current.qps > best.qps ? current : best
      );
      
      console.log(`📊 ${size} 文档: 推荐使用 "${best.config}" (QPS: ${best.qps.toFixed(2)})`);
    }
  }

  /**
   * 执行完整性能测试
   */
  async runFullTest() {
    console.log('🎯 开始混合索引性能测试\n');
    
    try {
      // 比较不同配置
      const results = await this.compareConfigurations();
      
      // 生成报告
      this.generateReport(results);
      
      console.log('\n✅ 性能测试完成！');
      
    } catch (error) {
      console.error('❌ 性能测试失败:', error);
    }
  }

  /**
   * 快速性能测试
   */
  async runQuickTest() {
    console.log('⚡ 开始快速性能测试\n');
    
    const store = new HybridVectorStore({
      storePath: `/tmp/quick_test_${Date.now()}.json`
    });
    
    // 添加测试数据
    const { documents, embeddings } = this.generateTestDocuments(1000);
    const addStart = Date.now();
    store.addDocuments(documents, embeddings);
    const addTime = Date.now() - addStart;
    
    // 测试搜索
    const searchResult = await this.testSearchPerformance(store, 20, 5);
    
    // 输出结果
    console.log('📊 快速测试结果:');
    console.log(`  📝 添加1000文档: ${addTime}ms`);
    console.log(`  🔍 平均搜索时间: ${searchResult.avgTime.toFixed(2)}ms`);
    console.log(`  📈 QPS: ${searchResult.qps.toFixed(2)}`);
    
    const stats = store.getStats();
    console.log(`  📊 LSH索引: ${stats.lshStats ? '✅ 启用' : '❌ 未启用'}`);
    console.log(`  📊 聚类索引: ${stats.clusterStats ? '✅ 启用' : '❌ 未启用'}`);
    
    console.log('\n✅ 快速测试完成！');
  }
}

// 命令行执行
if (require.main === module) {
  const test = new PerformanceTest();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'full':
      test.runFullTest().catch(console.error);
      break;
    case 'quick':
      test.runQuickTest().catch(console.error);
      break;
    default:
      console.log('使用方法:');
      console.log('  node performanceTest.js full   # 完整性能测试');
      console.log('  node performanceTest.js quick  # 快速性能测试');
  }
}

module.exports = PerformanceTest;