<template>
  <div class="section-list-container">
    <el-card class="section-list-card">
      <template #header>
        <div class="card-header">
          <span>课程安排列表</span>
          <div class="header-actions">
            <el-input 
              v-model="searchKeyword" 
              placeholder="搜索排课" 
              clearable 
              class="search-input"
              @input="handleSearch"
            >
              <template #prefix>
                <el-icon><search /></el-icon>
              </template>
            </el-input>
            
            <el-button 
              v-if="isAdmin || isTeacher" 
              type="primary" 
              @click="createSection"
            >
              增加排课
            </el-button>
          </div>
        </div>
      </template>
      
      <div v-if="loading" class="loading-placeholder">
        <el-skeleton :rows="5" animated />
      </div>
      
      <div v-else-if="filteredSections.length === 0" class="empty-placeholder">
        暂无课程安排数据
      </div>
      
      <el-table 
        v-else 
        :data="filteredSections" 
        style="width: 100%"
        :empty-text="'暂无课程安排数据'"
      >
        <el-table-column prop="course_code" label="课程代码" width="120" />
        <el-table-column prop="course_name" label="课程名称" />
        <el-table-column prop="teacher_name" label="教师" width="120" />
        <el-table-column prop="semester" label="学期" width="120" />
        <el-table-column prop="time_slot" label="时间" />
        <el-table-column prop="location" label="地点" width="120" />
        <el-table-column label="人数" width="100">
          <template #default="scope">
            {{ scope.row.current_enrollment }}/{{ scope.row.capacity }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220">
          <template #default="scope">
            <el-button link type="primary" @click="viewSection(scope.row.id)">
              查看
            </el-button>
            
            <el-button 
              v-if="isAdmin || (isTeacher && scope.row.teacher_id === userId)" 
              link 
              type="primary" 
              @click="editSection(scope.row.id)"
            >
              编辑
            </el-button>
            
            <el-popconfirm
              v-if="isAdmin"
              title="确定删除此课程安排吗？"
              @confirm="handleDeleteSection(scope.row.id)"
              confirm-button-text="确定"
              cancel-button-text="取消"
            >
              <template #reference>
                <el-button link type="danger" :loading="deletingId === scope.row.id">删除</el-button>
              </template>
            </el-popconfirm>
            
            <el-button 
              v-if="isStudent && !isFull(scope.row) && !isEnrolled(scope.row.id)" 
              link 
              type="success" 
              @click="enrollSection(scope.row.id)"
            >
              选课
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
          :total="totalSections"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Search } from '@element-plus/icons-vue';
import { useSectionStore } from '../store/sectionStore';
import { useUserStore } from '../store/userStore';
import { useEnrollmentStore } from '../store/enrollmentStore';

