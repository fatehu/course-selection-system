<template>
  <div class="announcement-list-container">
    <el-card class="announcement-list-card">
      <template #header>
        <div class="card-header">
          <span>公告列表</span>
          <div class="header-actions">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索公告"
              clearable
              class="search-input"
              @input="handleSearch"
            >
              <template #prefix>
                <el-icon><search /></el-icon>
              </template>
            </el-input>

            <el-button v-if="isAdmin || isTeacher" type="primary" @click="createAnnouncement">
              发布公告
            </el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="20" class="filter-row">
        <el-col :span="24">
          <el-select
            v-model="selectedCategory"
            placeholder="选择分类"
            clearable
            @change="handleFilter"
            class="category-filter"
          >
            <el-option
              v-for="category in categories"
              :key="category.value"
              :label="category.label"
              :value="category.value"
            />
          </el-select>

          <el-select
            v-model="publishStatus"
            placeholder="发布状态"
            clearable
            @change="handleFilter"
            class="status-filter"
            style="margin-left: 10px"
          >
            <el-option label="已发布" value="1" />
            <el-option label="未发布" value="0" />
          </el-select>
        </el-col>
      </el-row>

      <div v-if="loading" class="loading-placeholder">
        <el-skeleton :rows="5" animated />
      </div>

      <div v-else-if="filteredAnnouncements.length === 0" class="empty-placeholder">
        暂无公告数据
      </div>

      <el-table v-else :data="paginatedAnnouncements" style="width: 100%" empty-text="暂无公告数据">
        <el-table-column prop="title" label="标题" width="220" />
        <el-table-column label="分类" width="120">
          <template #default="{ row }">
            <el-tag :type="categoryTagType(row.category)">
              {{ categoryLabels[row.category] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="内容" min-width="300">
          <template #default="{ row }">
            <div class="content-preview" :title="row.content">
              {{ truncateContent(row.content) }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="publisher_name" label="发布人" width="120" />
        <el-table-column label="发布时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_published ? 'success' : 'info'">
              {{ row.is_published ? '已发布' : '未发布' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="scope">
            <el-button link type="primary" @click="viewDetail(scope.row.id)"> 详情 </el-button>

            <el-button
              v-if="showEditButton(scope.row)"
              link
              type="primary"
              @click="editAnnouncement(scope.row.id)"
            >
              编辑
            </el-button>

            <el-popconfirm
              v-if="showDeleteButton(scope.row)"
              title="确定删除此公告吗？"
              @confirm="deleteAnnouncement(scope.row.id)"
            >
              <template #reference>
                <el-button link type="danger">删除</el-button>
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
          :total="filteredAnnouncements.length"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { useAnnouncementStore } from '@/store/announcementStore'
import { useUserStore } from '@/store/userStore'
import dayjs from 'dayjs'
import { storeToRefs } from 'pinia'

export default {
  name: 'AnnouncementList',
  components: {
    Search,
  },
  setup() {
    const router = useRouter()
    const announcementStore = useAnnouncementStore()
    const { announcements } = storeToRefs(announcementStore)
    const userStore = useUserStore()

    const loading = ref(false)
    const searchKeyword = ref('')
    const selectedCategory = ref('')
    const publishStatus = ref('')
    const currentPage = ref(1)
    const pageSize = ref(10)

    // 分类选项
    const categories = [
      { label: '系统公告', value: 'system' },
      { label: '活动通知', value: 'general' },
      { label: '教学安排', value: 'course' },
      { label: '考试安排', value: 'exam' },
    ]

    // 搜索处理
    const handleSearch = () => {
      currentPage.value = 1
    }

    // 过滤处理
    const handleFilter = () => {
      currentPage.value = 1
    }

    // 获取公告列表
    const loadAnnouncements = async () => {
      loading.value = true
      try {
        await announcementStore.fetchAllAnnouncements()
      } catch (error) {
        console.error('获取公告列表失败:', error)
        ElMessage.error('获取公告列表失败')
      } finally {
        loading.value = false
      }
    }

    // 内容截断
    const truncateContent = (content) => {
      if (!content) return ''

      // 使用 DOMParser 解析 HTML
      const doc = new DOMParser().parseFromString(content, 'text/html')
      const plainText = doc.body.textContent || ''

      return plainText.length > 50 ? plainText.substring(0, 50) + '...' : plainText
    }

    // 日期格式化
    const formatDateTime = (date) => {
      return dayjs(date).format('YYYY-MM-DD HH:mm')
    }

    // 分类标签样式
    const categoryTagType = (category) => {
      const types = {
        system: 'primary',
        general: 'success',
        course: 'warning',
        exam: 'danger',
      }
      return types[category] || 'info'
    }

    const categoryLabels = {
      system: '系统公告',
      general: '活动通知',
      course: '教学安排',
      exam: '考试安排',
    }

    // 处理过的公告列表
    const filteredAnnouncements = computed(() => {
      let list = announcements.value || []

      // 根据关键词搜索
      if (searchKeyword.value) {
        const keyword = searchKeyword.value.toLowerCase()
        list = list.filter((ann) => {
          return (
            (ann.title && ann.title.toLowerCase().includes(keyword)) ||
            (ann.content && ann.content.toLowerCase().includes(keyword))
          )
        })
      }

      // 根据分类筛选
      if (selectedCategory.value) {
        list = list.filter((ann) => {
          return ann.category === selectedCategory.value
        })
      }

      // 根据发布状态筛选
      if (publishStatus.value) {
        list = list.filter((ann) => {
          return ann.is_published === +publishStatus.value
        })
      }

      return list
    })

    // 分页数据
    const paginatedAnnouncements = computed(() => {
      const start = (currentPage.value - 1) * pageSize.value
      const end = currentPage.value * pageSize.value
      return filteredAnnouncements.value.slice(start, end)
    })

    // 权限判断
    const showEditButton = (row) => {
      return userStore.isAdmin || userStore.user?.id === row.publisher_id
    }

    const showDeleteButton = (row) => {
      return userStore.isAdmin
    }

    // 删除公告
    const deleteAnnouncement = async (id) => {
      try {
        await announcementStore.deleteAnnouncement(id)
        ElMessage.success('删除成功')
        loadAnnouncements()
      } catch (error) {
        console.error('删除公告失败:', error)
        ElMessage.error(error.message || '删除失败')
      }
    }

    // 路由跳转
    const createAnnouncement = () => router.push('/announcement/create')
    const editAnnouncement = (id) => {
      router.push(`/announcement/${id}/edit`)
    }
    const viewDetail = (id) => router.push(`/announcement/${id}`)

    // 分页处理
    const handleSizeChange = (val) => {
      pageSize.value = val
      currentPage.value = 1
    }

    const handleCurrentChange = (val) => {
      currentPage.value = val
    }

    onMounted(() => {
      loadAnnouncements()
    })

    return {
      loading,
      searchKeyword,
      selectedCategory,
      publishStatus,
      categories,
      currentPage,
      pageSize,
      filteredAnnouncements,
      paginatedAnnouncements,
      truncateContent,
      formatDateTime,
      categoryTagType,
      showEditButton,
      showDeleteButton,
      deleteAnnouncement,
      createAnnouncement,
      editAnnouncement,
      viewDetail,
      handleSearch,
      handleFilter,
      handleSizeChange,
      handleCurrentChange,
      categoryLabels,
      isAdmin: computed(() => userStore.isAdmin),
      isTeacher: computed(() => userStore.isTeacher),
    }
  },
}
</script>

<style scoped>
.announcement-list-container {
  padding: 20px;
}

.announcement-list-card {
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

.filter-row {
  margin-bottom: 20px;
}

.category-filter,
.status-filter {
  width: 150px;
}

.content-preview {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
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
