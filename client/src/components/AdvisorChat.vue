<template>
  <div class="advisor-chat">
    <!-- 可折叠浮动按钮 -->
    <div 
      v-if="!expanded && !isAdvisorPage" 
      class="chat-button"
      @click="toggleExpanded"
    >
      <i class="fas fa-comment-dots"></i>
    </div>

    <!-- 聊天窗口 -->
    <div 
      v-if="expanded && !isAdvisorPage" 
      class="chat-window"
    >
      <div class="chat-header">
        <div class="header-title">AI学习辅导员</div>
        <div class="header-actions">
          <button @click="openFullPage" class="expand-button" title="全屏模式">
            <i class="fas fa-expand"></i>
          </button>
          <button @click="toggleExpanded" class="close-button" title="关闭">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>

      <div class="messages-container" ref="messagesContainer">
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
      </div>

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
    </div>
  </div>
</template>

<script>
import axios from '@/api/axiosForAssistant';
import advisorApi from '@/services/advisor';
import { useRoute } from 'vue-router';
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';

export default {
  name: 'AdvisorChat',
  setup() {
    const route = useRoute();
    
    // 判断是否是辅导员页面
    const isAdvisorPage = computed(() => {
      return route.path === '/advisor';
    });

    const expanded = ref(false);
    const messages = ref([]);
    const userInput = ref('');
    const loading = ref(false);
    const currentChatId = ref(null);
    const messagesContainer = ref(null);
    const inputField = ref(null);
    const baseURL = ref('');
    
    // 新增：默认知识库ID（使用null表示使用系统默认知识库）
    const defaultKnowledgeBaseId = ref(null);

    // 切换聊天窗口
    const toggleExpanded = () => {
      expanded.value = !expanded.value;
      if (expanded.value && messages.value.length === 0) {
        // 如果是第一次打开，添加欢迎消息
        messages.value.push({
          role: 'advisor',
          content: '你好！我是你的AI学习辅导员，可以帮你解答关于课程、选课和学分要求的问题。有什么我可以帮助你的吗？',
          isLoading: false
        });
      }
      
      if (expanded.value) {
        // 打开聊天窗口时，获取历史对话
        if (currentChatId.value) {
          loadConversation(currentChatId.value);
        }
        
        // 下一个渲染周期后聚焦输入框
        nextTick(() => {
          if (inputField.value) {
            inputField.value.focus();
          }
        });
      }
    };

    // 打开全屏页面
    const openFullPage = () => {
      if (currentChatId.value) {
        window.location.href = `/advisor?sessionId=${currentChatId.value}`;
      } else {
        window.location.href = '/advisor';
      }
    };
    // 格式化消息内容 (简易Markdown支持)
    const formatMessage = (content) => {
      if (!content) return '';
      
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
    };

    // 调整文本输入框高度
    const adjustTextareaHeight = () => {
      const textarea = inputField.value;
      if (!textarea) return;
      
      // 重置高度，以便能够准确计算滚动高度
      textarea.style.height = 'auto';
      
      // 设置最大高度 (3行)
      const maxHeight = 20 * 3; // 假设每行约20px
      
      // 计算适合内容的高度
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
    };

    // 滚动到底部
    const scrollToBottom = () => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
      }
    };

    // 发送消息
    const sendMessage = async () => {
      if (!userInput.value.trim() || loading.value) return;
      
      // 添加用户消息
      messages.value.push({
        role: 'user',
        content: userInput.value.trim(),
        isLoading: false
      });
      
      const question = userInput.value.trim();
      userInput.value = '';
      loading.value = true;
      
      // 调整输入框高度
      nextTick(() => {
        adjustTextareaHeight();
        scrollToBottom();
      });
      
      try {
        // 尝试使用流式接口
        await tryStreamingRequest(question, currentChatId.value);
      } catch (error) {
        console.log('流式接口失败，使用常规接口', error);
        
        try {
          // 如果流式接口失败，使用原来的非流式接口
          await useRegularRequest(question, currentChatId.value);
        } catch (error) {
          console.error('所有接口都失败了:', error);
          messages.value.push({
            role: 'advisor',
            content: '抱歉，我暂时无法回答您的问题。请稍后再试。',
            isLoading: false
          });
        }
      } finally {
        loading.value = false;
        nextTick(() => {
          scrollToBottom();
        });
      }
    };

    // 流式请求方法
    const tryStreamingRequest = async (question, sessionId) => {
      // 添加一个新的 AI 消息用于显示流式内容，初始状态为加载中
      const advisorMessageIndex = messages.value.push({
        role: 'advisor',
        content: '',
        isLoading: true
      }) - 1;
      
      // 滚动到新消息
      nextTick(() => {
        scrollToBottom();
      });

      // 获取认证token
      const token = localStorage.getItem('token');
      
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // 传递默认知识库ID
      const response = await fetch(`${baseURL.value}/advisor/ask-stream`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ 
          question,
          sessionId,
          knowledgeBaseId: defaultKnowledgeBaseId.value // 使用默认知识库ID
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
                    if (data.sessionId && !currentChatId.value) {
                      currentChatId.value = data.sessionId;
                      console.log('获取会话ID:', currentChatId.value);
                      
                      // 如果是第一条消息，生成标题
                      if (messages.value.length <= 3) {
                        generateTitle(currentChatId.value);
                      }
                    }
                    
                    // 第一次收到内容时，将加载状态设为false
                    if (messages.value[advisorMessageIndex].isLoading) {
                      messages.value[advisorMessageIndex].isLoading = false;
                    }
                    // 更新消息内容
                    messages.value[advisorMessageIndex].content += data.content;
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
                    return;
                    
                  case 'error':
                    console.error('流式传输错误:', data.error);
                    // 处理错误
                    messages.value[advisorMessageIndex].isLoading = false;
                    if (data.fallbackAnswer) {
                      messages.value[advisorMessageIndex].content = data.fallbackAnswer;
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
    };

    // 常规请求方法
    const useRegularRequest = async (question, sessionId) => {
      // 添加一个新的 AI 消息用于显示内容，初始状态为加载中
      const advisorMessageIndex = messages.value.push({
        role: 'advisor',
        content: '',
        isLoading: true
      }) - 1;
      
      // 滚动到新消息
      nextTick(() => {
        scrollToBottom();
      });
      
      console.log('发送常规请求:', { question, sessionId });
      // 修改：传递默认知识库ID
      const response = await axios.post('/api/advisor/ask', { 
        question,
        sessionId,
        knowledgeBaseId: defaultKnowledgeBaseId.value // 使用默认知识库ID
      });
      
      console.log('收到常规响应:', response.data);
      
      // 保存会话ID
      if (response.data && response.data.sessionId) {
        currentChatId.value = response.data.sessionId;
        console.log('获取会话ID:', currentChatId.value);
        
        // 如果是第一条消息，生成标题
        if (messages.value.length <= 3) {
          generateTitle(currentChatId.value);
        }
      }
      
      // 收到响应后，更新消息内容并设置加载状态为false
      messages.value[advisorMessageIndex].isLoading = false;
      messages.value[advisorMessageIndex].content = response.data?.answer || "收到响应但格式不正确";
    };

    // 加载特定会话
    const loadConversation = async (sessionId) => {
      try {
        console.log('加载会话:', sessionId);
        loading.value = true;
        const response = await axios.get(`/api/advisor/conversations/${sessionId}`);
        console.log('会话加载响应:', response.data);
        
        if (response.data && response.data.success) {
          const conversation = response.data.conversation;
          currentChatId.value = sessionId;
          
          // 清空当前消息并加载会话消息
          messages.value = conversation.messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'advisor',
            content: msg.content,
            isLoading: false
          }));
          
          // 如果没有消息，添加欢迎消息
          if (messages.value.length === 0) {
            messages.value.push({
              role: 'advisor',
              content: '你好！我是你的AI学习辅导员，可以帮你解答关于课程、选课和学分要求的问题。有什么我可以帮助你的吗？',
              isLoading: false
            });
          }
        }
      } catch (error) {
        console.error('加载会话失败:', error);
        // 如果加载失败，显示默认欢迎消息
        messages.value = [{
          role: 'advisor',
          content: '你好！我是你的AI学习辅导员，可以帮你解答关于课程、选课和学分要求的问题。有什么我可以帮助你的吗？',
          isLoading: false
        }];
      } finally {
        loading.value = false;
        nextTick(() => {
          scrollToBottom();
        });
      }
    };

    // 自动生成标题
    const generateTitle = async (sessionId) => {
      try {
        console.log('尝试为会话生成标题:', sessionId);
        await advisorApi.generateConversationTitle(sessionId);
        console.log('标题生成请求已发送');
      } catch (error) {
        console.error('生成标题失败:', error);
      }
    };

    onMounted(() => {
      // 在组件挂载时获取 axios 的基础 URL
      baseURL.value = axios.defaults.baseURL || '';
    });
    
    onBeforeUnmount(() => {
      // 清理操作（如果有需要）
    });

    return {
      isAdvisorPage,
      expanded,
      messages,
      userInput,
      loading,
      messagesContainer,
      inputField,
      toggleExpanded,
      openFullPage,
      formatMessage,
      adjustTextareaHeight,
      sendMessage,
      scrollToBottom
    };
  }
};
</script>

