// course-selection-system/client/src/api/review.js
import api from './axios'

// 根据课程 ID 获取课程评价
export const getReviewsByCourse = async (courseId) => {
  try {
    const response = await api.get(`http://localhost:3000/api/reviews/course/${courseId}`)
    console.log(response)

    return response.data
  } catch (error) {
    console.error('获取课程评价失败:', error)
    throw error.response?.data || error
  }
}

// 提交课程评价
export const submitReviewApi = async (reviewData) => {
  try {
    const response = await api.post(`http://localhost:3000/api/reviews`, reviewData)
    console.log(response)

    return response.data
  } catch (error) {
    console.error('提交课程评价失败:', error)
    throw error.response?.data || error
  }
}
