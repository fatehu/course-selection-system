<template>
  <div class="course-detail-container">
    <el-card class="course-detail-card">
      <template #header>
        <div class="card-header">
          <el-button @click="goBack" icon="arrow-left" circle plain></el-button>
          <span>课程详情</span>
          <div class="header-actions" v-if="isAdmin || isTeacher">
            <el-button type="primary" @click="editCourse">编辑课程</el-button>
          </div>
        </div>
      </template>

      <div v-if="loading" class="loading-placeholder">
        <el-skeleton :rows="6" animated />
      </div>

      <div v-else-if="!course" class="empty-placeholder">课程不存在或已被删除</div>

      <div v-else class="course-info">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="课程代码">{{ course.code }}</el-descriptions-item>
          <el-descriptions-item label="课程名称">{{ course.name }}</el-descriptions-item>
          <el-descriptions-item label="所属学院">{{ course.department_name }}</el-descriptions-item>
          <el-descriptions-item label="学分">{{ course.credits }}</el-descriptions-item>
          <el-descriptions-item label="课程描述" :span="2">
            <p class="course-description">{{ course.description || '暂无描述' }}</p>
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <el-divider></el-divider>

      <h3 class="section-title">课程安排</h3>

      <div v-if="loadingSections" class="loading-placeholder">
        <el-skeleton :rows="3" animated />
      </div>

      <div v-else-if="sections.length === 0" class="empty-placeholder">
        暂无课程安排
        <div v-if="isAdmin || isTeacher" class="mt-3">
          <el-button type="primary" @click="createSection">创建课程安排</el-button>
        </div>
      </div>

      <div v-else>
        <div v-if="isAdmin || isTeacher" class="action-bar">
          <el-button type="primary" @click="createSection">创建课程安排</el-button>
        </div>

        <el-table :data="sections" style="width: 100%">
          <el-table-column prop="semester" label="学期" width="120" />
          <el-table-column prop="teacher_name" label="教师" width="120" />
          <el-table-column prop="time_slot" label="时间" />
          <el-table-column prop="location" label="地点" width="120" />
          <el-table-column label="选课情况" width="120">
            <template #default="scope">
              {{ scope.row.current_enrollment }}/{{ scope.row.capacity }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200">
            <template #default="scope">
              <el-button link type="primary" @click="viewSection(scope.row.id)">查看</el-button>

              <el-button
                v-if="isAdmin || (isTeacher && scope.row.teacher_id === userId)"
                link
                type="primary"
                @click="editSection(scope.row.id)"
              >
                编辑
              </el-button>

              <el-button
                v-if="isStudent && !isFull(scope.row)"
                link
                type="success"
                @click="enrollSection(scope.row.id)"
              >
                选课
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <el-divider></el-divider>

      <h3 class="section-title">课程评价</h3>

      <div v-if="loadingReviews" class="loading-placeholder">
        <el-skeleton :rows="3" animated />
      </div>

      <div v-else-if="reviews.length === 0" class="empty-placeholder">暂无评价</div>

      <div v-else>
        <div v-for="review in reviews" :key="review.id" class="review-item">
          <div class="review-header">
            <span class="review-author">{{ authorNames[review.user_id] }}</span>
            <span class="review-time">{{ formatDate(review.created_at) }}</span>
          </div>
          <div class="review-content">{{ review.content }}</div>
        </div>
      </div>

      <div v-if="isStudent">
        <el-form :model="newReview" label-width="80px">
          <el-form-item label="评价内容">
            <el-input type="textarea" v-model="newReview.content"></el-input>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="submitReview">提交评价</el-button>
          </el-form-item>
        </el-form>
      </div>

      <h3 class="section-title">课程评价总结</h3>

      <div v-if="loadingSummary" class="loading-placeholder">
        <el-skeleton :rows="3" animated />
      </div>

      <div v-else-if="!summary" class="empty-placeholder">暂无评价总结</div>

      <div v-else class="summary-content markdown-content">
        <div v-html="summary"></div>
      </div>

      <el-divider></el-divider>
    </el-card>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useCourseStore } from '../store/courseStore'
