<template>
  <div class="section-form-container">
    <el-card class="section-form-card">
      <template #header>
        <div class="card-header">
          <el-button @click="goBack" icon="arrow-left" circle plain></el-button>
          <span>{{ isEdit ? '编辑课程排课' : '新增课程排课' }}</span>
        </div>
      </template>
      
      <div v-if="loading" class="loading-placeholder">
        <el-skeleton :rows="6" animated />
      </div>
      
      <el-form
        v-else
        ref="sectionFormRef"
        :model="sectionForm"
        :rules="rules"
        label-width="120px"
        label-position="right"
        status-icon
      >
        <el-form-item label="课程" prop="course_id">
          <el-select 
            v-model="sectionForm.course_id" 
            placeholder="请选择课程"
            filterable
            :disabled="isEdit || preselectedCourse"
            :loading="courseStore.loading"
          >
            <el-option
              v-for="course in courses"
              :key="course.id"
              :label="`${course.code} - ${course.name}`"
              :value="course.id"
            />
          </el-select>
        </el-form-item>
        
        <!-- 只对管理员显示教师选择，对教师用户隐藏 -->
        <el-form-item v-if="isAdmin" label="教师" prop="teacher_id">
          <el-select 
            v-model="sectionForm.teacher_id" 
            placeholder="请选择教师"
            filterable
            :loading="teachersLoading"
          >
            <el-option
              v-for="teacher in teachers"
              :key="teacher.id"
              :label="teacher.name"
              :value="teacher.id"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="学期" prop="semester">
          <el-select v-model="sectionForm.semester" placeholder="请选择学期">
            <el-option label="2024春季" value="2024春季" />
            <el-option label="2024夏季" value="2024夏季" />
            <el-option label="2024秋季" value="2024秋季" />
            <el-option label="2025春季" value="2025春季" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="上课时间" prop="time_slot">
          <el-input v-model="sectionForm.time_slot" placeholder="例如：周一 08:00-09:40" />
        </el-form-item>
        
        <el-form-item label="上课地点" prop="location">
          <el-input v-model="sectionForm.location" placeholder="例如：主楼301" />
        </el-form-item>
        
        <el-form-item label="容量" prop="capacity">
          <el-input-number v-model="sectionForm.capacity" :min="1" :max="200" />
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="submitForm" :loading="submitting">
            {{ isEdit ? '保存修改' : '创建排课' }}
          </el-button>
          <el-button @click="resetForm">重置</el-button>
          <el-button @click="goBack">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useSectionStore } from '../store/sectionStore';
import { useCourseStore } from '../store/courseStore';
import { useUserStore } from '../store/userStore';
import { getAllUsers } from '../api/user';

