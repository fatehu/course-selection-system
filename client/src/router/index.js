import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../store/userStore'

// 页面组件
import Login from '../views/Login.vue'
import Dashboard from '../views/DashBoard.vue'
import CourseList from '../views/CourseList.vue'
import CourseDetail from '../views/CourseDetail.vue'
import CourseForm from '../views/CourseForm.vue'
import SectionList from '../views/SectionList.vue'
import SectionDetail from '../views/SectionDetail.vue'
import SectionForm from '../views/SectionForm.vue'
import StudentEnrollment from '../views/StudentEnrollment.vue'
import EnrollmentList from '../views/EnrollmentList.vue'
import EnrollmentDetail from '../views/EnrollmentDetail.vue'
import UserList from '../views/UserList.vue'
import UserForm from '../views/UserForm.vue'
import UserProfile from '../views/userProfile.vue'
import NotFound from '../views/NotFound.vue'
import AnnouncementList from '@/views/AnnouncementList.vue'

const routes = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresAuth: false },
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true },
  },
  {
    path: '/courses',
    name: 'CourseList',
    component: CourseList,
    meta: { requiresAuth: true },
  },
  {
    path: '/courses/:id',
    name: 'CourseDetail',
    component: CourseDetail,
    meta: { requiresAuth: true },
  },
  {
    path: '/courses/create',
    name: 'CourseCreate',
    component: CourseForm,
    meta: { requiresAuth: true, roles: ['admin', 'teacher'] },
  },
  {
    path: '/courses/:id/edit',
    name: 'CourseEdit',
    component: CourseForm,
    meta: { requiresAuth: true, roles: ['admin', 'teacher'] },
  },
  {
    path: '/sections',
    name: 'SectionList',
    component: SectionList,
    meta: { requiresAuth: true },
  },
  {
    path: '/sections/:id',
    name: 'SectionDetail',
    component: SectionDetail,
    meta: { requiresAuth: true },
  },
  {
    path: '/sections/create',
    name: 'SectionCreate',
    component: SectionForm,
    meta: { requiresAuth: true, roles: ['admin', 'teacher'] },
  },
  {
    path: '/sections/:id/edit',
    name: 'SectionEdit',
    component: SectionForm,
    meta: { requiresAuth: true, roles: ['admin', 'teacher'] },
  },
  {
    path: '/enrollment',
    name: 'StudentEnrollment',
    component: StudentEnrollment,
    meta: { requiresAuth: true, roles: ['student'] },
  },
  {
    path: '/enrollments',
    name: 'EnrollmentList',
    component: EnrollmentList,
    meta: { requiresAuth: true, roles: ['admin', 'teacher'] },
  },
  {
    path: '/enrollments/:id',
    name: 'EnrollmentDetail',
    component: EnrollmentDetail,
    meta: { requiresAuth: true },
  },
  {
    path: '/users',
    name: 'UserList',
    component: UserList,
    meta: { requiresAuth: true, roles: ['admin'] },
  },
  {
    path: '/users/create',
    name: 'UserCreate',
    component: UserForm,
    meta: { requiresAuth: true, roles: ['admin'] },
  },
  {
    path: '/users/:id/edit',
    name: 'UserEdit',
    component: UserForm,
    meta: { requiresAuth: true, roles: ['admin'] },
  },
  // 个人信息页路由
  {
    path: '/profile',
    name: 'UserProfile',
    component: UserProfile,
    meta: { requiresAuth: true },
  },
  // 公告发布页面
  {
    path: '/announcement',
    name: 'Announcement',
    component: AnnouncementList,
    meta: { requiresAuth: true },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: NotFound,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 全局前置守卫 - 修复版本
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
