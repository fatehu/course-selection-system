import api from './axios'

// 获取所有公告
export const getAllAnnouncements = async () => {
  try {
    const response = await api.get('/announcements')
    return response
  } catch (error) {
    console.error('获取公告列表失败:', error)
    throw error.response?.data || error
  }
}

// 获取单个公告
export const getAnnouncement = async (id) => {
  console.log(id)

  try {
    const response = await api.get(`/announcements/${id}`)
    console.log(response)

    return response
  } catch (error) {
    console.error('获取公告失败:', error)
    throw error.response?.data || error
  }
}

// 创建公告
export const createAnnouncement = async (announcementData) => {
  try {
    const response = await api.post('/announcements', announcementData)
    console.log(response)

    return response
  } catch (error) {
    console.error('创建公告失败:', error)
    throw error.response?.data || error
  }
}

// 更新公告
export const updateAnnouncement = async (id, announcementData) => {
  try {
    const response = await api.put(`/announcements/${id}`, announcementData)
    return response
  } catch (error) {
    console.error('更新公告失败:', error)
    throw error.response?.data || error
  }
}

// 删除公告
export const deleteAnnouncement = async (id) => {
  try {
    const response = await api.delete(`/announcements/${id}`)
    return response
  } catch (error) {
    console.error('删除公告失败:', error)
    throw error.response?.data || error
  }
}