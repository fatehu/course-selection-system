# 使用Node.js 18的Alpine版本
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制所有源代码
COPY . .

# 创建必要的目录
RUN mkdir -p data/cache data/chunks data/conversations data/pdf data/settings data/vector_stores uploads/knowledge_base temp

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["npm", "start"]