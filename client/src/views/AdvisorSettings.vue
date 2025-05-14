<template>
  <div class="advisor-settings">
    <!-- 顶部导航栏 -->
    <div class="settings-header">
      <button class="back-button" @click="goBack">
        <i class="fas fa-arrow-left"></i>
      </button>
      <h1>AI辅导员设置</h1>
    </div>

    <!-- 设置表单 -->
    <div class="settings-container">
      <!-- 在保存/重置消息时显示提示 -->
      <div v-if="showMessage" class="settings-message" :class="messageType">
        <i :class="['fas', messageType === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle']"></i>
        {{ message }}
      </div>

      <div class="settings-section">
        <h2>AI 辅导员个性化</h2>
        <div class="form-group">
          <label for="aiName">AI名称</label>
          <input id="aiName" type="text" v-model="settings.aiName" placeholder="例如：学习助手、课程顾问" />
        </div>

        <div class="form-group">
          <label for="aiDescription">AI描述</label>
          <textarea 
            id="aiDescription" 
            v-model="settings.aiDescription" 
            placeholder="描述这个AI辅导员的特点和擅长领域..."
            rows="3"
          ></textarea>
        </div>
      </div>

      <!-- 系统提示词设置 -->
      <div class="settings-section">
        <h2>
          系统提示词设置
          <span class="section-help" @click="toggleHelp('prompt')">
            <i class="fas fa-question-circle"></i>
          </span>
        </h2>
        <div v-if="helpSections.prompt" class="help-panel">
          <p>提示词是指导AI行为的指令。系统提示词是每次对话开始时发送给AI的基础指令，会影响AI的整体表现和回答风格。</p>
          <p>例如：<em>"你是一名专业的学校辅导员，专门帮助学生解答选课和专业学习相关的问题..."</em></p>
        </div>
        
        <div class="form-group">
          <label for="systemPrompt">系统提示词</label>
          <textarea 
            id="systemPrompt" 
            v-model="settings.systemPrompt" 
            placeholder="输入系统提示词..." 
            rows="6"
          ></textarea>
        </div>
        
        <div class="form-group">
          <button @click="resetSystemPrompt" class="secondary-button">
            <i class="fas fa-undo"></i> 恢复默认提示词
          </button>
        </div>
      </div>

      <!-- AI参数设置 -->
      <div class="settings-section">
        <h2>
          AI参数设置
          <span class="section-help" @click="toggleHelp('parameters')">
            <i class="fas fa-question-circle"></i>
          </span>
        </h2>
        <div v-if="helpSections.parameters" class="help-panel">
          <p><strong>温度</strong>：控制输出的随机性。较低的值使回答更确定，较高的值使回答更多样化。</p>
          <p><strong>最大token数</strong>：限制回答的长度。</p>
        </div>
        
        <div class="form-group slider-group">
          <label for="temperature">温度（随机性）：{{ settings.temperature }}</label>
          <div class="slider-with-labels">
            <span>确定 0</span>
            <input 
              id="temperature" 
              type="range" 
              v-model.number="settings.temperature" 
              min="0" 
              max="1" 
              step="0.1" 
            />
            <span>创意 1</span>
          </div>
        </div>
        
        <div class="form-group slider-group">
          <label for="maxTokens">最大令牌数：{{ settings.maxTokens }}</label>
          <div class="slider-with-labels">
            <span>短 500</span>
            <input 
              id="maxTokens" 
              type="range" 
              v-model.number="settings.maxTokens" 
              min="500" 
              max="2000" 
              step="100" 
            />
            <span>长 2000</span>
          </div>
        </div>
      </div>

      <!-- 高级设置：会话历史长度 -->
      <div class="settings-section">
        <h2>
          高级设置
          <span class="section-help" @click="toggleHelp('advanced')">
            <i class="fas fa-question-circle"></i>
          </span>
        </h2>
        <div v-if="helpSections.advanced" class="help-panel">
          <p><strong>历史消息数量</strong>：AI回答时考虑的历史消息数量。数量越多AI越能理解上下文，但消耗的资源也越多。</p>
        </div>
        
        <div class="form-group slider-group">
          <label for="historyLength">历史消息数量：{{ settings.historyLength }}</label>
          <div class="slider-with-labels">
            <span>少 5</span>
            <input 
              id="historyLength" 
              type="range" 
              v-model.number="settings.historyLength" 
              min="5" 
              max="20" 
              step="1" 
            />
            <span>多 20</span>
          </div>
        </div>
      </div>

      <!-- 保存按钮 -->
      <div class="settings-actions">
        <button @click="resetAllSettings" class="danger-button">
          <i class="fas fa-undo"></i> 重置所有设置
        </button>
        <button @click="saveSettings" class="primary-button">
          <i class="fas fa-save"></i> 保存设置
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import axios from '@/api/axiosForAssistant';

