/**
 * 数据迁移脚本：从旧版本向量存储迁移到混合索引
 * 运行方式: node server/scripts/migrateToHybridIndex.js
 */
const fs = require('fs-extra');
const path = require('path');
const HybridVectorStore = require('../services/advisor/hybridVectorStore');

class HybridIndexMigration {
  constructor() {
    this.dataDir = path.join(process.cwd(), 'server/data');
    this.vectorStoresDir = path.join(this.dataDir, 'vector_stores');
    this.backupDir = path.join(this.dataDir, 'backup_' + Date.now());
  }

  /**
   * 执行完整迁移流程
   */
  async migrate() {
    console.log('🚀 开始混合索引迁移...');
    
    try {
      // 1. 创建备份
      await this.createBackup();
      
      // 2. 迁移主向量存储
      await this.migrateMainVectorStore();
      
      // 3. 迁移知识库向量存储
      await this.migrateKnowledgeBaseStores();
      
      // 4. 验证迁移结果
      await this.validateMigration();
      
      console.log('✅ 混合索引迁移完成！');
      console.log(`📁 备份文件保存在: ${this.backupDir}`);
      
    } catch (error) {
      console.error('❌ 迁移失败:', error);
      await this.rollback();
      throw error;
    }
  }

  /**
   * 创建数据备份
   */
  async createBackup() {
    console.log('📦 创建数据备份...');
    
    await fs.ensureDir(this.backupDir);
    
    // 备份主向量存储
    const mainStorePath = path.join(this.dataDir, 'vector-store.json');
    if (await fs.pathExists(mainStorePath)) {
      await fs.copy(mainStorePath, path.join(this.backupDir, 'vector-store.json'));
      console.log('✓ 主向量存储已备份');
    }
    
    // 备份知识库向量存储
    if (await fs.pathExists(this.vectorStoresDir)) {
      await fs.copy(this.vectorStoresDir, path.join(this.backupDir, 'vector_stores'));
      console.log('✓ 知识库向量存储已备份');
    }
    
    console.log('📦 备份完成');
  }

  /**
   * 迁移主向量存储
   */
  async migrateMainVectorStore() {
    console.log('🔄 迁移主向量存储...');
    
    const storePath = path.join(this.dataDir, 'vector-store.json');
    
    if (await fs.pathExists(storePath)) {
      const hybridStore = new HybridVectorStore({ storePath });
      
      if (hybridStore.load()) {
        console.log('✓ 成功加载旧版本数据');
        
        // 重建混合索引
        hybridStore.rebuildIndices();
        console.log('✓ 混合索引重建完成');
        
        // 保存新版本
        hybridStore.save();
        console.log('✓ 主向量存储迁移完成');
        
        // 打印统计信息
        const stats = hybridStore.getStats();
        console.log(`  📊 总文档数: ${stats.totalDocuments}`);
        console.log(`  📊 活跃文档数: ${stats.activeDocuments}`);
        console.log(`  📊 已删除文档数: ${stats.deletedDocuments}`);
        console.log(`  📊 文件数: ${stats.filesCount}`);
      } else {
        console.log('⚠️  主向量存储文件不存在或加载失败');
      }
    } else {
      console.log('⚠️  未找到主向量存储文件');
    }
  }

  /**
   * 迁移知识库向量存储
   */
  async migrateKnowledgeBaseStores() {
    console.log('🔄 迁移知识库向量存储...');
    
    if (!await fs.pathExists(this.vectorStoresDir)) {
      console.log('⚠️  知识库向量存储目录不存在');
      return;
    }
    
    const storeFiles = await fs.readdir(this.vectorStoresDir);
    const kbStoreFiles = storeFiles.filter(file => file.startsWith('kb_') && file.endsWith('.json'));
    
    console.log(`📁 找到 ${kbStoreFiles.length} 个知识库向量存储文件`);
    
    for (const fileName of kbStoreFiles) {
      const storePath = path.join(this.vectorStoresDir, fileName);
      console.log(`  🔄 迁移 ${fileName}...`);
      
      try {
        const hybridStore = new HybridVectorStore({ storePath });
        
        if (hybridStore.load()) {
          console.log(`    ✓ 成功加载 ${fileName}`);
          
          // 重建混合索引
          hybridStore.rebuildIndices();
          console.log(`    ✓ ${fileName} 混合索引重建完成`);
          
          // 保存新版本
          hybridStore.save();
          console.log(`    ✓ ${fileName} 迁移完成`);
          
          // 打印统计信息
          const stats = hybridStore.getStats();
          console.log(`    📊 文档数: ${stats.activeDocuments}/${stats.totalDocuments}`);
        } else {
          console.log(`    ⚠️  ${fileName} 加载失败`);
        }
      } catch (error) {
        console.error(`    ❌ ${fileName} 迁移失败:`, error);
      }
    }
    
    console.log('✓ 知识库向量存储迁移完成');
  }

