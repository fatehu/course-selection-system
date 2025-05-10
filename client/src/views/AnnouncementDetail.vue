<template>
  <div class="announcement-detail-container">
    <el-card class="announcement-detail-card">
      <template #header>
        <div class="card-header">
          <el-button @click="goBack" icon="arrow-left" circle plain></el-button>
          <span>公告详情</span>
          <div class="header-actions" v-if="isAdmin">
            <el-button type="primary" @click="editAnnouncement">编辑公告</el-button>
          </div>
        </div>
      </template>

      <div v-if="loading" class="loading-placeholder">
        <el-skeleton :rows="6" animated />
      </div>

      <div v-else-if="!announcement" class="empty-placeholder">公告不存在或已被删除</div>

      <div v-else class="announcement-info">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="公告标题">{{ announcement.title }}</el-descriptions-item>
          <el-descriptions-item label="公告分类">{{
            getCategoryLabel(announcement.category)
          }}</el-descriptions-item>
          <el-descriptions-item label="发布状态">
            <el-tag :type="announcement.is_published ? 'success' : 'warning'">
              {{ announcement.is_published ? '已发布' : '草稿' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="公告内容" :span="2">
            <p class="announcement-content">
              {{ truncateContent(announcement.content) || '暂无内容' }}
            </p>
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-card>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAnnouncementStore } from '../store/announcementStore'
import { useUserStore } from '../store/userStore'

export default {
  name: 'AnnouncementDetailView',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const announcementStore = useAnnouncementStore()
    const userStore = useUserStore()

    const loading = ref(true)
    const announcementId = route.params.id

    // 用户信息和权限
    const isAdmin = computed(() => userStore.isAdmin)

    // 当前公告信息
    const announcement = computed(() => announcementStore.currentAnnouncement)

    // 公告分类选项，可根据实际情况修改
    const categoryOptions = [
      { label: '系统公告', value: 'system' },
      { label: '活动通知', value: 'general' },
      { label: '教学安排', value: 'course' },
      { label: '考试安排', value: 'exam' },
    ]

    const truncateContent = (content) => {
      if (!content) return ''

      // 使用 DOMParser 解析 HTML
      const doc = new DOMParser().parseFromString(content, 'text/html')
      const plainText = doc.body.textContent || ''

      return plainText
    }

    // 获取公告分类标签
    const getCategoryLabel = (category) => {
      const option = categoryOptions.find((option) => option.value === category)
      return option ? option.label : '未知分类'
    }

    // 获取公告详情
    const fetchAnnouncementDetail = async () => {
      loading.value = true

      try {
        await announcementStore.fetchAnnouncement(announcementId)
      } catch (error) {
        console.error('获取公告详情失败', error)
        ElMessage.error('获取公告详情失败')
      } finally {
        loading.value = false
      }
    }

    // 返回上一页
    const goBack = () => {
      router.back()
    }

    // 编辑公告
    const editAnnouncement = () => {
      router.push(`/announcement/${announcementId}/edit`)
    }

    onMounted(() => {
      fetchAnnouncementDetail()
    })

    return {
      loading,
      announcement,
      isAdmin,
      truncateContent,
      goBack,
      editAnnouncement,
      getCategoryLabel,
    }
  },
}
</script>

<style scoped>
.announcement-detail-container {
  padding: 20px;
}

.announcement-detail-card {
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

.announcement-info {
  margin-bottom: 20px;
}

.announcement-content {
  white-space: pre-line;
  line-height: 1.6;
}
</style>
