<template>
  <div class="dashboard-container">
    <el-row :gutter="20">
      <el-col :span="24">
        <h2>欢迎回来，{{ user.name }}!</h2>
      </el-col>
    </el-row>

    <h2>最新公告</h2>
    <div v-if="loading" class="loading-placeholder">
      <el-skeleton :rows="3" animated />
    </div>
    <div v-else-if="publishedAnnouncements.length === 0" class="empty-placeholder">暂无公告</div>
    <div v-else>
      <el-card
        v-for="announcement in publishedAnnouncements"
        :key="announcement.id"
        class="announcement-card"
      >
        <template #header>
          <div class="card-header">
            <span>{{ announcement.title }}</span>
          </div>
        </template>
        <div class="announcement-content">
          <p>{{ truncateContent(announcement.content) }}</p>
          <p>发布者: {{ announcement.publisher_name }}</p>
          <p>发布时间: {{ formatDate(announcement.publish_time) }}</p>
        </div>
      </el-card>
    </div>

    <el-row :gutter="20" class="stats-row">
      <!-- 管理员视图 -->
      <template v-if="isAdmin">
        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="stat-card">
            <div class="stat-card-title">用户总数</div>
            <div class="stat-card-value">{{ dashboardStats.userCount || 0 }}</div>
            <div class="stat-card-actions">
              <el-button type="primary" link @click="navigateTo('/users')"> 管理用户 </el-button>
            </div>
          </el-card>
        </el-col>

        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="stat-card">
            <div class="stat-card-title">课程总数</div>
            <div class="stat-card-value">{{ dashboardStats.courseCount || 0 }}</div>
            <div class="stat-card-actions">
              <el-button type="primary" link @click="navigateTo('/courses')"> 管理课程 </el-button>
            </div>
          </el-card>
        </el-col>

        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="stat-card">
            <div class="stat-card-title">选课数量</div>
            <div class="stat-card-value">{{ dashboardStats.enrollmentCount || 0 }}</div>
            <div class="stat-card-actions">
              <el-button type="primary" link @click="navigateTo('/enrollments')">
                选课管理
              </el-button>
            </div>
          </el-card>
        </el-col>

        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="stat-card">
            <div class="stat-card-title">课程安排</div>
            <div class="stat-card-value">{{ dashboardStats.sectionCount || 0 }}</div>
            <div class="stat-card-actions">
              <el-button type="primary" link @click="navigateTo('/sections')"> 排课管理 </el-button>
            </div>
          </el-card>
        </el-col>
      </template>

      <!-- 教师视图 -->
      <template v-if="isTeacher">
        <el-col :xs="24" :sm="12" :md="8">
          <el-card class="stat-card">
            <template #header>
              <div class="card-header">
                <span>我的教学课程</span>
                <el-button class="button" text @click="navigateTo('/sections/create')">
                  新增
                </el-button>
              </div>
            </template>
            <div v-if="loading" class="loading-placeholder">
              <el-skeleton :rows="3" animated />
            </div>
            <div v-else-if="teacherSections.length === 0" class="empty-placeholder">
              暂无教学课程，点击右上角【新增】按钮创建课程安排
            </div>
            <ul v-else class="course-list">
              <li v-for="section in teacherSections" :key="section.id" class="course-item">
                <div class="course-code">{{ section.course_code }}</div>
                <div class="course-name">{{ section.course_name }}</div>
                <div class="course-info">
                  <span>{{ section.semester }}</span>
                  <span>{{ section.time_slot }}</span>
                  <span>{{ section.location }}</span>
                </div>
                <div class="course-stats">
                  {{ section.current_enrollment }}/{{ section.capacity }}
                </div>
              </li>
            </ul>
          </el-card>
        </el-col>
      </template>

      <!-- 学生视图 -->
      <template v-if="isStudent">
        <el-col :xs="24" :sm="12" :md="8">
          <el-card class="stat-card">
            <template #header>
              <div class="card-header">
                <span>我的课程</span>
                <el-button class="button" text @click="navigateTo('/enrollment')"> 选课 </el-button>
              </div>
            </template>
            <div v-if="loading" class="loading-placeholder">
              <el-skeleton :rows="3" animated />
            </div>
            <div v-else-if="studentEnrollments.length === 0" class="empty-placeholder">
              暂无选课记录，点击右上角【选课】按钮去选课
            </div>
            <ul v-else class="course-list">
              <li v-for="enrollment in studentEnrollments" :key="enrollment.id" class="course-item">
                <div class="course-code">{{ enrollment.course_code }}</div>
                <div class="course-name">{{ enrollment.course_name }}</div>
                <div class="course-info">
                  <span>{{ enrollment.teacher_name }}</span>
                  <span>{{ enrollment.time_slot }}</span>
                  <span>{{ enrollment.location }}</span>
                </div>
                <div :class="['course-status', `status-${enrollment.status}`]">
                  {{ getStatusText(enrollment.status) }}
                </div>
              </li>
            </ul>
          </el-card>
        </el-col>
      </template>
    </el-row>

    <!-- 最近课程 -->
    <el-row :gutter="20" class="recent-row">
      <el-col :span="24">
        <el-card class="recent-card">
          <template #header>
            <div class="card-header">
              <span>最近课程</span>
              <el-button class="button" text @click="navigateTo('/courses')"> 查看全部 </el-button>
            </div>
          </template>
          <div v-if="loading" class="loading-placeholder">
            <el-skeleton :rows="5" animated />
          </div>
          <el-table v-else :data="recentCourses" style="width: 100%" :empty-text="'暂无课程数据'">
            <el-table-column prop="code" label="课程代码" width="120" />
            <el-table-column prop="name" label="课程名称" width="200" />
            <el-table-column prop="department_name" label="所属学院" />
            <el-table-column prop="credits" label="学分" width="80" />
            <el-table-column label="操作" width="150">
              <template #default="scope">
                <el-button link type="primary" @click="viewCourse(scope.row.id)"> 查看 </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../store/userStore'
