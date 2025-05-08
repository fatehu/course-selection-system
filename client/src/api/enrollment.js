import api from './axios';

// 获取所有选课记录
export const getAllEnrollments = () => {
  return api.get('/enrollments');
};

// 获取单个选课记录
export const getEnrollment = (id) => {
  return api.get(`/enrollments/${id}`);
};

// 获取学生的所有选课记录
export const getStudentEnrollments = (studentId) => {
  return api.get(`/enrollments/student/${studentId}`);
};

// 获取课程安排的所有选课记录
export const getSectionEnrollments = (sectionId) => {
  return api.get(`/enrollments/section/${sectionId}`);
};

// 学生选课
export const enrollCourse = (sectionId, allowWaitlist = false) => {
  return api.post('/enrollments', { section_id: sectionId, allowWaitlist });
};

// 更新选课状态
export const updateEnrollmentStatus = (id, status) => {
  return api.put(`/enrollments/${id}/status`, { status });
};

// 退课
export const dropCourse = (id) => {
  return api.put(`/enrollments/${id}/drop`);
};

// 删除选课记录（管理员）
export const deleteEnrollment = (id) => {
  return api.delete(`/enrollments/${id}`);
};