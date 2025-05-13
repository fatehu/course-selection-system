<template>
  <div id="app">
    <!--已登录且不是登录页 显示侧边栏  -->
    <template v-if="isAuthenticated && !isLoginPage">
      <el-container class="app-container">
        <el-aside width="220px" class="app-aside">
          <div class="logo-container">
            <h3>高校选课系统</h3>
          </div>
          <el-menu
            :default-active="activeMenu"
            class="el-menu-vertical"
            :router="true"
            :collapse="isCollapse"
          >
            <el-menu-item index="/dashboard">
              <el-icon><icon-menu /></el-icon>
              <span>仪表盘</span>
            </el-menu-item>

            <el-menu-item index="/courses">
              <el-icon><document /></el-icon>
              <span>课程管理</span>
            </el-menu-item>

            <el-menu-item v-if="isStudent" index="/enrollment">
              <el-icon><calendar /></el-icon>
              <span>选课中心</span>
            </el-menu-item>

            <el-menu-item v-if="isAdmin || isTeacher" index="/sections">
              <el-icon><collection /></el-icon>
              <span>课程安排</span>
            </el-menu-item>

            <el-menu-item v-if="isAdmin || isTeacher" index="/enrollments">
              <el-icon><user /></el-icon>
              <span>选课管理</span>
            </el-menu-item>

            <el-menu-item v-if="isAdmin" index="/users">
              <el-icon><setting /></el-icon>
              <span>用户管理</span>
            </el-menu-item>

            <el-menu-item v-if="isAdmin" index="/announcement">
              <el-icon><Promotion /></el-icon>
              <span>公告发布</span>
            </el-menu-item>

            <!-- 新增知识库管理菜单项 -->
            <el-menu-item index="/knowledge-base">
              <el-icon><Collection /></el-icon>
              <span>知识库管理</span>
            </el-menu-item>

            <el-menu-item index="/profile">
              <el-icon><user /></el-icon>
              <span>个人信息</span>
            </el-menu-item>

            <!-- 新增AI辅导员菜单项 -->
            <el-menu-item index="/advisor">
              <el-icon><ChatDotRound /></el-icon>
              <span>AI辅导员</span>
            </el-menu-item>
          </el-menu>
        </el-aside>

        <el-container>
          <el-header class="app-header">
            <div class="header-left">
              <el-button
                :icon="isCollapse ? 'el-icon-s-unfold' : 'el-icon-s-fold'"
                @click="toggleSidebar"
                link
              />
              <!-- 当在AI辅导员页面时显示当前对话标题 -->
              <div v-if="isAdvisorPage" class="advisor-chat-title">
                <el-icon><ChatDotRound /></el-icon>
                <span>{{ advisorCurrentChatTitle || 'AI辅导员' }}</span>
              </div>
            </div>

            <div class="header-right">
              <el-dropdown @command="handleCommand">
                <span class="el-dropdown-link">
                  {{ user.name }}
                  <el-icon class="el-icon--right"><arrow-down /></el-icon>
                </span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="profile">个人信息</el-dropdown-item>
                    <el-dropdown-item command="logout">退出登录</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </el-header>

          <el-main class="app-main">
            <router-view v-slot="{ Component }">
              <transition name="fade" mode="out-in">
                <component :is="Component" />
              </transition>
            </router-view>
          </el-main>
        </el-container>
      </el-container>

      <!-- 添加AI辅导员组件 -->
      <AdvisorChat v-if="!isAdvisorPage" />
    </template>

    <template v-else>
      <router-view />
    </template>
    
  </div>
</template>

<script>
import { ref, computed, watch, provide } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from './store/userStore'
import {
  Menu as IconMenu,
  Document,
  Calendar,
  Collection,
  User,
  Setting,
  Promotion,
  ArrowDown,
  ChatDotRound,

} from '@element-plus/icons-vue'
import AdvisorChat from '@/components/AdvisorChat.vue'

export default {
  name: 'App',
  components: {
    IconMenu,
    Document,
    Calendar,
    Collection,
    User,
    Setting,
    ArrowDown,
    AdvisorChat,
    Promotion,
    ChatDotRound,
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const userStore = useUserStore()

    const isCollapse = ref(false)
    const advisorCurrentChatTitle = ref('新对话') // 存储AI辅导员当前对话标题

    // 获取当前路由路径
    const activeMenu = computed(() => {
      return route.path
    })

    const isAdvisorPage = computed(() => {
      return route.path === '/advisor';
    });
    
    // 新增：判断是否是知识库页面
    const isKnowledgeBasePage = computed(() => {
      return route.path.startsWith('/knowledge-base');
    });

    // 判断是否是登录页
    const isLoginPage = computed(() => {
      return route.path === '/login'
    })

    // 获取用户信息和认证状态
    const user = computed(() => userStore.user || {})
    const isAuthenticated = computed(() => userStore.isAuthenticated)
    const isAdmin = computed(() => userStore.isAdmin)
    const isTeacher = computed(() => userStore.isTeacher)
    const isStudent = computed(() => userStore.isStudent)

    // 切换侧边栏
    const toggleSidebar = () => {
      isCollapse.value = !isCollapse.value
    }

    // 下拉菜单命令处理 - 修改为支持个人信息页
    const handleCommand = (command) => {
      if (command === 'logout') {
        userStore.logout()
      } else if (command === 'profile') {
        router.push('/profile')
      }
    }

    // 在组件挂载时初始化用户状态
    userStore.initializeStore()
    
    // 提供更新AI辅导员对话标题的方法
    const updateAdvisorChatTitle = (title) => {
      advisorCurrentChatTitle.value = title || '新对话'
    }
    
    // 将方法提供给子组件
    provide('updateAdvisorChatTitle', updateAdvisorChatTitle)

    return {
      isCollapse,
      activeMenu,
      isLoginPage,
      user,
      isAuthenticated,
      isAdmin,
      isTeacher,
      isStudent,
      toggleSidebar,
      handleCommand,
      isAdvisorPage,
      isKnowledgeBasePage,
      advisorCurrentChatTitle,
      updateAdvisorChatTitle
    }
  },
}
</script>

<style>
html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family:
    Helvetica Neue,
    Helvetica,
    PingFang SC,
    Hiragino Sans GB,
    Microsoft YaHei,
    Arial,
    sans-serif;
}

#app {
  height: 100vh;
}

.app-container {
  height: 100%;
}

.app-aside {
  background-color: #415a78;
  transition: width 0.3s;
  overflow-x: hidden;
}

.logo-container {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background-color: #2c4a6e;
}

.el-menu-vertical {
  border-right: none;
  background-color: #415a78;
}

.el-menu-vertical:not(.el-menu--collapse) {
  width: 220px;
}

.el-menu--collapse {
  width: 64px;
}

.app-header {
  background-color: #fff;
  color: #333;
  line-height: 60px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
}

.header-left {
  display: flex;
  align-items: center;
}

/* AI辅导员对话标题样式 */
.advisor-chat-title {
  display: flex;
  align-items: center;
  margin-left: 15px;
  font-weight: 500;
  color: #5E35B1;
}

.advisor-chat-title .el-icon {
  margin-right: 8px;
  font-size: 18px;
}

.header-right {
  display: flex;
  align-items: center;
}

.el-dropdown-link {
  cursor: pointer;
  color: #606266;
  display: flex;
  align-items: center;
}

.app-main {
  background-color: #f0f2f5;
  padding: 0;
  overflow-x: hidden;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>