import api from './axios';

// 获取所有课程
export const getAllCourses = () => {
  return api.get('/courses');
};

// 获取单个课程
export const getCourse = (id) => {
  return api.get(`/courses/${id}`);
};

// 按学院获取课程
export const getCoursesByDepartment = (departmentId) => {
  return api.get(`/courses/department/${departmentId}`);
};

// 搜索课程
export const searchCourses = (keyword) => {
  return api.get(`/courses/search?keyword=${encodeURIComponent(keyword)}`);
};

// 创建课程
export const createCourse = (courseData) => {
  return api.post('/courses', courseData);
};

// 更新课程
export const updateCourse = (id, courseData) => {
  return api.put(`/courses/${id}`, courseData);
};

// 删除课程
export const deleteCourse = (id) => {
  return api.delete(`/courses/${id}`);
};