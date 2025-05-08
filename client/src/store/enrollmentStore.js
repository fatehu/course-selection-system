import { defineStore } from 'pinia';
import { 
  getAllEnrollments, 
  getEnrollment, 
  getStudentEnrollments,
  getSectionEnrollments,
  enrollCourse,
  updateEnrollmentStatus,
  dropCourse,
  deleteEnrollment
} from '../api/enrollment';
import { useUserStore } from './userStore';

export const useEnrollmentStore = defineStore('enrollment', {
  state: () => ({
    enrollments: [],
    studentEnrollments: [],
    currentEnrollment: null,
    loading: false,
    error: null
  }),
  
  getters: {
    getEnrollmentById: (state) => (id) => {
      return state.enrollments.find(enrollment => enrollment.id === id);
    },
    
    getEnrollmentsBySectionId: (state) => (sectionId) => {
      return state.enrollments.filter(enrollment => enrollment.section_id === sectionId);
    }
  },
  
  actions: {
    // 获取所有选课记录
    async fetchAllEnrollments() {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await getAllEnrollments();
        
        if (response.success) {
          this.enrollments = response.data;
        }
        
        return response.data;
      } catch (error) {
        this.error = error.message || '获取选课记录列表失败';
        return [];
      } finally {
        this.loading = false;
      }
    },
    
    // 获取单个选课记录
    async fetchEnrollment(id) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await getEnrollment(id);
        
        if (response.success) {
          this.currentEnrollment = response.data;
          
          // 更新选课记录列表中的记录
          const index = this.enrollments.findIndex(e => e.id === id);
          if (index !== -1) {
            this.enrollments[index] = response.data;
          } else {
            this.enrollments.push(response.data);
          }
        }
        
        return response.data;
      } catch (error) {
        this.error = error.message || '获取选课记录详情失败';
        return null;
      } finally {
        this.loading = false;
      }
    },
    
    // 获取当前学生的选课记录
    async fetchCurrentStudentEnrollments() {
      const userStore = useUserStore();
      
      if (!userStore.userId || userStore.userRole !== 'student') {
        return [];
      }
      
      return this.fetchStudentEnrollments(userStore.userId);
    },
    
    // 获取学生的所有选课记录
    async fetchStudentEnrollments(studentId) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await getStudentEnrollments(studentId);
        
        if (response.success) {
          this.studentEnrollments = response.data;
        }
        
        return response.data;
      } catch (error) {
        this.error = error.message || '获取学生选课记录失败';
        return [];
      } finally {
        this.loading = false;
      }
    },
    
    // 获取课程安排的所有选课记录
    async fetchSectionEnrollments(sectionId) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await getSectionEnrollments(sectionId);
        
        if (response.success) {
          // 更新选课记录列表
          const filteredEnrollments = this.enrollments.filter(
            enrollment => enrollment.section_id !== parseInt(sectionId)
          );
          this.enrollments = [...filteredEnrollments, ...response.data];
        }
        
        return response.data;
      } catch (error) {
        this.error = error.message || '获取课程安排选课记录失败';
        return [];
      } finally {
        this.loading = false;
      }
    },
    
    // 学生选课
    async enrollCourse(sectionId, allowWaitlist = false) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await enrollCourse(sectionId, allowWaitlist);
        
        if (response.success) {
          // 添加到选课记录列表
          this.studentEnrollments.push(response.data);
          
          // 刷新学生选课记录
          const userStore = useUserStore();
          if (userStore.userRole === 'student') {
            await this.fetchStudentEnrollments(userStore.userId);
          }
        }
        
        return response;
      } catch (error) {
        this.error = error.message || '选课失败';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // 更新选课状态
    async updateEnrollmentStatus(id, status) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await updateEnrollmentStatus(id, status);
        
        if (response.success) {
          // 更新选课记录
          await this.fetchEnrollment(id);
          
          // 如果是当前学生的选课记录，也更新学生选课记录列表
          const userStore = useUserStore();
          if (userStore.userRole === 'student') {
            const index = this.studentEnrollments.findIndex(e => e.id === id);
            if (index !== -1) {
              await this.fetchStudentEnrollments(userStore.userId);
            }
          }
        }
        
        return response;
      } catch (error) {
        this.error = error.message || '更新选课状态失败';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // 退课
    async dropCourse(id) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await dropCourse(id);
        
        if (response.success) {
          // 如果是当前学生的选课记录，更新学生选课记录列表
          const userStore = useUserStore();
          if (userStore.userRole === 'student') {
            await this.fetchStudentEnrollments(userStore.userId);
          }
          
          // 更新选课记录列表
          await this.fetchEnrollment(id);
        }
        
        return response;
      } catch (error) {
        this.error = error.message || '退课失败';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    // 删除选课记录（仅管理员）
    async deleteEnrollment(id) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await deleteEnrollment(id);
        
        if (response.success) {
          // 从列表中移除该记录
          this.enrollments = this.enrollments.filter(e => e.id !== parseInt(id));
          
          // 如果当前记录被删除，清空当前记录
          if (this.currentEnrollment && this.currentEnrollment.id === parseInt(id)) {
            this.currentEnrollment = null;
          }
        }
        
        return response;
      } catch (error) {
        this.error = error.message || '删除选课记录失败';
        throw error;
      } finally {
        this.loading = false;
      }
    }
  }
});