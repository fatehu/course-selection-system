<template>
  <div class="profile-container">
    <el-card class="profile-card">
      <template #header>
        <div class="card-header">
          <h3>个人信息</h3>
        </div>
      </template>
      
      <div v-if="loading" class="loading-placeholder">
        <el-skeleton :rows="4" animated />
      </div>
      
      <el-form
        v-else
        ref="profileForm"
        :model="profileData"
        :rules="rules"
        label-width="100px"
        label-position="right"
        @submit.prevent="submitForm"
      >
        <el-form-item label="用户名">
          <el-input v-model="profileData.username" disabled />
          <div class="form-tip">用户名不可修改</div>
        </el-form-item>
        
        <el-form-item label="姓名" prop="name">
          <el-input v-model="profileData.name" placeholder="请输入姓名" />
        </el-form-item>
        
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="profileData.email" placeholder="请输入邮箱" />
        </el-form-item>
        
        <el-form-item label="角色">
          <el-tag :type="getRoleType(profileData.role)">
            {{ getRoleText(profileData.role) }}
          </el-tag>
        </el-form-item>
        
        <el-divider>修改密码 (可选)</el-divider>
        
        <el-form-item label="原密码" prop="oldPassword">
          <el-input 
            v-model="profileData.oldPassword" 
            type="password" 
            placeholder="请输入原密码"
            show-password
          />
        </el-form-item>
        
        <el-form-item label="新密码" prop="newPassword">
          <el-input 
            v-model="profileData.newPassword" 
            type="password" 
            placeholder="请输入新密码" 
            show-password
          />
        </el-form-item>
        
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input 
            v-model="profileData.confirmPassword" 
            type="password" 
            placeholder="请再次输入新密码" 
            show-password
          />
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" native-type="submit" :loading="submitting">
            保存修改
          </el-button>
          <el-button @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useUserStore } from '../store/userStore';

export default {
  name: 'UserProfileView',
  setup() {
    const profileForm = ref(null);
    const userStore = useUserStore();
    
    const loading = ref(true);
    const submitting = ref(false);
    
    const profileData = reactive({
      username: '',
      name: '',
      email: '',
      role: '',
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    
    // 密码验证器 - 检查确认密码是否与新密码匹配
    const validateConfirmPassword = (rule, value, callback) => {
      if (value !== profileData.newPassword) {
        callback(new Error('两次输入的密码不一致'));
      } else {
        callback();
      }
    };
    
    // 表单验证规则
    const rules = {
      name: [
        { required: true, message: '请输入姓名', trigger: 'blur' },
        { min: 2, max: 100, message: '姓名长度在2到100个字符之间', trigger: 'blur' }
      ],
      email: [
        { required: true, message: '请输入邮箱', trigger: 'blur' },
        { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
      ],
      oldPassword: [
        { required: false },
        { min: 6, message: '密码长度不能少于6个字符', trigger: 'blur' }
      ],
      newPassword: [
        { required: false },
        { min: 6, message: '密码长度不能少于6个字符', trigger: 'blur' }
      ],
      confirmPassword: [
        { required: false },
        { validator: validateConfirmPassword, trigger: 'blur' }
      ]
    };
    
    // 加载用户个人资料
    const loadUserProfile = async () => {
      loading.value = true;
      
      try {
        console.log('开始请求用户个人资料');
        const userData = await userStore.getUserProfile();
        console.log('获取到用户资料:', userData);
        
        if (userData) {
          // 填充表单数据
          profileData.username = userData.username;
          profileData.name = userData.name;
          profileData.email = userData.email;
          profileData.role = userData.role;
        } else {
          ElMessage.error('获取个人资料失败：服务器没有返回数据');
        }
      } catch (error) {
        console.error('获取个人资料失败', error);
        ElMessage.error(`获取个人资料失败: ${error.message || '未知错误'}`);
      } finally {
        loading.value = false;
      }
    };
    
    // 提交表单
    const submitForm = async () => {
      if (!profileForm.value) return;
      
      await profileForm.value.validate(async (valid) => {
        if (!valid) {
          ElMessage.warning('请正确填写表单内容');
          return;
        }
        
        // 检查密码字段
        // 如果填写了新密码，则必须填写原密码
        if (profileData.newPassword && !profileData.oldPassword) {
          ElMessage.warning('请输入原密码');
          return;
        }
        
        // 如果填写了原密码，则必须填写新密码
        if (profileData.oldPassword && !profileData.newPassword) {
          ElMessage.warning('请输入新密码');
          return;
        }
        
        submitting.value = true;
        
        try {
          // 准备要更新的数据
          const updateData = {
            name: profileData.name,
            email: profileData.email
          };
          
          // 如果填写了密码字段，添加到更新数据中
          if (profileData.oldPassword && profileData.newPassword) {
            updateData.oldPassword = profileData.oldPassword;
            updateData.newPassword = profileData.newPassword;
          }
          
          const response = await userStore.updateUserProfile(updateData);
          
          if (response.success) {
            ElMessage.success('个人信息更新成功');
            
            // 清空密码字段
            profileData.oldPassword = '';
            profileData.newPassword = '';
            profileData.confirmPassword = '';
          } else {
            ElMessage.error(response.message || '更新个人信息失败');
          }
        } catch (error) {
          console.error('更新个人信息失败', error);
          ElMessage.error(error.message || '更新个人信息失败');
        } finally {
          submitting.value = false;
        }
      });
    };
    
    // 重置表单
    const resetForm = () => {
      // 重置基本信息
      loadUserProfile();
      
      // 清空密码字段
      profileData.oldPassword = '';
      profileData.newPassword = '';
      profileData.confirmPassword = '';
    };
    
    // 获取角色文本
    const getRoleText = (role) => {
      const roleMap = {
        admin: '管理员',
        teacher: '教师',
        student: '学生'
      };
      return roleMap[role] || role;
    };
    
    // 获取角色类型
    const getRoleType = (role) => {
      const typeMap = {
        admin: 'danger',
        teacher: 'warning',
        student: 'success'
      };
      return typeMap[role] || 'info';
    };
    
    onMounted(() => {
      loadUserProfile();
    });
    
    return {
      profileForm,
      profileData,
      rules,
      loading,
      submitting,
      getRoleText,
      getRoleType,
      submitForm,
      resetForm
    };
  }
};
</script>

<style scoped>
.profile-container {
  padding: 20px;
}

.profile-card {
  max-width: 700px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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