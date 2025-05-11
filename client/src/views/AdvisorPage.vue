<template>
  <div class="advisor-page">
    <!-- 新增侧边栏 -->
    <div class="sidebar">
      <div class="sidebar-header">
        <h1 class="app-title">AI学习辅导员</h1>
        <button class="new-chat-button">
          <i class="fas fa-plus"></i> 新建对话
        </button>
      </div>
      
      <!-- 历史记录区域 -->
      <div class="history-section">
        <div class="section-title">
          <i class="fas fa-history"></i> 对话历史
        </div>
        <div class="history-list">
          <div class="history-item active">
            <div class="history-item-title">当前对话</div>
            <div class="history-item-date">今天</div>
          </div>
          <!-- 这里会动态加载历史记录 -->
        </div>
      </div>
      
      <!-- 知识库区域 -->
      <div class="knowledge-section">
        <div class="section-title">
          <i class="fas fa-book"></i> 知识库
          <button class="add-knowledge-button" title="创建知识库">
            <i class="fas fa-plus-circle"></i>
          </button>
        </div>
        <div class="knowledge-list">
          <!-- 这里会动态加载知识库列表 -->
          <div class="knowledge-item">
            <i class="fas fa-graduation-cap"></i> 学校课程信息
          </div>
          <div class="knowledge-item">
            <i class="fas fa-clipboard-list"></i> 选课规则
          </div>
        </div>
      </div>
      
      <!-- 底部设置区域 -->
      <div class="sidebar-footer">
        <button class="settings-button">
          <i class="fas fa-cog"></i> 设置
        </button>
      </div>
    </div>

    <!-- 聊天主区域 -->
    <div class="chat-container">
      <!-- 顶部导航条 -->
      <div class="chat-header">
        <button class="menu-toggle" @click="toggleSidebar">
          <i class="fas fa-bars"></i>
        </button>
        <div class="current-chat-info">
          <span>当前对话</span>
          <button class="rename-button" title="重命名">
            <i class="fas fa-edit"></i>
          </button>
        </div>
        <div class="header-actions">
          <button class="clear-chat-button" title="清空对话">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>

      <!-- 消息区域 -->
      <div class="messages-area" ref="messagesArea">
        <div class="welcome-container" v-if="messages.length <= 1">
          <div class="welcome-content">
            <div class="welcome-icon">
              <i class="fas fa-robot"></i>
            </div>
            <h2>你好，我是你的AI学习辅导员</h2>
            <p>我可以帮助你了解课程信息、选课规则和学分要求。你可以问我任何关于学习和选课的问题。</p>
            
            <div class="example-questions">
              <h3>你可以尝试问我：</h3>
              <div class="question-chips">
                <div class="question-chip" @click="useExampleQuestion('电子信息工程专业的核心课程有哪些？')">
                  电子信息工程专业的核心课程有哪些？
                </div>
                <div class="question-chip" @click="useExampleQuestion('计算机科学专业需要修多少学分才能毕业？')">
                  计算机科学专业需要修多少学分才能毕业？
                </div>
                <div class="question-chip" @click="useExampleQuestion('如何选择适合我的选修课？')">
                  如何选择适合我的选修课？
                </div>
                <div class="question-chip" @click="useExampleQuestion('大一应该如何规划学习？')">
                  大一应该如何规划学习？
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 消息气泡 -->
        <div 
          v-for="(message, index) in messages" 
          :key="index" 
          :class="['message-wrapper', message.role === 'user' ? 'user-message-wrapper' : 'advisor-message-wrapper']"
        >
          <div class="message-container">
            <div class="message-avatar" v-if="message.role !== 'user'">
              <i class="fas fa-robot"></i>
            </div>
            <div :class="['message-bubble', message.role === 'user' ? 'user-message' : 'advisor-message']">
              <!-- 如果当前消息正在加载，显示加载动画 -->
              <div v-if="message.isLoading" class="loading-indicator">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
              </div>
              <!-- 否则显示消息内容 -->
              <div v-else class="message-content" v-html="formatMessage(message.content)"></div>
            </div>
            <div class="message-avatar user-avatar" v-if="message.role === 'user'">
              <i class="fas fa-user"></i>
            </div>
          </div>
        </div>
        
        <!-- 滚动到底部指示器 -->
        <div 
          v-if="showScrollButton" 
          class="scroll-button"
          @click="scrollToBottom"
        >
          <i class="fas fa-arrow-down"></i>
        </div>
      </div>
      
      <!-- 输入区域 -->
      <div class="input-area">
        <div class="input-container">
          <textarea 
            v-model="userInput" 
            placeholder="输入你的问题..." 
            @keydown.enter.prevent="sendMessage"
            :disabled="loading"
            rows="1"
            ref="inputField"
            @input="adjustTextareaHeight"
          ></textarea>
          <button 
            class="send-button" 
            @click="sendMessage" 
            :disabled="loading || !userInput.trim()"
          >
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>
        <div class="input-footer">
          <p>AI辅导员正在进行内测阶段，回答仅供参考。请对照学校官方文件验证信息准确性。</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from '@/api/axiosForAssistant';

