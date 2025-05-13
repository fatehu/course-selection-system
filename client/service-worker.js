// service-worker.js
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('my-cache-v1').then((cache) => {
      return cache.addAll(['/favicon.ico', '/base.css'])
    }),
  )
})

// 拦截网络请求
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 如果缓存中存在请求的资源，就返回缓存的资源
      if (cachedResponse) {
        return cachedResponse
      }
      // 否则，继续从网络请求资源
      return fetch(event.request)
    }),
  )
})

// 激活事件：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== 'my-cache-v1')
          .map((cacheName) => caches.delete(cacheName)),
      )
    }),
  )
})
