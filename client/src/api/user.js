import api from './axios';

// 获取所有用户
export const getAllUsers = () => {
  return api.get('/users');
};

// 获取单个用户
export const getUser = (id) => {
  return api.get(`/users/${id}`);
};

// 创建用户
export const createUser = (userData) => {
  return api.post('/users', userData);
};

// 更新用户
export const updateUser = (id, userData) => {
  return api.put(`/users/${id}`, userData);
};

// 删除用户 - 确保直接返回响应数据
export const deleteUser = async (id) => {
  try {
    const response = await api.delete(`/users/${id}`);
    return response; // 返回完整响应
  } catch (error) {
    console.error('删除用户请求失败:', error);
    
    // 如果错误中有响应数据，返回它
    if (error.response) {
      return error.response;
    }
    
    // 否则抛出错误供调用者处理
    throw error;
  }
};

// 获取当前用户个人信息
export const getCurrentUserProfile = () => {
  return api.get('/users/profile');
};

// 更新当前用户个人信息
export const updateUserProfile = (profileData) => {
  return api.put('/users/profile', profileData);
};