export default {
  name: 'SectionListView',
  components: {
    Search
  },
  setup() {
    const router = useRouter();
    const sectionStore = useSectionStore();
    const userStore = useUserStore();
    const enrollmentStore = useEnrollmentStore();
    
    const loading = ref(true);
    const searchKeyword = ref('');
    const currentPage = ref(1);
    const pageSize = ref(10);
    const deletingId = ref(null); // 添加删除状态标识
    
    // 用户信息和权限
    const isAdmin = computed(() => userStore.isAdmin);
    const isTeacher = computed(() => userStore.isTeacher);
    const isStudent = computed(() => userStore.isStudent);
    const userId = computed(() => userStore.userId);
    
    // 处理过的课程安排列表
    const filteredSections = computed(() => {
      let sections = sectionStore.sections;
      
      // 根据关键词搜索
      if (searchKeyword.value) {
        const keyword = searchKeyword.value.toLowerCase();
        sections = sections.filter(section => {
          return section.course_code?.toLowerCase().includes(keyword) ||
                 section.course_name?.toLowerCase().includes(keyword) ||
                 section.teacher_name?.toLowerCase().includes(keyword) ||
                 section.semester?.toLowerCase().includes(keyword) ||
                 section.location?.toLowerCase().includes(keyword);
        });
      }
      
      // 如果是教师，只显示自己的课程安排
      if (isTeacher.value && !isAdmin.value) {
        sections = sections.filter(section => section.teacher_id === userId.value);
      }
      
      return sections.slice((currentPage.value - 1) * pageSize.value, currentPage.value * pageSize.value);
    });
    
    // 总排课数
    const totalSections = computed(() => {
      let sections = sectionStore.sections;
      
      // 根据关键词搜索
      if (searchKeyword.value) {
        const keyword = searchKeyword.value.toLowerCase();
        sections = sections.filter(section => {
          return section.course_code?.toLowerCase().includes(keyword) ||
                 section.course_name?.toLowerCase().includes(keyword) ||
                 section.teacher_name?.toLowerCase().includes(keyword) ||
                 section.semester?.toLowerCase().includes(keyword) ||
                 section.location?.toLowerCase().includes(keyword);
        });
      }
      
      // 如果是教师，只显示自己的课程安排
      if (isTeacher.value && !isAdmin.value) {
        sections = sections.filter(section => section.teacher_id === userId.value);
      }
      
      return sections.length;
    });
    
    // 加载课程安排数据
    const loadSections = async () => {
      loading.value = true;
      
      try {
        await sectionStore.fetchAllSections();
        if (isStudent.value) {
          await enrollmentStore.fetchCurrentStudentEnrollments();
        }
      } catch (error) {
        console.error('加载课程安排数据失败', error);
        ElMessage.error('加载课程安排数据失败');
      } finally {
        loading.value = false;
      }
    };
    
    // 搜索处理
    const handleSearch = () => {
      currentPage.value = 1;
    };
    
    // 创建新排课
    const createSection = () => {
      router.push('/sections/create');
    };
    
    // 查看排课详情
    const viewSection = (id) => {
      router.push(`/sections/${id}`);
    };
    
    // 编辑排课
    const editSection = (id) => {
      router.push(`/sections/${id}/edit`);
    };
    
    // 删除排课 - 修复处理
    const handleDeleteSection = async (id) => {
      deletingId.value = id; // 设置当前正在删除的ID
      
      try {
        const response = await sectionStore.deleteSection(id);
        
        if (response.success) {
          ElMessage.success('课程安排删除成功');
          // 确保删除后重新加载数据，而不是依赖状态更新
          await loadSections();
        } else {
          ElMessage.error(response.message || '删除课程安排失败');
        }
      } catch (error) {
        console.error('删除课程安排失败', error);
        ElMessage.error(error.message || '删除课程安排失败');
      } finally {
        deletingId.value = null; // 无论成功失败都重置删除状态
      }
    };
    
    // 选课
    const enrollSection = async (sectionId) => {
      try {
        const response = await enrollmentStore.enrollCourse(sectionId);
        
        if (response.success) {
          ElMessage.success(response.message || '选课成功');
          // 刷新数据
          loadSections();
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
    
    // 检查是否已选
    const isEnrolled = (sectionId) => {
      if (!isStudent.value) return false;
      
      return enrollmentStore.studentEnrollments.some(enrollment => {
        return enrollment.section_id === sectionId && 
              (enrollment.status === 'enrolled' || enrollment.status === 'waitlisted');
      });
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
      loadSections();
    });
    
    return {
      loading,
      searchKeyword,
      currentPage,
      pageSize,
      filteredSections,
      totalSections,
      isAdmin,
      isTeacher,
      isStudent,
      userId,
      deletingId, // 导出删除状态
      handleSearch,
      createSection,
      viewSection,
      editSection,
      handleDeleteSection, // 更新方法名
      enrollSection,
      isFull,
      isEnrolled,
      handleSizeChange,
      handleCurrentChange
    };
  }
};
</script>

<style scoped>
.section-list-container {
  padding: 20px;
}

.section-list-card {
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