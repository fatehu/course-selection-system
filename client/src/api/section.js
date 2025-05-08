import api from './axios';

// 获取所有课程安排
export const getAllSections = () => {
  return api.get('/sections');
};

// 获取单个课程安排
export const getSection = (id) => {
  return api.get(`/sections/${id}`);
};

// 获取可用的课程安排
export const getAvailableSections = () => {
  return api.get('/sections/available');
};

// 按课程ID获取课程安排
export const getSectionsByCourse = (courseId) => {
  return api.get(`/sections/course/${courseId}`);
};

// 按教师ID获取课程安排
export const getSectionsByTeacher = (teacherId) => {
  return api.get(`/sections/teacher/${teacherId}`);
};

// 创建课程安排
export const createSection = (sectionData) => {
  return api.post('/sections', sectionData);
};

// 更新课程安排
export const updateSection = (id, sectionData) => {
  return api.put(`/sections/${id}`, sectionData);
};

// 删除课程安排
export const deleteSection = (id) => {
  return api.delete(`/sections/${id}`);
};