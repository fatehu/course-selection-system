import api from './axios';

// 用户登录
export const login = (username, password) => {
  return api.post('/auth/login', { username, password });
};

// 获取当前用户信息
export const getCurrentUser = () => {
  return api.get('/auth/me');
};