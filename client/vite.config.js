import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import cdnImport from 'vite-plugin-cdn-import'

export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    cdnImport({
      modules: [
        {
          name: 'vue',
          var: 'Vue',
          path: 'https://unpkg.com/vue@3/dist/vue.global.prod.js',
        },
        {
          name: 'element-plus',
          var: 'ElementPlus',
          path: 'https://unpkg.com/element-plus/dist/index.full.min.js',
          css: 'https://unpkg.com/element-plus/dist/index.css',
        },
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      external: ['vue', 'element-plus'], // 排除 Vue 和 Element Plus
      output: {
        globals: {
          vue: 'Vue',
          'element-plus': 'ElementPlus',
        },
      },
    },
  },
  server: {
    // 如果需要代理 API 请求，可以启用以下配置
    // proxy: {
    //   '/api': {
    //     target: 'http://localhost:3000',
    //     changeOrigin: true,
    //   },
    // },
    host: '0.0.0.0',
    proxy: {
      '/base.css': {
        target: 'http://localhost:5173/src/assets/base.css',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/base.css/, ''),
      },
    },
    allowedHosts: 'all', // 允许所有主机访问
  },
})
