<template>
    <div class="course-detail-container">
      <el-card class="course-detail-card">
        <template #header>
          <div class="card-header">
            <el-button @click="goBack" icon="arrow-left" circle plain></el-button>
            <span>课程详情</span>
            <div class="header-actions" v-if="isAdmin || isTeacher">
              <el-button type="primary" @click="editCourse">编辑课程</el-button>
            </div>
          </div>
        </template>
        
        <div v-if="loading" class="loading-placeholder">
          <el-skeleton :rows="6" animated />
        </div>
        
        <div v-else-if="!course" class="empty-placeholder">
          课程不存在或已被删除
        </div>
        
        <div v-else class="course-info">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="课程代码">{{ course.code }}</el-descriptions-item>
            <el-descriptions-item label="课程名称">{{ course.name }}</el-descriptions-item>
            <el-descriptions-item label="所属学院">{{ course.department_name }}</el-descriptions-item>
            <el-descriptions-item label="学分">{{ course.credits }}</el-descriptions-item>
            <el-descriptions-item label="课程描述" :span="2">
              <p class="course-description">{{ course.description || '暂无描述' }}</p>
            </el-descriptions-item>
          </el-descriptions>
        </div>
        
        <el-divider></el-divider>
        
        <h3 class="section-title">课程安排</h3>
        
        <div v-if="loadingSections" class="loading-placeholder">
          <el-skeleton :rows="3" animated />
        </div>
        
        <div v-else-if="sections.length === 0" class="empty-placeholder">
          暂无课程安排
          <div v-if="isAdmin || isTeacher" class="mt-3">
            <el-button type="primary" @click="createSection">创建课程安排</el-button>
          </div>
        </div>
        
        <div v-else>
          <div v-if="isAdmin || isTeacher" class="action-bar">
            <el-button type="primary" @click="createSection">创建课程安排</el-button>
          </div>
          
          <el-table :data="sections" style="width: 100%">
            <el-table-column prop="semester" label="学期" width="120" />
            <el-table-column prop="teacher_name" label="教师" width="120" />
            <el-table-column prop="time_slot" label="时间" />
            <el-table-column prop="location" label="地点" width="120" />
            <el-table-column label="选课情况" width="120">
              <template #default="scope">
                {{ scope.row.current_enrollment }}/{{ scope.row.capacity }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200">
              <template #default="scope">
                <el-button link type="primary" @click="viewSection(scope.row.id)">查看</el-button>
                
                <el-button 
                  v-if="isAdmin || (isTeacher && scope.row.teacher_id === userId)" 
                  link 
                  type="primary" 
                  @click="editSection(scope.row.id)"
                >
                  编辑
                </el-button>
                
                <el-button 
                  v-if="isStudent && !isFull(scope.row)" 
                  link 
                  type="success" 
                  @click="enrollSection(scope.row.id)"
                >
                  选课
                </el-button>
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
  import { ElMessage } from 'element-plus';
  import { useCourseStore } from '../store/courseStore';
  import { useSectionStore } from '../store/sectionStore';
  import { useEnrollmentStore } from '../store/enrollmentStore';
  import { useUserStore } from '../store/userStore';
  
  export default {
    name: 'CourseDetailView',
    setup() {
      const route = useRoute();
      const router = useRouter();
      const courseStore = useCourseStore();
      const sectionStore = useSectionStore();
      const enrollmentStore = useEnrollmentStore();
      const userStore = useUserStore();
      
      const loading = ref(true);
      const loadingSections = ref(true);
      const courseId = route.params.id;
      
      // 用户信息和权限
      const isAdmin = computed(() => userStore.isAdmin);
      const isTeacher = computed(() => userStore.isTeacher);
      const isStudent = computed(() => userStore.isStudent);
      const userId = computed(() => userStore.userId);
      
      // 当前课程信息
      const course = computed(() => courseStore.currentCourse);
      
      // 课程安排列表
      const sections = ref([]);
      
      // 获取课程详情
      const fetchCourseDetail = async () => {
        loading.value = true;
        
        try {
          await courseStore.fetchCourse(courseId);
        } catch (error) {
          console.error('获取课程详情失败', error);
          ElMessage.error('获取课程详情失败');
        } finally {
          loading.value = false;
        }
      };
      
      // 获取课程安排
      const fetchSections = async () => {
        loadingSections.value = true;
        
        try {
          const result = await sectionStore.fetchSectionsByCourse(courseId);
          sections.value = result;
        } catch (error) {
          console.error('获取课程安排失败', error);
          ElMessage.error('获取课程安排失败');
        } finally {
          loadingSections.value = false;
        }
      };
      
      // 返回上一页
      const goBack = () => {
        router.back();
      };
      
      // 编辑课程
      const editCourse = () => {
        router.push(`/courses/${courseId}/edit`);
      };
      
      // 创建课程安排
      const createSection = () => {
        router.push({
          path: '/sections/create',
          query: { courseId }
        });
      };
      
      // 查看排课详情
      const viewSection = (sectionId) => {
        router.push(`/sections/${sectionId}`);
      };
      
      // 编辑排课
      const editSection = (sectionId) => {
        router.push(`/sections/${sectionId}/edit`);
      };
      
      // 选课
      const enrollSection = async (sectionId) => {
        try {
          const response = await enrollmentStore.enrollCourse(sectionId);
          
          if (response.success) {
            ElMessage.success(response.message || '选课成功');
            // 刷新排课数据
            fetchSections();
          }
        } catch (error) {
          console.error('选课失败', error);
          ElMessage.error(error.message || '选课失败');
        }
      };
      
      // 检查课程是否已满
      const isFull = (section) => {
        return section.current_enrollment >= section.capacity;
      };
      
      onMounted(() => {
        fetchCourseDetail();
        fetchSections();
      });
      
      return {
        loading,
        loadingSections,
        course,
        sections,
        isAdmin,
        isTeacher,
        isStudent,
        userId,
        goBack,
        editCourse,
        createSection,
        viewSection,
        editSection,
        enrollSection,
        isFull
      };
    }
  };
  </script>
  
  <style scoped>
  .course-detail-container {
    padding: 20px;
  }
  
  .course-detail-card {
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
  
  .course-info {
    margin-bottom: 20px;
  }
  
  .course-description {
    white-space: pre-line;
    line-height: 1.6;
  }
  
  .section-title {
    margin-bottom: 20px;
    font-weight: 500;
    color: #303133;
  }
  
  .action-bar {
    margin-bottom: 15px;
    display: flex;
    justify-content: flex-end;
  }
  
  .mt-3 {
    margin-top: 15px;
  }
  </style>