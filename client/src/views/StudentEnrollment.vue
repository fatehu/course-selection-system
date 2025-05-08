<template>
    <div class="enrollment-container">
      <el-card class="enrollment-card">
        <template #header>
          <div class="card-header">
            <span>课程选择</span>
            <el-input 
              v-model="searchKeyword" 
              placeholder="搜索课程" 
              clearable 
              class="search-input"
              @input="handleSearch"
            >
              <template #prefix>
                <el-icon class="el-input__icon"><search /></el-icon>
              </template>
            </el-input>
          </div>
        </template>
        
        <el-tabs v-model="activeTabs" @tab-click="handleTabClick">
          <el-tab-pane label="可选课程" name="available">
            <div v-if="loading" class="loading-placeholder">
              <el-skeleton :rows="5" animated />
            </div>
            
            <div v-else-if="availableSections.length === 0" class="empty-placeholder">
              暂无可选课程
            </div>
            
            <el-table 
              v-else 
              :data="availableSections" 
              style="width: 100%" 
              :empty-text="'暂无可选课程'"
            >
              <el-table-column prop="course_code" label="课程代码" width="120" />
              <el-table-column prop="course_name" label="课程名称" />
              <el-table-column prop="teacher_name" label="教师" width="120" />
              <el-table-column prop="semester" label="学期" width="120" />
              <el-table-column prop="time_slot" label="时间" />
              <el-table-column prop="location" label="地点" width="120" />
              <el-table-column label="剩余名额" width="120">
                <template #default="scope">
                  {{ scope.row.capacity - scope.row.current_enrollment }}/{{ scope.row.capacity }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="150">
                <template #default="scope">
                  <el-button 
                    type="primary" 
                    size="small" 
                    :disabled="isEnrolled(scope.row.id) || enrollingId === scope.row.id"
                    :loading="enrollingId === scope.row.id"
                    @click="enrollCourse(scope.row.id)"
                  >
                    {{ isEnrolled(scope.row.id) ? '已选' : '选课' }}
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
            
            <div class="pagination-container">
              <el-pagination
                v-model:current-page="currentPage"
                v-model:page-size="pageSize"
                :page-sizes="[10, 20, 50, 100]"
                layout="total, sizes, prev, pager, next, jumper"
                :total="totalAvailable"
                @size-change="handleSizeChange"
                @current-change="handleCurrentChange"
              />
            </div>
          </el-tab-pane>
          
          <el-tab-pane label="我的选课" name="enrolled">
            <div v-if="loading" class="loading-placeholder">
              <el-skeleton :rows="5" animated />
            </div>
            
            <div v-else-if="studentEnrollments.length === 0" class="empty-placeholder">
              暂无选课记录
            </div>
            
            <el-table 
              v-else 
              :data="studentEnrollments" 
              style="width: 100%" 
              :empty-text="'暂无选课记录'"
            >
              <el-table-column prop="course_code" label="课程代码" width="120" />
              <el-table-column prop="course_name" label="课程名称" />
              <el-table-column prop="teacher_name" label="教师" width="120" />
              <el-table-column prop="semester" label="学期" width="120" />
              <el-table-column prop="time_slot" label="时间" />
              <el-table-column prop="location" label="地点" width="120" />
              <el-table-column prop="status" label="状态" width="120">
                <template #default="scope">
                  <el-tag :type="getStatusType(scope.row.status)">
                    {{ getStatusText(scope.row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="150">
                <template #default="scope">
                  <el-popconfirm
                    title="确定要退选该课程吗？"
                    @confirm="dropCourse(scope.row.id)"
                    confirm-button-text="确定"
                    cancel-button-text="取消"
                  >
                    <template #reference>
                      <el-button 
                        type="danger" 
                        size="small" 
                        :disabled="scope.row.status === 'dropped' || droppingId === scope.row.id"
                        :loading="droppingId === scope.row.id"
                      >
                        退课
                      </el-button>
                    </template>
                  </el-popconfirm>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </div>
  </template>
  
  <script>
  import { ref, computed, onMounted } from 'vue';
  import { Search } from '@element-plus/icons-vue';
  import { ElMessage } from 'element-plus';
  import { useSectionStore } from '../store/sectionStore';
  import { useEnrollmentStore } from '../store/enrollmentStore';
  import { useUserStore } from '../store/userStore';
  
  export default {
    name: 'StudentEnrollmentView',
    components: {
      Search
    },
    setup() {
      const userStore = useUserStore();
      const sectionStore = useSectionStore();
      const enrollmentStore = useEnrollmentStore();
      
      const loading = ref(false);
      const activeTabs = ref('available');
      const searchKeyword = ref('');
      const currentPage = ref(1);
      const pageSize = ref(10);
      const totalAvailable = ref(0);
      const enrollingId = ref(null);
      const droppingId = ref(null);
      
      // 获取当前用户选择的课程
      const studentEnrollments = computed(() => {
        return enrollmentStore.studentEnrollments;
      });
      
      // 获取可选课程，并进行分页
      const availableSections = computed(() => {
        let sections = sectionStore.availableSections;
        
        // 过滤掉已经选了的课程
        sections = sections.filter(section => {
          return !isEnrolled(section.id);
        });
        
        // 根据搜索关键词筛选
        if (searchKeyword.value) {
          const keyword = searchKeyword.value.toLowerCase();
          sections = sections.filter(section => {
            return section.course_code.toLowerCase().includes(keyword) ||
                   section.course_name.toLowerCase().includes(keyword) ||
                   section.teacher_name.toLowerCase().includes(keyword);
          });
        }
        
        totalAvailable.value = sections.length;
        
        // 分页
        const start = (currentPage.value - 1) * pageSize.value;
        const end = start + pageSize.value;
        return sections.slice(start, end);
      });
      
      // 检查课程是否已选
      const isEnrolled = (sectionId) => {
        return studentEnrollments.value.some(enrollment => {
          return enrollment.section_id === sectionId && 
                (enrollment.status === 'enrolled' || enrollment.status === 'waitlisted');
        });
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
      
      // 加载数据
      const loadData = async () => {
        loading.value = true;
        
        try {
          await Promise.all([
            sectionStore.fetchAvailableSections(),
            enrollmentStore.fetchCurrentStudentEnrollments()
          ]);
        } catch (error) {
          console.error('加载数据失败', error);
          ElMessage.error('加载数据失败');
        } finally {
          loading.value = false;
        }
      };
      
      // 选课
      const enrollCourse = async (sectionId) => {
        enrollingId.value = sectionId;
        
        try {
          const response = await enrollmentStore.enrollCourse(sectionId, true);
          
          if (response.success) {
            ElMessage.success(response.message || '选课成功');
            // 刷新数据
            await loadData();
          }
        } catch (error) {
          console.error('选课失败', error);
          ElMessage.error(error.message || '选课失败');
        } finally {
          enrollingId.value = null;
        }
      };
      
      // 退课
      const dropCourse = async (enrollmentId) => {
        droppingId.value = enrollmentId;
        
        try {
          const response = await enrollmentStore.dropCourse(enrollmentId);
          
          if (response.success) {
            ElMessage.success(response.message || '退课成功');
            // 刷新数据
            await loadData();
          }
        } catch (error) {
          console.error('退课失败', error);
          ElMessage.error(error.message || '退课失败');
        } finally {
          droppingId.value = null;
        }
      };
      
      // 搜索处理
      const handleSearch = () => {
        currentPage.value = 1;
      };
      
      // 标签切换
      const handleTabClick = () => {
        // 如果切换到已选课程，刷新数据
        if (activeTabs.value === 'enrolled') {
          enrollmentStore.fetchCurrentStudentEnrollments();
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
      
      onMounted(() => {
        loadData();
      });
      
      return {
        loading,
        activeTabs,
        searchKeyword,
        currentPage,
        pageSize,
        totalAvailable,
        availableSections,
        studentEnrollments,
        enrollingId,
        droppingId,
        isEnrolled,
        getStatusText,
        getStatusType,
        enrollCourse,
        dropCourse,
        handleSearch,
        handleTabClick,
        handleSizeChange,
        handleCurrentChange
      };
    }
  };
  </script>
  
  <style scoped>
  .enrollment-container {
    padding: 20px;
  }
  
  .enrollment-card {
    margin-bottom: 20px;
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
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