import { useSectionStore } from '../store/sectionStore'
import { useEnrollmentStore } from '../store/enrollmentStore'
import { useUserStore } from '../store/userStore'
import { useReviewStore } from '../store/reviewStore'
import dayjs from 'dayjs'

export default {
  name: 'CourseDetailView',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const courseStore = useCourseStore()
    const sectionStore = useSectionStore()
    const enrollmentStore = useEnrollmentStore()
    const userStore = useUserStore()
    const reviewStore = useReviewStore()

    const loading = ref(true)
    const loadingSections = ref(true)
    const loadingReviews = ref(true)
    const loadingSummary = ref(true)
    const summary = ref('')
    const courseId = route.params.id

    // 用户信息和权限
    const isAdmin = computed(() => userStore.isAdmin)
    const isTeacher = computed(() => userStore.isTeacher)
    const isStudent = computed(() => userStore.isStudent)
    const userId = computed(() => userStore.userId)
    const authorNames = ref({})
    const getAuthorName = async (userId) => {
      const user = await userStore.getUserById(userId)
      authorNames.value[userId] = user.name
    }

    // 当前课程信息
    const course = computed(() => courseStore.currentCourse)

    // 课程安排列表
    const sections = ref([])

    // 课程评价列表
    const reviews = computed(() => reviewStore.reviews)

    // 新建评价
    const newReview = ref({
      content: '',
      course_id: courseId,
      user_id: userId.value,
    })

    // Markdown处理函数
    const processMarkdown = (content) => {
      if (!content) return ''
      
      // 先清理重复的编号（如 "1. 1." -> "1."）
      let cleanedContent = content
        .replace(/^(\d+)\.\s+\1\.\s+/gm, '$1. ')  // 处理 "1. 1. " -> "1. "
        .replace(/^(\d+)\.\s+(\d+)\.\s+/gm, '$1. ') // 处理 "1. 2. " -> "1. "
      
      return cleanedContent
        // 处理标题（从最长的开始，避免误匹配）
        .replace(/^##### (.*$)/gim, '<h5 class="md-h5">$1</h5>')
        .replace(/^#### (.*$)/gim, '<h4 class="md-h4">$1</h4>')
        .replace(/^### (.*$)/gim, '<h3 class="md-h3">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 class="md-h2">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 class="md-h1">$1</h1>')
        
        // 处理粗体和斜体
        .replace(/\*\*(.*?)\*\*/gim, '<strong class="md-strong">$1</strong>')
        .replace(/\*(.*?)\*/gim, '<em class="md-em">$1</em>')
        
        // 处理代码块
        .replace(/```([\s\S]*?)```/gim, '<pre class="md-pre"><code class="md-code">$1</code></pre>')
        .replace(/`(.*?)`/gim, '<code class="md-inline-code">$1</code>')
        
        // 处理链接
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="md-link">$1</a>')
        
        // 按段落分割处理
        .split('\n\n')
        .map(paragraph => {
          if (paragraph.trim() === '') return ''
          
          // 处理有序列表段落
          if (/^\d+\.\s/.test(paragraph.trim())) {
            const listItems = paragraph
              .split('\n')
              .filter(line => line.trim())
              .map(line => {
                const match = line.match(/^\d+\.\s+(.*)$/)
                if (match) {
                  return `<li class="md-li md-li-ordered">${match[1]}</li>`
                }
                return line
              })
              .join('')
            return `<ol class="md-ol">${listItems}</ol>`
          }
          
          // 处理无序列表段落
          if (/^[\*\-]\s/.test(paragraph.trim())) {
            const listItems = paragraph
              .split('\n')
              .filter(line => line.trim())
              .map(line => {
                const match = line.match(/^[\*\-]\s+(.*)$/)
                if (match) {
                  return `<li class="md-li">${match[1]}</li>`
                }
                return line
              })
              .join('')
            return `<ul class="md-ul">${listItems}</ul>`
          }
          
          // 如果是标题或代码块，不包装段落
          if (paragraph.includes('<h1') || paragraph.includes('<h2') || 
              paragraph.includes('<h3') || paragraph.includes('<h4') || 
              paragraph.includes('<h5') || paragraph.includes('<pre')) {
            return paragraph
          }
          
          // 普通段落
          return `<p class="md-p">${paragraph.replace(/\n/g, '<br>')}</p>`
        })
        .filter(p => p.trim() !== '')
        .join('')
    }

    const formatDate = (date) => {
      return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
    }

    // 获取课程详情
    const fetchCourseDetail = async () => {
      loading.value = true

      try {
        await courseStore.fetchCourse(courseId)
      } catch (error) {
        console.error('获取课程详情失败', error)
        ElMessage.error('获取课程详情失败')
      } finally {
        loading.value = false
      }
    }

    // 获取课程安排
    const fetchSections = async () => {
      loadingSections.value = true

      try {
        const result = await sectionStore.fetchSectionsByCourse(courseId)
        sections.value = result
      } catch (error) {
        console.error('获取课程安排失败', error)
        ElMessage.error('获取课程安排失败')
      } finally {
        loadingSections.value = false
      }
    }

    // 获取课程评价
    const fetchReviews = async () => {
      loadingReviews.value = true
      reviews.value = []

      try {
        await reviewStore.fetchReview(courseId)
        reviews.value.forEach((review) => {
          getAuthorName(review.user_id)
        })
      } catch (error) {
        console.error('获取课程评价失败', error)
        ElMessage.error('获取课程评价失败')
      } finally {
        loadingReviews.value = false
      }
    }

    // 获取课程评价总结
    const fetchSummary = async () => {
      loadingSummary.value = true
      try {
        const response = await fetch(`http://localhost:3000/api/reviews/course/${courseId}/summary`)
        const data = await response.json()
        if (data.success) {
          // 使用markdown处理函数
          summary.value = processMarkdown(data.data.summary)
        } else {
          summary.value = ''
        }
      } catch (error) {
        console.error('获取课程评价总结失败', error)
        ElMessage.error('获取课程评价总结失败')
      } finally {
        loadingSummary.value = false
      }
    }

    // 返回上一页
    const goBack = () => {
      router.back()
    }

    // 编辑课程
    const editCourse = () => {
      router.push(`/courses/${courseId}/edit`)
    }

    // 创建课程安排
    const createSection = () => {
      router.push({
        path: '/sections/create',
        query: { courseId },
      })
    }

    // 查看排课详情
    const viewSection = (sectionId) => {
      router.push(`/sections/${sectionId}`)
    }

    // 编辑排课
    const editSection = (sectionId) => {
      router.push(`/sections/${sectionId}/edit`)
    }

    // 选课
    const enrollSection = async (sectionId) => {
      try {
        const response = await enrollmentStore.enrollCourse(sectionId)

        if (response.success) {
          ElMessage.success(response.message || '选课成功')
          fetchSections()
        }
      } catch (error) {
        console.error('选课失败', error)
        ElMessage.error(error.message || '选课失败')
      }
    }

    // 提交评价
    const submitReview = async () => {
      try {
        console.log(newReview.value)
        const response = await reviewStore.submitReview(newReview.value)
        console.log(newReview.value)
        console.log(response)

        if (response) {
          ElMessage.success('评价提交成功')
          fetchReviews()
          newReview.value.content = ''
        }
      } catch (error) {
        console.error('提交评价失败', error)
        ElMessage.error(error.message || '提交评价失败')
      }
    }

    // 检查课程是否已满
    const isFull = (section) => {
      return section.current_enrollment >= section.capacity
    }

    onMounted(() => {
      fetchCourseDetail()
      fetchSections()
      fetchReviews()
      fetchSummary()
    })

    return {
      loading,
      loadingSections,
      loadingReviews,
      loadingSummary,
      course,
      sections,
      reviews,
      newReview,
      summary,
      isAdmin,
      isTeacher,
      isStudent,
      userId,
      goBack,
      editCourse,
      createSection,
      viewSection,
      editSection,
      enrollSection,
      submitReview,
      isFull,
      formatDate,
      getAuthorName,
      authorNames,
      processMarkdown
    }
  },
}
</script>

<style scoped>
.course-detail-container {
  padding: 20px;
}

.course-detail-card {
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

.course-info {
  margin-bottom: 20px;
}

.course-description {
  white-space: pre-line;
  line-height: 1.6;
}

.section-title {
  margin-bottom: 20px;
  font-weight: 500;
  color: #303133;
}

.action-bar {
  margin-bottom: 15px;
  display: flex;
  justify-content: flex-end;
}

.mt-3 {
  margin-top: 15px;
}

.review-item {
  margin-bottom: 15px;
  padding: 15px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}

.review-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.review-author {
  font-weight: 500;
}

.review-time {
  color: #909399;
}

.review-content {
  white-space: pre-line;
}

.summary-content {
  margin-bottom: 20px;
  padding: 20px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background-color: #fafafa;
  line-height: 1.6;
}

/* Markdown样式 */
.markdown-content {
  color: #333;
}

.markdown-content :deep(.md-h1) {
  font-size: 1.8em;
  font-weight: 600;
  margin: 1.2em 0 0.8em 0;
  color: #2c3e50;
  border-bottom: 2px solid #3498db;
  padding-bottom: 0.3em;
}

.markdown-content :deep(.md-h2) {
  font-size: 1.5em;
  font-weight: 600;
  margin: 1em 0 0.6em 0;
  color: #34495e;
  border-bottom: 1px solid #bdc3c7;
  padding-bottom: 0.2em;
}

.markdown-content :deep(.md-h3) {
  font-size: 1.3em;
  font-weight: 600;
  margin: 0.8em 0 0.5em 0;
  color: #5d6d7e;
}

.markdown-content :deep(.md-h4) {
  font-size: 1.1em;
  font-weight: 600;
  margin: 0.7em 0 0.4em 0;
  color: #6c7b8a;
}

.markdown-content :deep(.md-h5) {
  font-size: 1em;
  font-weight: 600;
  margin: 0.6em 0 0.3em 0;
  color: #7b8794;
}

.markdown-content :deep(.md-p) {
  margin: 0.8em 0;
  line-height: 1.7;
  color: #2c3e50;
}

.markdown-content :deep(.md-strong) {
  font-weight: 600;
  color: #e74c3c;
}

.markdown-content :deep(.md-em) {
  font-style: italic;
  color: #8e44ad;
}

.markdown-content :deep(.md-ul),
.markdown-content :deep(.md-ol) {
  margin: 1em 0;
  padding-left: 0;
}

.markdown-content :deep(.md-li) {
  margin: 0.3em 0;
  padding-left: 1.5em;
  position: relative;
  line-height: 1.6;
  color: #34495e;
}

.markdown-content :deep(.md-ul .md-li::before) {
  content: "•";
  color: #3498db;
  font-weight: bold;
  position: absolute;
  left: 0.5em;
}

.markdown-content :deep(.md-ol) {
  counter-reset: li-counter;
}

.markdown-content :deep(.md-ol .md-li) {
  counter-increment: li-counter;
}

.markdown-content :deep(.md-ol .md-li::before) {
  content: counter(li-counter) ".";
  color: #3498db;
  font-weight: bold;
  position: absolute;
  left: 0;
  width: 1.2em;
  text-align: right;
}

.markdown-content :deep(.md-pre) {
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 1em;
  margin: 1em 0;
  overflow-x: auto;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.markdown-content :deep(.md-code) {
  color: #d73a49;
  background: transparent;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9em;
}

.markdown-content :deep(.md-inline-code) {
  background-color: #f1f2f6;
  color: #e74c3c;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9em;
}

.markdown-content :deep(.md-link) {
  color: #3498db;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: all 0.3s ease;
}

.markdown-content :deep(.md-link:hover) {
  color: #2980b9;
  border-bottom-color: #3498db;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .markdown-content :deep(.md-h1) {
    font-size: 1.5em;
  }
  
  .markdown-content :deep(.md-h2) {
    font-size: 1.3em;
  }
  
  .markdown-content :deep(.md-h3) {
    font-size: 1.1em;
  }
  
  .markdown-content :deep(.md-h4) {
    font-size: 1em;
  }
  
  .markdown-content :deep(.md-h5) {
    font-size: 0.95em;
  }
  
  .markdown-content :deep(.md-pre) {
    padding: 0.8em;
    font-size: 0.9em;
  }
}
</style>