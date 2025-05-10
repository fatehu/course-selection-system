<template>
  <div class="course-list-container">
    <el-card class="course-list-card">
      <template #header>
        <div class="card-header">
          <span>课程列表</span>
          <div class="header-actions">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索课程"
              clearable
              class="search-input"
              @input="handleSearch"
            >
              <template #prefix>
                <el-icon><search /></el-icon>
              </template>
            </el-input>

            <el-button v-if="isAdmin || isTeacher" type="primary" @click="createCourse">
              新增课程
            </el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="20" class="filter-row">
        <el-col :span="24">
          <el-select
            v-model="selectedDepartment"
            placeholder="选择学院"
            clearable
            @change="filterByDepartment"
            class="department-filter"
            :loading="departmentStore.loading"
          >
            <el-option
              v-for="dept in departments"
              :key="dept.id"
              :label="dept.name"
              :value="dept.id"
            />
          </el-select>
        </el-col>
      </el-row>

      <div v-if="loading" class="loading-placeholder">
        <el-skeleton :rows="5" animated />
      </div>

      <div v-else-if="filteredCourses.length === 0" class="empty-placeholder">暂无课程数据</div>

      <el-table v-else :data="filteredCourses" style="width: 100%" :empty-text="'暂无课程数据'">
        <el-table-column prop="code" label="课程代码" width="120" />
        <el-table-column prop="name" label="课程名称" />
        <el-table-column prop="department_name" label="所属学院" width="180" />
        <el-table-column prop="credits" label="学分" width="80" />
        <el-table-column label="操作" width="220">
          <template #default="scope">
            <el-button link type="primary" @click="viewCourse(scope.row.id)"> 查看 </el-button>

            <el-button
              v-if="isAdmin || isTeacher"
              link
              type="primary"
              @click="editCourse(scope.row.id)"
            >
              编辑
            </el-button>

            <el-popconfirm
              v-if="isAdmin"
              title="确定删除此课程吗？"
              @confirm="deleteCourse(scope.row.id)"
              confirm-button-text="确定"
              cancel-button-text="取消"
            >
              <template #reference>
                <el-button link type="danger">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="totalCourses"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { useCourseStore } from '../store/courseStore'
import { useDepartmentStore } from '../store/departmentStore'
import { useUserStore } from '../store/userStore'

export default {
  name: 'CourseListView',
  components: {
    Search,
  },
  setup() {
    const router = useRouter()
    const courseStore = useCourseStore()
    const departmentStore = useDepartmentStore()
    const userStore = useUserStore()

    const loading = ref(true)
    const searchKeyword = ref('')
    const selectedDepartment = ref('')
    const currentPage = ref(1)
    const pageSize = ref(10)

    // 从store获取部门列表
    const departments = computed(() => departmentStore.departments)

    // 用户角色
    const isAdmin = computed(() => userStore.isAdmin)
    const isTeacher = computed(() => userStore.isTeacher)

    // 处理过的课程列表
    const filteredCourses = computed(() => {
      let courses = courseStore.courses

      // 根据关键词搜索
      if (searchKeyword.value) {
        const keyword = searchKeyword.value.toLowerCase()
        courses = courses.filter((course) => {
          return (
            course.code.toLowerCase().includes(keyword) ||
            course.name.toLowerCase().includes(keyword) ||
            (course.description && course.description.toLowerCase().includes(keyword))
          )
        })
      }

      // 根据学院筛选
      if (selectedDepartment.value) {
        courses = courses.filter((course) => {
          return course.department_id === parseInt(selectedDepartment.value)
        })
      }

      // 分页
      return courses.slice(
        (currentPage.value - 1) * pageSize.value,
        currentPage.value * pageSize.value,
      )
    })

    // 总课程数
    const totalCourses = computed(() => {
      let courses = courseStore.courses

      // 根据关键词搜索
      if (searchKeyword.value) {
        const keyword = searchKeyword.value.toLowerCase()
        courses = courses.filter((course) => {
          return (
            course.code.toLowerCase().includes(keyword) ||
            course.name.toLowerCase().includes(keyword) ||
            (course.description && course.description.toLowerCase().includes(keyword))
          )
        })
      }

      // 根据学院筛选
      if (selectedDepartment.value) {
        courses = courses.filter((course) => {
          return course.department_id === parseInt(selectedDepartment.value)
        })
      }

      return courses.length
    })

    // 加载课程和部门数据
    const loadData = async () => {
      loading.value = true

      try {
        await Promise.all([courseStore.fetchAllCourses(), departmentStore.fetchAllDepartments()])
      } catch (error) {
        console.error('加载数据失败', error)
        ElMessage.error('加载数据失败')
      } finally {
        loading.value = false
      }
    }

    // 根据学院筛选
    const filterByDepartment = async (departmentId) => {
      currentPage.value = 1

      if (departmentId) {
        loading.value = true

        try {
          await courseStore.fetchCoursesByDepartment(departmentId)
        } catch (error) {
          console.error('获取学院课程失败', error)
          ElMessage.error('获取学院课程失败')
        } finally {
          loading.value = false
        }
      } else {
        // 如果清除了学院筛选，重新获取所有课程
        await courseStore.fetchAllCourses()
      }
    }

    // 搜索处理
    const handleSearch = () => {
      currentPage.value = 1
    }

    // 查看课程详情
    const viewCourse = (id) => {
      router.push(`/courses/${id}`)
    }

    // 创建新课程
    const createCourse = () => {
      router.push('/courses/create')
    }

    // 编辑课程
    const editCourse = (id) => {
      router.push(`/courses/${id}/edit`)
    }

    // 删除课程
    const deleteCourse = async (id) => {
      try {
        const response = await courseStore.deleteCourse(id)

        if (response.success) {
          ElMessage.success('课程删除成功')
        }
      } catch (error) {
        console.error('删除课程失败', error)
        ElMessage.error(error.message || '删除课程失败')
      }
    }

    // 分页大小改变
    const handleSizeChange = (val) => {
      pageSize.value = val
      currentPage.value = 1
    }

    // 当前页改变
    const handleCurrentChange = (val) => {
      currentPage.value = val
    }

    onMounted(() => {
      loadData()
    })

    return {
      loading,
      departments,
      departmentStore,
      searchKeyword,
      selectedDepartment,
      currentPage,
      pageSize,
      filteredCourses,
      totalCourses,
      isAdmin,
      isTeacher,
      handleSearch,
      filterByDepartment,
      viewCourse,
      createCourse,
      editCourse,
      deleteCourse,
      handleSizeChange,
      handleCurrentChange,
    }
  },
}
</script>

<style scoped>
.course-list-container {
  padding: 20px;
}

.course-list-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.search-input {
  width: 250px;
}

.filter-row {
  margin-bottom: 20px;
}

.department-filter {
  width: 220px;
}

.loading-placeholder,
.empty-placeholder {
  padding: 20px 0;
  text-align: center;
  color: #909399;
}

.pagination-container {
  margin-top: 20px;
  text-align: right;
}
</style>
