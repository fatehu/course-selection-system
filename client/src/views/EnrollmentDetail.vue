<template>
    <div class="enrollment-detail-container">
      <el-card class="enrollment-detail-card">
        <template #header>
          <div class="card-header">
            <el-button @click="goBack" icon="arrow-left" circle plain></el-button>
            <span>选课记录详情</span>
            <div class="header-actions" v-if="isAdmin">
              <el-dropdown @command="handleStatusChange">
                <el-button type="primary">
                  更改状态
                  <el-icon class="el-icon--right"><arrow-down /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item 
                      command="enrolled" 
                      :disabled="enrollment?.status === 'enrolled'"
                    >
                      已选
                    </el-dropdown-item>
                    <el-dropdown-item 
                      command="waitlisted" 
                      :disabled="enrollment?.status === 'waitlisted'"
                    >
                      等待
                    </el-dropdown-item>
                    <el-dropdown-item 
                      command="dropped" 
                      :disabled="enrollment?.status === 'dropped'"
                    >
                      已退
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </template>
        
        <div v-if="loading" class="loading-placeholder">
          <el-skeleton :rows="6" animated />
        </div>
        
        <div v-else-if="!enrollment" class="empty-placeholder">
          选课记录不存在或已被删除
        </div>
        
        <div v-else class="enrollment-info">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="学生">{{ enrollment.student_name }}</el-descriptions-item>
            <el-descriptions-item label="选课状态">
              <el-tag :type="getStatusType(enrollment.status)">
                {{ getStatusText(enrollment.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="课程代码">{{ enrollment.course_code }}</el-descriptions-item>
            <el-descriptions-item label="课程名称">{{ enrollment.course_name }}</el-descriptions-item>
            <el-descriptions-item label="教师">{{ enrollment.teacher_name }}</el-descriptions-item>
            <el-descriptions-item label="学期">{{ enrollment.semester }}</el-descriptions-item>
            <el-descriptions-item label="上课时间">{{ enrollment.time_slot }}</el-descriptions-item>
            <el-descriptions-item label="上课地点">{{ enrollment.location }}</el-descriptions-item>
            <el-descriptions-item label="选课日期" :span="2">
              {{ formatDate(enrollment.enrollment_date) }}
            </el-descriptions-item>
          </el-descriptions>
          
          <div class="action-buttons" v-if="canDrop">
            <el-button type="danger" @click="dropEnrollment" :loading="actionLoading">
              退课
            </el-button>
          </div>
        </div>
      </el-card>
    </div>
  </template>
  
  <script>
  import { ref, computed, onMounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { ElMessage, ElMessageBox } from 'element-plus';
  import { ArrowDown } from '@element-plus/icons-vue';
  import { useEnrollmentStore } from '../store/enrollmentStore';
  import { useUserStore } from '../store/userStore';
  
  export default {
    name: 'EnrollmentDetailView',
    components: {
      ArrowDown
    },
    setup() {
      const route = useRoute();
      const router = useRouter();
      const enrollmentStore = useEnrollmentStore();
      const userStore = useUserStore();
      
      const loading = ref(true);
      const actionLoading = ref(false);
      const enrollmentId = route.params.id;
      
      // 用户信息和权限
      const isAdmin = computed(() => userStore.isAdmin);
      const isStudent = computed(() => userStore.isStudent);
      const userId = computed(() => userStore.userId);
      
      // 选课记录
      const enrollment = computed(() => enrollmentStore.currentEnrollment);
      
      // 是否可以退课
      const canDrop = computed(() => {
        return isStudent.value && 
               enrollment.value && 
               enrollment.value.student_id === userId.value && 
               enrollment.value.status !== 'dropped';
      });
      
      // 获取选课记录详情
      const fetchEnrollmentDetail = async () => {
        loading.value = true;
        
        try {
          await enrollmentStore.fetchEnrollment(enrollmentId);
        } catch (error) {
          console.error('获取选课记录详情失败', error);
          ElMessage.error('获取选课记录详情失败');
        } finally {
          loading.value = false;
        }
      };
      
      // 获取状态文本
      const getStatusText = (status) => {
        const statusMap = {
          enrolled: '已选',
          waitlisted: '等待',
          dropped: '已退'
        };
        return statusMap[status] || status;
      };
      
      // 获取状态类型
      const getStatusType = (status) => {
        const typeMap = {
          enrolled: 'success',
          waitlisted: 'warning',
          dropped: 'danger'
        };
        return typeMap[status] || 'info';
      };
      
      // 格式化日期
      const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleString();
      };
      
      // 退课
      const dropEnrollment = async () => {
        try {
          await ElMessageBox.confirm('确定要退课吗？', '确认', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          });
          
          actionLoading.value = true;
          
          const response = await enrollmentStore.dropCourse(enrollmentId);
          
          if (response.success) {
            ElMessage.success(response.message || '退课成功');
            // 刷新数据
            await fetchEnrollmentDetail();
          }
        } catch (error) {
          if (error !== 'cancel') {
            console.error('退课失败', error);
            ElMessage.error(typeof error === 'string' ? error : (error.message || '退课失败'));
          }
        } finally {
          actionLoading.value = false;
        }
      };
      
      // 更改选课状态
      const handleStatusChange = async (status) => {
        try {
          actionLoading.value = true;
          
          const response = await enrollmentStore.updateEnrollmentStatus(enrollmentId, status);
          
          if (response.success) {
            ElMessage.success('状态更新成功');
            // 刷新数据
            await fetchEnrollmentDetail();
          }
        } catch (error) {
          console.error('更改状态失败', error);
          ElMessage.error(error.message || '更改状态失败');
        } finally {
          actionLoading.value = false;
        }
      };
      
      // 返回上一页
      const goBack = () => {
        router.back();
      };
      
      onMounted(() => {
        fetchEnrollmentDetail();
      });
      
      return {
        loading,
        actionLoading,
        enrollment,
        isAdmin,
        isStudent,
        canDrop,
        getStatusText,
        getStatusType,
        formatDate,
        goBack,
        dropEnrollment,
        handleStatusChange
      };
    }
  };
  </script>
  
  <style scoped>
  .enrollment-detail-container {
    padding: 20px;
  }
  
  .enrollment-detail-card {
    margin-bottom: 20px;
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .header-actions {
    display: flex;
    gap: 10px;
  }
  
  .loading-placeholder,
  .empty-placeholder {
    padding: 20px 0;
    text-align: center;
    color: #909399;
  }
  
  .enrollment-info {
    margin-bottom: 20px;
  }
  
  .action-buttons {
    margin-top: 20px;
  }
  </style>