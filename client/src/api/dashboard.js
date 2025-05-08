import api from './axios';

// 获取仪表盘统计数据
export const getDashboardStats = () => {
  return api.get('/dashboard/stats');
};

// 获取最近课程列表
export const getRecentCourses = (limit = 5) => {
  return api.get(`/dashboard/recent-courses?limit=${limit}`);
};

// 获取教师的课程安排
export const getTeacherSections = (teacherId) => {
  return api.get(`/dashboard/teacher-sections/${teacherId}`);
};

// 获取学生的选课记录
export const getStudentEnrollments = (studentId) => {
  return api.get(`/dashboard/student-enrollments/${studentId}`);
};