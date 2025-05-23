import { defineStore } from 'pinia'
import {
  getAllAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '@/api/announcement'

export const useAnnouncementStore = defineStore('announcement', {
  state: () => ({
    announcements: [],
    currentAnnouncement: null,
    loading: false,
    error: null,
  }),

  actions: {
    // 获取所有公告
    async fetchAllAnnouncements() {
      this.loading = true
      this.error = null

      try {
        const response = await getAllAnnouncements()

        if (response && response.success) {
          this.announcements = response.data
        } else {
          this.announcements = []
        }

        return response
      } catch (error) {
        this.error = error.message || '获取公告列表失败'
        this.announcements = []
        return { success: false, data: [] }
      } finally {
        this.loading = false
      }
    },

    // 获取单个公告
    async fetchAnnouncement(id) {
      this.loading = true
      this.error = null

      try {
        const response = await getAnnouncement(id)
        console.log(response)

        if (response && response.success) {
          this.currentAnnouncement = response.data
        } else {
          this.currentAnnouncement = null
        }

        return response
      } catch (error) {
        this.error = error.message || '获取公告详情失败'
        this.currentAnnouncement = null
        return { success: false, data: null }
      } finally {
        this.loading = false
      }
    },

    // 创建公告
    async createAnnouncement(announcementData) {
      this.loading = true
      this.error = null

      try {
        const response = await createAnnouncement(announcementData)

        if (response && response.success) {
          // 添加到公告列表
          this.announcements.unshift(response.data)
        }

        return response
      } catch (error) {
        this.error = error.message || '创建公告失败'
        throw error
      } finally {
        this.loading = false
      }
    },

    // 更新公告
    async updateAnnouncement(id, announcementData) {
      this.loading = true
      this.error = null

      try {
        const response = await updateAnnouncement(id, announcementData)

        if (response && response.success) {
          // 更新公告列表中的公告
          const index = this.announcements.findIndex((a) => a.id === id)
          if (index !== -1) {
            this.announcements[index] = response.data
          }

          // 更新当前公告
          if (this.currentAnnouncement && this.currentAnnouncement.id === id) {
            this.currentAnnouncement = response.data
          }
        }

        return response
      } catch (error) {
        this.error = error.message || '更新公告失败'
        throw error
      } finally {
        this.loading = false
      }
    },

    // 删除公告
    async deleteAnnouncement(id) {
      this.loading = true
      this.error = null

      try {
        const response = await deleteAnnouncement(id)

        if (response && response.success) {
          // 从公告列表中移除
          this.announcements = this.announcements.filter((a) => a.id !== id)

          // 如果删除的是当前公告，重置当前公告
          if (this.currentAnnouncement && this.currentAnnouncement.id === id) {
            this.currentAnnouncement = null
          }
        }

        return response
      } catch (error) {
        this.error = error.message || '删除公告失败'
        throw error
      } finally {
        this.loading = false
      }
    },
  },
})