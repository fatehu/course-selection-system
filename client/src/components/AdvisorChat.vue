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
          <div class="message-content">{{ message.content }}</div>
        </div>
        
        <div v-if="loading" class="message advisor-message">
          <div class="message-content loading">
            <div class="dot-typing"></div>
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

export default {
  name: 'AdvisorChat',
  data() {
    return {
      messages: [],
      userInput: '',
      loading: false,
      isExpanded: true
    };
  },
  mounted() {
    // 添加初始欢迎消息
    this.messages.push({
      role: 'advisor',
      content: '你好！我是你的AI学习辅导员，可以帮你解答关于课程、选课和学分要求的问题。例如，你可以问我"电子信息工程专业的核心课程有哪些？"或"计算机科学与技术专业需要修多少学分才能毕业？"'
    });
  },
  methods: {
    toggleExpand() {
      this.isExpanded = !this.isExpanded;
    },
    async sendMessage() {
      if (!this.userInput.trim() || this.loading) return;
      
      // 添加用户消息
      this.messages.push({
        role: 'user',
        content: this.userInput.trim()
      });
      
      const question = this.userInput.trim();
      this.userInput = '';
      this.loading = true;
      
      // 滚动到底部
      this.$nextTick(() => {
        this.scrollToBottom();
      });
      
      try {
        const response = await axios.post('advisor/ask', { question });
        console.log('API响应:', response);  // 添加日志查看实际结构
        
        // 修改这一行，根据实际响应结构调整
        this.messages.push({
          role: 'advisor',
          content: response.answer || response.data?.answer || response || "收到响应但格式不正确"
        });
      } catch (error) {
        console.error('获取回答失败:', error);
        
        // 添加错误消息
        this.messages.push({
          role: 'advisor',
          content: '抱歉，我暂时无法回答您的问题。请稍后再试。'
        });
      } finally {
        this.loading = false;
        
        // 滚动到底部
        this.$nextTick(() => {
          this.scrollToBottom();
        });
      }
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