// 为AI辅导员创建特殊的axios实例
import axios from 'axios';

// 专用于AI辅导员的axios实例，超时时间更长
const advisorApi = axios.create({
  baseURL: 'http://localhost:3000/api',
  timeout: 60000,  // 设置为60秒，远高于普通请求
  headers: {
    'Content-Type': 'application/json'
  }
});

// 复制原有的拦截器
advisorApi.interceptors.request.use(/* 与原api相同 */);
advisorApi.interceptors.response.use(/* 与原api相同 */);

export default advisorApi;