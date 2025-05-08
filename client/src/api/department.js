import api from './axios';

// 获取所有部门
export const getAllDepartments = () => {
  return api.get('/departments');
};

// 获取单个部门
export const getDepartment = (id) => {
  return api.get(`/departments/${id}`);
};

// 创建部门
export const createDepartment = (departmentData) => {
  return api.post('/departments', departmentData);
};

// 更新部门
export const updateDepartment = (id, departmentData) => {
  return api.put(`/departments/${id}`, departmentData);
};

// 删除部门
export const deleteDepartment = (id) => {
  return api.delete(`/departments/${id}`);
};