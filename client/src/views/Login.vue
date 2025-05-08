<template>
  <div class="login-container">
    <div class="login-card">
      <h2>高校选课系统</h2>
      <h3>用户登录</h3>
      
      <el-alert
        v-if="error"
        :title="error"
        type="error"
        :closable="false"
        show-icon
      />
      
      <el-form
        ref="loginForm"
        :model="loginData"
        :rules="rules"
        label-position="top"
        @submit.prevent="handleLogin"
      >
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="loginData.username"
            placeholder="请输入用户名"
            class="custom-input"
          >
            <template #prefix>
              <el-icon>
                <User />
              </el-icon>
            </template>
          </el-input>
        </el-form-item>
        
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="loginData.password"
            type="password"
            placeholder="请输入密码"
            show-password
            class="custom-input"
          >
            <template #prefix>
              <el-icon>
                <Lock />
              </el-icon>
            </template>
          </el-input>
        </el-form-item>
        
        <el-form-item>
          <el-button
            type="primary"
            native-type="submit"
            :loading="loading"
            class="login-button"
          >
            登录
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script>
import { ref, reactive } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { User, Lock } from '@element-plus/icons-vue'; // 导入图标
import { useUserStore } from '../store/userStore';

export default {
  name: 'LoginView',
  components: {
    User, // 注册用户图标组件
    Lock  // 注册锁图标组件
  },
  setup() {
    const loginForm = ref(null);
    const userStore = useUserStore();
    const router = useRouter();
    const route = useRoute();
    
    const loginData = reactive({
      username: '',
      password: ''
    });
    
    const rules = {
      username: [
        { required: true, message: '请输入用户名', trigger: 'blur' },
        { min: 3, max: 50, message: '用户名长度在3到50个字符之间', trigger: 'blur' }
      ],
      password: [
        { required: true, message: '请输入密码', trigger: 'blur' },
        { min: 6, message: '密码长度不能少于6个字符', trigger: 'blur' }
      ]
    };
    
    const loading = ref(false);
    const error = ref('');
    
    const handleLogin = async () => {
      // 验证表单
      await loginForm.value.validate(async (valid) => {
        if (!valid) {
          return false;
        }
        
        loading.value = true;
        error.value = '';
        
        try {
          const response = await userStore.loginUser(loginData.username, loginData.password);
          
          ElMessage({
            message: '登录成功',
            type: 'success'
          });
          
          // 重定向到之前尝试访问的页面或默认到首页
          const redirectPath = route.query.redirect || '/dashboard';
          router.push(redirectPath);
        } catch (err) {
          error.value = err.message || '登录失败，请检查用户名和密码';
          ElMessage({
            message: error.value,
            type: 'error'
          });
        } finally {
          loading.value = false;
        }
      });
    };
    
    return {
      loginForm,
      loginData,
      rules,
      loading,
      error,
      handleLogin
    };
  }
};
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f5f7fa;
}

.login-card {
  width: 400px;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  background-color: white;
}

h2 {
  text-align: center;
  margin-bottom: 10px;
  color: #409EFF;
}

h3 {
  text-align: center;
  margin-bottom: 20px;
  font-weight: normal;
  color: #606266;
}

.login-button {
  width: 100%;
  margin-top: 15px;
}

:deep(.custom-input .el-input__prefix) {
  left: 5px !important; /* 将图标稍微放在左侧，但不会太远 */
}

/* 确保错误提示正确显示 */
.el-form-item__error {
  display: block !important;
  position: absolute;
  padding-top: 4px;
}
</style>