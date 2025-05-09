<template>
  <div class="container mx-auto px-4 py-8">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold text-gray-800">公告管理</h2>
      <button
        v-if="userRole === 'admin'"
        @click="openCreateModal"
        class="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition duration-300 shadow-sm flex items-center"
      >
        <i class="fa fa-plus mr-2"></i> 发布公告
      </button>
    </div>

    <div class="bg-white rounded-xl shadow-md overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr
              class="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <th class="px-6 py-3">标题</th>
              <th class="px-6 py-3">分类</th>
              <th class="px-6 py-3">发布者</th>
              <th class="px-6 py-3">发布时间</th>
              <th class="px-6 py-3">状态</th>
              <th class="px-6 py-3">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr
              v-for="announcement in announcements"
              :key="announcement.id"
              class="hover:bg-gray-50 transition duration-150"
            >
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">{{ announcement.title }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800"
                >
                  {{ formatCategory(announcement.category) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">{{ announcement.publisher_name }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ formatDateTime(announcement.publish_time) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                  :class="
                    announcement.is_published
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  "
                >
                  {{ announcement.is_published ? '已发布' : '草稿' }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button
                  @click="viewAnnouncement(announcement.id)"
                  class="text-indigo-600 hover:text-indigo-900 mr-3"
                >
                  <i class="fa fa-eye"></i>
                </button>
                <button
                  v-if="userRole === 'admin'"
                  @click="editAnnouncement(announcement.id)"
                  class="text-yellow-600 hover:text-yellow-900 mr-3"
                >
                  <i class="fa fa-edit"></i>
                </button>
                <button
                  v-if="userRole === 'admin'"
                  @click="confirmDelete(announcement.id)"
                  class="text-red-600 hover:text-red-900"
                >
                  <i class="fa fa-trash"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分页 -->
      <div class="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
        <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p class="text-sm text-gray-700">
              显示第 <span class="font-medium">1</span> 至
              <span class="font-medium">{{ announcements.length }}</span> 条，共
              <span class="font-medium">{{ announcements.length }}</span> 条记录
            </p>
          </div>
          <div>
            <nav
              class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
              aria-label="Pagination"
            >
              <a
                href="#"
                class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                <span class="sr-only">上一页</span>
                <i class="fa fa-chevron-left"></i>
              </a>
              <a
                href="#"
                class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-indigo-50 text-sm font-medium text-indigo-600 hover:bg-indigo-100"
              >
                1
              </a>
              <a
                href="#"
                class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                <span class="sr-only">下一页</span>
                <i class="fa fa-chevron-right"></i>
              </a>
            </nav>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建/编辑公告模态框 -->
    <div v-if="isModalOpen" class="fixed inset-0 z-50 overflow-y-auto">
      <div
        class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0"
      >
        <div class="fixed inset-0 transition-opacity" aria-hidden="true">
          <div class="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true"
          >&#8203;</span
        >
        <div
          class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
        >
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div class="sm:flex sm:items-start">
              <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">
                  {{ isEditing ? '编辑公告' : '发布公告' }}
                </h3>
                <div class="mt-2">
                  <form @submit.prevent="submitAnnouncement">
                    <div class="mb-4">
                      <label for="title" class="block text-sm font-medium text-gray-700 mb-1"
                        >标题</label
                      >
                      <input
                        type="text"
                        id="title"
                        v-model="formData.title"
                        class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        required
                      />
                    </div>

                    <div class="mb-4">
                      <label for="category" class="block text-sm font-medium text-gray-700 mb-1"
                        >分类</label
                      >
                      <select
                        id="category"
                        v-model="formData.category"
                        class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      >
                        <option value="general">普通公告</option>
                        <option value="course">课程相关</option>
                        <option value="exam">考试安排</option>
                        <option value="system">系统通知</option>
                      </select>
                    </div>

                    <div class="mb-4">
                      <label for="content" class="block text-sm font-medium text-gray-700 mb-1"
                        >内容</label
                      >
                      <textarea
                        id="content"
                        v-model="formData.content"
                        rows="6"
                        class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        required
                      ></textarea>
                    </div>

                    <div class="mb-4">
                      <label class="inline-flex items-center">
                        <input
                          type="checkbox"
                          v-model="formData.is_published"
                          class="form-checkbox h-5 w-5 text-indigo-600 rounded"
                        />
                        <span class="ml-2 text-sm text-gray-700">立即发布</span>
                      </label>
                    </div>

                    <div class="flex justify-end mt-6">
                      <button
                        type="button"
                        @click="closeModal"
                        class="mr-3 inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        取消
                      </button>
                      <button
                        type="submit"
                        class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        {{ isEditing ? '保存更改' : '发布' }}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 公告详情模态框 -->
    <div v-if="isViewModalOpen" class="fixed inset-0 z-50 overflow-y-auto">
      <div
        class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0"
      >
        <div class="fixed inset-0 transition-opacity" aria-hidden="true">
          <div class="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true"
          >&#8203;</span
        >
        <div
          class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full"
        >
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div class="sm:flex sm:items-start">
              <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 class="text-xl leading-6 font-bold text-gray-900 mb-2">
                  {{ currentViewAnnouncement.title }}
                </h3>
                <div class="flex items-center text-sm text-gray-500 mb-4">
                  <span>{{ currentViewAnnouncement.publisher_name }}</span>
                  <span class="mx-2">·</span>
                  <span>{{ formatDateTime(currentViewAnnouncement.publish_time) }}</span>
                  <span class="mx-2">·</span>
                  <span
                    class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800"
                  >
                    {{ formatCategory(currentViewAnnouncement.category) }}
                  </span>
                </div>
                <div class="mt-2 text-gray-700 leading-relaxed">
                  <div v-html="currentViewAnnouncement.content"></div>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-gray-50 px-4 py-3 sm:px-6 flex justify-end">
            <button
              type="button"
              @click="closeViewModal"
              class="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 删除确认模态框 -->
    <div v-if="isDeleteModalOpen" class="fixed inset-0 z-50 overflow-y-auto">
      <div
        class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0"
      >
        <div class="fixed inset-0 transition-opacity" aria-hidden="true">
          <div class="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true"
          >&#8203;</span
        >
        <div
          class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-sm sm:w-full"
        >
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div class="sm:flex sm:items-start">
              <div
                class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10"
              >
                <i class="fa fa-exclamation-triangle text-red-500"></i>
              </div>
              <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                  删除公告
                </h3>
                <div class="mt-2">
                  <p class="text-sm text-gray-500">确定要删除此公告吗？此操作不可撤销。</p>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              @click="confirmDeleteAction"
              class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
            >
              删除
            </button>
            <button
              type="button"
              @click="closeDeleteModal"
              class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAnnouncementStore } from '@/store/announcementStore'
import { useUserStore } from '@/store/userStore'
import { ElMessage } from 'element-plus' // 引入 ElementPlus 的消息提示组件

const announcementStore = useAnnouncementStore()
const userStore = useUserStore()

// 状态变量
const announcements = computed(() => announcementStore.announcements)
const userRole = computed(() => userStore.user?.role || '')

// 模态框状态
const isModalOpen = ref(false)
const isViewModalOpen = ref(false)
const isDeleteModalOpen = ref(false)
const isEditing = ref(false)
const currentAnnouncementId = ref(null)

// 表单数据
const formData = ref({
  title: '',
  content: '',
  category: 'general',
  is_published: true,
})

// 当前查看的公告
const currentViewAnnouncement = ref(null)

// 生命周期钩子
onMounted(async () => {
  try {
    await announcementStore.fetchAllAnnouncements()
  } catch (error) {
    ElMessage.error('获取公告列表失败，请稍后重试')
  }
})

// 格式化日期时间
const formatDateTime = (dateTime) => {
  if (!dateTime) return ''
  const date = new Date(dateTime)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 格式化分类
const formatCategory = (category) => {
  const categories = {
    general: '普通公告',
    course: '课程相关',
    exam: '考试安排',
    system: '系统通知',
  }
  return categories[category] || category
}

// 打开创建公告模态框
const openCreateModal = () => {
  isEditing.value = false
  formData.value = {
    title: '',
    content: '',
    category: 'general',
    is_published: true,
  }
  isModalOpen.value = true
}

// 打开编辑公告模态框
const editAnnouncement = async (id) => {
  try {
    isEditing.value = true
    currentAnnouncementId.value = id

    const announcement = await announcementStore.fetchAnnouncement(id)
    formData.value = {
      title: announcement.title,
      content: announcement.content,
      category: announcement.category,
      is_published: announcement.is_published,
    }

    isModalOpen.value = true
  } catch (error) {
    ElMessage.error('获取公告详情失败，请稍后重试')
  }
}

// 查看公告详情
const viewAnnouncement = async (id) => {
  try {
    const announcement = await announcementStore.fetchAnnouncement(id)
    currentViewAnnouncement.value = announcement
    isViewModalOpen.value = true
  } catch (error) {
    ElMessage.error('获取公告详情失败，请稍后重试')
  }
}

// 确认删除公告
const confirmDelete = (id) => {
  currentAnnouncementId.value = id
  isDeleteModalOpen.value = true
}

// 关闭模态框
const closeModal = () => {
  isModalOpen.value = false
}

const closeViewModal = () => {
  isViewModalOpen.value = false
}

const closeDeleteModal = () => {
  isDeleteModalOpen.value = false
}

// 提交公告表单
const submitAnnouncement = async () => {
  try {
    if (isEditing.value) {
      // 更新公告
      await announcementStore.updateAnnouncement(currentAnnouncementId.value, formData.value)
      ElMessage.success('公告更新成功')
    } else {
      // 创建公告
      await announcementStore.createAnnouncement({
        ...formData.value,
        publisher_id: userStore.user.id,
      })
      ElMessage.success('公告发布成功')
    }

    isModalOpen.value = false
    await announcementStore.fetchAllAnnouncements() // 重新获取公告列表
  } catch (error) {
    ElMessage.error('操作失败，请稍后重试')
  }
}

// 确认删除操作
const confirmDeleteAction = async () => {
  try {
    await announcementStore.deleteAnnouncement(currentAnnouncementId.value)
    ElMessage.success('公告删除成功')
    isDeleteModalOpen.value = false
    await announcementStore.fetchAllAnnouncements() // 重新获取公告列表
  } catch (error) {
    ElMessage.error('删除公告失败，请稍后重试')
  }
}
</script>