export default {
  name: 'AdvisorPage',
  data() {
    return {
      messages: [],
      userInput: '',
      loading: false,
      baseURL: '',
      showScrollButton: false,
      lastScrollPosition: 0,
      scrollThreshold: 100, // 滚动阈值
      sidebarVisible: true, // 控制侧边栏显示状态
      currentChatId: null, // 当前对话ID
      chatHistory: [], // 对话历史
      knowledgeBases: [] // 知识库列表
    };
  },
  async mounted() {
    // 添加初始欢迎消息
    this.messages.push({
      role: 'advisor',
      content: '你好！我是你的AI学习辅导员，可以帮你解答关于课程、选课和学分要求的问题。有什么我可以帮助你的吗？',
      isLoading: false
    });
    
    // 在组件挂载时获取 axios 的基础 URL
    this.baseURL = axios.defaults.baseURL || '';
    
    // 滚动监听
    if (this.$refs.messagesArea) {
      this.$refs.messagesArea.addEventListener('scroll', this.handleScroll);
    }
    
    // 调整输入框高度
    this.adjustTextareaHeight();
    
    // 在这里可以添加加载对话历史和知识库列表的方法
    // this.loadChatHistory();
    // this.loadKnowledgeBases();
    
    // 检查屏幕尺寸，在移动设备上默认隐藏侧边栏
    this.checkScreenSize();
    window.addEventListener('resize', this.checkScreenSize);
  },
  beforeUnmount() {
    // 移除滚动监听器
    if (this.$refs.messagesArea) {
      this.$refs.messagesArea.removeEventListener('scroll', this.handleScroll);
    }
    
    // 移除窗口大小监听器
    window.removeEventListener('resize', this.checkScreenSize);
  },
  methods: {
    // 原有方法保持不变
    formatMessage(content) {
      // Markdown 基础格式转换
      const formatted = content
        // 加粗处理
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // 斜体处理
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // 链接处理
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
        // 数字列表处理
        .replace(/(\d+\.\s+.*(?:\n|$))/g, '<div class="list-item">$1</div>')
        // 无序列表处理
        .replace(/(\-\s+.*(?:\n|$))/g, '<div class="list-item bullet">$1</div>')
        // 换行处理
        .replace(/\n/g, '<br>');
      
      // 二次处理列表项的换行
      return formatted.replace(/<br><div class="list-item">/g, '<div class="list-item">');
    },
    
    adjustTextareaHeight() {
      const textarea = this.$refs.inputField;
      if (!textarea) return;
      
      // 重置高度，以便能够准确计算滚动高度
      textarea.style.height = 'auto';
      
      // 设置最大高度 (5行)
      const maxHeight = 20 * 5; // 假设每行约20px
      
      // 计算适合内容的高度
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
    },
    
    useExampleQuestion(question) {
      this.userInput = question;
      this.$nextTick(() => {
        this.adjustTextareaHeight();
        this.$refs.inputField.focus();
      });
    },
    
    handleScroll() {
      if (!this.$refs.messagesArea) return;
      
      const { scrollTop, scrollHeight, clientHeight } = this.$refs.messagesArea;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < this.scrollThreshold;
      
      this.showScrollButton = !isNearBottom;
      this.lastScrollPosition = scrollTop;
    },
    
    scrollToBottom() {
      if (this.$refs.messagesArea) {
        this.$refs.messagesArea.scrollTop = this.$refs.messagesArea.scrollHeight;
      }
    },
    
    sendMessage() {
      if (!this.userInput.trim() || this.loading) return;
      
      this.messages.push({
        role: 'user',
        content: this.userInput.trim(),
        isLoading: false
      });
      
      const question = this.userInput.trim();
      this.userInput = '';
      this.loading = true;
      
      // 调整输入框高度
      this.$nextTick(() => {
        this.adjustTextareaHeight();
        this.scrollToBottom();
      });
      
      // 尝试使用流式接口
      this.tryStreamingRequest(question)
        .catch(() => {
          // 如果流式接口失败，使用原来的非流式接口
          console.log('流式接口失败，使用常规接口');
          return this.useRegularRequest(question);
        })
        .catch((error) => {
          console.error('所有接口都失败了:', error);
          this.messages.push({
            role: 'advisor',
            content: '抱歉，我暂时无法回答您的问题。请稍后再试。',
            isLoading: false
          });
        })
        .finally(() => {
          this.loading = false;
          this.$nextTick(() => {
            this.scrollToBottom();
          });
        });
    },
    
    async tryStreamingRequest(question) {
      const streamUrl = '/advisor/ask-stream';

      // 添加一个新的 AI 消息用于显示流式内容，初始状态为加载中
      const advisorMessageIndex = this.messages.push({
        role: 'advisor',
        content: '',
        isLoading: true
      }) - 1;
      
      // 滚动到新消息
      this.$nextTick(() => {
        this.scrollToBottom();
      });

      // 获取认证token
      const token = localStorage.getItem('token');
      
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // 使用 axios 配置的 baseURL
      const fullUrl = `${this.baseURL}${streamUrl}`;

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ 
          question,
          // 可以在此处添加知识库ID参数，用于指定使用哪个知识库
          knowledgeBaseId: this.activeKnowledgeBaseId
        }),
      });
      
      if (!response.ok) {
        throw new Error('流式接口响应异常');
      }
      
      // 处理 SSE 流
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            break;
          }
          
          // 将新数据添加到缓冲区
          buffer += decoder.decode(value, { stream: true });
          
          // 处理缓冲区中的完整行
          const lines = buffer.split('\n');
          buffer = lines.pop(); // 保留最后一个可能不完整的行
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                switch (data.type) {
                  case 'start':
                    // 开始流式传输
                    break;
                    
                  case 'first_chunk':
                  case 'chunk':
                    // 第一次收到内容时，将加载状态设为false
                    if (this.messages[advisorMessageIndex].isLoading) {
                      this.messages[advisorMessageIndex].isLoading = false;
                    }
                    // 更新消息内容
                    this.messages[advisorMessageIndex].content += data.content;
                    break;
                    
                  case 'end':
                    // 流式传输结束
                    this.messages[advisorMessageIndex].isLoading = false;  // 确保加载状态结束
                    // 保存对话内容到历史记录
                    this.saveConversation();
                    return; // 成功完成
                    
                  case 'error':
                    // 处理错误
                    this.messages[advisorMessageIndex].isLoading = false;
                    if (data.fallbackAnswer) {
                      this.messages[advisorMessageIndex].content = data.fallbackAnswer;
                    }
                    return; // 结束处理
                }
              } catch (parseError) {
                console.error('解析SSE数据失败:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
    
    async useRegularRequest(question) {
      // 添加一个新的 AI 消息用于显示内容，初始状态为加载中
      const advisorMessageIndex = this.messages.push({
        role: 'advisor',
        content: '',
        isLoading: true
      }) - 1;
      
      // 滚动到新消息
      this.$nextTick(() => {
        this.scrollToBottom();
      });
      
      const response = await axios.post('advisor/ask', { 
        question,
        // 可以在此处添加知识库ID参数
        knowledgeBaseId: this.activeKnowledgeBaseId
      });
      
      // 收到响应后，更新消息内容并设置加载状态为false
      this.messages[advisorMessageIndex].isLoading = false;
      this.messages[advisorMessageIndex].content = response.answer || response.data?.answer || response || "收到响应但格式不正确";
      
      // 保存对话内容到历史记录
      this.saveConversation();
    },
    
    // 新增的方法
    toggleSidebar() {
      this.sidebarVisible = !this.sidebarVisible;
    },
    
    checkScreenSize() {
      // 在移动设备上默认隐藏侧边栏
      if (window.innerWidth < 768) {
        this.sidebarVisible = false;
      } else {
        this.sidebarVisible = true;
      }
    },
    
    // 创建新对话
    createNewChat() {
      // 生成新对话ID
      this.currentChatId = Date.now().toString();
      // 清空当前消息
      this.messages = [];
      // 添加初始欢迎消息
      this.messages.push({
        role: 'advisor',
        content: '你好！我是你的AI学习辅导员，可以帮你解答关于课程、选课和学分要求的问题。有什么我可以帮助你的吗？',
        isLoading: false
      });
    },
    
    // 保存当前对话到历史记录
    saveConversation() {
      // 实现保存对话逻辑
      if (!this.currentChatId) {
        this.currentChatId = Date.now().toString();
      }
      
      // 这里可以调用API保存对话，或者保存到本地存储
      // ...
    },
    
    // 加载历史对话
    loadChatHistory() {
      // 实现加载历史对话的逻辑
      // 这里可以调用API获取历史对话列表
      // ...
    },
    
    // 切换到指定的历史对话
    switchChat(chatId) {
      // 保存当前对话
      this.saveConversation();
      
      // 加载指定ID的对话
      this.currentChatId = chatId;
      // 这里可以调用API获取对话内容
      // ...
    },
    
    // 创建新知识库
    createKnowledgeBase() {
      // 实现创建知识库的逻辑
      // ...
    },
    
    // 加载知识库列表
    loadKnowledgeBases() {
      // 实现加载知识库列表的逻辑
      // ...
    },
    
    // 切换使用的知识库
    setActiveKnowledgeBase(knowledgeBaseId) {
      this.activeKnowledgeBaseId = knowledgeBaseId;
      // 可以在这里添加切换知识库的提示
      // ...
    }
  }
};
</script>

