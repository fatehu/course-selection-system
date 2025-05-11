<template>
    <div class="enrollment-list-container">
      <el-card class="enrollment-list-card">
        <template #header>
          <div class="card-header">
            <span>选课记录</span>
            <div class="header-actions">
              <el-input 
                v-model="searchKeyword" 
                placeholder="搜索学生或课程" 
                clearable 
                class="search-input"
                @input="handleSearch"
              >
                <template #prefix>
                  <el-icon><search /></el-icon>
                </template>
              </el-input>
            </div>
          </div>
        </template>
        
        <el-tabs v-model="activeTab" @tab-click="handleTabChange">
          <el-tab-pane label="所有选课记录" name="all">
            <div v-if="loading" class="loading-placeholder">
              <el-skeleton :rows="5" animated />
            </div>
            
            <div v-else-if="filteredEnrollments.length === 0" class="empty-placeholder">
              暂无选课记录
            </div>
            
            <el-table 
              v-else 
              :data="filteredEnrollments" 
              style="width: 100%"
              :empty-text="'暂无选课记录'"
            >
              <el-table-column prop="student_name" label="学生" width="120" />
              <el-table-column prop="course_code" label="课程代码" width="120" />
              <el-table-column prop="course_name" label="课程名称" />
              <el-table-column prop="teacher_name" label="教师" width="120" />
              <el-table-column prop="semester" label="学期" width="120" />
              <el-table-column prop="status" label="状态" width="100">
                <template #default="scope">
                  <el-tag :type="getStatusType(scope.row.status)">
                    {{ getStatusText(scope.row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="enrollment_date" label="选课日期" width="180">
                <template #default="scope">
                  {{ formatDate(scope.row.enrollment_date) }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="150">
                <template #default="scope">
                  <el-button link type="primary" @click="viewEnrollment(scope.row.id)">
                    查看
                  </el-button>
                  
                  <el-dropdown v-if="isAdmin" @command="(command) => handleStatusChange(scope.row.id, command)">
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

                  <!-- 添加删除按钮 - 仅管理员可见 -->
                  <el-popconfirm
                    v-if="isAdmin"
                    title="确定删除此选课记录吗？"
                    @confirm="handleDeleteEnrollment(scope.row.id)"
                    confirm-button-text="确定"
                    cancel-button-text="取消"
                  >
                    <template #reference>
                      <el-button link type="danger" :loading="deletingId === scope.row.id">
                        删除
                      </el-button>
                    </template>
                  </el-popconfirm>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
          
          <el-tab-pane v-if="isTeacher" label="我的课程选课记录" name="teacher">
            <div v-if="loading" class="loading-placeholder">
              <el-skeleton :rows="5" animated />
            </div>
            
            <div v-else-if="teacherEnrollments.length === 0" class="empty-placeholder">
              暂无选课记录
            </div>
            
            <el-table 
              v-else 
              :data="teacherEnrollments" 
              style="width: 100%"
              :empty-text="'暂无选课记录'"
            >
              <el-table-column prop="student_name" label="学生" width="120" />
              <el-table-column prop="course_code" label="课程代码" width="120" />
              <el-table-column prop="course_name" label="课程名称" />
              <el-table-column prop="semester" label="学期" width="120" />
              <el-table-column prop="status" label="状态" width="100">
                <template #default="scope">
                  <el-tag :type="getStatusType(scope.row.status)">
                    {{ getStatusText(scope.row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="enrollment_date" label="选课日期" width="180">
                <template #default="scope">
                  {{ formatDate(scope.row.enrollment_date) }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="120">
                <template #default="scope">
                  <el-button link type="primary" @click="viewEnrollment(scope.row.id)">
                    查看
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
        
        <div class="pagination-container">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            :total="totalEnrollments"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </el-card>
    </div>
  </template>
  
  <script>
  import { ref, computed, onMounted, watch } from 'vue';
  import { useRouter } from 'vue-router';
  import { ElMessage } from 'element-plus';
  import { Search, ArrowDown } from '@element-plus/icons-vue';
  import { useEnrollmentStore } from '../store/enrollmentStore';
  import { useUserStore } from '../store/userStore';
  
  export default {
    name: 'EnrollmentListView',
    components: {
      Search,
      ArrowDown
    },
    setup() {
      const router = useRouter();
      const enrollmentStore = useEnrollmentStore();
      const userStore = useUserStore();
      
      const loading = ref(true);
      const searchKeyword = ref('');
      const currentPage = ref(1);
      const pageSize = ref(10);
      const activeTab = ref('all');
      const deletingId = ref(null); // 删除状态标识
      
      // 用户信息和权限
      const isAdmin = computed(() => userStore.isAdmin);
      const isTeacher = computed(() => userStore.isTeacher);
      const userId = computed(() => userStore.userId);
      
      // 所有选课记录
      const allEnrollments = computed(() => {
        return enrollmentStore.enrollments;
      });
      
      // 过滤后的选课记录（根据关键词搜索）
      const filteredEnrollments = computed(() => {
        let enrollments = allEnrollments.value;
        
        // 根据关键词搜索
        if (searchKeyword.value) {
          const keyword = searchKeyword.value.toLowerCase();
          enrollments = enrollments.filter(enrollment => {
            return enrollment.student_name.toLowerCase().includes(keyword) ||
                   enrollment.course_code.toLowerCase().includes(keyword) ||
                   enrollment.course_name.toLowerCase().includes(keyword) ||
                   enrollment.teacher_name.toLowerCase().includes(keyword);
          });
        }
        
        // 分页
        const start = (currentPage.value - 1) * pageSize.value;
        const end = start + pageSize.value;
        return enrollments.slice(start, end);
      });
      
      // 教师自己课程的选课记录
      const teacherEnrollments = computed(() => {
        if (!isTeacher.value) return [];
        
        // 确保类型一致
        const currentUserId = parseInt(userId.value);
        
        let enrollments = allEnrollments.value.filter(
          enrollment => enrollment.teacher_id === currentUserId
        );
        
        // 根据关键词搜索
        if (searchKeyword.value) {
          const keyword = searchKeyword.value.toLowerCase();
          enrollments = enrollments.filter(enrollment => {
            return enrollment.student_name.toLowerCase().includes(keyword) ||
                   enrollment.course_code.toLowerCase().includes(keyword) ||
                   enrollment.course_name.toLowerCase().includes(keyword);
          });
        }
        
        // 分页
        const start = (currentPage.value - 1) * pageSize.value;
        const end = start + pageSize.value;
        return enrollments.slice(start, end);
      });
      
      // 总记录数
      const totalEnrollments = computed(() => {
        if (activeTab.value === 'teacher' && isTeacher.value) {
          let enrollments = allEnrollments.value.filter(
            enrollment => enrollment.teacher_id === userId.value
          );
          
          // 根据关键词搜索
          if (searchKeyword.value) {
            const keyword = searchKeyword.value.toLowerCase();
            enrollments = enrollments.filter(enrollment => {
              return enrollment.student_name.toLowerCase().includes(keyword) ||
                     enrollment.course_code.toLowerCase().includes(keyword) ||
                     enrollment.course_name.toLowerCase().includes(keyword);
            });
          }
          
          return enrollments.length;
        } else {
          let enrollments = allEnrollments.value;
          
          // 根据关键词搜索
          if (searchKeyword.value) {
            const keyword = searchKeyword.value.toLowerCase();
            enrollments = enrollments.filter(enrollment => {
              return enrollment.student_name.toLowerCase().includes(keyword) ||
                     enrollment.course_code.toLowerCase().includes(keyword) ||
                     enrollment.course_name.toLowerCase().includes(keyword) ||
                     enrollment.teacher_name.toLowerCase().includes(keyword);
            });
          }
          
          return enrollments.length;
        }
      });
      
      // 加载选课记录
      const loadEnrollments = async () => {
        loading.value = true;
        
        try {
          await enrollmentStore.fetchAllEnrollments();
        } catch (error) {
          console.error('获取选课记录失败', error);
          ElMessage.error('获取选课记录失败');
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
      
      // 搜索处理
      const handleSearch = () => {
        currentPage.value = 1;
      };
      
      // 标签切换
      const handleTabChange = () => {
        currentPage.value = 1;
      };
      
      // 查看选课记录详情
      const viewEnrollment = (id) => {
        router.push(`/enrollments/${id}`);
      };
      
      // 更改选课状态
      const handleStatusChange = async (id, status) => {
        try {
          const response = await enrollmentStore.updateEnrollmentStatus(id, status);
          
          if (response.success) {
            ElMessage.success('状态更新成功');
            // 刷新选课记录
            await loadEnrollments();
          }
        } catch (error) {
          console.error('更改状态失败', error);
          ElMessage.error(error.message || '更改状态失败');
        }
      };

      // 删除选课记录
      const handleDeleteEnrollment = async (id) => {
        deletingId.value = id; // 设置当前正在删除的ID
        
        try {
          const response = await enrollmentStore.deleteEnrollment(id);
          
          if (response.success) {
            ElMessage.success('选课记录删除成功');
            // 确保删除后重新加载数据，而不是依赖状态更新
            await loadEnrollments();
          } else {
            ElMessage.error(response.message || '删除选课记录失败');
          }
        } catch (error) {
          console.error('删除选课记录失败', error);
          ElMessage.error(error.message || '删除选课记录失败');
        } finally {
          deletingId.value = null; // 无论成功失败都重置删除状态
        }
      };
      
      // 分页大小改变
      const handleSizeChange = (val) => {
        pageSize.value = val;
        currentPage.value = 1;
      };
      
      // 当前页改变
      const handleCurrentChange = (val) => {
        currentPage.value = val;
      };
      
      // 监听关键词和标签变化，重置当前页
      watch([searchKeyword, activeTab], () => {
        currentPage.value = 1;
      });
      
      onMounted(() => {
        loadEnrollments();
      });
      
      return {
      loading,
      searchKeyword,
      currentPage,
      pageSize,
      activeTab,
      filteredEnrollments,
      teacherEnrollments,
      totalEnrollments,
      isAdmin,
      isTeacher,
      deletingId, // 导出删除状态
      getStatusText,
      getStatusType,
      formatDate,
      handleSearch,
      handleTabChange,
      viewEnrollment,
      handleStatusChange,
      handleDeleteEnrollment, // 导出删除处理函数
      handleSizeChange,
      handleCurrentChange
    };
  }
};
</script>
  
<style scoped>
.enrollment-list-container {
  padding: 20px;
}

.enrollment-list-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.search-input {
  width: 250px;
}

.loading-placeholder,
.empty-placeholder {
  padding: 20px 0;
  text-align: center;
  color: #909399;
}

.pagination-container {
  margin-top: 20px;
  text-align: right;
}
</style>