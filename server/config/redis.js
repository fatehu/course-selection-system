const Redis = require('ioredis')

// 从环境变量加载 Redis 配置
const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || null,
  db: process.env.REDIS_DB || 0,
})

// 测试连接
redis.on('connect', () => {
  console.log('Redis 连接成功')
})

redis.on('error', (err) => {
  console.error('Redis 连接失败:', err)
})

module.exports = redis
