<template>
  <div class="announcement-list-container">
    <el-card class="announcement-list-card">
      <template #header>
        <div class="card-header">
          <span>公告管理</span>
          <div class="header-actions">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索公告"
              clearable
              class="search-input"
            />
            <el-button v-if="userRole === 'admin'" type="primary" @click="openCreateModal">
              <i class="fa fa-plus mr-2"></i> 发布公告
            </el-button>
          </div>
        </div>
      </template>

      <el-table :data="announcements" style="width: 100%">
        <el-table-column prop="title" label="标题" />
        <el-table-column prop="category" label="分类" :formatter="formatCategory" />
        <el-table-column prop="publisher_name" label="发布者" />
        <el-table-column prop="publish_time" label="发布时间" :formatter="formatDateTime" />
        <el-table-column label="状态">
          <template #default="{ row }">
            <el-tag :type="row.is_published ? 'success' : 'info'">
              {{ row.is_published ? '已发布' : '草稿' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewAnnouncement(row.id)">
              <i class="fa fa-eye"></i>
            </el-button>
            <el-button
              v-if="userRole === 'admin'"
              link
              type="warning"
              @click="editAnnouncement(row.id)"
            >
              <i class="fa fa-edit"></i>
            </el-button>
            <el-popconfirm
              v-if="userRole === 'admin'"
              title="确定删除此公告吗？"
              @confirm="confirmDelete(row.id)"
            >
              <template #reference>
                <el-button link type="danger">
                  <i class="fa fa-trash"></i>
                </el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          :total="announcements.length"
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.announcement-list-container {
  padding: 20px;
}

.announcement-list-card {
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

.pagination-container {
  margin-top: 20px;
  text-align: right;
}
</style>