<style scoped>
.advisor-page {
  display: flex;
  height: 100%;
  width: 100%;
  background-color: #f9f9f9;
  overflow: hidden;
}

/* 侧边栏样式 */
.sidebar {
  width: 280px;
  flex-shrink: 0;
  background-color: #f5f5f5;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  height: 100%;
  transition: transform 0.3s ease;
  z-index: 10;
}

/* 响应式设计：当侧边栏隐藏时的样式 */
@media (max-width: 768px) {
  .sidebar {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    transform: translateX(-100%);
  }
  
  .sidebar.visible {
    transform: translateX(0);
  }
}

.sidebar-header {
  padding: 1.5rem 1rem;
  border-bottom: 1px solid #e0e0e0;
}

.app-title {
  font-size: 1.5rem;
  margin: 0 0 1rem 0;
  font-weight: 600;
  color: #333;
}

.new-chat-button {
  width: 100%;
  padding: 0.75rem;
  background-color: #5E35B1;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: background-color 0.2s;
}

.new-chat-button:hover {
  background-color: #4527A0;
}

.history-section, .knowledge-section {
  padding: 1rem;
  flex: 1;
  overflow-y: auto;
  border-bottom: 1px solid #e0e0e0;
}

.section-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: #555;
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title i {
  margin-right: 0.5rem;
}

