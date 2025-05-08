import { defineStore } from 'pinia';
import { 
  getAllCourses, 
  getCourse, 
  getCoursesByDepartment, 
  searchCourses,
  createCourse,
  updateCourse,
  deleteCourse
} from '../api/course';

export const useCourseStore = defineStore('course', {
  state: () => ({
    courses: [],
    currentCourse: null,
    loading: false,
    error: null
  }),
  
  getters: {
    getCourseById: (state) => (id) => {
      return state.courses.find(course => course.id === id);
    }
  },
  
  actions: {
    // 获取所有课程
    async fetchAllCourses() {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await getAllCourses();
        
        if (response.success) {
          this.courses = response.data;
        }
        
        return response.data;
      } catch (error) {
        this.error = error.message || '获取课程列表失败';
        return [];
      } finally {
        this.loading = false;
      }
    },
    
    // 获取单个课程
    async fetchCourse(id) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await getCourse(id);
        
        if (response.success) {
          this.currentCourse = response.data;
          
          // 更新课程列表中的课程
          const index = this.courses.findIndex(c => c.id === id);
          if (index !== -1) {
            this.courses[index] = response.data;
          } else {
            this.courses.push(response.data);
          }
        }
        
        return response.data;
      } catch (error) {
        this.error = error.message || '获取课程详情失败';
        return null;
      } finally {
        this.loading = false;
      }
    },
    
    // 按学院获取课程
    async fetchCoursesByDepartment(departmentId) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await getCoursesByDepartment(departmentId);
        
        if (response.success) {
          // 只更新该学院的课程
          this.courses = this.courses.filter(course => course.department_id !== departmentId);
          this.courses = [...this.courses, ...response.data];
        }
        
        return response.data;
      } catch (error) {
        this.error = error.message || '获取学院课程失败';
        return [];
      } finally {
        this.loading = false;
      }
    },
    
    // 搜索课程
    async searchCourses(keyword) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await searchCourses(keyword);
        
        return response.success ? response.data : [];
      } catch (error) {
        this.error = error.message || '搜索课程失败';
        return [];
      } finally {
        this.loading = false;
      }
    },
    
    // 创建课程
    async createCourse(courseData) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await createCourse(courseData);
        
        if (response.success) {
          // 添加到课程列表
          this.courses.push(response.data);
        }
        
        return response;
      } catch (error) {
        this.error = error.message || '创建课程失败';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // 更新课程
    async updateCourse(id, courseData) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await updateCourse(id, courseData);
        
        if (response.success) {
          // 更新课程列表中的课程
          await this.fetchCourse(id);
        }
        
        return response;
      } catch (error) {
        this.error = error.message || '更新课程失败';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // 删除课程
    async deleteCourse(id) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await deleteCourse(id);
        
        if (response.success) {
          // 从课程列表中移除
          this.courses = this.courses.filter(course => course.id !== id);
          
          // 如果当前课程被删除，清空当前课程
          if (this.currentCourse && this.currentCourse.id === id) {
            this.currentCourse = null;
          }
        }
        
        return response;
      } catch (error) {
        this.error = error.message || '删除课程失败';
        throw error;
      } finally {
        this.loading = false;
      }
    }
  }
});