import { useAnnouncementStore } from '../store/announcementStore'
import dayjs from 'dayjs'
import {
  getDashboardStats,
  getRecentCourses,
  getTeacherSections,
  getStudentEnrollments,
} from '../api/dashboard'

export default {
  name: 'DashboardView',
  setup() {
    const router = useRouter()
    const userStore = useUserStore()

    const loading = ref(true)
    const dashboardStats = reactive({
      userCount: 0,
      courseCount: 0,
      sectionCount: 0,
      enrollmentCount: 0,
    })

    const announcementStore = useAnnouncementStore()

    // 获取所有公告
    const announcements = computed(() => announcementStore.announcements)

    // 只显示已发布的公告
    const publishedAnnouncements = computed(() =>
      announcements.value.filter((announcement) => announcement.is_published),
    )

    // 格式化日期
    const formatDate = (date) => {
      return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
    }

    // 获取所有公告
    const fetchAnnouncements = async () => {
      loading.value = true
      try {
        await announcementStore.fetchAllAnnouncements()
      } catch (error) {
        console.error('获取公告列表失败', error)
      } finally {
        loading.value = false
      }
    }

    const teacherSections = ref([])
    const studentEnrollments = ref([])
    const recentCourses = ref([])

    const user = computed(() => userStore.user || {})
    const isAdmin = computed(() => userStore.isAdmin)
    const isTeacher = computed(() => userStore.isTeacher)
    const isStudent = computed(() => userStore.isStudent)

    const fetchDashboardData = async () => {
      loading.value = true

      try {
        // 根据用户角色获取不同的数据
        if (isAdmin.value) {
          // 管理员 - 获取仪表盘统计信息
          const statsResponse = await getDashboardStats()
          if (statsResponse.success) {
            Object.assign(dashboardStats, statsResponse.data)
          }
        } else if (isTeacher.value) {
          // 教师 - 获取自己的课程安排
          const sectionsResponse = await getTeacherSections(user.value.id)
          if (sectionsResponse.success) {
            teacherSections.value = sectionsResponse.data
          }
        } else if (isStudent.value) {
          // 学生 - 获取自己的选课记录
          const enrollmentsResponse = await getStudentEnrollments(user.value.id)
          if (enrollmentsResponse.success) {
            studentEnrollments.value = enrollmentsResponse.data
          }
        }

        // 获取最近课程 - 所有用户角色都需要
        const coursesResponse = await getRecentCourses()
        if (coursesResponse.success) {
          recentCourses.value = coursesResponse.data
        }
      } catch (error) {
        console.error('获取仪表盘数据失败', error)
        ElMessage.error('获取仪表盘数据失败')
      } finally {
        loading.value = false
      }
    }

    const navigateTo = (path) => {
      router.push(path)
    }

    const viewCourse = (id) => {
      router.push(`/courses/${id}`)
    }

    const getStatusText = (status) => {
      const statusMap = {
        enrolled: '已选',
        waitlisted: '等待',
        dropped: '已退',
      }
      return statusMap[status] || status
    }

    // 内容截断
    const truncateContent = (content) => {
      if (!content) return ''

      // 使用 DOMParser 解析 HTML
      const doc = new DOMParser().parseFromString(content, 'text/html')
      const plainText = doc.body.textContent || ''

      return plainText
    }

    onMounted(() => {
      fetchDashboardData()
      fetchAnnouncements()
    })

    return {
      user,
      isAdmin,
      isTeacher,
      isStudent,
      loading,
      dashboardStats,
      recentCourses,
      teacherSections,
      studentEnrollments,
      formatDate,
      publishedAnnouncements,
      navigateTo,
      viewCourse,
      getStatusText,
      truncateContent,
    }
  },
}
</script>

<style scoped>
.dashboard-container {
  padding: 20px;
}

.stats-row {
  margin-bottom: 20px;
}

.recent-row {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-card {
  margin-bottom: 20px;
  height: 100%;
}

.stat-card-title {
  font-size: 16px;
  color: #606266;
  margin-bottom: 10px;
}

.stat-card-value {
  font-size: 28px;
  font-weight: bold;
  color: #409eff;
  margin-bottom: 10px;
}

.stat-card-actions {
  margin-top: 10px;
}

.loading-placeholder,
.empty-placeholder {
  padding: 20px 0;
  text-align: center;
  color: #909399;
}

.course-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.course-item {
  padding: 10px 0;
  border-bottom: 1px solid #ebeef5;
}

.course-item:last-child {
  border-bottom: none;
}

.course-code {
  font-size: 14px;
  color: #909399;
}

.course-name {
  font-size: 16px;
  font-weight: bold;
  margin: 5px 0;
}

.course-info {
  font-size: 14px;
  color: #606266;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.course-stats {
  font-size: 14px;
  margin-top: 5px;
  color: #409eff;
  font-weight: bold;
}

.course-status {
  margin-top: 5px;
  font-size: 14px;
  font-weight: bold;
}

.status-enrolled {
  color: #67c23a;
}

.status-waitlisted {
  color: #e6a23c;
}

.status-dropped {
  color: #f56c6c;
}

.dashboard-container {
  padding: 20px;
}

.announcement-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.loading-placeholder,
.empty-placeholder {
  padding: 20px 0;
  text-align: center;
  color: #909399;
}

.announcement-content {
  white-space: pre-line;
  line-height: 1.6;
}
</style>