export default {
  name: 'AdvisorSettings',
  data() {
    return {
      settings: {
        aiName: '学习辅导员',
        aiDescription: '专门帮助学生解答选课和专业学习相关的问题',
        systemPrompt: '',
        temperature: 0.7,
        maxTokens: 1000,
        historyLength: 10
      },
      defaultSettings: {
        aiName: '学习辅导员',
        aiDescription: '专门帮助学生解答选课和专业学习相关的问题',
        systemPrompt: '你是一名专业的学校辅导员，专门帮助学生解答选课和专业学习相关的问题。你掌握了各专业的培养方案、课程设置和学分要求等信息。\n\n你的职责是：\n1. 帮助学生了解各专业的培养方案、课程设置和学分要求\n2. 解答学生关于选课、课程内容、学分要求等问题\n3. 提供合理的学习规划和建议\n4. 解释课程之间的关联和先修要求\n\n在回答问题时，请提供准确、全面且易于理解的解答。如果学生询问的信息不在你知识范围内，请礼貌地告知并建议他们咨询教务处或相关学院。\n\n请记住我们之前的对话内容，保持连贯性。如果学生的问题涉及到之前讨论过的内容，请基于之前的对话进行回答。',
        temperature: 0.7,
        maxTokens: 1000,
        historyLength: 10
      },
      helpSections: {
        prompt: false,
        parameters: false,
        advanced: false
      },
      showMessage: false,
      messageType: 'success',
      message: '',
      loading: false
    };
  },
  mounted() {
    this.loadSettings();
  },
  methods: {
    // 加载设置
    async loadSettings() {
      try {
        this.loading = true;
        const response = await axios.get('/advisor/settings');
        
        if (response.data && response.data.success) {
          // 合并服务器设置和默认设置
          this.settings = {
            ...this.defaultSettings,
            ...response.data.settings
          };
        } else {
          // 如果没有保存的设置，使用默认设置
          this.settings = {...this.defaultSettings};
        }
      } catch (error) {
        console.error('加载设置失败:', error);
        this.showMessageAlert('加载设置失败，使用默认设置', 'error');
        this.settings = {...this.defaultSettings};
      } finally {
        this.loading = false;
      }
    },
    
    // 保存设置
    async saveSettings() {
      try {
        this.loading = true;
        const response = await axios.post('/advisor/settings', this.settings);
        
        if (response.data && response.data.success) {
          this.showMessageAlert('设置保存成功', 'success');
        } else {
          this.showMessageAlert('设置保存失败: ' + (response.data?.error || '未知错误'), 'error');
        }
      } catch (error) {
        console.error('保存设置失败:', error);
        this.showMessageAlert('保存设置失败: ' + (error.message || '未知错误'), 'error');
      } finally {
        this.loading = false;
      }
    },
    
    // 重置系统提示词
    resetSystemPrompt() {
      this.settings.systemPrompt = this.defaultSettings.systemPrompt;
      this.showMessageAlert('系统提示词已重置为默认值', 'success');
    },
    
    // 重置所有设置
    resetAllSettings() {
      // 确认重置
      if (confirm('确定要重置所有设置为默认值吗？')) {
        this.settings = {...this.defaultSettings};
        this.showMessageAlert('所有设置已重置为默认值', 'success');
      }
    },
    
    // 显示消息提示
    showMessageAlert(message, type = 'success') {
      this.message = message;
      this.messageType = type;
      this.showMessage = true;
      
      // 3秒后自动隐藏消息
      setTimeout(() => {
        this.showMessage = false;
      }, 3000);
    },
    
    // 切换帮助面板
    toggleHelp(section) {
      this.helpSections[section] = !this.helpSections[section];
    },
    
    // 返回上一页
    goBack() {
      this.$router.push('/advisor');
    }
  }
};
</script>

<style scoped>
.advisor-settings {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f8f9fa;
}

.settings-header {
  background-color: #5E35B1;
  color: white;
  padding: 1rem;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.back-button {
  background: none;
  border: none;
  color: white;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-right: 15px;
}

.back-button:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.settings-header h1 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
}

.settings-container {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.settings-message {
  padding: 10px 15px;
  border-radius: 8px;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.settings-message.success {
  background-color: #e8f5e9;
  color: #2e7d32;
}

.settings-message.error {
  background-color: #ffebee;
  color: #c62828;
}

.settings-section {
  background-color: white;
  border-radius: 10px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.settings-section h2 {
  margin-top: 0;
  margin-bottom: 1.2rem;
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-help {
  cursor: pointer;
  color: #5E35B1;
  font-size: 1rem;
}

.help-panel {
  background-color: #f5f5f5;
  border-radius: 8px;
  padding: 12px 15px;
  margin-bottom: 15px;
  font-size: 0.9rem;
  color: #555;
}

.help-panel p {
  margin: 8px 0;
}

.form-group {
  margin-bottom: 1.2rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #444;
}

.form-group input[type="text"],
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.95rem;
  transition: border-color 0.2s;
}

.form-group input[type="text"]:focus,
.form-group textarea:focus {
  border-color: #5E35B1;
  outline: none;
  box-shadow: 0 0 0 2px rgba(94, 53, 177, 0.1);
}

.slider-group {
  margin-bottom: 1.5rem;
}

.slider-with-labels {
  display: flex;
  align-items: center;
  gap: 10px;
}

.slider-with-labels span {
  color: #666;
  font-size: 0.8rem;
  min-width: 60px;
}

.slider-with-labels input[type="range"] {
  flex: 1;
  width: 100%;
  margin: 0;
  height: 5px;
  -webkit-appearance: none;
  appearance: none;
  background: #ddd;
  border-radius: 5px;
  outline: none;
}

.slider-with-labels input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #5E35B1;
  cursor: pointer;
}

.settings-actions {
  display: flex;
  justify-content: flex-end;
  gap: 15px;
  margin-top: 20px;
}

.primary-button,
.secondary-button,
.danger-button {
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 0.95rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
  border: none;
}

.primary-button {
  background-color: #5E35B1;
  color: white;
}

.primary-button:hover {
  background-color: #4527A0;
}

.secondary-button {
  background-color: #f5f5f5;
  color: #333;
}

.secondary-button:hover {
  background-color: #e0e0e0;
}

.danger-button {
  background-color: #ffebee;
  color: #c62828;
}

.danger-button:hover {
  background-color: #ffcdd2;
}

@media (max-width: 768px) {
  .settings-container {
    padding: 1rem;
  }
  
  .settings-section {
    padding: 1rem;
  }
  
  .settings-actions {
    flex-direction: column-reverse;
  }
  
  .settings-actions button {
    width: 100%;
  }
}
</style>