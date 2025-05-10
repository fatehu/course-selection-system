// course-selection-system/client/src/store/reviewStore.js
import { defineStore } from 'pinia'
import { getReviewsByCourse, submitReviewApi } from '@/api/review'

export const useReviewStore = defineStore('review', {
  state: () => ({
    reviews: [],
    error: null,
  }),

  actions: {
    // 根据课程 ID 获取课程评价
    async fetchReview(courseId) {
      this.error = null

      try {
        const response = await getReviewsByCourse(courseId)

        console.log('获取课程评价:', response)

        if (response) {
          this.reviews = response
        }

        return response
      } catch (error) {
        this.error = error.message || '获取课程评价失败'
        return []
      }
    },

    // 提交课程评价
    async submitReview(reviewData) {
      this.error = null

      try {
        const response = await submitReviewApi(reviewData)

        if (response.success) {
          // 添加到课程评价列表
          this.reviews.unshift(response.data)
        }

        return response
      } catch (error) {
        this.error = error.message || '提交课程评价失败'
        throw error
      }
    },
  },
})
