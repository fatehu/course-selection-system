import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../store/userStore'
// 添加知识库管理路由
import KnowledgeBaseManager from '@/components/KnowledgeBaseManager.vue';
import KnowledgeBaseDetail from '@/components/KnowledgeBaseDetail.vue';
import KnowledgeBaseTest from '@/components/KnowledgeBaseTest.vue';

const routes = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../views/DashBoard.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/courses',
    name: 'CourseList',
    component: () => import('../views/CourseList.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/courses/:id',
    name: 'CourseDetail',
    component: () => import('../views/CourseDetail.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/courses/create',
    name: 'CourseCreate',
    component: () => import('../views/CourseForm.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'teacher'] },
  },
  {
    path: '/courses/:id/edit',
    name: 'CourseEdit',
    component: () => import('../views/CourseForm.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'teacher'] },
  },
  {
    path: '/sections',
    name: 'SectionList',
    component: () => import('../views/SectionList.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/sections/:id',
    name: 'SectionDetail',
    component: () => import('../views/SectionDetail.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/sections/create',
    name: 'SectionCreate',
    component: () => import('../views/SectionForm.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'teacher'] },
  },
  {
    path: '/sections/:id/edit',
    name: 'SectionEdit',
    component: () => import('../views/SectionForm.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'teacher'] },
  },
  {
    path: '/enrollment',
    name: 'StudentEnrollment',
    component: () => import('../views/StudentEnrollment.vue'),
    meta: { requiresAuth: true, roles: ['student'] },
  },
  {
    path: '/enrollments',
    name: 'EnrollmentList',
    component: () => import('../views/EnrollmentList.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'teacher'] },
  },
  {
    path: '/enrollments/:id',
    name: 'EnrollmentDetail',
    component: () => import('../views/EnrollmentDetail.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/users',
    name: 'UserList',
    component: () => import('../views/UserList.vue'),
    meta: { requiresAuth: true, roles: ['admin'] },
  },
  {
    path: '/users/create',
    name: 'UserCreate',
    component: () => import('../views/UserForm.vue'),
    meta: { requiresAuth: true, roles: ['admin'] },
  },
  {
    path: '/users/:id/edit',
    name: 'UserEdit',
    component: () => import('../views/UserForm.vue'),
    meta: { requiresAuth: true, roles: ['admin'] },
  },
  // 个人信息页路由
  {
    path: '/profile',
    name: 'UserProfile',
    component: () => import('../views/userProfile.vue'),
    meta: { requiresAuth: true },
  },
  // 公告页面
  {
    path: '/announcement',
    name: 'Announcement',
    component: () => import('@/views/AnnouncementList.vue'),
    meta: { requiresAuth: true },
  },
  // 公告发布页面
  {
    path: '/announcement/create',
    name: 'AnnouncementCreate',
    component: () => import('@/views/AnnouncementForm.vue'),
    meta: { requiresAuth: true },
  },
  // 公告编辑页面
  {
    path: '/announcement/:id/edit',
    name: 'announcementEdit',
    component: () => import('@/views/AnnouncementForm.vue'),
    meta: { requiresAuth: true },
  },
  // 公告详情页面
  {
    path: '/announcement/:id',
    name: 'announcementDetail',
    component: () => import('@/views/AnnouncementDetail.vue'),
    meta: { requiresAuth: true },
  },
  // 新增AI辅导员路由
  {
    path: '/advisor',
    name: 'Advisor',
    component: () => import('@/views/AdvisorPage.vue'),
    meta: { requiresAuth: true },
  },
    {
    path: '/knowledge-base',
    name: 'KnowledgeBaseManager',
    component: KnowledgeBaseManager,
    meta: { requiresAuth: true }
  },
  {
    path: '/knowledge-base/:id',
    name: 'KnowledgeBaseDetail',
    component: KnowledgeBaseDetail,
    props: true,
    meta: { requiresAuth: true }
  },
  {
    path: '/knowledge-base/:id/test',
    name: 'KnowledgeBaseTest',
    component: KnowledgeBaseTest,
    props: true,
    meta: { requiresAuth: true }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFound.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 全局前置守卫
router.beforeEach((to, from, next) => {
  // 初始化用户存储
  const userStore = useUserStore()

  // 检查当前身份验证状态
  const isAuthenticated = userStore.isAuthenticated

  // 检查是否需要身份验证
  const requiresAuth = to.meta.requiresAuth !== false // 默认为true

  // 判断是否为登录页
  const isLoginPage = to.path === '/login'

  // 如果是登录页且已登录，重定向到首页
  if (isLoginPage && isAuthenticated) {
    next({ name: 'Dashboard' })
    return
  }

  // 如果需要登录但未登录，重定向到登录页
  if (requiresAuth && !isAuthenticated) {
    next({
      name: 'Login',
      query: { redirect: to.fullPath },
    })
    return
  }

  // 检查角色权限
  const requiredRoles = to.meta.roles
  const userRole = userStore.userRole

  if (requiredRoles && isAuthenticated) {
    if (!requiredRoles.includes(userRole)) {
      // 如果用户没有所需角色的权限，重定向到首页
      next({ name: 'Dashboard' })
      return
    }
  }

  // 继续导航
  next()
})

export default router
