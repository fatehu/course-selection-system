import axios from 'axios';

// 创建 axios 实例
const api = axios.create({
  // 生产环境使用相对路径，开发环境使用localhost
  baseURL: process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器
api.interceptors.request.use(
  config => {
    // 从本地存储获取 token
    const token = localStorage.getItem('token');
    
    // 如果有 token，添加到请求头
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  response => {
    return response.data;
  },
  error => {
    // 处理 401 未授权错误
    if (error.response && error.response.status === 401) {
      // 清除本地存储中的 token
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // 重定向到登录页
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    // 返回错误信息
    return Promise.reject(error.response ? error.response.data : error);
  }
);

export default api;