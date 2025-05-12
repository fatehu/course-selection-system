<template>
  <div class="advisor-page">
    <!-- 侧边栏 -->
    <div class="sidebar" :class="{ 'visible': sidebarVisible }">
      <div class="sidebar-header">
        <h1 class="app-title">AI学习辅导员</h1>
        <button class="new-chat-button" @click="createNewChat">
          <i class="fas fa-plus"></i> 新建对话
        </button>
        <!-- Add close sidebar button inside sidebar -->
        <button class="close-sidebar-button" @click="toggleSidebar">
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <!-- 历史记录区域 -->
      <div class="history-section">
        <div class="section-title">
          <i class="fas fa-history"></i> 对话历史
        </div>
        <div class="history-list">
          <div class="history-item" 
               :class="{ active: !currentChatId }"
               @click="createNewChat">
            <div class="history-item-title">新建对话</div>
          </div>
          
          <div v-if="chatHistory.length === 0 && hasLoadedHistory" class="empty-history">
            <p>暂无历史对话</p>
          </div>
          
          <!-- 在历史对话列表中 -->
          <div v-for="chat in chatHistory" 
              :key="chat.id" 
              class="history-item"
              :class="{ active: currentChatId === chat.id }">
            
            <div class="history-item-content" @click="switchChat(chat.id)">
              <div class="history-item-title">{{ chat.title || '未命名对话' }}</div>
              <div class="history-item-date">{{ formatDate(chat.updatedAt) }}</div>
            </div>
            
            <!-- 三点菜单按钮 -->
            <div class="history-item-actions">
              <div class="more-actions" @click.stop="showActionMenu(chat, $event)">
                <i class="fas fa-ellipsis-v"></i>
              </div>
              
              <!-- 下拉菜单 -->
              <div v-if="activeMenu === chat.id" class="action-menu">
                <div class="action-item" @click.stop="showRenameConfirm(chat)">
                  <i class="fas fa-edit"></i> 重命名
                </div>
                <div class="action-item delete-action" @click.stop="showDeleteConfirm(chat)">
                  <i class="fas fa-trash-alt"></i> 删除
                </div>
              </div>
            </div>
          </div>
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
      <!-- 图标按钮替代头部 -->
      <button class="menu-toggle" @click="toggleSidebar">
        <i class="fas fa-bars"></i>
      </button>

      <!-- 消息区域 -->
      <div class="messages-area" ref="messagesArea">
        <div class="welcome-container" v-if="messages.length <= 1 && !currentChatId">
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

    <!-- 新的删除/重命名确认对话框 (Claude风格) -->
    <div class="claude-modal-overlay" v-if="showModal" @click.self="cancelModal">
      <div class="claude-modal-container">
        <h3 class="claude-modal-title">{{ modalType === 'delete' ? '删除对话？' : '重命名对话' }}</h3>
        
        <div class="claude-modal-content">
          <!-- 重命名表单 -->
          <div v-if="modalType === 'rename'">
            <input 
              type="text" 
              v-model="newTitle" 
              class="claude-rename-input" 
              placeholder="输入新标题" 
              ref="renameInput"
              @keyup.enter="confirmModal"
            >
          </div>
          
          <!-- 删除确认 -->
          <p v-if="modalType === 'delete'">
            确定要删除此对话吗？
          </p>
        </div>
        
        <div class="claude-modal-actions">
          <button class="claude-cancel-button" @click="cancelModal">取消</button>
          <button 
            :class="['claude-confirm-button', modalType === 'delete' ? 'claude-delete-button' : '']" 
            @click="confirmModal"
          >
            {{ modalType === 'rename' ? '确认' : '删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from '@/api/axiosForAssistant';
import advisorApi from '@/services/advisor'; 
import { inject, watch } from 'vue'

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
      sidebarVisible: false, // 默认隐藏侧边栏
      currentChatId: null, // 当前会话ID
      chatHistory: [], // 对话历史
      hasLoadedHistory: false, // 是否已加载历史会话
      knowledgeBases: [], // 知识库列表
      activeKnowledgeBaseId: null, // 当前使用的知识库ID
      activeMenu: null, // 当前激活的菜单ID
      showModal: false, // 是否显示模态框
      modalType: '', // 模态框类型: 'rename' 或 'delete'
      modalTitle: '', // 模态框标题
      selectedChat: null, // 当前选中的对话
      newTitle: '', // 重命名输入
    };
  },
  computed: {
    // 当前会话标题
    currentChatTitle() {
      if (!this.currentChatId) {
        return '新对话';
      }
      
      const currentChat = this.chatHistory.find(chat => chat.id === this.currentChatId);
      return currentChat ? (currentChat.title || '未命名对话') : '当前对话';
    }
  },
  setup() {
    const updateAdvisorChatTitle = inject('updateAdvisorChatTitle')
    
    return {
      updateAdvisorChatTitle
    }
  },
  watch: {
      currentChatTitle: {
      handler(newTitle) {
        this.updateAdvisorChatTitle(newTitle)
      },
      immediate: true
    }
  },
  beforeUnmount() {
    this.updateAdvisorChatTitle('')
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
    
    // 加载对话历史
    await this.loadChatHistory();
    
    // 不再根据屏幕尺寸自动显示侧边栏
    window.addEventListener('resize', this.handleResize);
  },
  beforeUnmount() {
    // 移除滚动监听器
    if (this.$refs.messagesArea) {
      this.$refs.messagesArea.removeEventListener('scroll', this.handleScroll);
    }
    
    // 移除窗口大小监听器
    window.removeEventListener('resize', this.handleResize);
  },
  methods: {
    // 格式化消息内容
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
    
    // 调整文本输入框高度
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
    
    // 使用示例问题
    useExampleQuestion(question) {
      this.userInput = question;
      this.$nextTick(() => {
        this.adjustTextareaHeight();
        this.$refs.inputField.focus();
      });
    },
    
    // 处理滚动事件
    handleScroll() {
      if (!this.$refs.messagesArea) return;
      
      const { scrollTop, scrollHeight, clientHeight } = this.$refs.messagesArea;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < this.scrollThreshold;
      
      this.showScrollButton = !isNearBottom;
      this.lastScrollPosition = scrollTop;
    },
    
    // 监听窗口大小变化
    handleResize() {
      // 不再自动改变侧边栏可见性
    },
    
    // 滚动到底部
    scrollToBottom() {
      if (this.$refs.messagesArea) {
        this.$refs.messagesArea.scrollTop = this.$refs.messagesArea.scrollHeight;
      }
    },
    
    // 发送消息
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
      
      // 尝试使用流式接口，传递当前会话ID
      this.tryStreamingRequest(question, this.currentChatId)
        .catch((error) => {
          // 如果流式接口失败，使用原来的非流式接口
          console.log('流式接口失败，使用常规接口', error);
          return this.useRegularRequest(question, this.currentChatId);
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
    
    // 流式请求方法
    async tryStreamingRequest(question, sessionId) {
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
      console.log('发送流式请求:', fullUrl, { question, sessionId });

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ 
          question,
          sessionId,
          knowledgeBaseId: this.activeKnowledgeBaseId
        }),
      });
      
      if (!response.ok) {
        throw new Error('流式接口响应异常: ' + response.status);
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
                    console.log('开始流式传输');
                    break;
                    
                  case 'first_chunk':
                  case 'chunk':
                    // 保存会话ID
                    if (data.sessionId && !this.currentChatId) {
                      this.currentChatId = data.sessionId;
                      console.log('获取会话ID:', this.currentChatId);
                      // 刷新会话历史
                      this.loadChatHistory();
                    }
                    
                    // 第一次收到内容时，将加载状态设为false
                    if (this.messages[advisorMessageIndex].isLoading) {
                      this.messages[advisorMessageIndex].isLoading = false;
                    }
                    // 更新消息内容
                    this.messages[advisorMessageIndex].content += data.content;
                    break;
                    
                  case 'end':
                    console.log('流式传输结束');
                    // 保存会话ID
                    if (data.sessionId) {
                      // 如果尚未设置会话ID则设置
                      if (!this.currentChatId) {
                        this.currentChatId = data.sessionId;
                      }
                      console.log('获取会话ID:', this.currentChatId);
                      // 刷新会话历史
                      this.loadChatHistory();

                      // 判断是否需要生成标题（第一条用户消息）
                      const userMessages = this.messages.filter(m => m.role === 'user').length;
                      if (userMessages === 1) {
                        this.generateTitle(this.currentChatId);
                      }
                    }
                    
                    // 流式传输结束
                    this.messages[advisorMessageIndex].isLoading = false;
                    return; // 结束处理
                    
                  case 'error':
                    console.error('流式传输错误:', data.error);
                    // 处理错误
                    this.messages[advisorMessageIndex].isLoading = false;
                    if (data.fallbackAnswer) {
                      this.messages[advisorMessageIndex].content = data.fallbackAnswer;
                    }
                    return; // 结束处理
                }
              } catch (parseError) {
                console.error('解析SSE数据失败:', parseError, line);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    },

    // 自动生成标题
    async generateTitle(sessionId) {
      try {
        console.log('尝试为会话生成标题:', sessionId);
        const response = await advisorApi.generateConversationTitle(sessionId);
        console.log('标题生成响应:', response.data);
        
        if (response.data && response.data.success) {
          console.log('标题生成成功:', response.data.title);
          // 更新当前显示的标题
          const currentChat = this.chatHistory.find(chat => chat.id === sessionId);
          if (currentChat) {
            currentChat.title = response.data.title;
          }
          // 刷新会话列表
          this.loadChatHistory();
        }
      } catch (error) {
        console.error('生成标题失败:', error);
      }
    },

    // 显示重命名对话框
    showRenameDialog() {
      if (!this.currentChatId) return;
      
      const currentChat = this.chatHistory.find(chat => chat.id === this.currentChatId);
      if (currentChat) {
        const title = prompt('请输入新的会话标题:', currentChat.title || '');
        if (title !== null && title.trim() !== '') {
          this.renameConversation(this.currentChatId, title.trim());
        }
      }
    },
    
    // 重命名会话
    async renameConversation(sessionId, newTitle) {
      try {
        console.log('重命名会话:', sessionId, '新标题:', newTitle);
        const response = await advisorApi.renameConversation(sessionId, newTitle);
        console.log('重命名响应:', response.data);
        
        if (response.data && response.data.success) {
          console.log('重命名成功');
          // 更新当前显示的标题
          const currentChat = this.chatHistory.find(chat => chat.id === sessionId);
          if (currentChat) {
            currentChat.title = newTitle;
          }
          // 刷新会话列表
          this.loadChatHistory();
        }
      } catch (error) {
        console.error('重命名失败:', error);
      }
    },

    // 常规请求方法
    async useRegularRequest(question, sessionId) {
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
      
      console.log('发送常规请求:', { question, sessionId });
      const response = await axios.post('/advisor/ask', { 
        question,
        sessionId,
        knowledgeBaseId: this.activeKnowledgeBaseId
      });
      
      console.log('收到常规响应:', response.data);
      
      // 保存会话ID
      if (response.data && response.data.sessionId) {
        this.currentChatId = response.data.sessionId;
        console.log('获取会话ID:', this.currentChatId);
        
        // 如果成功回答，刷新会话历史
        this.loadChatHistory();
        
        // 如果是第一条消息，生成标题
        if (this.messages.length <= 3) {
          this.generateTitle(this.currentChatId);
        }
      }
      
      // 收到响应后，更新消息内容并设置加载状态为false
      this.messages[advisorMessageIndex].isLoading = false;
      this.messages[advisorMessageIndex].content = response.data?.answer || "收到响应但格式不正确";
    },
    
    // 切换侧边栏显示状态
    toggleSidebar() {
      this.sidebarVisible = !this.sidebarVisible;
    },
    
    // 不再检查屏幕尺寸自动调整侧边栏
    // 移除checkScreenSize方法，由toggleSidebar方法完全控制侧边栏显示
    
    // 创建新对话
    createNewChat() {
      // 清空当前会话ID
      this.currentChatId = null;
      // 清空当前消息
      this.messages = [{
        role: 'advisor',
        content: '你好！我是你的AI学习辅导员，可以帮你解答关于课程、选课和学分要求的问题。有什么我可以帮助你的吗？',
        isLoading: false
      }];
    },
    
    // 清空当前会话
    async clearCurrentChat() {
      if (!confirm('确定要删除当前对话吗？此操作不可恢复。')) {
        return;
      }
      
      if (this.currentChatId) {
        try {
          console.log('删除会话:', this.currentChatId);
          const response = await advisorApi.deleteConversation(this.currentChatId);
          console.log('删除响应:', response.data);
          
          if (response.data && response.data.success) {
            console.log('会话删除成功');
            this.createNewChat();
            this.loadChatHistory();
          } else {
            console.error('删除失败:', response.data?.error || '未知错误');
            // 如果API调用失败，只清空本地消息
            this.createNewChat();
          }
        } catch (error) {
          console.error('删除会话失败:', error);
          // 发生错误时仍然清空本地消息
          this.createNewChat();
        }
      } else {
        // 如果没有当前会话ID，只需重置本地状态
        this.createNewChat();
      }
    },
    
    // 加载会话历史
    async loadChatHistory() {
      try {
        console.log('加载会话历史...');
        const response = await advisorApi.getUserConversations();
        console.log('会话历史响应:', response.data);
        
        if (response.data && response.data.success) {
          this.chatHistory = response.data.conversations || [];
          this.hasLoadedHistory = true;
          console.log('历史加载完成,共', this.chatHistory.length, '个会话');
        }
      } catch (error) {
        console.error('加载会话历史失败:', error);
      }
    },
    
    // 加载特定会话
    async loadConversation(sessionId) {
      try {
        console.log('加载会话:', sessionId);
        this.loading = true;
        const response = await advisorApi.getConversationMessages(sessionId);
        console.log('会话加载响应:', response.data);
        
        if (response.data && response.data.success) {
          const conversation = response.data.conversation;
          this.currentChatId = sessionId;
          
          // 清空当前消息并加载会话消息
          this.messages = conversation.messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'advisor',
            content: msg.content,
            isLoading: false
          }));
          
          // 如果没有消息，添加欢迎消息
          if (this.messages.length === 0) {
            this.messages.push({
              role: 'advisor',
              content: '你好！我是你的AI学习辅导员，可以帮你解答关于课程、选课和学分要求的问题。有什么我可以帮助你的吗？',
              isLoading: false
            });
          }
        }
      } catch (error) {
        console.error('加载会话失败:', error);
        // 如果加载失败，显示默认欢迎消息
        this.messages = [{
          role: 'advisor',
          content: '你好！我是你的AI学习辅导员，可以帮你解答关于课程、选课和学分要求的问题。有什么我可以帮助你的吗？',
          isLoading: false
        }];
      } finally {
        this.loading = false;
        this.$nextTick(() => {
          this.scrollToBottom();
        });
      }
    },
    
    // 切换到指定的历史对话
    switchChat(chatId) {
      if (this.currentChatId === chatId) return;
      this.loadConversation(chatId);
    },
    
    // 格式化日期
    formatDate(timestamp) {
      if (!timestamp) return '';
      
      const date = new Date(timestamp);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const isYesterday = new Date(now - 86400000).toDateString() === date.toDateString();
      
      if (isToday) {
        return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      } else if (isYesterday) {
        return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      } else {
        return `${date.getMonth() + 1}月${date.getDate()}日`;
      }
    },
    
    // 设置使用的知识库
    setActiveKnowledgeBase(knowledgeBaseId) {
      this.activeKnowledgeBaseId = knowledgeBaseId;
      // 可以在这里添加切换知识库的提示
      console.log('切换到知识库:', knowledgeBaseId);
    },

  // 显示操作菜单
  showActionMenu(chat, event) {
    // 阻止事件冒泡
    if (event) event.stopPropagation();
    
    // 如果当前有打开的菜单且点击的是同一个项目，则关闭
    if (this.activeMenu === chat.id) {
      this.activeMenu = null;
    } else {
      this.activeMenu = chat.id;
    }
    
    // 点击其他区域关闭菜单
    const closeMenu = (e) => {
      this.activeMenu = null;
      document.removeEventListener('click', closeMenu);
    };
    
    setTimeout(() => {
      document.addEventListener('click', closeMenu);
    }, 0);
  },
  
    // 显示重命名确认框
    showRenameConfirm(chat) {
      if (!chat) return;
      this.selectedChat = chat;
      this.modalType = 'rename';
      this.modalTitle = '重命名对话';
      this.newTitle = chat.title || '';
      this.showModal = true;
      
      // 聚焦输入框
      this.$nextTick(() => {
        if (this.$refs.renameInput) {
          this.$refs.renameInput.focus();
        }
      });
    },
    
    // 显示删除确认框
    showDeleteConfirm(chat) {
      if (!chat) return;
      this.selectedChat = chat;
      this.modalType = 'delete';
      this.modalTitle = '删除对话';
      this.showModal = true;
    },
    
    // 取消模态框
    cancelModal() {
      this.showModal = false;
      this.selectedChat = null;
      this.newTitle = '';
    },
    
    // 确认模态框操作
    confirmModal() {
      if (!this.selectedChat) return;
      
      if (this.modalType === 'rename') {
        // 处理重命名
        if (this.newTitle.trim()) {
          this.renameConversation(this.selectedChat.id, this.newTitle.trim());
        }
      } else if (this.modalType === 'delete') {
        // 处理删除
        this.deleteConversation(this.selectedChat.id);
      }
      
      this.showModal = false;
      this.selectedChat = null;
      this.newTitle = '';
    },
    
    // 删除会话 - 保留原有完善处理
    async deleteConversation(chatId) {
      try {
        console.log('删除会话:', chatId);
        const response = await advisorApi.deleteConversation(chatId);
        console.log('删除响应:', response.data);
        
        if (response.data && response.data.success) {
          console.log('会话删除成功');
          
          // 如果删除的是当前会话，创建新会话
          if (this.currentChatId === chatId) {
            this.createNewChat();
          }
          
          // 刷新会话列表
          this.loadChatHistory();
        } else {
          console.error('删除失败:', response.data?.error || '未知错误');
          // 如果API调用失败但返回了响应，仍然处理本地状态
          if (this.currentChatId === chatId) {
            this.createNewChat();
          }
        }
      } catch (error) {
        console.error('删除会话失败:', error);
        // 发生错误时仍然清空本地消息
        if (this.currentChatId === chatId) {
          this.createNewChat();
        }
      }
    }
  }
};
</script>

