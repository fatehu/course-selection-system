import { defineStore } from 'pinia';
import { 
  getAllSections, 
  getSection, 
  getAvailableSections,
  getSectionsByCourse,
  getSectionsByTeacher,
  createSection,
  updateSection,
  deleteSection
} from '../api/section';

export const useSectionStore = defineStore('section', {
  state: () => ({
    sections: [],
    currentSection: null,
    availableSections: [],
    loading: false,
    error: null
  }),
  
  getters: {
    getSectionById: (state) => (id) => {
      return state.sections.find(section => section.id === id);
    },
    
    getSectionsByCourseId: (state) => (courseId) => {
      return state.sections.filter(section => section.course_id === courseId);
    }
  },
  
  actions: {
    // 获取所有课程安排
    async fetchAllSections() {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await getAllSections();
        
        if (response.success) {
          this.sections = response.data;
        }
        
        return response.data;
      } catch (error) {
        this.error = error.message || '获取课程安排列表失败';
        return [];
      } finally {
        this.loading = false;
      }
    },
    
    // 获取单个课程安排
    async fetchSection(id) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await getSection(id);
        
        if (response.success) {
          this.currentSection = response.data;
          
          // 更新排课列表中的排课
          const index = this.sections.findIndex(s => s.id === id);
          if (index !== -1) {
            this.sections[index] = response.data;
          } else {
            this.sections.push(response.data);
          }
        }
        
        return response.data;
      } catch (error) {
        this.error = error.message || '获取课程安排详情失败';
        return null;
      } finally {
        this.loading = false;
      }
    },
    
    // 获取可用的课程安排
    async fetchAvailableSections() {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await getAvailableSections();
        
        if (response.success) {
          this.availableSections = response.data;
        }
        
        return response.data;
      } catch (error) {
        this.error = error.message || '获取可用课程安排失败';
        return [];
      } finally {
        this.loading = false;
      }
    },
    
    // 按课程ID获取课程安排
    async fetchSectionsByCourse(courseId) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await getSectionsByCourse(courseId);
        
        if (response.success) {
          // 更新课程安排列表，保留不是该课程的排课
          this.sections = this.sections.filter(section => section.course_id !== parseInt(courseId));
          this.sections = [...this.sections, ...response.data];
        }
        
        return response.data;
      } catch (error) {
        this.error = error.message || '获取课程安排失败';
        return [];
      } finally {
        this.loading = false;
      }
    },
    
    // 按教师ID获取课程安排
    async fetchSectionsByTeacher(teacherId) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await getSectionsByTeacher(teacherId);
        
        return response.success ? response.data : [];
      } catch (error) {
        this.error = error.message || '获取教师课程安排失败';
        return [];
      } finally {
        this.loading = false;
      }
    },
    
    // 创建课程安排
    async createSection(sectionData) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await createSection(sectionData);
        
        if (response.success) {
          // 添加到课程安排列表
          this.sections.push(response.data);
        }
        
        return response;
      } catch (error) {
        this.error = error.message || '创建课程安排失败';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // 更新课程安排
    async updateSection(id, sectionData) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await updateSection(id, sectionData);
        
        if (response.success) {
          // 更新课程安排列表中的排课
          await this.fetchSection(id);
        }
        
        return response;
      } catch (error) {
        this.error = error.message || '更新课程安排失败';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // 删除课程安排
    async deleteSection(id) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await deleteSection(id);
        
        if (response.success) {
          // 从课程安排列表中移除
          this.sections = this.sections.filter(section => section.id !== id);
          
          // 如果当前排课被删除，清空当前排课
          if (this.currentSection && this.currentSection.id === id) {
            this.currentSection = null;
          }
        }
        
        return response;
      } catch (error) {
        this.error = error.message || '删除课程安排失败';
        throw error;
      } finally {
        this.loading = false;
      }
    }
  }
});