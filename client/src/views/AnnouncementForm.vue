<template>
  <div class="announcement-form-container">
    <el-card class="announcement-form-card">
      <template #header>
        <div class="card-header">
          <el-button @click="goBack" icon="arrow-left" circle plain></el-button>
          <span>{{ isEdit ? '编辑公告' : '发布公告' }}</span>
        </div>
      </template>

      <div v-if="loading" class="loading-placeholder">
        <el-skeleton :rows="5" animated />
      </div>

      <el-form
        v-else
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-width="100px"
        label-position="right"
        status-icon
      >
        <!-- 表单字段 -->
        <el-form-item label="公告标题" prop="title">
          <el-input v-model="formData.title" placeholder="请输入公告标题" />
        </el-form-item>

        <el-form-item label="公告分类" prop="category">
          <el-select v-model="formData.category" placeholder="请选择分类" clearable>
            <el-option
              v-for="item in categoryOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="发布状态" prop="is_published">
          <el-switch
            v-model="formData.is_published"
            active-text="立即发布"
            inactive-text="暂存草稿"
            :active-value="1"
            :inactive-value="0"
          />
        </el-form-item>

        <el-form-item label="公告内容" prop="content">
          <RichTextEditor v-model="formData.content" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="submitForm" :loading="submitting">
            {{ isEdit ? '保存修改' : '立即发布' }}
          </el-button>
          <el-button @click="resetForm">重置</el-button>
          <el-button @click="goBack">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'
import RichTextEditor from '@/components/RichTextEditor.vue'
import { useAnnouncementStore } from '@/store/announcementStore'

const route = useRoute()
const router = useRouter()
const announcementStore = useAnnouncementStore()

const isEdit = computed(() => !!route.params.id) // 判断是否为编辑模式

// 表单引用
const formRef = ref(null)
const loading = ref(false)
const submitting = ref(false)

// 表单初始数据
const initFormData = () => ({
  title: '',
  content: '',
  category: 'general',
  is_published: 1,
})

// 响应式数据
const formData = reactive(initFormData())
const categoryOptions = [
  { label: '系统公告', value: 'system' },
  { label: '活动通知', value: 'general' },
  { label: '教学安排', value: 'course' },
  { label: '考试安排', value: 'exam' },
]

const rules = {
  title: [
    { required: true, message: '标题不能为空', trigger: 'blur' },
    { min: 1, max: 50, message: '长度在1-50个字符之间', trigger: 'blur' },
  ],
  content: [
    { required: true, message: '内容不能为空', trigger: 'blur' },
    { min: 1, message: '内容至少1个字符', trigger: 'blur' },
  ],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
}

// 初始化数据
const initData = async () => {
  loading.value = true
  try {
    if (isEdit.value) {
      // 如果是编辑模式，获取公告详情
      const data = await announcementStore.fetchAnnouncement(route.params.id)
      console.log(data)

      if (data) {
        Object.assign(formData, data) // 将获取到的数据回显到表单
      } else {
        ElMessage.error('公告不存在或已被删除')
        router.back()
      }
    }
  } catch (error) {
    console.error('加载公告数据失败:', error)
    ElMessage.error(error.message || '加载公告数据失败')
    router.back()
  } finally {
    loading.value = false
  }
}

const submitForm = async () => {
  try {
    await formRef.value.validate()
    submitting.value = true

    const payload = { ...formData }
    if (isEdit.value) {
      await announcementStore.updateAnnouncement(route.params.id, payload)
      ElMessage.success('公告修改成功')
    } else {
      await announcementStore.createAnnouncement(payload)
      ElMessage.success('公告发布成功')
    }
    router.push('/announcement')
  } catch (error) {
    console.error('提交失败:', error)
    ElMessage.error(error.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

// 其他功能方法
const resetForm = () => formRef.value?.resetFields()
const goBack = () => router.back()

onMounted(initData)
</script>

<style scoped>
.announcement-form-container {
  padding: 20px;
}

.announcement-form-card {
  max-width: 900px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

:deep(.el-form-item__content) {
  line-height: normal;
}

.loading-placeholder {
  padding: 20px 0;
  text-align: center;
  color: #909399;
}
</style>
