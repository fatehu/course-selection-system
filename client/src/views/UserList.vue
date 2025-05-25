<template>
  <div class="user-list-container">
    <el-card class="user-list-card">
      <template #header>
        <div class="card-header">
          <span>用户管理</span>
          <div class="header-actions">
            <el-input 
              v-model="searchKeyword" 
              placeholder="搜索用户" 
              clearable 
              class="search-input"
              @input="handleSearch"
            >
              <template #prefix>
                <el-icon><search /></el-icon>
              </template>
            </el-input>
            
            <el-upload
              class="batch-import-uploader"
              action="" 
              :http-request="handleCustomUpload"
              :show-file-list="false"
              :before-upload="beforeUploadCheck"
            >
              <el-button type="success" :loading="isUploading">
                <el-icon><UploadFilled /></el-icon>
                &nbsp;{{ isUploading ? '正在导入...' : '批量导入 (CSV)' }}
              </el-button>
            </el-upload>
            <el-button type="primary" @click="createUser">
              新增用户
            </el-button>
          </div>
        </div>
      </template>
      
      <div v-if="loading" class="loading-placeholder">
        <el-skeleton :rows="5" animated />
      </div>
      
      <div v-else-if="filteredUsers.length === 0" class="empty-placeholder">
        暂无用户数据
      </div>
      
      <el-table 
        v-else 
        :data="filteredUsers" 
        style="width: 100%"
        :empty-text="'暂无用户数据'"
      >
        <el-table-column prop="username" label="用户名" width="150" />
        <el-table-column prop="name" label="姓名" width="150" />
        <el-table-column prop="email" label="邮箱" />
        <el-table-column prop="role" label="角色" width="120">
          <template #default="scope">
            <el-tag :type="getRoleType(scope.row.role)">
              {{ getRoleText(scope.row.role) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="scope">
            <el-button link type="primary" @click="editUser(scope.row.id)">
              编辑
            </el-button>
            
            <el-popconfirm
              title="确定删除此用户吗？"
              @confirm="handleDeleteUser(scope.row.id)"
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
      
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="totalUsers"
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
import { Search, UploadFilled } from '@element-plus/icons-vue';
import { getAllUsers, deleteUser, batchImportUsersFromCSV } from '../api/user';

export default {
  name: 'UserListView',
  components: {
    Search,
    UploadFilled
  },
  setup() {
    const router = useRouter();
    const users = ref([]);
    const loading = ref(true);
    const searchKeyword = ref('');
    const currentPage = ref(1);
    const pageSize = ref(10);
    const deletingId = ref(null); // 添加删除状态标识

    // ---  上传状态 ---
    const isUploading = ref(false);
    // --- 上传前检查 ---
    const beforeUploadCheck = (file) => {
      const isCsv = file.name.toLowerCase().endsWith('.csv');
      if (!isCsv) {
        ElMessage.error('只能上传 CSV 格式的文件!');
        return false;
      }
      // 可以添加大小检查等
      return true;
    };

    // --- 自定义上传处理函数 ---
    const handleCustomUpload = async (options) => {
      const file = options.file;
      isUploading.value = true;
      loading.value = true; // 也可以用 loading 表示

      try {
        // 调用我们定义的 API 函数
        const response = await batchImportUsersFromCSV(file);

        // 注意：axios 拦截器会返回 response.data，所以这里直接用 response
        if (response.success) {
          ElMessage.success(`${response.message || `成功导入 ${response.insertedCount} 名学生！`}`);
          loadUsers(); // 刷新列表
        } else {
          let errorMsg = response.message || '批量导入失败';
            if (response.errors && response.errors.length > 0) {
                 errorMsg += ` (错误数: ${response.errors.length})，详情请查看控制台。`;
                 console.error("导入错误详情:", response.errors);
            }
          ElMessage.error(errorMsg);
        }
      } catch (error) {
          // axios 拦截器会处理 401，这里处理其他错误
          console.error('上传失败:', error);
          ElMessage.error(error.message || '文件上传失败，请检查网络或联系管理员。');
      } finally {
        isUploading.value = false;
        loading.value = false;
      }
    };

    // 过滤后的用户列表
    const filteredUsers = computed(() => {
      let filteredList = users.value;
      
      // 根据关键词搜索
      if (searchKeyword.value) {
        const keyword = searchKeyword.value.toLowerCase();
        filteredList = filteredList.filter(user => {
          return user.username?.toLowerCase().includes(keyword) ||
                 user.name?.toLowerCase().includes(keyword) ||
                 user.email?.toLowerCase().includes(keyword);
        });
      }
      
      // 分页
      const start = (currentPage.value - 1) * pageSize.value;
      const end = start + pageSize.value;
      return filteredList.slice(start, end);
    });
    
    // 总用户数
    const totalUsers = computed(() => {
      let filteredList = users.value;
      
      // 根据关键词搜索
      if (searchKeyword.value) {
        const keyword = searchKeyword.value.toLowerCase();
        filteredList = filteredList.filter(user => {
          return user.username?.toLowerCase().includes(keyword) ||
                 user.name?.toLowerCase().includes(keyword) ||
                 user.email?.toLowerCase().includes(keyword);
        });
      }
      
      return filteredList.length;
    });
    
    // 加载用户数据
    const loadUsers = async () => {
      loading.value = true;
      
      try {
        const response = await getAllUsers();
        
        if (response.success) {
          users.value = response.data;
        } else {
          ElMessage.error(response.message || '获取用户列表失败');
        }
      } catch (error) {
        console.error('获取用户列表失败', error);
        ElMessage.error('获取用户列表失败');
      } finally {
        loading.value = false;
      }
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
    
    // 格式化日期
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleString();
    };
    
    // 搜索处理
    const handleSearch = () => {
      currentPage.value = 1;
    };
    
    // 创建用户
    const createUser = () => {
      router.push('/users/create');
    };
    
    // 编辑用户
    const editUser = (id) => {
      router.push(`/users/${id}/edit`);
    };
    
    // 删除用户 - 修复处理
    const handleDeleteUser = async (id) => {
      deletingId.value = id; // 设置当前正在删除的ID
      
      try {
        const response = await deleteUser(id);
        
        if (response.success) {
          ElMessage.success('用户删除成功');
          // 确保删除后重新加载数据，而不是依赖状态更新
          await loadUsers();
        } else {
          ElMessage.error(response.message || '删除用户失败');
        }
      } catch (error) {
        console.error('删除用户失败', error);
        ElMessage.error(typeof error === 'string' ? error : (error.message || '删除用户失败'));
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
    
    onMounted(() => {
      loadUsers();
    });
    
    return {
      users,
      loading,
      searchKeyword,
      currentPage,
      pageSize,
      filteredUsers,
      totalUsers,
      deletingId, // 导出删除状态
      getRoleText,
      getRoleType,
      formatDate,
      handleSearch,
      createUser,
      editUser,
      handleDeleteUser, // 更新方法名
      handleSizeChange,
      handleCurrentChange,
      isUploading,
      handleCustomUpload,
      beforeUploadCheck
    };
  }
};
</script>

<style scoped>
.user-list-container {
  padding: 20px;
}

.user-list-card {
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px; 
}

.batch-import-uploader {
  display: inline-block;
}

.search-input {
  width: 250px;
}
</style>