// AdvisorAdmin.vue - 管理员管理页面
<template>
  <div class="advisor-admin">
    <div class="admin-header">
      <h1>AI辅导员管理</h1>
      <button @click="goBack" class="back-button">
        <i class="fas fa-arrow-left"></i> 返回
      </button>
    </div>

    <div class="admin-container">
      <!-- 状态显示 -->
      <div class="status-section">
        <h2>默认知识库状态</h2>
        <div v-if="loading" class="loading">检查状态中...</div>
        <div v-else-if="status" class="status-info">
          <div class="status-item">
            <label>总文档数:</label>
            <span>{{ status.vectorStore?.totalDocuments || 0 }}</span>
          </div>
          <div class="status-item">
            <label>活跃文档数:</label>
            <span>{{ status.vectorStore?.activeDocuments || 0 }}</span>
          </div>
          <div class="status-item">
            <label>是否需要重建:</label>
            <span :class="status.needsRebuild ? 'need-rebuild' : 'good'">
              {{ status.needsRebuild ? '是' : '否' }}
            </span>
          </div>
        </div>
        
        <!-- PDF文件状态 -->
        <div v-if="status?.pdfFiles" class="pdf-files">
          <h3>PDF文件状态</h3>
          <div v-for="file in status.pdfFiles" :key="file.path" class="file-item">
            <div class="file-name">{{ getFileName(file.path) }}</div>
            <div class="file-status">
              <span :class="file.exists ? 'exists' : 'missing'">
                {{ file.exists ? '存在' : '缺失' }}
              </span>
              <span v-if="file.exists" class="file-size">
                ({{ formatFileSize(file.size) }})
              </span>
            </div>
          </div>
        </div>
        
        <button @click="checkStatus" class="refresh-button" :disabled="loading">
          <i class="fas fa-refresh"></i> 刷新状态
        </button>
      </div>

      <!-- 操作区域 -->
      <div class="actions-section">
        <h2>管理操作</h2>
        
        <div class="action-group">
          <button 
            @click="rebuildKnowledgeBase" 
            class="rebuild-button"
            :disabled="rebuilding"
          >
            <i class="fas fa-sync-alt"></i>
            {{ rebuilding ? '重建中...' : '重建默认知识库' }}
          </button>
          <p class="action-desc">
            完全重建默认知识库的向量索引，处理时间较长
          </p>
        </div>

        <div class="action-group">
          <button 
            @click="clearCache" 
            class="clear-button"
            :disabled="clearing"
          >
            <i class="fas fa-trash"></i>
            {{ clearing ? '清理中...' : '清理处理缓存' }}
          </button>
          <p class="action-desc">
            清理文档处理和嵌入缓存，下次处理将重新计算
          </p>
        </div>
      </div>

      <!-- 操作日志 -->
      <div class="logs-section" v-if="logs.length > 0">
        <h2>操作日志</h2>
        <div class="logs-container">
          <div 
            v-for="(log, index) in logs" 
            :key="index" 
            :class="['log-item', log.type]"
          >
            <span class="log-time">{{ formatTime(log.time) }}</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from '@/api/axiosForAssistant';

export default {
  name: 'AdvisorAdmin',
  data() {
    return {
      status: null,
      loading: false,
      rebuilding: false,
      clearing: false,
      logs: []
    };
  },
  mounted() {
    this.checkStatus();
  },
  methods: {
    async checkStatus() {
      this.loading = true;
      try {
        const response = await axios.get('/advisor/admin/knowledge-base/status');
        if (response.data.success) {
          this.status = response.data.data;
          this.addLog('状态检查完成', 'info');
        }
      } catch (error) {
        console.error('检查状态失败:', error);
        this.addLog('状态检查失败: ' + error.message, 'error');
      } finally {
        this.loading = false;
      }
    },

    async rebuildKnowledgeBase() {
      if (!confirm('重建知识库将需要较长时间，确定要继续吗？')) {
        return;
      }

      this.rebuilding = true;
      this.addLog('开始重建默认知识库...', 'info');
      
      try {
        const response = await axios.post('/advisor/admin/knowledge-base/rebuild');
        if (response.data.success) {
          this.addLog('默认知识库重建成功', 'success');
          await this.checkStatus(); // 刷新状态
        }
      } catch (error) {
        console.error('重建失败:', error);
        this.addLog('重建失败: ' + error.message, 'error');
      } finally {
        this.rebuilding = false;
      }
    },

    async clearCache() {
      if (!confirm('确定要清理所有处理缓存吗？')) {
        return;
      }

      this.clearing = true;
      this.addLog('开始清理缓存...', 'info');
      
      try {
        const response = await axios.post('/advisor/admin/cache/clear');
        if (response.data.success) {
          this.addLog('缓存清理成功', 'success');
        }
      } catch (error) {
        console.error('清理缓存失败:', error);
        this.addLog('清理缓存失败: ' + error.message, 'error');
      } finally {
        this.clearing = false;
      }
    },

    addLog(message, type = 'info') {
      this.logs.unshift({
        message,
        type,
        time: new Date()
      });
      
      // 保持最多50条日志
      if (this.logs.length > 50) {
        this.logs = this.logs.slice(0, 50);
      }
    },

    getFileName(path) {
      return path.split('/').pop();
    },

    formatFileSize(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    formatTime(time) {
      return time.toLocaleTimeString();
    },

    goBack() {
      this.$router.push('/advisor');
    }
  }
};
</script>

<style scoped>
.advisor-admin {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.admin-header {
  background: #5E35B1;
  color: white;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.back-button {
  background: rgba(255,255,255,0.2);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.admin-container {
  padding: 2rem;
  max-width: 1000px;
  margin: 0 auto;
}

.status-section, .actions-section, .logs-section {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.status-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid #eee;
}

.need-rebuild {
  color: #f44336;
  font-weight: bold;
}

.good {
  color: #4caf50;
}

.file-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
}

.exists {
  color: #4caf50;
}

.missing {
  color: #f44336;
}

.action-group {
  margin-bottom: 2rem;
}

.rebuild-button, .clear-button, .refresh-button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  margin-right: 1rem;
}

.rebuild-button {
  background: #4caf50;
  color: white;
}

.clear-button {
  background: #ff9800;
  color: white;
}

.refresh-button {
  background: #2196f3;
  color: white;
}

.action-desc {
  color: #666;
  font-size: 0.9rem;
  margin: 0.5rem 0;
}

.logs-container {
  max-height: 400px;
  overflow-y: auto;
}

.log-item {
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  border-radius: 4px;
}

.log-item.success {
  background: #e8f5e9;
  color: #2e7d32;
}

.log-item.error {
  background: #ffebee;
  color: #c62828;
}

.log-item.info {
  background: #e3f2fd;
  color: #1565c0;
}

.log-time {
  font-size: 0.8rem;
  opacity: 0.7;
  margin-right: 1rem;
}
</style>