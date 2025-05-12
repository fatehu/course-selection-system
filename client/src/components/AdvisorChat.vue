<template>
  <div class="advisor-chat" :class="{ 'expanded': isExpanded }">
    <div class="advisor-header" @click="toggleExpand">
      <div class="title">
        <i class="advisor-icon fas fa-robot"></i>
        <h3>选课小助手</h3>
      </div>
      <button class="toggle-btn">
        <i :class="['fas', isExpanded ? 'fa-chevron-down' : 'fa-chevron-up']"></i>
      </button>
    </div>
    
    <div v-show="isExpanded" class="advisor-body">
      <div class="chat-messages" ref="chatBody">
        <div 
          v-for="(message, index) in messages" 
          :key="index" 
          :class="['message', message.role === 'user' ? 'user-message' : 'advisor-message']"
        >
          <div class="message-content">
            <!-- 如果当前消息正在加载，显示加载动画 -->
            <div v-if="message.isLoading" class="loading">
              <div class="dot-typing"></div>
            </div>
            <!-- 否则显示消息内容 -->
            <div v-else v-html="formatMessage(message.content)"></div>
          </div>
        </div>
      </div>
      
      <div class="chat-input">
        <input 
          v-model="userInput" 
          placeholder="请输入你的问题..." 
          @keyup.enter="sendMessage"
          :disabled="loading"
        />
        <button @click="sendMessage" :disabled="loading || !userInput.trim()">
          <i class="fas fa-paper-plane"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import axios from '@/api/axiosForAssistant';
import advisorApi from '@/services/advisor';

