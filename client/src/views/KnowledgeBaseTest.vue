<template>
  <div class="knowledge-base-test">
    <div class="knowledge-base-header">
      <div class="header-left">
        <button class="back-button" @click="goBack">
          <i class="fas fa-arrow-left"></i>
        </button>
        <h2>{{ knowledgeBase.name || '知识库测试' }}</h2>
      </div>
    </div>
    
    <div class="test-container">
      <div class="search-section">
        <h3>测试搜索</h3>
        <p class="test-description">输入查询内容，测试知识库的搜索效果</p>
        
        <div class="search-form">
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="输入搜索内容..."
            @keyup.enter="searchKnowledgeBase"
          />
          <button 
            class="search-button" 
            @click="searchKnowledgeBase"
            :disabled="!searchQuery.trim() || searching"
          >
            <i v-if="searching" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-search"></i>
            {{ searching ? '搜索中...' : '搜索' }}
          </button>
        </div>
      </div>
      
      <div class="search-results" v-if="hasSearched">
        <h3>搜索结果</h3>
        
        <div v-if="results.length === 0" class="empty-results">
          <i class="fas fa-search"></i>
          <p>没有找到相关内容</p>
        </div>
        
        <div v-else class="results-list">
          <div v-for="(result, index) in results" :key="index" class="result-item">
            <div class="result-header">
              <div class="result-source">
                <i :class="getFileIcon(result.document.metadata.fileName)"></i>
                <span>{{ result.document.metadata.fileName }}</span>
              </div>
              <div class="result-score">相似度: {{ (result.similarity * 100).toFixed(1) }}%</div>
            </div>
            
            <div class="result-content">
              {{ result.document.content }}
            </div>
            
            <div class="result-meta">
              <span>块 {{ result.document.metadata.chunk }}/{{ result.document.metadata.totalChunks }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from '@/api/axiosForAssistant';

export default {
  name: 'KnowledgeBaseTest',
  props: {
    id: {
      type: [String, Number],
      required: true
    }
  },
  data() {
    return {
      knowledgeBase: {},
      searchQuery: '',
      results: [],
      searching: false,
      hasSearched: false
    };
  },
  mounted() {
    this.fetchKnowledgeBaseDetails();
  },
  methods: {
    // 返回知识库详情页
    goBack() {
      this.$router.push(`/knowledge-base/${this.id}`);
    },
    
    // 获取知识库详情
    async fetchKnowledgeBaseDetails() {
      try {
        const response = await axios.get(`/knowledge-base/${this.id}`);
        
        if (response.data.success) {
          this.knowledgeBase = response.data.knowledgeBase || {};
          console.log('获取知识库详情成功:', this.knowledgeBase);
        } else {
          console.error('获取知识库详情失败:', response.data.error);
        }
      } catch (error) {
        console.error('获取知识库详情出错:', error);
      }
    },
    
    // 搜索知识库
    async searchKnowledgeBase() {
      if (!this.searchQuery.trim() || this.searching) return;
      
      this.searching = true;
      
      try {
        const response = await axios.post(`/knowledge-base/${this.id}/search`, {
          query: this.searchQuery
        });
        
        if (response.data.success) {
          this.results = response.data.results || [];
          this.hasSearched = true;
          console.log('搜索成功:', this.results);
        } else {
          console.error('搜索失败:', response.data.error);
          alert(`搜索失败: ${response.data.error}`);
        }
      } catch (error) {
        console.error('搜索出错:', error);
        alert('搜索出错，请稍后再试');
      } finally {
        this.searching = false;
      }
    },
    
    // 根据文件类型获取图标
    getFileIcon(fileName) {
      if (!fileName) return 'fas fa-file';
      
      const extension = fileName.split('.').pop().toLowerCase();
      
      const typeMap = {
        'pdf': 'fas fa-file-pdf',
        'txt': 'fas fa-file-alt',
        'doc': 'fas fa-file-word',
        'docx': 'fas fa-file-word',
        'csv': 'fas fa-file-csv',
        'md': 'fas fa-file-alt',
        'markdown': 'fas fa-file-alt'
      };
      
      return typeMap[extension] || 'fas fa-file';
    }
  }
};
</script>

<style scoped>
.knowledge-base-test {
  padding: 20px;
}

.knowledge-base-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.back-button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #f0f0f0;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.back-button:hover {
  background-color: #e0e0e0;
}

.test-container {
  background-color: white;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 20px;
}

.search-section {
  margin-bottom: 30px;
}

.search-section h3 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #333;
}

.test-description {
  color: #666;
  margin-bottom: 20px;
}

.search-form {
  display: flex;
  gap: 10px;
}

.search-form input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.95rem;
}

.search-form input:focus {
  border-color: #5E35B1;
  outline: none;
}

.search-button {
  background-color: #5E35B1;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-button:hover {
  background-color: #4527A0;
}

.search-button:disabled {
  background-color: #9e9e9e;
  cursor: not-allowed;
}

.search-results h3 {
  margin-top: 0;
  margin-bottom: 20px;
  color: #333;
}

.empty-results {
  text-align: center;
  padding: 40px;
  color: #666;
}

.empty-results i {
  font-size: 3rem;
  margin-bottom: 15px;
  color: #9e9e9e;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.result-item {
  padding: 20px;
  border-radius: 8px;
  background-color: #f9f9f9;
  transition: background-color 0.2s;
}

.result-item:hover {
  background-color: #f3f3f3;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.result-source {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: #555;
}

.result-source i {
  color: #2196F3;
}

.result-score {
  padding: 4px 10px;
  background-color: #e3f2fd;
  color: #2196F3;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 500;
}

.result-content {
  padding: 15px;
  background-color: white;
  border-radius: 6px;
  color: #333;
  border: 1px solid #eee;
  margin-bottom: 10px;
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
}

.result-meta {
  display: flex;
  justify-content: flex-end;
  color: #666;
  font-size: 0.8rem;
}
</style>