.history-list, .knowledge-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.history-item, .knowledge-item {
  padding: 0.75rem;
  border-radius: 8px;
  background-color: white;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 0.9rem;
  color: #333;
  display: flex;
  flex-direction: column;
}

.history-item:hover, .knowledge-item:hover {
  background-color: #e8e8e8;
}

.history-item.active {
  background-color: #e3f2fd;
  border-left: 3px solid #2196F3;
}

.history-item-title {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-item-date {
  font-size: 0.8rem;
  color: #666;
  margin-top: 0.25rem;
}

.knowledge-item {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

.knowledge-item i {
  color: #5E35B1;
}

.add-knowledge-button {
  background: none;
  border: none;
  color: #5E35B1;
  cursor: pointer;
  padding: 0;
  font-size: 1rem;
}

.add-knowledge-button:hover {
  color: #4527A0;
}

.sidebar-footer {
  padding: 1rem;
  border-top: 1px solid #e0e0e0;
}

.settings-button {
  width: 100%;
  padding: 0.75rem;
  background-color: #f0f0f0;
  color: #333;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: background-color 0.2s;
}

.settings-button:hover {
  background-color: #e0e0e0;
}

/* 聊天容器样式 */
.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: white;
  position: relative;
}

.chat-header {
  padding: 1rem;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  background-color: white;
  z-index: 5;
}

.menu-toggle {
  background: none;
  border: none;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  color: #555;
  cursor: pointer;
  margin-right: 1rem;
}

.menu-toggle:hover {
  color: #333;
}

.current-chat-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
}

