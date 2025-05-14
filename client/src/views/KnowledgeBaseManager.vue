<template>
  <div class="knowledge-base-manager">
    <div class="knowledge-base-header">
      <h2>知识库管理</h2>
      <button class="primary-button" @click="showCreateDialog = true">
        <i class="fas fa-plus"></i> 创建知识库
      </button>
    </div>
    
    <!-- 知识库列表 -->
    <div class="knowledge-base-list" v-if="!loading">
      <div v-if="knowledgeBases.length === 0" class="empty-state">
        <i class="fas fa-book-open"></i>
        <p>暂无知识库，点击"创建知识库"按钮开始创建</p>
      </div>
      
      <div v-else class="kb-card-container">
        <div v-for="kb in knowledgeBases" :key="kb.id" class="kb-card">
          <div class="kb-card-header">
            <h3>{{ kb.name }}</h3>
            <div class="kb-actions">
              <button class="icon-button" @click="editKnowledgeBase(kb)">
                <i class="fas fa-edit"></i>
              </button>
              <button class="icon-button" @click="confirmDeleteKnowledgeBase(kb)">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          
          <p class="kb-description">{{ kb.description || '无描述' }}</p>
          
          <div class="kb-stats">
            <span class="kb-stat">
              <i class="fas fa-file"></i> {{ kb.file_count || 0 }} 个文件
            </span>
            <span class="kb-stat">
              <i class="fas fa-check-circle"></i> {{ kb.indexed_count || 0 }} 已索引
            </span>
          </div>
          
          <div class="kb-actions-footer">
            <button class="action-button" @click="viewKnowledgeBase(kb.id)">
              <i class="fas fa-eye"></i> 查看文件
            </button>
            <button class="action-button" @click="testKnowledgeBase(kb.id)">
              <i class="fas fa-search"></i> 测试搜索
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="loading-state">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>
    
    <!-- 创建知识库对话框 -->
    <div v-if="showCreateDialog" class="modal-overlay" @click="showCreateDialog = false">
      <div class="modal-content" @click.stop>
        <h3>{{ editMode ? '编辑知识库' : '创建知识库' }}</h3>
        
        <div class="form-group">
          <label for="kb-name">知识库名称</label>
          <input type="text" id="kb-name" v-model="newKnowledgeBase.name" placeholder="输入知识库名称" />
        </div>
        
        <div class="form-group">
          <label for="kb-description">描述（可选）</label>
          <textarea id="kb-description" v-model="newKnowledgeBase.description" placeholder="描述这个知识库的用途..."></textarea>
        </div>
        
        <div class="modal-actions">
          <button class="cancel-button" @click="showCreateDialog = false">取消</button>
          <button 
            class="primary-button" 
            @click="saveKnowledgeBase" 
            :disabled="!newKnowledgeBase.name"
          >
            {{ editMode ? '保存' : '创建' }}
          </button>
        </div>
      </div>
    </div>
    
    <!-- 删除确认对话框 -->
    <div v-if="showDeleteDialog" class="modal-overlay" @click="showDeleteDialog = false">
      <div class="modal-content" @click.stop>
        <h3>删除知识库</h3>
        <p>您确定要删除知识库"{{ knowledgeBaseToDelete?.name }}"吗？此操作无法撤销。</p>
        
        <div class="modal-actions">
          <button class="cancel-button" @click="showDeleteDialog = false">取消</button>
          <button class="delete-button" @click="deleteKnowledgeBase">
            <i class="fas fa-trash"></i> 确认删除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from '@/api/axiosForAssistant';

