<template>
  <div class="advisor-page">
    <!-- 侧边栏 -->
    <div class="sidebar" :class="{ 'visible': sidebarVisible }">
      <div class="sidebar-header">
        <h1 class="app-title">AI学习辅导员</h1>
        <button class="new-chat-button" @click="createNewChat" :disabled="loading">
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
               @click="loading ? null : createNewChat">
            <div class="history-item-title">新建对话</div>
          </div>
          
          <div v-if="chatHistory.length === 0 && hasLoadedHistory" class="empty-history">
            <p>暂无历史对话</p>
          </div>
          
          <!-- 在历史对话列表中 -->
          <div v-for="chat in chatHistory"
              :key="chat.id"
              class="history-item"
              :class="{
                active: currentChatId === chat.id,
                'disabled-item': loading && currentChatId !== chat.id
              }">

            <div class="history-item-content"
                @click="(loading && currentChatId !== chat.id) ? null : switchChat(chat.id)">
              <div class="history-item-title">{{ chat.title || '未命名对话' }}</div>
              <div class="history-item-date">{{ formatDate(chat.updatedAt) }}</div>
            </div>

            <div class="history-item-actions" v-if="!(loading && currentChatId !== chat.id)">
              <div class="more-actions" @click.stop="showActionMenu(chat, $event)">
                <i class="fas fa-ellipsis-v"></i>
              </div>
              <div v-if="activeMenu === chat.id" class="action-menu">
                <div class="action-item" @click.stop="showRenameConfirm(chat)">
                  <i class="fas fa-edit"></i> 重命名
                </div>
                <div class="action-item delete-action" @click.stop="showDeleteConfirm(chat)">
                  <i class="fas fa-trash-alt"></i> 删除
                </div>
              </div>
            </div>
            <div class="history-item-actions" v-else>
              <div class="more-actions disabled-item">
                  <i class="fas fa-ellipsis-v"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 知识库区域 - 修改为支持选择知识库 -->
      <div class="knowledge-section">
        <div class="section-title">
          <i class="fas fa-book"></i> 知识库
          <button class="add-knowledge-button" title="管理知识库" @click="goToKnowledgeBaseManager">
            <i class="fas fa-cog"></i>
          </button>
        </div>
        <div class="knowledge-list">
          <div class="knowledge-item" 
               :class="{ active: !activeKnowledgeBaseId }" 
               @click="setActiveKnowledgeBase(null)">
            <i class="fas fa-globe"></i> 默认知识
          </div>
          <div v-for="kb in knowledgeBases" 
               :key="kb.id" 
               class="knowledge-item"
               :class="{ active: activeKnowledgeBaseId === kb.id }"
               @click="setActiveKnowledgeBase(kb.id)">
            <i class="fas fa-book"></i> {{ kb.name }}
          </div>
          <div v-if="knowledgeBases.length === 0" class="empty-knowledge">
            <p>暂无自定义知识库</p>
          </div>
        </div>
      </div>

      <!-- 网络搜索功能 - 从侧边栏移除，改到下拉菜单中 -->
      <div class="sidebar-footer">
        <button class="settings-button" @click="goToSettings">
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
              <div v-else>
                <!-- 如果有思维链，先显示思维链 -->
                  <div v-if="message.reasoning" class="reasoning-content">
                    <div class="reasoning-header" @click="toggleReasoning(index)">
                      <i :class="['fas', message.showReasoning ? 'fa-chevron-down' : 'fa-chevron-right']"></i>
                      思考过程
                    </div>
                    <div class="reasoning-body" v-show="message.showReasoning" v-html="formatMessage(message.reasoning)"></div>
                  </div>
                <!-- 显示主要回答 -->
                <div class="message-content" v-html="formatMessage(message.content)"></div>
              </div>
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
          <!-- 添加功能菜单按钮 -->
          <div class="features-dropdown">
            <button class="features-button" @click.stop="toggleFeaturesMenu">
              <i class="fas fa-sliders-h"></i>
            </button>
            
            <!-- 下拉菜单内容 -->
            <div class="dropdown-content" v-if="showFeaturesMenu">
              <!-- 网络搜索选项 -->
              <div class="dropdown-item">
                <div class="item-label">
                  <i class="fas fa-globe"></i>
                  <span>网络搜索</span>
                </div>
                <div class="toggle-switch mini">
                  <input type="checkbox" id="web-search-toggle-mini" v-model="webSearchEnabled">
                  <label for="web-search-toggle-mini"></label>
                </div>
              </div>

              <!-- 网络搜索引擎选择 (仅在网络搜索开启时显示) -->
              <div class="dropdown-item search-engines-item" v-if="webSearchEnabled && availableSearchEngines.length > 0">
                <div class="item-label">
                  <i class="fas fa-search-plus"></i>
                  <span>选择搜索引擎</span>
                </div>
              </div>
              <div class="search-engine-list" v-if="webSearchEnabled && availableSearchEngines.length > 0">
                <div 
                  v-for="engine in availableSearchEngines" 
                  :key="engine.id"
                  class="engine-badge"
                  :class="{ active: isEngineActive(engine.id) }"
                  @click.stop="toggleSearchEngine(engine.id)"
                  :title="engine.description"
                >
                  {{ engine.name }}
                </div>
                <div class="search-engine-tip" v-if="availableSearchEngines.length === 0">
                  <i class="fas fa-exclamation-circle"></i> 未配置搜索引擎
                </div>
              </div>
              
              <!-- 深度思考选项 -->
              <div class="dropdown-item">
                <div class="item-label">
                  <i class="fas fa-brain"></i>
                  <span>深度思考</span>
                </div>
                <div class="toggle-switch mini">
                  <input type="checkbox" id="deep-thinking-toggle-mini" v-model="deepThinkingEnabled">
                  <label for="deep-thinking-toggle-mini"></label>
                </div>
              </div>
              
              <!-- 知识库选项 -->
              <div class="dropdown-item knowledge-dropdown">
                <div class="item-label">
                  <i class="fas fa-book"></i>
                  <span>知识库</span>
                </div>
                <select v-model="activeKnowledgeBaseId" class="knowledge-select">
                  <option :value="null">默认知识</option>
                  <option v-for="kb in knowledgeBases" :key="kb.id" :value="kb.id">
                    {{ kb.name }}
                  </option>
                </select>
              </div>
            </div>
          </div>
          
          <!-- 活跃功能指示器 -->
          <div class="active-features" v-if="webSearchEnabled || deepThinkingEnabled || activeKnowledgeBaseId">
            <div v-if="webSearchEnabled" class="feature-tag" title="网络搜索已开启">
              <i class="fas fa-globe"></i>
            </div>
            <div v-if="deepThinkingEnabled" class="feature-tag" title="深度思考已开启">
              <i class="fas fa-brain"></i>
            </div>
            <div v-if="activeKnowledgeBaseId" class="feature-tag" title="使用自定义知识库">
              <i class="fas fa-book"></i>
            </div>
          </div>
          
          <!-- 保留原有输入框 -->
          <textarea 
            v-model="userInput" 
            placeholder="输入你的问题..." 
            @keydown.enter.prevent="sendMessage"
            :disabled="loading"
            rows="1"
            ref="inputField"
            @input="adjustTextareaHeight"
          ></textarea>
          
          <!-- 发送按钮 -->
          <button 
            class="send-button" 
            @click="sendMessage" 
            :disabled="loading || !userInput.trim()"
          >
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>
        
        <!-- 更新底部提示信息 -->
        <div class="input-footer">
          <p v-if="webSearchEnabled || deepThinkingEnabled || activeKnowledgeBaseId">
            <span v-if="webSearchEnabled">网络搜索开启 · </span>
            <span v-if="deepThinkingEnabled">深度思考开启 · </span>
            <span v-if="activeKnowledgeBaseId">使用知识库：{{ getKnowledgeBaseName(activeKnowledgeBaseId) }}</span>
          </p>
          <p v-else>
            AI辅导员正在进行内测阶段，回答仅供参考。请对照学校官方文件验证信息准确性。
          </p>
        </div>
      </div>
    </div>

    <!-- 删除/重命名确认对话框 -->
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
import katex from 'katex';
import 'katex/dist/katex.min.css';

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
      knowledgeBases: [], // 新增：知识库列表
      activeKnowledgeBaseId: null, // 新增：当前使用的知识库ID
      activeMenu: null, // 当前激活的菜单ID
      showModal: false, // 是否显示模态框
      modalType: '', // 模态框类型: 'rename' 或 'delete'
      modalTitle: '', // 模态框标题
      selectedChat: null, // 当前选中的对话
      newTitle: '', // 重命名输入
      // 网络搜索相关属性
      webSearchEnabled: false,
      availableSearchEngines: [],
      activeSearchEngines: [],
      searchEnginesLoaded: false,
      // 深度思考相关属性
      deepThinkingEnabled: false,
      // 添加新属性
      showFeaturesMenu: false, // 控制功能菜单的显示状态
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
  updated() {
    // 获取所有消息内容元素
    const messageElements = document.querySelectorAll('.message-content');
    // 对每个元素渲染数学公式
    messageElements.forEach(element => {
      this.renderMathInMessage(element);
    });
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
    
    // 新增：加载知识库列表
    await this.fetchKnowledgeBases();

    // 检查URL中是否有sessionId参数
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('sessionId');
    
    if (sessionId) {
      // 加载指定会话
      this.loadConversation(sessionId);
    }
      
    // 不再根据屏幕尺寸自动显示侧边栏
    window.addEventListener('resize', this.handleResize);
  
    // 加载搜索引擎配置
    await this.loadSearchEngines();
  },
  beforeUnmount() {
    // 移除滚动监听器
    if (this.$refs.messagesArea) {
      this.$refs.messagesArea.removeEventListener('scroll', this.handleScroll);
    }
    
    // 移除窗口大小监听器
    window.removeEventListener('resize', this.handleResize);
    
    // 移除功能菜单的文档点击监听器
    document.removeEventListener('click', this.closeFeaturesMenu);
  },
  methods: {
    // 切换功能菜单显示状态
    toggleFeaturesMenu(event) {
      if (event) event.stopPropagation();
      this.showFeaturesMenu = !this.showFeaturesMenu;
      
      // 如果打开菜单，添加点击其他区域关闭菜单的事件
      if (this.showFeaturesMenu) {
        setTimeout(() => {
          document.addEventListener('click', this.closeFeaturesMenu);
        }, 0);
      } else {
        document.removeEventListener('click', this.closeFeaturesMenu);
      }
    },
    
    // 关闭功能菜单
    closeFeaturesMenu(event) {
      if (event && event.target.closest('.features-dropdown')) return;
      this.showFeaturesMenu = false;
      document.removeEventListener('click', this.closeFeaturesMenu);
    },
    
    // 切换思维链显示状态
    toggleReasoning(index) {
      this.messages[index].showReasoning = !this.messages[index].showReasoning;
    },
    
    goToSettings() {
      this.$router.push('/advisor/settings');
    },

    // 格式化消息内容
    formatMessage(content) {
      if (!content) return '';
      
      // 步骤1: 在HTML转义前提取数学部分
      let mathSections = [];
      let processedContent = content;
      let mathCounter = 0;
      
      // 创建一个函数来处理所有类型的公式，避免代码重复
      function extractMath(text, pattern, isBlock) {
        return text.replace(pattern, (match, formula) => {
          const id = `math-${isBlock ? 'block' : 'inline'}-${mathCounter++}`;
          // 移除公式中可能存在的<br>和其他HTML标签文本
          const cleanFormula = formula
            .replace(/< *br *>/g, '') // 移除<br>文本
            .replace(/< *\/ *div *>/g, '') // 移除</div>文本
            .replace(/< *divclass *= *[^>]*>/g, '') // 移除<divclass=...>文本
            .replace(/< *strong *>/g, '') // 移除<strong>文本
            .replace(/< *\/ *strong *>/g, '') // 移除</strong>文本
            .replace(/< *h4 *>/g, '') // 移除<h4>文本
            .replace(/< *\/ *h4 *>/g, '') // 移除</h4>文本
            .replace(/(< *br *>|&lt;br *&gt;)/gi, '') // 增强匹配不同形式的 br
            .replace(/<\/?[a-z][^>]*>/gi, '') // 移除所有 HTML 标签
            .replace(/&[a-z]+;/g, ''); // 移除 HTML 实体
            
            mathSections.push({ id, formula: cleanFormula, isBlock });
          return `{{${id}}}`;
        });
      }
      
      // 处理所有类型的数学公式
      processedContent = extractMath(processedContent, /\$\$([\s\S]+?)\$\$/g, true); // 块级公式 $$...$$
      processedContent = extractMath(processedContent, /\$([^\$]+?)\$/g, false); // 行内公式 $...$
      processedContent = extractMath(processedContent, /\\\(([\s\S]+?)\\\)/g, false); // 行内公式 \(...\)
      processedContent = extractMath(processedContent, /\\\[([\s\S]+?)\\\]/g, true); // 块级公式 \[...\]
      
      // 步骤2: 进行常规的HTML转义以防止注入
      processedContent = processedContent
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      
      // 步骤3: 处理特定的HTML标签
      processedContent = processedContent.replace(/&lt;\s*divclass\s*=\s*(.*?)&gt;/g, '<div class="$1">');
      processedContent = processedContent.replace(/&lt;\s*\/\s*divclass\s*&gt;/g, '</div>');
      processedContent = processedContent.replace(/&lt;br\s*&gt;/g, '<br>');
      processedContent = processedContent.replace(/&lt;h4&gt;(.*?)&lt;\/h4&gt;/g, '<h4>$1</h4>');
      
      // 步骤4: 恢复提取出的数学公式部分
      mathSections.forEach(section => {
        processedContent = processedContent.replace(
          `{{${section.id}}}`,
          section.isBlock 
            ? `<div class="math-block" data-math="${section.formula}"></div>` 
            : `<span class="math-inline" data-math="${section.formula}"></span>`
        );
      });
      
      // 步骤5: 应用Markdown格式转换
      processedContent = processedContent
        // 标题处理 (支持 h1-h6)
        .replace(/^#{6}\s+(.*)$/gm, '<h6>$1</h6>')
        .replace(/^#{5}\s+(.*)$/gm, '<h5>$1</h5>')
        .replace(/^#{4}\s+(.*)$/gm, '<h4>$1</h4>')
        .replace(/^#{3}\s+(.*)$/gm, '<h3>$1</h3>')
        .replace(/^#{2}\s+(.*)$/gm, '<h2>$1</h2>')
        .replace(/^#{1}\s+(.*)$/gm, '<h1>$1</h1>')
        
        // 分隔线处理
        .replace(/^---$/gm, '<hr>')
        
        // 代码块处理
        .replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>')
        
        // 行内代码处理
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        
        // 加粗处理
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // 斜体处理
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // 链接处理
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
        
        // 保护数学公式中的减号，防止被误认为是无序列表
        // 数字列表处理
        .replace(/(\d+\.\s+.*(?:\n|$))/g, '<div class="list-item">$1</div>')
        
        // 无序列表处理 - 修改正则表达式，确保只有行首的减号被处理为列表项
        .replace(/^(\-\s+.*(?:\n|$))/gm, '<div class="list-item bullet">$1</div>') 
        
        // 换行处理 - 需要小心这部分，可能影响公式中的换行
        .replace(/\n/g, (match, offset) => {
          // 检查是否在数学公式占位符区域内
          const isInMath = /{{math-(block|inline)-\d+}}/.test(
            processedContent.slice(0, offset)
          );
          return isInMath ? '\n' : '<br>';
        });
      // 二次处理列表项的换行
      processedContent = processedContent.replace(/<br><div class="list-item">/g, '<div class="list-item">');
      
      // 处理特殊的数学表示法
      processedContent = processedContent.replace(/≈/g, '&approx;');
      processedContent = processedContent.replace(/当x=([0-9.]+)/g, '当 x = $1');
      
      return processedContent;
    },

    // 渲染数学公式
    renderMathInMessage(messageElement) {
      if (!messageElement) return;
      
      try {
        // 渲染行内公式
        const inlineElements = messageElement.querySelectorAll('.math-inline');
        inlineElements.forEach(element => {
          try {
            const math = element.getAttribute('data-math');
            if (math) {
              katex.render(math, element, {
                throwOnError: false,
                displayMode: false,
                output: 'html',
                trust: true  // 允许某些高级功能
              });
            }
          } catch (error) {
            console.error('渲染行内公式出错:', error);
            // 出错时显示原始LaTeX代码
            element.textContent = '$' + (element.getAttribute('data-math') || '') + '$';
          }
        });
        
        // 渲染块级公式
        const blockElements = messageElement.querySelectorAll('.math-block');
        blockElements.forEach(element => {
          try {
            const math = element.getAttribute('data-math');
            if (math) {
              katex.render(math, element, {
                throwOnError: false,
                displayMode: true,
                output: 'html',
                trust: true  // 允许某些高级功能
              });
            }
          } catch (error) {
            console.error('渲染块级公式出错:', error, element.getAttribute('data-math'));
            // 出错时显示原始LaTeX代码
            element.textContent = '$$' + (element.getAttribute('data-math') || '') + '$$';
          }
        });
      } catch (e) {
        console.error('渲染数学公式时发生错误:', e);
      }
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
      
      // 尝试使用流式接口，传递当前会话ID、知识库ID、网络搜索状态和深度思考状态
      this.tryStreamingRequest(question, this.currentChatId, this.activeKnowledgeBaseId, this.webSearchEnabled, this.deepThinkingEnabled)
        .catch((error) => {
          // 如果流式接口失败，使用原来的非流式接口
          console.log('流式接口失败，使用常规接口', error);
          return this.useRegularRequest(question, this.currentChatId, this.activeKnowledgeBaseId, this.webSearchEnabled, this.deepThinkingEnabled);
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
          // 渲染新消息中的数学公式
          const messageElements = document.querySelectorAll('.message-content');
          messageElements.forEach(element => {
            this.renderMathInMessage(element);
          });
        });
      });
    },
    
    // 流式请求方法
    async tryStreamingRequest(question, sessionId, knowledgeBaseId, useWebSearch, useDeepThinking) {
      const streamUrl = '/advisor/ask-stream';

      // 添加一个新的 AI 消息用于显示流式内容，初始状态为加载中
      const advisorMessageIndex = this.messages.push({
        role: 'advisor',
        content: '',
        reasoning: useDeepThinking ? '' : null, // 如果使用深度思考，准备存储思维链
        isLoading: true,
        showReasoning: true // 默认显示思维链
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
      console.log('发送流式请求:', fullUrl, { 
        question, 
        sessionId, 
        knowledgeBaseId,
        useWebSearch,
        useDeepThinking // 新增深度思考参数
      });

      // 修改：传递所有参数，包括网络搜索状态和深度思考状态
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ 
          question,
          sessionId,
          knowledgeBaseId,
          useWebSearch,
          useDeepThinking
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
                    
                    // 根据内容类型更新不同部分
                    if (data.contentType === 'reasoning') {
                      console.log(`[前端] 收到思维链数据，长度: ${data.content.length}`);
                     
                      // 确保reasoning字段已初始化
                      if (this.messages[advisorMessageIndex].reasoning === null ||
                          this.messages[advisorMessageIndex].reasoning === undefined) {
                        this.messages[advisorMessageIndex].reasoning = '';
                      }

                      // 直接修改对象属性
                      this.messages[advisorMessageIndex].reasoning = (this.messages[advisorMessageIndex].reasoning || '') + data.content;
                    } else {
                      console.log(`[前端] 收到回答数据，长度: ${data.content.length}`);
                      // 直接修改对象属性
                      this.messages[advisorMessageIndex].content = (this.messages[advisorMessageIndex].content || '') + data.content;
                    }
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

                    // 流式传输结束后关闭思维链显示
                    // 确保消息存在且有思维链``
                    if (this.messages[advisorMessageIndex] && 
                      this.messages[advisorMessageIndex].reasoning) {
                      console.log('思维链传输完成，自动折叠显示');
                      this.messages[advisorMessageIndex].showReasoning = false;
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

    // 新增：获取知识库列表方法
    async fetchKnowledgeBases() {
      try {
        console.log('获取知识库列表...');
        const response = await axios.get('/knowledge-base');
        
        if (response.data && response.data.success) {
          this.knowledgeBases = response.data.knowledgeBases || [];
          console.log('获取知识库成功:', this.knowledgeBases);
        } else {
          console.error('获取知识库失败:', response.data?.error);
        }
      } catch (error) {
        console.error('获取知识库失败:', error);
      }
    },
    
    // 设置当前使用的知识库
    setActiveKnowledgeBase(knowledgeBaseId) {
      this.activeKnowledgeBaseId = knowledgeBaseId;
      console.log('切换到知识库:', knowledgeBaseId);
    },
    
    // 获取知识库名称
    getKnowledgeBaseName(id) {
      const kb = this.knowledgeBases.find(kb => kb.id == id);
      return kb ? kb.name : '';
    },
    
    // 跳转到知识库管理页面
    goToKnowledgeBaseManager() {
      this.$router.push('/knowledge-base');
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
    async useRegularRequest(question, sessionId, knowledgeBaseId, useWebSearch, useDeepThinking) {
      // 添加一个新的 AI 消息用于显示内容，初始状态为加载中
      const advisorMessageIndex = this.messages.push({
        role: 'advisor',
        content: '',
        reasoning: useDeepThinking ? '' : null, // 如果使用深度思考，准备存储思维链
        isLoading: true,
        showReasoning: false
      }) - 1;
      
      // 滚动到新消息
      this.$nextTick(() => {
        this.scrollToBottom();
      });
      
      console.log('发送常规请求:', { 
        question, 
        sessionId, 
        knowledgeBaseId,
        useWebSearch,
        useDeepThinking
      });
      
      // 修改：传递所有参数，包括网络搜索状态和深度思考状态
      const response = await axios.post('/advisor/ask', { 
        question,
        sessionId,
        knowledgeBaseId,
        useWebSearch,
        useDeepThinking
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
      
      // 如果有思维链内容，添加到消息中
      if (response.data?.reasoning) {
        this.messages[advisorMessageIndex].reasoning = response.data.reasoning;
      }
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
    },

    // 加载搜索引擎配置
    async loadSearchEngines() {
      try {
        console.log('加载搜索引擎配置...');
        const response = await advisorApi.getSearchEngines();
        
        if (response.data && response.data.success) {
          this.availableSearchEngines = response.data.availableEngines || [];
          this.activeSearchEngines = response.data.activeEngines || [];
          this.searchEnginesLoaded = true;
          console.log('搜索引擎加载成功:', this.availableSearchEngines);
        } else {
          console.error('加载搜索引擎失败:', response.data?.error);
          this.availableSearchEngines = [];
          this.activeSearchEngines = [];
        }
      } catch (error) {
        console.error('加载搜索引擎失败:', error);
        this.availableSearchEngines = [];
        this.activeSearchEngines = [];
      }
    },
    
    // 检查搜索引擎是否激活
    isEngineActive(engineId) {
      return this.activeSearchEngines.includes(engineId);
    },
    
    // 切换搜索引擎状态
    async toggleSearchEngine(engineId) {
      let newActiveEngines = [...this.activeSearchEngines];
      
      if (this.isEngineActive(engineId)) {
        // 如果至少有2个引擎激活，则可以移除
        if (newActiveEngines.length > 1) {
          newActiveEngines = newActiveEngines.filter(id => id !== engineId);
        }
      } else {
        // 添加到激活列表
        newActiveEngines.push(engineId);
      }
      
      try {
        console.log('设置激活搜索引擎:', newActiveEngines);
        const response = await advisorApi.setActiveEngines(newActiveEngines);
        
        if (response.data && response.data.success) {
          this.activeSearchEngines = response.data.activeEngines;
          console.log('搜索引擎设置成功:', this.activeSearchEngines);
        }
      } catch (error) {
        console.error('设置搜索引擎失败:', error);
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

/* 知识库项目样式 - 新增样式 */
.knowledge-item {
  display: flex;
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

.knowledge-item.active {
  background-color: #e3f2fd;
  border-left: 3px solid #2196F3;
}

.knowledge-item i {
  color: #5E35B1;
}

.empty-knowledge {
  text-align: center;
  padding: 10px;
  color: #666;
  font-size: 0.85rem;
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

/* 知识库信息提示 - 新增样式 */
.knowledge-base-info {
  padding: 8px 12px;
  background-color: #e8f5e9;
  color: #4caf50;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 6px;
  border-top: 1px solid #c8e6c9;
}

.knowledge-base-info i {
  font-size: 1rem;
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

.message-content h1,
.message-content h2,
.message-content h3,
.message-content h4,
.message-content h5,
.message-content h6 {
  margin: 0.3em 0 0.1em 0;
  font-weight: bold;
}

.message-content h1 { font-size: 1.8em; }
.message-content h2 { font-size: 1.5em; }
.message-content h3 { font-size: 1.3em; }
.message-content h4 { font-size: 1.1em; }
.message-content h5 { font-size: 0.9em; }
.message-content h6 { font-size: 0.8em; }

.message-content hr {
  border: none;
  border-top: 1px solid #e0e0e0;
  margin: 0.2em 0;
}

.message-content code {
  background-color: #f4f4f4;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: monospace;
}

.message-content pre {
  background-color: #f4f4f4;
  padding: 1em;
  border-radius: 5px;
  overflow-x: auto;
  margin: 1em 0;
}

.message-content pre code {
  background-color: transparent;
  padding: 0;
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
  position: relative;
  align-items: center;
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
  margin: 0 8px;
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

.input-footer p {
  margin: 4px 0;
  line-height: 1.4;
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

/* 思维链样式 */
.reasoning-content {
  margin-bottom: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

.reasoning-header {
  padding: 8px 12px;
  background-color: #f0f0f0;
  color: #555;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.reasoning-header:hover {
  background-color: #e0e0e0;
}

.reasoning-body {
  padding: 12px;
  background-color: #f9f9f9;
  color: #666;
  font-size: 0.9em;
  white-space: pre-wrap;
  max-height: 300px;
  overflow-y: auto;
  border-top: 1px solid #e0e0e0;
}

/* 功能下拉菜单样式 - 新增 */
.features-dropdown {
  position: relative;
  margin-right: 8px;
}

.features-button {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: #f0f0f0;
  color: #555;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.features-button:hover {
  background-color: #e0e0e0;
  color: #333;
}

.dropdown-content {
  position: absolute;
  bottom: 100%;
  left: 0;
  width: 240px;
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  padding: 10px;
  z-index: 20;
  margin-bottom: 10px;
  animation: fadeIn 0.2s;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 下拉箭头指示 */
.dropdown-content:after {
  content: '';
  position: absolute;
  bottom: -8px;
  left: 15px;
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid white;
}

.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.dropdown-item:last-child {
  border-bottom: none;
}

.item-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: #333;
}

.item-label i {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 0.8rem;
}

.item-label i.fa-globe {
  color: #2e7d32;
  background-color: #e8f5e9;
}

.item-label i.fa-brain {
  color: #0288d1;
  background-color: #e1f5fe;
}

.item-label i.fa-book {
  color: #5E35B1;
  background-color: #f3e5f5;
}

/* 小型开关样式 */
.toggle-switch.mini {
  width: 40px;
  height: 20px;
}

.toggle-switch.mini label:before {
  height: 14px;
  width: 14px;
  left: 3px;
  bottom: 3px;
}

.toggle-switch.mini input:checked + label:before {
  transform: translateX(20px);
}

/* 知识库下拉选择框 */
.knowledge-select {
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid #ddd;
  font-size: 0.85rem;
  outline: none;
  background-color: #f5f5f5;
  flex: 1;
  margin-left: 10px;
}

.knowledge-select:focus {
  border-color: #5E35B1;
}

/* 活跃功能指示器 */
.active-features {
  display: flex;
  gap: 6px;
  margin-right: 6px;
}

.feature-tag {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  position: relative;
}

.feature-tag:hover:after {
  content: attr(title);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.7);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  white-space: nowrap;
  margin-bottom: 5px;
  pointer-events: none;
  z-index: 10;
}

.feature-tag i.fa-globe {
  color: #2e7d32;
}

.feature-tag i.fa-brain {
  color: #0288d1;
}

.feature-tag i.fa-book {
  color: #5E35B1;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .chat-container {
    max-width: 100%; /* 在小屏幕上占据全部宽度 */
  }

  .input-container {
    flex-wrap: wrap;
  }
  
  .features-dropdown {
    order: 1;
  }
  
  .active-features {
    order: 2;
    margin-right: 0;
  }
  
  textarea {
    order: 3;
    width: 100%;
    margin: 8px 0;
  }
  
  .send-button {
    order: 4;
  }
}

/* 搜索引擎列表样式 */
.search-engines-item {
  border-bottom: none;
  padding-bottom: 0;
  margin-top: 4px;
}

.search-engine-list {
  padding: 0 12px 12px 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.engine-badge {
  background-color: #f0f0f0;
  border: 1px solid #ddd;
  padding: 4px 12px;
  border-radius: 14px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.engine-badge:hover {
  background-color: #e0e0e0;
}

.engine-badge.active {
  background-color: #5E35B1;
  color: white;
  border-color: #4527A0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.search-engine-tip {
  font-size: 0.8rem;
  color: #e65100;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0;
}

/* 数学公式样式 */
.math-block {
  display: block;
  overflow-x: auto;
  margin: 1em 0;
  text-align: center;
}

.math-inline {
  white-space: pre-wrap !important;
  overflow-wrap: normal !important;
}

/* 确保KaTeX渲染的公式可以在小屏幕上水平滚动 */
.katex-display {
  overflow-x: auto;
  overflow-y: hidden;
  margin: 0.5em 0 !important;
}
</style>