.rename-button {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 0;
  font-size: 0.9rem;
}

.rename-button:hover {
  color: #333;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.clear-chat-button {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-chat-button:hover {
  color: #ff3333;
}

/* 保留原有的消息区域、输入区域等样式 */
.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  scroll-behavior: smooth;
  position: relative;
}

.message-wrapper {
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
}

.message-container {
  display: flex;
  align-items: flex-start;
}

.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: #5E35B1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  margin-right: 12px;
  flex-shrink: 0;
}

.user-avatar {
  background-color: #2196F3;
  margin-left: 12px;
  margin-right: 0;
}

.message-bubble {
  padding: 1rem 1.2rem;
  border-radius: 1.2rem;
  max-width: 80%;
  position: relative;
}

.advisor-message {
  background-color: #f0f0f0;
  color: #333;
  border-top-left-radius: 4px;
}

.user-message {
  background-color: #2196F3;
  color: white;
  border-top-right-radius: 4px;
  align-self: flex-end;
}

.user-message-wrapper {
  align-items: flex-end;
}

.advisor-message-wrapper {
  align-items: flex-start;
}

.message-content {
  white-space: pre-wrap;
  line-height: 1.5;
  font-size: 0.95rem;
}

/* 加粗文本样式 */
.message-content :deep(strong) {
  font-weight: 600;
}

/* 斜体文本样式 */
.message-content :deep(em) {
  font-style: italic;
}

/* 链接样式 */
.message-content :deep(a) {
  color: #5E35B1;
  text-decoration: underline;
}

.user-message .message-content :deep(a) {
  color: #fff;
}

/* 列表项样式 */
.message-content :deep(.list-item) {
  margin: 8px 0;
  padding-left: 24px;
  position: relative;
  line-height: 1.6;
}

.message-content :deep(.list-item.bullet::before) {
  content: "•";
  position: absolute;
  left: 8px;
  font-weight: bold;
}

/* 调整用户消息中的样式 */
.user-message .message-content :deep(strong) {
  color: #e3f2fd;
}

.input-area {
  padding: 1rem;
  border-top: 1px solid #eee;
  background-color: white;
}

.input-container {
  display: flex;
  background-color: #f5f5f5;
  border-radius: 24px;
  padding: 8px 16px;
}

textarea {
  flex: 1;
  border: none;
  background: transparent;
  resize: none;
  outline: none;
  padding: 8px 0;
  font-family: inherit;
  font-size: 0.95rem;
  max-height: 120px;
  overflow-y: auto;
}

.send-button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #5E35B1;
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-left: 8px;
  transition: all 0.2s;
}

.send-button:hover {
  background-color: #4527A0;
}

.send-button:disabled {
  background-color: #c0c0c0;
  cursor: not-allowed;
}

.input-footer {
  margin-top: 8px;
  font-size: 0.75rem;
  color: #666;
  text-align: center;
}

/* 加载动画 */
.loading-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 24px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #888;
  margin: 0 4px;
  animation: pulse 1.5s infinite ease-in-out;
}

.dot:nth-child(2) {
  animation-delay: 0.3s;
}

.dot:nth-child(3) {
  animation-delay: 0.6s;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.4;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

/* 欢迎页面样式 */
.welcome-container {
  display: flex;
  justify-content: center;
  padding: 2rem 1rem;
}

.welcome-content {
  max-width: 600px;
  text-align: center;
}

.welcome-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background-color: #5E35B1;
  color: white;
  font-size: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
}

.welcome-content h2 {
  margin-bottom: 1rem;
  color: #333;
}

.welcome-content p {
  color: #666;
  margin-bottom: 2rem;
}

.example-questions {
  margin-top: 2rem;
  text-align: left;
}

.example-questions h3 {
  font-size: 1rem;
  margin-bottom: 1rem;
  color: #555;
}

.question-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.question-chip {
  background-color: #f0f0f0;
  border-radius: 16px;
  padding: 8px 16px;
  font-size: 0.9rem;
  color: #5E35B1;
  cursor: pointer;
  transition: all 0.2s;
}

.question-chip:hover {
  background-color: #e0e0e0;
}

/* 滚动按钮 */
.scroll-button {
  position: absolute;
  bottom: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #5E35B1;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 10;
  transition: all 0.2s ease;
}

.scroll-button:hover {
  background-color: #4527A0;
  transform: translateY(-2px);
}
</style>