const Course = require('../models/courseModel')
const redis = require('../config/redis')

// 获取所有课程
exports.getAllCourses = async (req, res) => {
  try {
    const cacheKey = 'courses:all'

    // 检查 Redis 缓存
    const cachedCourses = await redis.get(cacheKey)
    if (cachedCourses) {
      console.log('从 Redis 缓存中获取课程列表')
      return res.status(200).json({
        success: true,
        count: JSON.parse(cachedCourses).length,
        data: JSON.parse(cachedCourses),
      })
    }

    // 如果缓存不存在，从数据库查询
    const courses = await Course.getAll()

    // 将结果存入 Redis，设置过期时间为 1 小时
    await redis.set(cacheKey, JSON.stringify(courses), 'EX', 3600)

    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses,
    })
  } catch (error) {
    console.error('获取课程列表失败:', error)
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    })
  }
}

// 获取单个课程
exports.getCourse = async (req, res) => {
  try {
    const courseId = req.params.id
    const cacheKey = `course:${courseId}`

    // 检查 Redis 缓存
    const cachedCourse = await redis.get(cacheKey)
    if (cachedCourse) {
      console.log(`从 Redis 缓存中获取课程 ID: ${courseId}`)
      return res.status(200).json({
        success: true,
        data: JSON.parse(cachedCourse),
      })
    }

    // 如果缓存不存在，从数据库查询
    const course = await Course.getById(courseId)

    if (!course) {
      return res.status(404).json({
        success: false,
        message: '课程不存在',
      })
    }

    // 将结果存入 Redis，设置过期时间为 1 小时
    await redis.set(cacheKey, JSON.stringify(course), 'EX', 3600)

    res.status(200).json({
      success: true,
      data: course,
    })
  } catch (error) {
    console.error('获取课程失败:', error)
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    })
  }
}

// 按学院获取课程
exports.getCoursesByDepartment = async (req, res) => {
  try {
    const departmentId = req.params.departmentId
    const courses = await Course.getByDepartment(departmentId)

    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses,
    })
  } catch (error) {
    console.error('获取学院课程失败:', error)
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    })
  }
}

// 创建课程
exports.createCourse = async (req, res) => {
  try {
    // 只有管理员和教师才能创建课程
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作',
      })
    }

    const newCourse = await Course.create(req.body)

    // 清除 Redis 中的课程列表缓存
    await redis.del('courses:all')

    res.status(201).json({
      success: true,
      message: '课程创建成功',
      data: newCourse,
    })
  } catch (error) {
    console.error('创建课程失败:', error)
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    })
  }
}

// 更新课程
exports.updateCourse = async (req, res) => {
  try {
    const courseId = req.params.id

    // 检查课程是否存在
    const course = await Course.getById(courseId)

    if (!course) {
      return res.status(404).json({
        success: false,
        message: '课程不存在',
      })
    }

    // 只有管理员和教师才能更新课程
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作',
      })
    }

    const success = await Course.update(courseId, req.body)

    if (!success) {
      return res.status(500).json({
        success: false,
        message: '更新课程失败',
      })
    }

    // 清除 Redis 中的相关缓存
    await redis.del('courses:all') // 清除课程列表缓存
    await redis.del(`course:${courseId}`) // 清除单个课程缓存

    res.status(200).json({
      success: true,
      message: '课程更新成功',
    })
  } catch (error) {
    console.error('更新课程失败:', error)
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    })
  }
}

// 删除课程
exports.deleteCourse = async (req, res) => {
  try {
    const courseId = req.params.id

    // 检查课程是否存在
    const course = await Course.getById(courseId)

    if (!course) {
      return res.status(404).json({
        success: false,
        message: '课程不存在',
      })
    }

    // 只有管理员才能删除课程
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作',
      })
    }

    const success = await Course.delete(courseId)

    if (!success) {
      return res.status(500).json({
        success: false,
        message: '删除课程失败',
      })
    }

    // 清除 Redis 中的相关缓存
    await redis.del('courses:all') // 清除课程列表缓存
    await redis.del(`course:${courseId}`) // 清除单个课程缓存

    res.status(200).json({
      success: true,
      message: '课程删除成功',
    })
  } catch (error) {
    console.error('删除课程失败:', error)
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    })
  }
}

// 搜索课程
exports.searchCourses = async (req, res) => {
  try {
    const keyword = req.query.keyword || ''

    if (!keyword) {
      return res.status(400).json({
        success: false,
        message: '请提供搜索关键词',
      })
    }

    const courses = await Course.search(keyword)

    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses,
    })
  } catch (error) {
    console.error('搜索课程失败:', error)
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message,
    })
  }
}
