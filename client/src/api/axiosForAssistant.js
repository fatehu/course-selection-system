// 为AI辅导员创建特殊的axios实例
import axios from 'axios';

// 专用于AI辅导员的axios实例，超时时间更长
const advisorApi = axios.create({
  baseURL: 'http://localhost:3000/api',
  timeout: 60000,  // 设置为60秒，远高于普通请求
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器 - 添加认证token
advisorApi.interceptors.request.use(
  (config) => {
    // 获取token
    const token = localStorage.getItem('token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理认证错误
advisorApi.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // 未认证，清除token并跳转到登录页
      localStorage.removeItem('token');
      
      // 跳转到登录页
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

export default advisorApi;