<style scoped>
.advisor-page {
  display: flex;
  justify-content: center; /* 新增: 水平居中 */
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
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  transform: translateX(-100%);
}

.sidebar.visible {
  transform: translateX(0);
}

.sidebar-header {
  padding: 1.5rem 1rem;
  border-bottom: 1px solid #e0e0e0;
  position: relative;
}

.close-sidebar-button {
  position: absolute;
  right: 10px;
  top: 10px;
  background: none;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #666;
}

.close-sidebar-button:hover {
  background-color: #e0e0e0;
  color: #333;
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

/* 历史项目和操作菜单样式 */
.history-item {
  padding: 0.75rem;
  border-radius: 8px;
  background-color: white;
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 0.9rem;
  color: #333;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.history-item:hover {
  background-color: #e8e8e8;
}

.history-item.active {
  background-color: #e3f2fd;
  border-left: 3px solid #2196F3;
}

.history-item-content {
  flex: 1;
  overflow: hidden;
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

.history-item-actions {
  position: relative;
}

.more-actions {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #666;
  opacity: 0.7;
  transition: all 0.2s;
}

.more-actions:hover {
  background-color: #f0f0f0;
  opacity: 1;
}

.action-menu {
  position: absolute;
  top: 100%;
  right: 0;
  min-width: 120px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  overflow: hidden;
}

.action-item {
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.2s;
}

.action-item:hover {
  background-color: #f5f5f5;
}

.delete-action {
  color: #f44336;
}

.empty-history {
  text-align: center;
  padding: 1rem;
  color: #666;
  font-size: 0.9rem;
}

.knowledge-item {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 8px;
  background-color: white;
  cursor: pointer;
  transition: background-color 0.2s;
}

.knowledge-item:hover {
  background-color: #e8e8e8;
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

/* 聊天容器样式 - 新增最大宽度限制 */
.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: white;
  position: relative;
  margin-left: 0;
  max-width: 900px; /* 新增: 限制最大宽度 */
  width: 100%; /* 新增: 确保占据可用空间但不超过max-width */
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.05); /* 新增: 轻微阴影效果 */
}

/* 菜单切换按钮 - 现在浮动在左上角 */
.menu-toggle {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 5;
  background: none;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  color: #555;
  cursor: pointer;
  background-color: rgba(255, 255, 255, 0.8);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.menu-toggle:hover {
  color: #333;
  background-color: white;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}

.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  padding-top: 64px; /* Add extra padding at top for the menu button */
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
  word-wrap: break-word; /* 新增: 确保长文本正确换行 */
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

/* 输入区域样式 */
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

/* Claude 风格模态框 */
.claude-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.claude-modal-container {
  width: 100%;
  max-width: 420px;
  background-color: white;
  border-radius: 10px;
  overflow: hidden;
  padding: 20px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

.claude-modal-title {
  font-size: 1.1rem;
  margin: 0 0 16px 0;
  font-weight: 600;
  color: #333;
}

.claude-modal-content {
  margin-bottom: 20px;
}

.claude-modal-content p {
  margin: 0;
  color: #555;
}

.claude-rename-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.95rem;
}

.claude-rename-input:focus {
  border-color: #5E35B1;
  outline: none;
}

.claude-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.claude-cancel-button, 
.claude-confirm-button {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  border: none;
}

.claude-cancel-button {
  background-color: #f5f5f5;
  color: #333;
}

.claude-confirm-button {
  background-color: #5E35B1;
  color: white;
}

.claude-delete-button {
  background-color: #9c0d20;
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

/* 新增模态框样式 */
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

.modal-container {
  width: 100%;
  max-width: 400px;
  background-color: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
  animation: modal-in 0.2s ease-out;
}

@keyframes modal-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #333;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1rem;
  color: #666;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.modal-close:hover {
  background-color: #f0f0f0;
  color: #333;
}

.modal-body {
  padding: 20px;
}

.rename-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: border-color 0.2s;
}

.rename-input:focus {
  border-color: #5E35B1;
  outline: none;
}

.warning-text {
  color: #f44336;
  font-size: 0.9rem;
  margin-top: 8px;
}

.modal-footer {
  padding: 12px 20px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  border-top: 1px solid #eee;
}

.cancel-button, .confirm-button {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-button {
  background-color: #f0f0f0;
  color: #333;
}

.cancel-button:hover {
  background-color: #e0e0e0;
}

.confirm-button {
  background-color: #5E35B1;
  color: white;
}

.confirm-button:hover {
  background-color: #4527A0;
}

.delete-button {
  background-color: #f44336;
}

.delete-button:hover {
  background-color: #e53935;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .chat-container {
    max-width: 100%; /* 在小屏幕上占据全部宽度 */
  }
}
</style>