export default {
  name: 'SectionFormView',
  setup() {
    const route = useRoute();
    const router = useRouter();
    const sectionStore = useSectionStore();
    const courseStore = useCourseStore();
    const userStore = useUserStore();
    
    const sectionFormRef = ref(null);
    const loading = ref(false);
    const submitting = ref(false);
    const teachersLoading = ref(false);
    
    // 用户信息和权限
    const isAdmin = computed(() => userStore.isAdmin);
    const isTeacher = computed(() => userStore.isTeacher);
    const userId = computed(() => userStore.userId);
    
    // 判断是编辑还是新增
    const isEdit = computed(() => {
      return !!route.params.id;
    });
    
    // 排课ID
    const sectionId = computed(() => {
      return route.params.id;
    });
    
    // 是否有预选课程
    const preselectedCourse = computed(() => {
      return !!route.query.courseId;
    });
    
    // 表单数据 - 教师角色自动设为当前用户
    const sectionForm = reactive({
      course_id: route.query.courseId || '',
      teacher_id: userStore.userId, // 直接设置为当前用户ID
      semester: '2025春季',
      time_slot: '',
      location: '',
      capacity: 30
    });
    
    // 课程列表
    const courses = computed(() => courseStore.courses);
    
    // 教师列表 - 仅管理员使用
    const teachers = ref([]);
    
    // 表单验证规则
    const rules = {
      course_id: [
        { required: true, message: '请选择课程', trigger: 'change' }
      ],
      teacher_id: [
        { required: true, message: '请选择教师', trigger: 'change' }
      ],
      semester: [
        { required: true, message: '请选择学期', trigger: 'change' }
      ],
      time_slot: [
        { required: true, message: '请输入上课时间', trigger: 'blur' },
        { min: 3, max: 100, message: '长度在 3 到 100 个字符', trigger: 'blur' }
      ],
      location: [
        { required: true, message: '请输入上课地点', trigger: 'blur' },
        { min: 3, max: 100, message: '长度在 3 到 100 个字符', trigger: 'blur' }
      ],
      capacity: [
        { required: true, message: '请输入容量', trigger: 'blur' },
        { type: 'number', min: 1, message: '容量必须大于0', trigger: 'blur' }
      ]
    };
    
    // 初始化数据
    const initData = async () => {
      loading.value = true;
      
      try {
        // 获取课程列表
        await courseStore.fetchAllCourses();
        
        // 仅在管理员角色时获取教师列表
        if (isAdmin.value) {
          await loadTeachers();
        }
        
        // 如果是编辑模式，加载排课数据
        if (isEdit.value) {
          await loadSectionData();
        }
      } catch (error) {
        console.error('初始化数据失败:', error);
        ElMessage.error('加载数据失败');
      } finally {
        loading.value = false;
      }
    };
    
    // 加载教师列表 - 仅管理员使用
    const loadTeachers = async () => {
      if (!isAdmin.value) return; // 非管理员不加载教师列表
      
      teachersLoading.value = true;
      
      try {
        const response = await getAllUsers();
        
        if (response.success) {
          // 过滤出教师角色的用户
          teachers.value = response.data.filter(user => user.role === 'teacher');
        } else {
          ElMessage.error(response.message || '获取教师列表失败');
        }
      } catch (error) {
        console.error('获取教师列表失败', error);
        ElMessage.error('获取教师列表失败');
      } finally {
        teachersLoading.value = false;
      }
    };
    
    // 加载排课数据
    const loadSectionData = async () => {
      try {
        const section = await sectionStore.fetchSection(sectionId.value);
        
        if (section) {
          // 填充表单数据
          sectionForm.course_id = section.course_id;
          sectionForm.teacher_id = section.teacher_id;
          sectionForm.semester = section.semester;
          sectionForm.time_slot = section.time_slot;
          sectionForm.location = section.location;
          sectionForm.capacity = section.capacity;
        } else {
          ElMessage.error('排课不存在或已被删除');
          goBack();
        }
      } catch (error) {
        console.error('获取排课数据失败', error);
        ElMessage.error('获取排课数据失败');
        goBack();
      }
    };
    
    // 提交表单
    const submitForm = async () => {
      if (!sectionFormRef.value) return;
      
      await sectionFormRef.value.validate(async (valid) => {
        if (!valid) {
          ElMessage.warning('请正确填写表单内容');
          return;
        }
        
        submitting.value = true;
        
        try {
          let response;
          
          if (isEdit.value) {
            // 更新排课
            response = await sectionStore.updateSection(sectionId.value, sectionForm);
          } else {
            // 创建排课
            response = await sectionStore.createSection(sectionForm);
          }
          
          if (response.success) {
            ElMessage.success(isEdit.value ? '排课更新成功' : '排课创建成功');
            goBack();
          }
        } catch (error) {
          console.error(isEdit.value ? '更新排课失败' : '创建排课失败', error);
          ElMessage.error(error.message || (isEdit.value ? '更新排课失败' : '创建排课失败'));
        } finally {
          submitting.value = false;
        }
      });
    };
    
    // 重置表单
    const resetForm = () => {
      if (sectionFormRef.value) {
        sectionFormRef.value.resetFields();
      }
    };
    
    // 返回上一页
    const goBack = () => {
      router.back();
    };
    
    onMounted(() => {
      initData();
    });
    
    return {
      sectionFormRef,
      sectionForm,
      courses,
      teachers,
      courseStore,
      rules,
      loading,
      submitting,
      teachersLoading,
      isEdit,
      isAdmin,
      isTeacher,
      preselectedCourse,
      submitForm,
      resetForm,
      goBack
    };
  }
};
</script>

<style scoped>
.section-form-container {
  padding: 20px;
}

.section-form-card {
  margin-bottom: 20px;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.loading-placeholder {
  padding: 20px 0;
  text-align: center;
  color: #909399;
}
</style>