import { defineStore } from 'pinia';
import {
  getAllDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment
} from '../api/department';

export const useDepartmentStore = defineStore('department', {
  state: () => ({
    departments: [],
    currentDepartment: null,
    loading: false,
    error: null
  }),
  
  getters: {
    getDepartmentById: (state) => (id) => {
      return state.departments.find(dept => dept.id === id);
    }
  },
  
  actions: {
    // 获取所有部门
    async fetchAllDepartments() {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await getAllDepartments();
        
        if (response.success) {
          this.departments = response.data;
        }
        
        return response.data;
      } catch (error) {
        this.error = error.message || '获取部门列表失败';
        return [];
      } finally {
        this.loading = false;
      }
    },
    
    // 获取单个部门
    async fetchDepartment(id) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await getDepartment(id);
        
        if (response.success) {
          this.currentDepartment = response.data;
        }
        
        return response.data;
      } catch (error) {
        this.error = error.message || '获取部门详情失败';
        return null;
      } finally {
        this.loading = false;
      }
    },
    
    // 创建部门
    async createDepartment(departmentData) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await createDepartment(departmentData);
        
        if (response.success) {
          this.departments.push(response.data);
        }
        
        return response;
      } catch (error) {
        this.error = error.message || '创建部门失败';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // 更新部门
    async updateDepartment(id, departmentData) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await updateDepartment(id, departmentData);
        
        if (response.success) {
          const index = this.departments.findIndex(dept => dept.id === parseInt(id));
          if (index !== -1) {
            this.departments[index] = { ...this.departments[index], ...departmentData };
          }
          
          if (this.currentDepartment && this.currentDepartment.id === parseInt(id)) {
            this.currentDepartment = { ...this.currentDepartment, ...departmentData };
          }
        }
        
        return response;
      } catch (error) {
        this.error = error.message || '更新部门失败';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    
    // 删除部门
    async deleteDepartment(id) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await deleteDepartment(id);
        
        if (response.success) {
          this.departments = this.departments.filter(dept => dept.id !== parseInt(id));
          
          if (this.currentDepartment && this.currentDepartment.id === parseInt(id)) {
            this.currentDepartment = null;
          }
        }
        
        return response;
      } catch (error) {
        this.error = error.message || '删除部门失败';
        throw error;
      } finally {
        this.loading = false;
      }
    }
  }
});