export default {
  name: 'KnowledgeBaseManager',
  data() {
    return {
      knowledgeBases: [],
      loading: true,
      showCreateDialog: false,
      showDeleteDialog: false,
      editMode: false,
      newKnowledgeBase: {
        name: '',
        description: ''
      },
      knowledgeBaseToDelete: null
    };
  },
  mounted() {
    this.fetchKnowledgeBases();
  },
  methods: {
    // 获取知识库列表
    async fetchKnowledgeBases() {
      this.loading = true;
      try {
        const response = await axios.get('/knowledge-base');
        
        if (response.data.success) {
          this.knowledgeBases = response.data.knowledgeBases;
          console.log('获取知识库成功:', this.knowledgeBases);
        } else {
          console.error('获取知识库失败:', response.data.error);
        }
      } catch (error) {
        console.error('获取知识库出错:', error);
      } finally {
        this.loading = false;
      }
    },
    
    // 编辑知识库
    editKnowledgeBase(knowledgeBase) {
      this.editMode = true;
      this.newKnowledgeBase = {
        id: knowledgeBase.id,
        name: knowledgeBase.name,
        description: knowledgeBase.description || ''
      };
      this.showCreateDialog = true;
    },
    
    // 保存知识库
    async saveKnowledgeBase() {
      try {
        let response;
        
        if (this.editMode) {
          // 更新已有知识库
          response = await axios.put(`/knowledge-base/${this.newKnowledgeBase.id}`, {
            name: this.newKnowledgeBase.name,
            description: this.newKnowledgeBase.description
          });
        } else {
          // 创建新知识库
          response = await axios.post('/knowledge-base', {
            name: this.newKnowledgeBase.name,
            description: this.newKnowledgeBase.description
          });
        }
        
        if (response.data.success) {
          // 重新获取知识库列表
          this.fetchKnowledgeBases();
          this.showCreateDialog = false;
          this.resetForm();
        } else {
          console.error('保存知识库失败:', response.data.error);
          alert(`保存失败: ${response.data.error}`);
        }
      } catch (error) {
        console.error('保存知识库出错:', error);
        alert('保存出错，请稍后再试');
      }
    },
    
    // 确认删除知识库
    confirmDeleteKnowledgeBase(knowledgeBase) {
      this.knowledgeBaseToDelete = knowledgeBase;
      this.showDeleteDialog = true;
    },
    
    // 删除知识库
    async deleteKnowledgeBase() {
      if (!this.knowledgeBaseToDelete) return;
      
      try {
        const response = await axios.delete(`/knowledge-base/${this.knowledgeBaseToDelete.id}`);
        
        if (response.data.success) {
          // 重新获取知识库列表
          this.fetchKnowledgeBases();
          this.showDeleteDialog = false;
          this.knowledgeBaseToDelete = null;
        } else {
          console.error('删除知识库失败:', response.data.error);
          alert(`删除失败: ${response.data.error}`);
        }
      } catch (error) {
        console.error('删除知识库出错:', error);
        alert('删除出错，请稍后再试');
      }
    },
    
    // 查看知识库详情
    viewKnowledgeBase(id) {
      this.$router.push(`/knowledge-base/${id}`);
    },
    
    // 测试知识库搜索
    testKnowledgeBase(id) {
      this.$router.push(`/knowledge-base/${id}/test`);
    },
    
    // 重置表单
    resetForm() {
      this.editMode = false;
      this.newKnowledgeBase = {
        name: '',
        description: ''
      };
    }
  }
};
</script>

<style scoped>
.knowledge-base-manager {
  padding: 20px;
}

.knowledge-base-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.primary-button {
  background-color: #5E35B1;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.primary-button:hover {
  background-color: #4527A0;
}

.primary-button:disabled {
  background-color: #9e9e9e;
  cursor: not-allowed;
}

.kb-card-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.kb-card {
  background-color: white;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.kb-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.kb-card-header h3 {
  margin: 0;
  color: #333;
}

.kb-actions {
  display: flex;
  gap: 8px;
}

.icon-button {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
}

.icon-button:hover {
  background-color: #f0f0f0;
  color: #333;
}

.kb-description {
  color: #666;
  margin-bottom: 15px;
  flex-grow: 1;
}

.kb-stats {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
  color: #555;
}

.kb-stat {
  display: flex;
  align-items: center;
  gap: 5px;
}

.kb-actions-footer {
  display: flex;
  gap: 10px;
}

.action-button {
  flex: 1;
  background-color: #f0f0f0;
  border: none;
  padding: 8px;
  border-radius: 6px;
  color: #333;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.action-button:hover {
  background-color: #e0e0e0;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
}

.empty-state i {
  font-size: 3rem;
  margin-bottom: 15px;
  color: #9e9e9e;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #666;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #5E35B1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 对话框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  border-radius: 10px;
  padding: 25px;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  color: #555;
}

.form-group input, .form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.95rem;
}

.form-group textarea {
  resize: vertical;
  min-height: 100px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.cancel-button {
  background-color: #f0f0f0;
  color: #333;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
}

.cancel-button:hover {
  background-color: #e0e0e0;
}

.delete-button {
  background-color: #f44336;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.delete-button:hover {
  background-color: #d32f2f;
}
</style>