import { defineStore } from 'pinia';
import { login, getCurrentUser } from '../api/auth';
import { getCurrentUserProfile, updateUserProfile } from '../api/user';
import router from '../router';

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null,
    token: null,
    isAuthenticated: false,
    loading: false,
    error: null
  }),
  
  getters: {
    isAdmin: (state) => state.user && state.user.role === 'admin',
    isTeacher: (state) => state.user && state.user.role === 'teacher',
    isStudent: (state) => state.user && state.user.role === 'student',
    userRole: (state) => state.user ? state.user.role : null,
    userId: (state) => state.user ? state.user.id : null
  },
  
  actions: {
    // 从本地存储初始化用户状态
    initializeStore() {
      // 从本地存储获取用户信息和token
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (storedToken && storedUser) {
        this.token = storedToken;
        this.user = JSON.parse(storedUser);
        this.isAuthenticated = true;
      }
    },
    
    // 设置用户和token
    setUserAndToken(userData, token) {
      this.user = userData;
      this.token = token;
      this.isAuthenticated = true;
      
      // 保存到本地存储
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
    },
    
    // 用户登录
    async loginUser(username, password) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await login(username, password);
        
        if (response.success) {
          const { user, token } = response;
          this.setUserAndToken(user, token);
        }
        
        return response;
      } catch (error) {
        this.error = error.message || '登录失败';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // 获取当前用户信息
    async fetchCurrentUser() {
      if (!this.token) return null;
      
      this.loading = true;
      
      try {
        const response = await getCurrentUser();
        
        if (response.success) {
          this.user = response.user;
          localStorage.setItem('user', JSON.stringify(response.user));
        }
        
        return response.user;
      } catch (error) {
        this.error = error.message || '获取用户信息失败';
        return null;
      } finally {
        this.loading = false;
      }
    },
    
    // 获取当前用户个人资料
    async getUserProfile() {
      if (!this.token) return null;
      
      this.loading = true;
      
      try {
        const response = await getCurrentUserProfile();
        
        if (response.success) {
          // 更新本地用户信息，但不更新角色等敏感信息
          this.user = {
            ...this.user,
            name: response.data.name,
            email: response.data.email,
            username: response.data.username
          };
          localStorage.setItem('user', JSON.stringify(this.user));
          return response.data;
        }
        
        return null;
      } catch (error) {
        this.error = error.message || '获取个人资料失败';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // 更新当前用户个人资料
    async updateUserProfile(profileData) {
      if (!this.token) return null;
      
      this.loading = true;
      
      try {
        const response = await updateUserProfile(profileData);
        
        if (response.success) {
          // 更新本地用户信息
          this.user = {
            ...this.user,
            name: response.data.name,
            email: response.data.email
          };
          localStorage.setItem('user', JSON.stringify(this.user));
        }
        
        return response;
      } catch (error) {
        this.error = error.message || '更新个人资料失败';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // 用户登出
    logout() {
      // 确保先导航到登录页面，再清除用户状态
      router.push('/login').then(() => {
        // 路由导航完成后再清除状态
        this.user = null;
        this.token = null;
        this.isAuthenticated = false;
        
        // 清除本地存储
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      });
    }
  }
});