<style scoped>
.advisor-chat {
  --primary-color: #5E35B1;
  --primary-dark-color: #4527A0;
  --text-color: #333;
  --light-bg-color: #f0f0f0;
  --border-color: #e0e0e0;
  --user-msg-color: #2196F3;
  --shadow-color: rgba(0, 0, 0, 0.2);
}

.chat-button {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: var(--primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  cursor: pointer;
  box-shadow: 0 2px 10px var(--shadow-color);
  z-index: 999;
  transition: all 0.3s ease;
}

.chat-button:hover {
  background-color: var(--primary-dark-color);
  transform: scale(1.05);
}

.chat-window {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 360px;
  height: 500px;
  border-radius: 10px;
  background-color: white;
  box-shadow: 0 5px 15px var(--shadow-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 1000;
}

.chat-header {
  padding: 12px 16px;
  background-color: var(--primary-color);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  font-weight: 600;
  font-size: 1rem;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.expand-button, .close-button {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.expand-button:hover, .close-button:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  scroll-behavior: smooth;
}

.message-wrapper {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
}

.message-container {
  display: flex;
  align-items: flex-start;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  margin-right: 8px;
  flex-shrink: 0;
  font-size: 0.8rem;
}

.user-avatar {
  background-color: var(--user-msg-color);
  margin-left: 8px;
  margin-right: 0;
}

.message-bubble {
  padding: 10px 12px;
  border-radius: 18px;
  max-width: 80%;
  position: relative;
}

.advisor-message {
  background-color: var(--light-bg-color);
  color: var(--text-color);
  border-top-left-radius: 4px;
}

.user-message {
  background-color: var(--user-msg-color);
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
  line-height: 1.4;
  font-size: 0.9rem;
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
  color: var(--primary-color);
  text-decoration: underline;
}

.user-message .message-content :deep(a) {
  color: #fff;
}

/* 列表项样式 */
.message-content :deep(.list-item) {
  margin: 6px 0;
  padding-left: 20px;
  position: relative;
  line-height: 1.5;
}

.message-content :deep(.list-item.bullet::before) {
  content: "•";
  position: absolute;
  left: 6px;
  font-weight: bold;
}

.input-container {
  padding: 12px;
  border-top: 1px solid var(--border-color);
  background-color: white;
  display: flex;
  align-items: center;
}

textarea {
  flex: 1;
  border: 1px solid var(--border-color);
  border-radius: 18px;
  background-color: var(--light-bg-color);
  resize: none;
  outline: none;
  padding: 8px 12px;
  font-family: inherit;
  font-size: 0.9rem;
  max-height: 80px;
  overflow-y: auto;
}

.send-button {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: var(--primary-color);
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
  background-color: var(--primary-dark-color);
}

.send-button:disabled {
  background-color: #c0c0c0;
  cursor: not-allowed;
}

/* 加载动画 */
.loading-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 20px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #888;
  margin: 0 3px;
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
</style>