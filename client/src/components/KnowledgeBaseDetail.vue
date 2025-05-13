<template>
  <div class="knowledge-base-detail">
    <div class="knowledge-base-header">
      <div class="header-left">
        <button class="back-button" @click="goBack">
          <i class="fas fa-arrow-left"></i>
        </button>
        <h2>{{ knowledgeBase.name || '知识库详情' }}</h2>
      </div>
      <button class="primary-button" @click="showUploadDialog = true">
        <i class="fas fa-upload"></i> 上传文件
      </button>
    </div>
    
    <div class="knowledge-base-info" v-if="knowledgeBase.id">
      <p class="kb-description">{{ knowledgeBase.description || '无描述' }}</p>
      
      <!-- 索引重建按钮 -->
      <div class="rebuild-index-section">
        <button class="rebuild-button" @click="confirmRebuildIndex">
          <i class="fas fa-sync-alt"></i> 重建索引
        </button>
        <span class="rebuild-info">重建索引将重新处理所有文件，可能需要较长时间</span>
      </div>
    </div>
    
    <!-- 文件列表 -->
    <div class="files-section" v-if="!loading">
      <!-- 添加切换标签 -->
      <div class="tabs-header">
        <div :class="['tab', activeTab === 'active' ? 'active' : '']" @click="activeTab = 'active'">
          <i class="fas fa-file"></i> 有效文件
        </div>
        <div :class="['tab', activeTab === 'deleted' ? 'active' : '']" @click="activeTab = 'deleted'">
          <i class="fas fa-trash"></i> 回收站
          <span v-if="deletedFiles.length > 0" class="badge">{{ deletedFiles.length }}</span>
        </div>
      </div>
      
      <h3>{{ activeTab === 'active' ? '文件列表' : '已删除文件' }}</h3>
      
      <!-- 活动文件列表 -->
      <div v-if="activeTab === 'active'">
        <div v-if="activeFiles.length === 0" class="empty-state">
          <i class="fas fa-file-alt"></i>
          <p>暂无文件，点击"上传文件"按钮开始上传</p>
        </div>
        
        <div v-else class="file-list">
          <div v-for="file in activeFiles" :key="file.id" class="file-item">
            <div class="file-icon">
              <i :class="getFileIcon(file.file_type)"></i>
            </div>
            
            <div class="file-details">
              <div class="file-name">{{ file.original_filename }}</div>
              <div class="file-meta">
                <span class="file-type">{{ file.file_type.toUpperCase() }}</span>
                <span class="file-size">{{ formatFileSize(file.file_size) }}</span>
                <span :class="['file-status', `status-${file.status}`]">
                  {{ getStatusText(file.status) }}
                </span>
              </div>
            </div>
            
            <div class="file-actions">
              <button class="icon-button" @click="confirmDeleteFile(file)">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 已删除文件列表 -->
      <div v-if="activeTab === 'deleted'">
        <div v-if="deletedFiles.length === 0" class="empty-state">
          <i class="fas fa-trash-alt"></i>
          <p>回收站为空</p>
        </div>
        
        <div v-else class="file-list">
          <div v-for="file in deletedFiles" :key="file.id" class="file-item deleted-file">
            <div class="file-icon">
              <i :class="getFileIcon(file.file_type)"></i>
            </div>
            
            <div class="file-details">
              <div class="file-name">{{ file.original_filename }}</div>
              <div class="file-meta">
                <span class="file-type">{{ file.file_type.toUpperCase() }}</span>
                <span class="file-size">{{ formatFileSize(file.file_size) }}</span>
                <span class="file-status status-deleted">已删除</span>
              </div>
            </div>
            
            <div class="file-actions">
              <button class="icon-button restore-button" @click="confirmRestoreFile(file)" title="恢复文件">
                <i class="fas fa-undo"></i>
              </button>
              <button class="icon-button purge-button" @click="confirmPurgeFile(file)" title="彻底删除">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>
        </div>
        
        <!-- 清空回收站按钮 -->
        <div v-if="deletedFiles.length > 0" class="purge-actions">
          <button class="purge-all-button" @click="confirmPurgeAll">
            <i class="fas fa-trash-alt"></i> 清空回收站
          </button>
        </div>
      </div>
    </div>
    
    <div v-else class="loading-state">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>
    
    <!-- 上传文件对话框 -->
    <div v-if="showUploadDialog" class="modal-overlay" @click="showUploadDialog = false">
      <div class="modal-content" @click.stop>
        <h3>上传文件</h3>
        
        <div class="file-upload-area">
          <input 
            type="file" 
            ref="fileInput" 
            style="display: none"
            @change="handleFileSelected"
            accept=".pdf,.txt,.doc,.docx,.csv,.md,.markdown"
          />
          
          <div 
            class="file-drop-zone"
            @click="$refs.fileInput.click()"
            @dragover.prevent="onDragOver"
            @dragleave.prevent="onDragLeave"
            @drop.prevent="onFileDrop"
            :class="{ 'drag-over': isDragging }"
          >
            <div v-if="selectedFile">
              <i :class="getFileIcon(getFileType(selectedFile.name))"></i>
              <div class="selected-filename">{{ selectedFile.name }}</div>
              <div class="selected-filesize">{{ formatFileSize(selectedFile.size) }}</div>
              <button class="small-button" @click.stop="selectedFile = null">
                <i class="fas fa-times"></i> 移除
              </button>
            </div>
            <div v-else>
              <i class="fas fa-cloud-upload-alt"></i>
              <p>拖放文件到这里或点击选择文件</p>
              <p class="file-types">支持 PDF, TXT, DOC, DOCX, CSV, MD</p>
            </div>
          </div>
        </div>
        
        <div class="modal-actions">
          <button class="cancel-button" @click="showUploadDialog = false">取消</button>
          <button 
            class="primary-button" 
            @click="uploadFile" 
            :disabled="!selectedFile || uploading"
          >
            <span v-if="uploading">
              <i class="fas fa-spinner fa-spin"></i> 上传中...
            </span>
            <span v-else>
              <i class="fas fa-upload"></i> 上传
            </span>
          </button>
        </div>
      </div>
    </div>
    
    <!-- 确认对话框 -->
    <div v-if="showConfirmDialog" class="modal-overlay" @click="showConfirmDialog = false">
      <div class="modal-content confirm-dialog" @click.stop>
        <h3>{{ confirmDialogTitle }}</h3>
        <p>{{ confirmDialogMessage }}</p>
        
        <div class="modal-actions">
          <button class="cancel-button" @click="showConfirmDialog = false">取消</button>
          <button 
            :class="['confirm-action-button', confirmDialogActionClass]" 
            @click="executeConfirmedAction"
          >
            {{ confirmDialogActionText }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from '@/api/axiosForAssistant';

export default {
  name: 'KnowledgeBaseDetail',
  props: {
    id: {
      type: [String, Number],
      required: true
    }
  },
  data() {
    return {
      knowledgeBase: {},
      files: [],
      deletedFiles: [], // 存储已删除的文件
      activeTab: 'active', // 当前激活的标签
      loading: true,
      showUploadDialog: false,
      showConfirmDialog: false,
      confirmDialogTitle: '',
      confirmDialogMessage: '',
      confirmDialogActionText: '',
      confirmDialogActionClass: '',
      confirmedAction: null,
      selectedFile: null,
      isDragging: false,
      uploading: false,
      fileToDelete: null,
      fileToRestore: null, // 要恢复的文件
      fileToPurge: null    // 要彻底删除的文件
    };
  },
  computed: {
    // 计算活动的文件
    activeFiles() {
      return this.files.filter(file => file.status !== 'deleted');
    }
  },
  mounted() {
    this.fetchKnowledgeBaseDetails();
  },
  methods: {
    // 返回上一页
    goBack() {
      this.$router.push('/knowledge-base');
    },
    
    // 获取知识库详情
    async fetchKnowledgeBaseDetails() {
      this.loading = true;
      try {
        // 修改API调用以获取已删除的文件
        const response = await axios.get(`/knowledge-base/${this.id}?includeDeleted=true`);
        
        if (response.data.success) {
          this.knowledgeBase = response.data.knowledgeBase || {};
          this.files = response.data.files || [];
          this.deletedFiles = response.data.deletedFiles || [];
          console.log('获取知识库详情成功:', this.knowledgeBase);
        } else {
          console.error('获取知识库详情失败:', response.data.error);
        }
      } catch (error) {
        console.error('获取知识库详情出错:', error);
      } finally {
        this.loading = false;
      }
    },
    
    // 根据文件类型获取图标
    getFileIcon(fileType) {
      if (!fileType) return 'fas fa-file';
      
      const typeMap = {
        'pdf': 'fas fa-file-pdf',
        'txt': 'fas fa-file-alt',
        'doc': 'fas fa-file-word',
        'docx': 'fas fa-file-word',
        'csv': 'fas fa-file-csv',
        'md': 'fas fa-file-alt',
        'markdown': 'fas fa-file-alt'
      };
      
      return typeMap[fileType.toLowerCase()] || 'fas fa-file';
    },
    
    // 格式化文件大小
    formatFileSize(bytes) {
      if (!bytes || isNaN(bytes)) return '未知大小';
      
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    // 获取文件状态文本
    getStatusText(status) {
      const statusMap = {
        'pending': '待处理',
        'processing': '处理中',
        'indexed': '已索引',
        'failed': '处理失败',
        'deleted': '已删除'
      };
      
      return statusMap[status] || status;
    },
    
    // 处理文件选择
    handleFileSelected(event) {
      if (event.target.files && event.target.files.length > 0) {
        this.selectedFile = event.target.files[0];
      }
    },
    
    // 拖拽处理
    onDragOver(event) {
      this.isDragging = true;
    },
    
    onDragLeave(event) {
      this.isDragging = false;
    },
    
    onFileDrop(event) {
      this.isDragging = false;
      
      if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        const file = event.dataTransfer.files[0];
        const fileType = this.getFileType(file.name);
        
        // 检查文件类型是否支持
        const supportedTypes = ['pdf', 'txt', 'doc', 'docx', 'csv', 'md', 'markdown'];
        
        if (supportedTypes.includes(fileType)) {
          this.selectedFile = file;
        } else {
          alert('不支持的文件类型! 请上传PDF、TXT、DOC、DOCX、CSV或MD文件。');
        }
      }
    },
    
    // 获取文件类型
    getFileType(filename) {
      return filename.split('.').pop().toLowerCase();
    },
    
    // 上传文件
    async uploadFile() {
      if (!this.selectedFile) return;
      
      this.uploading = true;
      
      try {
        const formData = new FormData();
        formData.append('file', this.selectedFile);
        
        const response = await axios.post(`/knowledge-base/${this.id}/files`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        if (response.data.success) {
          // 上传成功
          this.showUploadDialog = false;
          this.selectedFile = null;
          
          // 重新获取文件列表
          this.fetchKnowledgeBaseDetails();
        } else {
          console.error('上传文件失败:', response.data.error);
          alert(`上传失败: ${response.data.error}`);
        }
      } catch (error) {
        console.error('上传文件出错:', error);
        alert('上传出错，请稍后再试');
      } finally {
        this.uploading = false;
      }
    },
    
    // 确认删除文件
    confirmDeleteFile(file) {
      this.fileToDelete = file;
      this.confirmDialogTitle = '删除文件';
      this.confirmDialogMessage = `您确定要删除文件"${file.original_filename}"吗？文件将被移至回收站。`;
      this.confirmDialogActionText = '删除';
      this.confirmDialogActionClass = '';
      this.confirmedAction = this.deleteFile;
      this.showConfirmDialog = true;
    },
    
    // 确认重建索引
    confirmRebuildIndex() {
      this.confirmDialogTitle = '重建索引';
      this.confirmDialogMessage = '重建索引将重新处理所有文件，这可能需要较长时间。确定要继续吗？';
      this.confirmDialogActionText = '重建';
      this.confirmDialogActionClass = '';
      this.confirmedAction = this.rebuildIndex;
      this.showConfirmDialog = true;
    },
    
    // 重建索引
    async rebuildIndex() {
      try {
        const response = await axios.post(`/knowledge-base/${this.id}/rebuild`);
        
        if (response.data.success) {
          alert('索引重建已启动，请稍后刷新页面查看最新状态');
          
          // 延迟3秒后刷新
          setTimeout(() => {
            this.fetchKnowledgeBaseDetails();
          }, 3000);
        } else {
          console.error('重建索引失败:', response.data.error);
          alert(`重建失败: ${response.data.error}`);
        }
      } catch (error) {
        console.error('重建索引出错:', error);
        alert('重建索引出错，请稍后再试');
      }
    },
    
    // 删除文件（软删除）
    async deleteFile() {
      if (!this.fileToDelete) return;
      
      try {
        const response = await axios.delete(`/knowledge-base/files/${this.fileToDelete.id}`);
        
        if (response.data.success) {
          // 显示成功消息
          const successMessage = response.data.message || '文件已移至回收站';
          console.log(successMessage);
          alert(successMessage);
          
          // 文件删除成功，重新获取文件列表
          this.fetchKnowledgeBaseDetails();
          this.fileToDelete = null;
        } else {
          console.error('删除文件失败:', response.data.error);
          alert(`删除失败: ${response.data.error}`);
        }
      } catch (error) {
        console.error('删除文件出错:', error);
        alert('删除出错，请稍后再试');
      } finally {
        this.showConfirmDialog = false;
      }
    },
    
    // 恢复文件确认
    confirmRestoreFile(file) {
      this.fileToRestore = file;
      this.confirmDialogTitle = '恢复文件';
      this.confirmDialogMessage = `您确定要恢复文件"${file.original_filename}"吗？`;
      this.confirmDialogActionText = '恢复';
      this.confirmDialogActionClass = 'restore-button-dialog';
      this.confirmedAction = this.restoreFile;
      this.showConfirmDialog = true;
    },
    
    // 恢复文件
    async restoreFile() {
      if (!this.fileToRestore) return;
      
      try {
        const response = await axios.post(`/knowledge-base/files/${this.fileToRestore.id}/restore`);
        
        if (response.data.success) {
          // 显示成功消息
          const successMessage = response.data.message || '文件恢复成功';
          console.log(successMessage);
          alert(successMessage);
          
          // 文件恢复成功，重新获取文件列表
          this.fetchKnowledgeBaseDetails();
          this.fileToRestore = null;
        } else {
          console.error('恢复文件失败:', response.data.error);
          alert(`恢复失败: ${response.data.error}`);
        }
      } catch (error) {
        console.error('恢复文件出错:', error);
        alert('恢复出错，请稍后再试');
      } finally {
        this.showConfirmDialog = false;
      }
    },
    
    // 彻底删除文件确认
    confirmPurgeFile(file) {
      this.fileToPurge = file;
      this.confirmDialogTitle = '彻底删除文件';
      this.confirmDialogMessage = `您确定要彻底删除文件"${file.original_filename}"吗？此操作无法撤销！`;
      this.confirmDialogActionText = '彻底删除';
      this.confirmDialogActionClass = 'danger-button';
      this.confirmedAction = this.purgeFile;
      this.showConfirmDialog = true;
    },
    
    // 彻底删除文件
    async purgeFile() {
      if (!this.fileToPurge) return;
      
      try {
        const response = await axios.delete(`/knowledge-base/files/${this.fileToPurge.id}?purge=true`);
        
        if (response.data.success) {
          // 显示成功消息
          const successMessage = response.data.message || '文件已彻底删除';
          console.log(successMessage);
          alert(successMessage);
          
          // 重新获取文件列表
          this.fetchKnowledgeBaseDetails();
          this.fileToPurge = null;
        } else {
          console.error('彻底删除文件失败:', response.data.error);
          alert(`删除失败: ${response.data.error}`);
        }
      } catch (error) {
        console.error('彻底删除文件出错:', error);
        alert('删除出错，请稍后再试');
      } finally {
        this.showConfirmDialog = false;
      }
    },
    
    // 确认清空回收站
    confirmPurgeAll() {
      this.confirmDialogTitle = '清空回收站';
      this.confirmDialogMessage = `您确定要清空回收站中的所有文件吗？此操作无法撤销！`;
      this.confirmDialogActionText = '清空';
      this.confirmDialogActionClass = 'danger-button';
      this.confirmedAction = this.purgeAllDeletedFiles;
      this.showConfirmDialog = true;
    },
    
    // 清空回收站（彻底删除所有已删除文件）
    async purgeAllDeletedFiles() {
      try {
        const response = await axios.post(`/knowledge-base/${this.id}/purge`);
        
        if (response.data.success) {
          // 显示成功消息
          const successMessage = response.data.message || '回收站已清空';
          console.log(successMessage);
          alert(successMessage);
          
          // 重新获取文件列表
          this.fetchKnowledgeBaseDetails();
        } else {
          console.error('清空回收站失败:', response.data.error);
          alert(`清空失败: ${response.data.error}`);
        }
      } catch (error) {
        console.error('清空回收站出错:', error);
        alert('操作出错，请稍后再试');
      } finally {
        this.showConfirmDialog = false;
      }
    },
    
    // 执行确认的操作
    executeConfirmedAction() {
      if (typeof this.confirmedAction === 'function') {
        this.confirmedAction();
      }
      this.showConfirmDialog = false;
    }
  }
};
</script>

<style scoped>
.knowledge-base-detail {
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

.knowledge-base-info {
  background-color: white;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-bottom: 30px;
}

.kb-description {
  margin-bottom: 20px;
  color: #555;
}

.rebuild-index-section {
  display: flex;
  align-items: center;
  gap: 15px;
}

.rebuild-button {
  background-color: #f0f0f0;
  color: #333;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.rebuild-button:hover {
  background-color: #e0e0e0;
}

.rebuild-info {
  color: #666;
  font-size: 0.9rem;
}

.files-section {
  background-color: white;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 20px;
}

.files-section h3 {
  margin-top: 0;
  margin-bottom: 20px;
  color: #333;
}

/* 标签样式 */
.tabs-header {
  display: flex;
  margin-bottom: 20px;
  border-bottom: 1px solid #e0e0e0;
}

.tab {
  padding: 10px 16px;
  cursor: pointer;
  color: #666;
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
}

.tab.active {
  color: #5E35B1;
  border-bottom: 2px solid #5E35B1;
}

.tab i {
  font-size: 0.9rem;
}

.badge {
  background-color: #f44336;
  color: white;
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 10px;
  margin-left: 4px;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 15px;
  border-radius: 8px;
  background-color: #f9f9f9;
  transition: background-color 0.2s;
}

.file-item:hover {
  background-color: #f0f0f0;
}

/* 删除文件样式 */
.deleted-file {
  opacity: 0.8;
  background-color: #ffebee;
}

.file-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background-color: #e3f2fd;
  color: #2196F3;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  margin-right: 15px;
}

.file-details {
  flex: 1;
}

.file-name {
  margin-bottom: 5px;
  font-weight: 500;
  color: #333;
}

.file-meta {
  display: flex;
  gap: 15px;
  font-size: 0.9rem;
  color: #666;
}

.file-type {
  color: #555;
  font-weight: 500;
}

.file-status {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
}

.status-pending {
  background-color: #fff3e0;
  color: #ff9800;
}

.status-processing {
  background-color: #e3f2fd;
  color: #2196F3;
}

.status-indexed {
  background-color: #e8f5e9;
  color: #4caf50;
}

.status-failed {
  background-color: #ffebee;
  color: #f44336;
}

.status-deleted {
  background-color: #ffebee;
  color: #f44336;
}

.file-actions {
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
  background-color: #e0e0e0;
  color: #333;
}

.restore-button {
  color: #4caf50;
}

.restore-button:hover {
  background-color: #e8f5e9;
  color: #4caf50;
}

.purge-button {
  color: #f44336;
}

.purge-button:hover {
  background-color: #ffebee;
  color: #f44336;
}

.purge-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.purge-all-button {
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

.purge-all-button:hover {
  background-color: #d32f2f;
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

.confirm-dialog {
  max-width: 400px;
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

.confirm-action-button {
  background-color: #5E35B1;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
}

.confirm-action-button:hover {
  background-color: #4527A0;
}

.danger-button {
  background-color: #f44336;
}

.danger-button:hover {
  background-color: #d32f2f;
}

.restore-button-dialog {
  background-color: #4caf50;
}

.restore-button-dialog:hover {
  background-color: #3b8c3b;
}

.file-upload-area {
  margin: 15px 0;
}

.file-drop-zone {
  border: 2px dashed #ddd;
  border-radius: 10px;
  padding: 30px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.file-drop-zone:hover {
  border-color: #5E35B1;
  background-color: #f9f6fd;
}

.file-drop-zone.drag-over {
  border-color: #5E35B1;
  background-color: #f3eefa;
}

.file-drop-zone i {
  font-size: 2.5rem;
  color: #5E35B1;
  margin-bottom: 15px;
}

.file-types {
  font-size: 0.8rem;
  color: #666;
  margin-top: 5px;
}

.selected-filename {
  font-weight: 500;
  margin: 10px 0 5px;
}

.selected-filesize {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 10px;
}

.small-button {
  background-color: #f0f0f0;
  color: #333;
  border: none;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.small-button:hover {
  background-color: #e0e0e0;
}
</style>