export default {
  name: 'AdvisorChat',
  data() {
    return {
      messages: [],
      userInput: '',
      loading: false,
      isExpanded: true,
      baseURL: '',
      sessionId: null // 添加会话ID字段
    };
  },
  async mounted() {
    this.messages.push({
      role: 'advisor',
      content: '你好！我是你的AI学习辅导员，可以帮你解答关于课程、选课和学分要求的问题。例如，你可以问我"电子信息工程专业的核心课程有哪些？"或"计算机科学与技术专业需要修多少学分才能毕业？"',
      isLoading: false
    });
    
    // 在组件挂载时获取 axios 的基础 URL
    this.baseURL = axios.defaults.baseURL || '';
  },
  methods: {
    formatMessage(content) {
      // Markdown基础格式转换
      const formatted = content
        // 加粗处理
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // 数字列表处理
        .replace(/(\d+\.\s+.*(?:\n|$))/g, '<div class="list-item">$1</div>')
        // 换行处理
        .replace(/\n/g, '<br>');
      
      // 二次处理列表项的换行
      return formatted.replace(/<br><div class="list-item">/g, '<div class="list-item">');
    },
    toggleExpand() {
      this.isExpanded = !this.isExpanded;
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
      
      this.$nextTick(() => {
        this.scrollToBottom();
      });
      
      // 尝试使用流式接口，传递会话ID
      this.tryStreamingRequest(question, this.sessionId)
        .catch(() => {
          // 如果流式接口失败，使用原来的非流式接口
          console.log('流式接口失败，使用常规接口');
          return this.useRegularRequest(question, this.sessionId);
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
    async tryStreamingRequest(question, sessionId) {
      const streamUrl = '/advisor/ask-stream';

      // 添加一个新的 AI 消息用于显示流式内容，初始状态为加载中
      const advisorMessageIndex = this.messages.push({
        role: 'advisor',
        content: '',
        isLoading: true  // 初始状态为加载中
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
          sessionId
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
                    // 保存会话ID
                    if (data.sessionId && !this.sessionId) {
                      this.sessionId = data.sessionId;
                      console.log('获取会话ID:', this.sessionId);
                    }
                    
                    // 第一次收到内容时，将加载状态设为false
                    if (this.messages[advisorMessageIndex].isLoading) {
                      this.messages[advisorMessageIndex].isLoading = false;
                    }
                    // 更新消息内容
                    this.messages[advisorMessageIndex].content += data.content;
                    this.$nextTick(() => {
                      this.scrollToBottom();
                    });
                    break;
                    
                  case 'end':
                    // 保存会话ID
                    if (data.sessionId && !this.sessionId) {
                      this.sessionId = data.sessionId;
                      console.log('获取会话ID:', this.sessionId);
                    }
                    
                    // 流式传输结束
                    this.messages[advisorMessageIndex].isLoading = false;  // 确保加载状态结束
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
      
      const response = await axios.post('advisor/ask', { 
        question,
        sessionId
      });
      
      // 保存会话ID
      if (response.data && response.data.sessionId) {
        this.sessionId = response.data.sessionId;
        console.log('获取会话ID:', this.sessionId);
      }
      
      // 收到响应后，更新消息内容并设置加载状态为false
      this.messages[advisorMessageIndex].isLoading = false;
      this.messages[advisorMessageIndex].content = response.answer || response.data?.answer || response || "收到响应但格式不正确";
    },
    scrollToBottom() {
      if (this.$refs.chatBody) {
        this.$refs.chatBody.scrollTop = this.$refs.chatBody.scrollHeight;
      }
    }
  }
};
</script>

<style scoped>
.advisor-chat {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 350px;
  max-height: 500px;
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 1000;
  transition: all 0.3s ease;
}

.advisor-header {
  padding: 15px;
  background-color: #4285f4;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.advisor-header .title {
  display: flex;
  align-items: center;
}

.advisor-icon {
  margin-right: 10px;
  font-size: 18px;
}

.advisor-header h3 {
  margin: 0;
  font-size: 16px;
}

.toggle-btn {
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 14px;
}

.advisor-body {
  display: flex;
  flex-direction: column;
  height: 400px;
}

.chat-messages {
  flex-grow: 1;
  padding: 15px;
  overflow-y: auto;
  background-color: #f5f5f5;
}

.message {
  margin-bottom: 15px;
  display: flex;
}

.user-message {
  justify-content: flex-end;
}

.advisor-message {
  justify-content: flex-start;
}

.message-content {
  padding: 10px 15px;
  border-radius: 18px;
  max-width: 80%;
  word-wrap: break-word;
  line-height: 1.5;
}

/* 加粗文本样式 */
.message-content :deep(strong) {
  color: #2c3e50;
  font-weight: 600;
  padding: 0 2px;
}

/* 列表项样式 */
.message-content :deep(.list-item) {
  margin: 8px 0;
  padding-left: 20px;
  position: relative;
  line-height: 1.6;
}

.message-content :deep(.list-item::before) {
  content: "•";
  color: #4285f4;
  position: absolute;
  left: 0;
  font-weight: bold;
  font-size: 1.2em;
}

/* 调整用户消息中的样式 */
.user-message .message-content :deep(strong) {
  color: #e3f2fd;
}

.user-message .message-content :deep(.list-item::before) {
  color: #bbdefb;
}

.user-message .message-content {
  background-color: #4285f4;
  color: white;
  border-top-right-radius: 5px;
}

.advisor-message .message-content {
  background-color: #e9e9eb;
  color: #333;
  border-top-left-radius: 5px;
}

.chat-input {
  display: flex;
  padding: 10px;
  border-top: 1px solid #e0e0e0;
}

.chat-input input {
  flex-grow: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 20px;
  margin-right: 10px;
  outline: none;
}

.chat-input button {
  width: 40px;
  height: 40px;
  background-color: #4285f4;
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-input button:disabled {
  background-color: #a9a9a9;
  cursor: not-allowed;
}

/* 加载动画 */
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
}

.dot-typing {
  position: relative;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #666;
  animation: dot-typing 1.5s infinite linear;
}

.dot-typing::before,
.dot-typing::after {
  content: '';
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #666;
  animation: dot-typing 1.5s infinite linear;
}

.dot-typing::before {
  left: -12px;
  animation-delay: 0s;
}

.dot-typing {
  animation-delay: 0.5s;
}

.dot-typing::after {
  left: 12px;
  animation-delay: 1s;
}

@keyframes dot-typing {
  0%, 100% {
    opacity: 0;
    transform: scale(0.5);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>