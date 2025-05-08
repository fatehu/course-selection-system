<template>
  <div class="user-form-container">
    <el-card class="user-form-card">
      <template #header>
        <div class="card-header">
          <el-button @click="goBack" icon="arrow-left" circle plain></el-button>
          <span>{{ isEdit ? '编辑用户' : '新增用户' }}</span>
        </div>
      </template>
      
      <div v-if="loading" class="loading-placeholder">
        <el-skeleton :rows="6" animated />
      </div>
      
      <el-form
        v-else
        ref="userFormRef"
        :model="userForm"
        :rules="rules"
        label-width="120px"
        label-position="right"
        status-icon
      >
        <el-form-item label="用户名" prop="username">
          <el-input 
            v-model="userForm.username" 
            placeholder="请输入用户名"
            :disabled="isEdit"
          />
        </el-form-item>
        
        <el-form-item label="姓名" prop="name">
          <el-input v-model="userForm.name" placeholder="请输入姓名" />
        </el-form-item>
        
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="userForm.email" placeholder="请输入邮箱" />
        </el-form-item>
        
        <el-form-item label="角色" prop="role">
          <el-select v-model="userForm.role" placeholder="请选择角色">
            <el-option label="学生" value="student" />
            <el-option label="教师" value="teacher" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="密码" prop="password">
          <el-input 
            v-model="userForm.password" 
            type="password" 
            placeholder="请输入密码"
            show-password
          />
          <div class="form-tip" v-if="isEdit">留空表示不修改密码</div>
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="submitForm" :loading="submitting">
            {{ isEdit ? '保存修改' : '创建用户' }}
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
import { getUser, createUser, updateUser } from '../api/user';

export default {
  name: 'UserFormView',
  setup() {
    const route = useRoute();
    const router = useRouter();
    
    const userFormRef = ref(null);
    const loading = ref(false);
    const submitting = ref(false);
    
    // 判断是编辑还是新增
    const isEdit = computed(() => {
      return !!route.params.id;
    });
    
    // 用户ID
    const userId = computed(() => {
      return route.params.id;
    });
    
    // 表单数据
    const userForm = reactive({
      username: '',
      name: '',
      email: '',
      role: 'student',
      password: ''
    });
    
    // 表单验证规则 - 改为计算属性确保响应性
    const rules = computed(() => {
      return {
        username: [
          { required: true, message: '请输入用户名', trigger: 'blur' },
          { min: 3, max: 50, message: '长度在 3 到 50 个字符', trigger: 'blur' }
        ],
        name: [
          { required: true, message: '请输入姓名', trigger: 'blur' },
          { min: 2, max: 100, message: '长度在 2 到 100 个字符', trigger: 'blur' }
        ],
        email: [
          { required: true, message: '请输入邮箱', trigger: 'blur' },
          { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
        ],
        role: [
          { required: true, message: '请选择角色', trigger: 'change' }
        ],
        password: [
          // 只在创建用户时添加必填验证
          ...(isEdit.value ? [] : [{ required: true, message: '请输入密码', trigger: 'blur' }]),
          {
            validator: (rule, value, callback) => {
              // 编辑模式下，允许密码为空
              if (isEdit.value && (value === '' || value === undefined)) {
                callback();
              } 
              // 非空密码验证长度
              else if (value !== '' && value !== undefined && value.length < 6) {
                callback(new Error('密码长度不能少于6个字符'));
              } 
              // 创建模式下，不允许密码为空
              else if (!isEdit.value && (value === '' || value === undefined)) {
                callback(new Error('请输入密码'));
              } 
              else {
                callback();
              }
            },
            trigger: 'blur'
          }
        ]
      };
    });
    
    // 如果是编辑，加载用户数据
    const loadUserData = async () => {
      if (!isEdit.value) return;
      
      loading.value = true;
      
      try {
        const response = await getUser(userId.value);
        
        if (response.success) {
          // 填充表单数据
          userForm.username = response.data.username;
          userForm.name = response.data.name;
          userForm.email = response.data.email;
          userForm.role = response.data.role;
          // 密码为空，表示不修改
          userForm.password = '';
        } else {
          ElMessage.error(response.message || '用户不存在或已被删除');
          goBack();
        }
      } catch (error) {
        console.error('获取用户数据失败', error);
        ElMessage.error('获取用户数据失败');
        goBack();
      } finally {
        loading.value = false;
      }
    };
    
    // 提交表单
    const submitForm = async () => {
      if (!userFormRef.value) return;
      
      await userFormRef.value.validate(async (valid) => {
        if (!valid) {
          ElMessage.warning('请正确填写表单内容');
          return;
        }
        
        submitting.value = true;
        
        try {
          let response;
          let userData = { ...userForm };
          
          // 如果是编辑模式且密码为空，则从提交数据中删除密码字段
          if (isEdit.value && (userData.password === '' || userData.password === undefined)) {
            delete userData.password;
          }
          
          if (isEdit.value) {
            // 更新用户
            response = await updateUser(userId.value, userData);
          } else {
            // 创建用户
            response = await createUser(userData);
          }
          
          if (response.success) {
            ElMessage.success(isEdit.value ? '用户更新成功' : '用户创建成功');
            goBack();
          } else {
            ElMessage.error(response.message || (isEdit.value ? '更新用户失败' : '创建用户失败'));
          }
        } catch (error) {
          console.error(isEdit.value ? '更新用户失败' : '创建用户失败', error);
          ElMessage.error(error.message || (isEdit.value ? '更新用户失败' : '创建用户失败'));
        } finally {
          submitting.value = false;
        }
      });
    };
    
    // 重置表单
    const resetForm = () => {
      if (userFormRef.value) {
        userFormRef.value.resetFields();
      }
    };
    
    // 返回上一页
    const goBack = () => {
      router.back();
    };
    
    onMounted(() => {
      loadUserData();
    });
    
    return {
      userFormRef,
      userForm,
      rules, // 注意这里返回的是计算属性
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
.user-form-container {
  padding: 20px;
}

.user-form-card {
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

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}
</style>