  /**
   * 验证迁移结果
   */
  async validateMigration() {
    console.log('🔍 验证迁移结果...');
    
    // 验证主向量存储
    const mainStorePath = path.join(this.dataDir, 'vector-store.json');
    if (await fs.pathExists(mainStorePath)) {
      const hybridStore = new HybridVectorStore({ storePath: mainStorePath });
      if (hybridStore.load()) {
        const stats = hybridStore.getStats();
        console.log(`✓ 主向量存储验证通过 (版本: ${stats.version})`);
        
        // 测试搜索功能
        if (stats.activeDocuments > 0) {
          const testEmbedding = new Array(1024).fill(0).map(() => Math.random());
          const results = hybridStore.similaritySearch(testEmbedding, 1);
          console.log(`✓ 搜索功能正常 (返回 ${results.length} 个结果)`);
        }
      } else {
        throw new Error('主向量存储验证失败');
      }
    }
    
    // 验证知识库向量存储
    if (await fs.pathExists(this.vectorStoresDir)) {
      const storeFiles = await fs.readdir(this.vectorStoresDir);
      const kbStoreFiles = storeFiles.filter(file => file.startsWith('kb_') && file.endsWith('.json'));
      
      let validCount = 0;
      for (const fileName of kbStoreFiles) {
        const storePath = path.join(this.vectorStoresDir, fileName);
        const hybridStore = new HybridVectorStore({ storePath });
        
        if (hybridStore.load()) {
          const stats = hybridStore.getStats();
          if (stats.version === '2.0.0') {
            validCount++;
          }
        }
      }
      
      console.log(`✓ 知识库向量存储验证通过 (${validCount}/${kbStoreFiles.length})`);
    }
    
    console.log('✅ 迁移验证完成');
  }

  /**
   * 回滚操作
   */
  async rollback() {
    console.log('🔄 执行回滚操作...');
    
    try {
      // 恢复主向量存储
      const backupMainStore = path.join(this.backupDir, 'vector-store.json');
      const mainStorePath = path.join(this.dataDir, 'vector-store.json');
      
      if (await fs.pathExists(backupMainStore)) {
        await fs.copy(backupMainStore, mainStorePath);
        console.log('✓ 主向量存储已回滚');
      }
      
      // 恢复知识库向量存储
      const backupVectorStores = path.join(this.backupDir, 'vector_stores');
      if (await fs.pathExists(backupVectorStores)) {
        await fs.remove(this.vectorStoresDir);
        await fs.copy(backupVectorStores, this.vectorStoresDir);
        console.log('✓ 知识库向量存储已回滚');
      }
      
      console.log('✅ 回滚完成');
    } catch (error) {
      console.error('❌ 回滚失败:', error);
    }
  }

  /**
   * 获取迁移状态报告
   */
  async getStatus() {
    console.log('\n📊 迁移状态报告:');
    console.log('==================');
    
    // 检查主向量存储
    const mainStorePath = path.join(this.dataDir, 'vector-store.json');
    if (await fs.pathExists(mainStorePath)) {
      const hybridStore = new HybridVectorStore({ storePath: mainStorePath });
      if (hybridStore.load()) {
        const stats = hybridStore.getStats();
        console.log(`主向量存储: ${stats.version === '2.0.0' ? '✅ 已迁移' : '❌ 未迁移'}`);
        console.log(`  - 版本: ${stats.version || '1.0.0'}`);
        console.log(`  - 文档数: ${stats.activeDocuments}/${stats.totalDocuments}`);
        console.log(`  - LSH索引: ${stats.lshStats ? '✅ 已启用' : '❌ 未启用'}`);
        console.log(`  - 聚类索引: ${stats.clusterStats ? '✅ 已启用' : '❌ 未启用'}`);
      }
    } else {
      console.log('主向量存储: ❌ 文件不存在');
    }
    
    // 检查知识库向量存储
    if (await fs.pathExists(this.vectorStoresDir)) {
      const storeFiles = await fs.readdir(this.vectorStoresDir);
      const kbStoreFiles = storeFiles.filter(file => file.startsWith('kb_') && file.endsWith('.json'));
      
      console.log(`\n知识库向量存储 (${kbStoreFiles.length} 个):`);
      
      for (const fileName of kbStoreFiles) {
        const storePath = path.join(this.vectorStoresDir, fileName);
        const hybridStore = new HybridVectorStore({ storePath });
        
        if (hybridStore.load()) {
          const stats = hybridStore.getStats();
          const status = stats.version === '2.0.0' ? '✅' : '❌';
          console.log(`  ${fileName}: ${status} (${stats.activeDocuments} 文档)`);
        } else {
          console.log(`  ${fileName}: ❌ 加载失败`);
        }
      }
    }
    
    console.log('\n==================');
  }
}

// 命令行执行
if (require.main === module) {
  const migration = new HybridIndexMigration();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'migrate':
      migration.migrate().catch(console.error);
      break;
    case 'status':
      migration.getStatus().catch(console.error);
      break;
    case 'rollback':
      migration.rollback().catch(console.error);
      break;
    default:
      console.log('使用方法:');
      console.log('  node migrateToHybridIndex.js migrate   # 执行迁移');
      console.log('  node migrateToHybridIndex.js status    # 查看状态');
      console.log('  node migrateToHybridIndex.js rollback  # 回滚操作');
  }
}

module.exports = HybridIndexMigration;