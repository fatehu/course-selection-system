const express = require('express')
const cors = require('cors')
const { testConnection } = require('./config/db')
const compression = require('compression') // 引入压缩中间件
require('dotenv').config()

// 导入路由
const authRoutes = require('./routes/authRoutes')
const userRoutes = require('./routes/userRoutes')
const courseRoutes = require('./routes/courseRoutes')
const sectionRoutes = require('./routes/sectionRoutes')
const enrollmentRoutes = require('./routes/enrollmentRoutes')
const departmentRoutes = require('./routes/departmentRoutes')
const dashboardRoutes = require('./routes/dashboardRoutes') // 添加仪表盘路由
const batchRoutes = require('./routes/batchRoutes')
const announcementRoutes = require('./routes/announcementRoutes')
// 添加AI辅导员路由
const advisorRoutes = require('./routes/advisor')
const reviewRoutes = require('./routes/reviewRoutes')
const knowledgeBaseRouter = require('./routes/knowledgeBase')

// 创建Express应用
const app = express()

// 中间件
app.use(cors())
app.use(express.json())
app.use(compression())

// 日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`)
  next()
})

// 添加数据库连接到app.locals
const { pool } = require('./config/db')
app.locals.pool = pool

// 路由
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/courses', courseRoutes)
app.use('/api/sections', sectionRoutes)
app.use('/api/enrollments', enrollmentRoutes)
app.use('/api/departments', departmentRoutes)
app.use('/api/dashboard', dashboardRoutes) // 添加仪表盘路由
app.use('/api/batch', batchRoutes)
app.use('/api/announcements', announcementRoutes)
app.use('/api/advisor', advisorRoutes)
app.use('/api/reviews', reviewRoutes)
app.use('/api/knowledge-base', knowledgeBaseRouter)

// 根路由
app.get('/', (req, res) => {
  res.json({
    message: '高校选课系统API服务',
    version: '1.0.0',
  })
})

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err)
  res.status(500).json({
    success: false,
    message: '服务器错误',
    error:
      process.env.NODE_ENV === 'development' ? err.message : '内部服务器错误',
  })
})

// 启动服务器
const PORT = process.env.PORT || 3000
const startServer = async () => {
  try {
    // 测试数据库连接
    const dbConnected = await testConnection()

    if (!dbConnected) {
      console.error('无法连接到数据库，服务启动失败')
      process.exit(1)
    }

    app.listen(PORT, () => {
      console.log(`服务器正在运行于端口: ${PORT}`)
    })
  } catch (error) {
    console.error('服务器启动失败:', error)
    process.exit(1)
  }
}

startServer()

module.exports = app // 用于测试
