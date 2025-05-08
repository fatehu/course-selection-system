<template>
  <div class="not-found-container">
    <div class="not-found-content">
      <el-result
        icon="error"
        title="404"
        sub-title="抱歉，您访问的页面不存在"
      >
        <template #extra>
          <el-button type="primary" @click="goHome">返回首页</el-button>
          <el-button @click="goBack">返回上一页</el-button>
        </template>
      </el-result>
    </div>
  </div>
</template>

<script>
import { useRouter } from 'vue-router';

export default {
  name: 'NotFoundView',
  setup() {
    const router = useRouter();
    
    const goHome = () => {
      router.push('/dashboard');
    };
    
    const goBack = () => {
      router.back();
    };
    
    return {
      goHome,
      goBack
    };
  }
};
</script>

<style scoped>
.not-found-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 20px;
}

.not-found-content {
  max-width: 500px;
  width: 100%;
}
</style>