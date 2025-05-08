<template>
    <div class="section-detail-container">
      <el-card class="section-detail-card">
        <template #header>
          <div class="card-header">
            <el-button @click="goBack" icon="arrow-left" circle plain></el-button>
            <span>课程安排详情</span>
            <div class="header-actions" v-if="isAdmin || (isTeacher && isMySection)">
              <el-button type="primary" @click="editSection">编辑排课</el-button>
            </div>
          </div>
        </template>
        
        <div v-if="loading" class="loading-placeholder">
          <el-skeleton :rows="6" animated />
        </div>
        
        <div v-else-if="!section" class="empty-placeholder">
          课程安排不存在或已被删除
        </div>
        
        <div v-else class="section-info">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="课程代码">{{ section.course_code }}</el-descriptions-item>
            <el-descriptions-item label="课程名称">{{ section.course_name }}</el-descriptions-item>
            <el-descriptions-item label="教师">{{ section.teacher_name }}</el-descriptions-item>
            <el-descriptions-item label="学期">{{ section.semester }}</el-descriptions-item>
            <el-descriptions-item label="上课时间">{{ section.time_slot }}</el-descriptions-item>
            <el-descriptions-item label="上课地点">{{ section.location }}</el-descriptions-item>
            <el-descriptions-item label="容量">{{ section.capacity }}</el-descriptions-item>
            <el-descriptions-item label="已选人数">{{ section.current_enrollment }}</el-descriptions-item>
          </el-descriptions>
          
          <div class="section-actions" v-if="isStudent && !loading">
            <el-button 
              v-if="enrollmentStatus === null && !isFull" 
              type="primary" 
              @click="enrollSection"
              :loading="actionLoading"
            >
              选课
            </el-button>
            
            <el-button 
              v-if="enrollmentStatus === null && isFull" 
              type="warning" 
              @click="waitlistSection"
              :loading="actionLoading"
            >
              加入等待列表
            </el-button>
            
            <el-button 
              v-if="enrollmentStatus !== null && enrollmentStatus !== 'dropped'" 
              type="danger" 
              @click="dropSection"
              :loading="actionLoading"
            >
              退课
            </el-button>
            
            <el-tag v-if="enrollmentStatus === 'enrolled'" type="success">已选</el-tag>
            <el-tag v-if="enrollmentStatus === 'waitlisted'" type="warning">等待列表</el-tag>
            <el-tag v-if="enrollmentStatus === 'dropped'" type="danger">已退课</el-tag>
          </div>
        </div>
        
        <el-divider v-if="isAdmin || isTeacher"></el-divider>
        
        <div v-if="isAdmin || isTeacher">
          <h3 class="enrollment-title">选课学生列表</h3>
          
          <div v-if="loadingEnrollments" class="loading-placeholder">
            <el-skeleton :rows="3" animated />
          </div>
          
          <div v-else-if="enrollments.length === 0" class="empty-placeholder">
            暂无学生选课
          </div>
          
          <el-table v-else :data="enrollments" style="width: 100%">
            <el-table-column prop="student_name" label="学生姓名" />
            <el-table-column prop="status" label="状态" width="120">
              <template #default="scope">
                <el-tag 
                  :type="getStatusType(scope.row.status)"
                >
                  {{ getStatusText(scope.row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="enrollment_date" label="选课时间" width="180">
              <template #default="scope">
                {{ formatDate(scope.row.enrollment_date) }}
              </template>
            </el-table-column>
            <el-table-column v-if="isAdmin" label="操作" width="180">
              <template #default="scope">
                <el-dropdown @command="(command) => handleStatusChange(scope.row.id, command)">
                  <el-button link type="primary">
                    更改状态
                    <el-icon class="el-icon--right"><arrow-down /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item 
                        command="enrolled" 
                        :disabled="scope.row.status === 'enrolled'"
                      >
                        已选
                      </el-dropdown-item>
                      <el-dropdown-item 
                        command="waitlisted" 
                        :disabled="scope.row.status === 'waitlisted'"
                      >
                        等待
                      </el-dropdown-item>
                      <el-dropdown-item 
                        command="dropped" 
                        :disabled="scope.row.status === 'dropped'"
                      >
                        已退
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-card>
    </div>
  </template>
  
  <script>
  import { ref, computed, onMounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { ElMessage, ElMessageBox } from 'element-plus';
  import { ArrowDown } from '@element-plus/icons-vue';
  import { useSectionStore } from '../store/sectionStore';
  import { useEnrollmentStore } from '../store/enrollmentStore';
  import { useUserStore } from '../store/userStore';
  
  export default {
    name: 'SectionDetailView',
    components: {
      ArrowDown
    },
    setup() {
      const route = useRoute();
      const router = useRouter();
      const sectionStore = useSectionStore();
      const enrollmentStore = useEnrollmentStore();
      const userStore = useUserStore();
      
      const loading = ref(true);
      const loadingEnrollments = ref(true);
      const actionLoading = ref(false);
      const sectionId = route.params.id;
      
      // 用户信息和权限
      const isAdmin = computed(() => userStore.isAdmin);
      const isTeacher = computed(() => userStore.isTeacher);
      const isStudent = computed(() => userStore.isStudent);
      const userId = computed(() => userStore.userId);
      
      // 当前排课信息
      const section = computed(() => sectionStore.currentSection);
      
      // 是否是自己的排课（教师）
      const isMySection = computed(() => {
        return section.value && section.value.teacher_id === userId.value;
      });
      
      // 是否已满
      const isFull = computed(() => {
        return section.value && section.value.current_enrollment >= section.value.capacity;
      });
      
      // 选课状态
      const enrollmentStatus = ref(null);
      const enrollmentId = ref(null);
      
      // 选课学生列表
      const enrollments = ref([]);
      
      // 获取排课详情
      const fetchSectionDetail = async () => {
        loading.value = true;
        
        try {
          await sectionStore.fetchSection(sectionId);
          
          if (isStudent.value) {
            await checkEnrollmentStatus();
          }
        } catch (error) {
          console.error('获取排课详情失败', error);
          ElMessage.error('获取排课详情失败');
        } finally {
          loading.value = false;
        }
      };
      
      // 获取选课记录
      const fetchEnrollments = async () => {
        if (!isAdmin.value && !isTeacher.value) return;
        
        loadingEnrollments.value = true;
        
        try {
          const result = await enrollmentStore.fetchSectionEnrollments(sectionId);
          enrollments.value = result;
        } catch (error) {
          console.error('获取选课记录失败', error);
          ElMessage.error('获取选课记录失败');
        } finally {
          loadingEnrollments.value = false;
        }
      };
      
      // 检查选课状态
      const checkEnrollmentStatus = async () => {
        if (!isStudent.value) return;
        
        try {
          await enrollmentStore.fetchCurrentStudentEnrollments();
          
          // 查找当前排课的选课记录
          const enrollment = enrollmentStore.studentEnrollments.find(
            e => e.section_id === parseInt(sectionId)
          );
          
          if (enrollment) {
            enrollmentStatus.value = enrollment.status;
            enrollmentId.value = enrollment.id;
          } else {
            enrollmentStatus.value = null;
            enrollmentId.value = null;
          }
        } catch (error) {
          console.error('检查选课状态失败', error);
        }
      };
      
      // 选课
      const enrollSection = async () => {
        actionLoading.value = true;
        
        try {
          const response = await enrollmentStore.enrollCourse(sectionId);
          
          if (response.success) {
            ElMessage.success(response.message || '选课成功');
            // 刷新数据
            await fetchSectionDetail();
            await fetchEnrollments();
          }
        } catch (error) {
          console.error('选课失败', error);
          ElMessage.error(error.message || '选课失败');
        } finally {
          actionLoading.value = false;
        }
      };
      
      // 加入等待列表
      const waitlistSection = async () => {
        actionLoading.value = true;
        
        try {
          const response = await enrollmentStore.enrollCourse(sectionId, true);
          
          if (response.success) {
            ElMessage.success(response.message || '已加入等待列表');
            // 刷新数据
            await fetchSectionDetail();
            await fetchEnrollments();
          }
        } catch (error) {
          console.error('加入等待列表失败', error);
          ElMessage.error(error.message || '加入等待列表失败');
        } finally {
          actionLoading.value = false;
        }
      };
      
      // 退课
      const dropSection = async () => {
        if (!enrollmentId.value) return;
        
        try {
          await ElMessageBox.confirm('确定要退课吗？', '确认', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          });
          
          actionLoading.value = true;
          
          const response = await enrollmentStore.dropCourse(enrollmentId.value);
          
          if (response.success) {
            ElMessage.success(response.message || '退课成功');
            // 刷新数据
            await fetchSectionDetail();
            await fetchEnrollments();
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
      
      // 更改选课状态（管理员）
      const handleStatusChange = async (id, status) => {
        try {
          const response = await enrollmentStore.updateEnrollmentStatus(id, status);
          
          if (response.success) {
            ElMessage.success('状态更新成功');
            // 刷新数据
            await fetchSectionDetail();
            await fetchEnrollments();
          }
        } catch (error) {
          console.error('更改状态失败', error);
          ElMessage.error(error.message || '更改状态失败');
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
      
      // 返回上一页
      const goBack = () => {
        router.back();
      };
      
      // 编辑排课
      const editSection = () => {
        router.push(`/sections/${sectionId}/edit`);
      };
      
      onMounted(() => {
        fetchSectionDetail();
        fetchEnrollments();
      });
      
      return {
        loading,
        loadingEnrollments,
        actionLoading,
        section,
        enrollments,
        isAdmin,
        isTeacher,
        isStudent,
        isMySection,
        isFull,
        enrollmentStatus,
        enrollmentId,
        goBack,
        editSection,
        enrollSection,
        waitlistSection,
        dropSection,
        handleStatusChange,
        getStatusText,
        getStatusType,
        formatDate
      };
    }
  };
  </script>
  
<style scoped>
.section-detail-container {
  padding: 20px;
}

.section-detail-card {
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

.section-info {
  margin-bottom: 20px;
}

.section-actions {
  margin-top: 20px;
  display: flex;
  gap: 10px;
  align-items: center;
}

.enrollment-title {
  margin-bottom: 20px;
  font-weight: 500;
  color: #303133;
}
</style>