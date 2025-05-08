<template>
  <div class="course-form-container">
    <el-card class="course-form-card">
      <template #header>
        <div class="card-header">
          <el-button @click="goBack" icon="arrow-left" circle plain></el-button>
          <span>{{ isEdit ? '编辑课程' : '新增课程' }}</span>
        </div>
      </template>
      
      <div v-if="loading" class="loading-placeholder">
        <el-skeleton :rows="6" animated />
      </div>
      
      <el-form
        v-else
        ref="courseFormRef"
        :model="courseForm"
        :rules="rules"
        label-width="120px"
        label-position="right"
        status-icon
      >
        <el-form-item label="课程代码" prop="code">
          <el-input v-model="courseForm.code" placeholder="请输入课程代码" />
        </el-form-item>
        
        <el-form-item label="课程名称" prop="name">
          <el-input v-model="courseForm.name" placeholder="请输入课程名称" />
        </el-form-item>
        
        <el-form-item label="学分" prop="credits">
          <el-input-number v-model="courseForm.credits" :min="1" :max="10" />
        </el-form-item>
        
        <el-form-item label="所属学院" prop="department_id">
          <el-select 
            v-model="courseForm.department_id" 
            placeholder="请选择所属学院"
            :loading="departmentStore.loading"
          >
            <el-option
              v-for="dept in departments"
              :key="dept.id"
              :label="dept.name"
              :value="dept.id"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="课程描述" prop="description">
          <el-input
            v-model="courseForm.description"
            type="textarea"
            :rows="4"
            placeholder="请输入课程描述"
          />
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="submitForm" :loading="submitting">
            {{ isEdit ? '保存修改' : '创建课程' }}
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
import { useCourseStore } from '../store/courseStore';
import { useDepartmentStore } from '../store/departmentStore';

export default {
  name: 'CourseFormView',
  setup() {
    const route = useRoute();
    const router = useRouter();
    const courseStore = useCourseStore();
    const departmentStore = useDepartmentStore();
    
    const courseFormRef = ref(null);
    const loading = ref(false);
    const submitting = ref(false);
    
    // 判断是编辑还是新增
    const isEdit = computed(() => {
      return !!route.params.id;
    });
    
    // 课程ID
    const courseId = computed(() => {
      return route.params.id;
    });
    
    // 表单数据
    const courseForm = reactive({
      code: '',
      name: '',
      description: '',
      credits: 3,
      department_id: ''
    });
    
    // 部门列表
    const departments = computed(() => departmentStore.departments);
    
    // 表单验证规则
    const rules = {
      code: [
        { required: true, message: '请输入课程代码', trigger: 'blur' },
        { min: 3, max: 20, message: '长度在 3 到 20 个字符', trigger: 'blur' }
      ],
      name: [
        { required: true, message: '请输入课程名称', trigger: 'blur' },
        { min: 2, max: 100, message: '长度在 2 到 100 个字符', trigger: 'blur' }
      ],
      credits: [
        { required: true, message: '请输入学分', trigger: 'blur' },
        { type: 'number', min: 1, message: '学分必须大于0', trigger: 'blur' }
      ],
      department_id: [
        { required: true, message: '请选择所属学院', trigger: 'change' }
      ]
    };
    
    // 初始化数据
    const initData = async () => {
      loading.value = true;
      
      try {
        // 获取部门列表
        await departmentStore.fetchAllDepartments();
        
        // 如果是编辑模式，加载课程数据
        if (isEdit.value) {
          await loadCourseData();
        }
      } catch (error) {
        console.error('初始化数据失败:', error);
        ElMessage.error('加载数据失败');
      } finally {
        loading.value = false;
      }
    };
    
    // 加载课程数据
    const loadCourseData = async () => {
      try {
        const course = await courseStore.fetchCourse(courseId.value);
        
        if (course) {
          // 填充表单数据
          courseForm.code = course.code;
          courseForm.name = course.name;
          courseForm.description = course.description || '';
          courseForm.credits = course.credits;
          courseForm.department_id = course.department_id;
        } else {
          ElMessage.error('课程不存在或已被删除');
          goBack();
        }
      } catch (error) {
        console.error('获取课程数据失败', error);
        ElMessage.error('获取课程数据失败');
        goBack();
      }
    };
    
    // 提交表单
    const submitForm = async () => {
      if (!courseFormRef.value) return;
      
      await courseFormRef.value.validate(async (valid) => {
        if (!valid) {
          ElMessage.warning('请正确填写表单内容');
          return;
        }
        
        submitting.value = true;
        
        try {
          let response;
          
          if (isEdit.value) {
            // 更新课程
            response = await courseStore.updateCourse(courseId.value, courseForm);
          } else {
            // 创建课程
            response = await courseStore.createCourse(courseForm);
          }
          
          if (response.success) {
            ElMessage.success(isEdit.value ? '课程更新成功' : '课程创建成功');
            goBack();
          }
        } catch (error) {
          console.error(isEdit.value ? '更新课程失败' : '创建课程失败', error);
          ElMessage.error(error.message || (isEdit.value ? '更新课程失败' : '创建课程失败'));
        } finally {
          submitting.value = false;
        }
      });
    };
    
    // 重置表单
    const resetForm = () => {
      if (courseFormRef.value) {
        courseFormRef.value.resetFields();
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
      courseFormRef,
      courseForm,
      departments,
      departmentStore,
      rules,
      loading,
      submitting,
      isEdit,
      submitForm,
      resetForm,
      goBack
    };
  }
};
</script>

<style scoped>
.course-form-container {
  padding: 20px;
}

.course-form-card {
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