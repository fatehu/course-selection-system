const express = require('express');
const router = express.Router();
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

// 部门控制器
const departmentController = {
  // 获取所有部门
  getAllDepartments: async (req, res) => {
    try {
      const [rows] = await req.app.locals.pool.query('SELECT * FROM departments');
      
      res.status(200).json({
        success: true,
        count: rows.length,
        data: rows
      });
    } catch (error) {
      console.error('获取部门列表失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      });
    }
  },
  
  // 获取单个部门
  getDepartment: async (req, res) => {
    try {
      const [rows] = await req.app.locals.pool.query(
        'SELECT * FROM departments WHERE id = ?', 
        [req.params.id]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: '部门不存在'
        });
      }
      
      res.status(200).json({
        success: true,
        data: rows[0]
      });
    } catch (error) {
      console.error('获取部门失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      });
    }
  },
  
  // 创建部门
  createDepartment: async (req, res) => {
    try {
      const { name, description } = req.body;
      
      // 检查部门名是否已存在
      const [existingDept] = await req.app.locals.pool.query(
        'SELECT * FROM departments WHERE name = ?',
        [name]
      );
      
      if (existingDept.length > 0) {
        return res.status(400).json({
          success: false,
          message: '部门名称已存在'
        });
      }
      
      const [result] = await req.app.locals.pool.query(
        'INSERT INTO departments (name, description) VALUES (?, ?)',
        [name, description]
      );
      
      res.status(201).json({
        success: true,
        message: '部门创建成功',
        data: {
          id: result.insertId,
          name,
          description
        }
      });
    } catch (error) {
      console.error('创建部门失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      });
    }
  },
  
  // 更新部门
  updateDepartment: async (req, res) => {
    try {
      const { name, description } = req.body;
      const departmentId = req.params.id;
      
      // 检查部门是否存在
      const [existingDept] = await req.app.locals.pool.query(
        'SELECT * FROM departments WHERE id = ?',
        [departmentId]
      );
      
      if (existingDept.length === 0) {
        return res.status(404).json({
          success: false,
          message: '部门不存在'
        });
      }
      
      // 检查更新的名称是否与其他部门重复
      if (name && name !== existingDept[0].name) {
        const [nameCheck] = await req.app.locals.pool.query(
          'SELECT * FROM departments WHERE name = ? AND id != ?',
          [name, departmentId]
        );
        
        if (nameCheck.length > 0) {
          return res.status(400).json({
            success: false,
            message: '部门名称已存在'
          });
        }
      }
      
      await req.app.locals.pool.query(
        'UPDATE departments SET name = ?, description = ? WHERE id = ?',
        [
          name || existingDept[0].name,
          description !== undefined ? description : existingDept[0].description,
          departmentId
        ]
      );
      
      res.status(200).json({
        success: true,
        message: '部门更新成功'
      });
    } catch (error) {
      console.error('更新部门失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      });
    }
  },
  
  // 删除部门
  deleteDepartment: async (req, res) => {
    try {
      const departmentId = req.params.id;
      
      // 检查部门是否存在
      const [existingDept] = await req.app.locals.pool.query(
        'SELECT * FROM departments WHERE id = ?',
        [departmentId]
      );
      
      if (existingDept.length === 0) {
        return res.status(404).json({
          success: false,
          message: '部门不存在'
        });
      }
      
      // 检查是否有关联的课程
      const [relatedCourses] = await req.app.locals.pool.query(
        'SELECT COUNT(*) as count FROM courses WHERE department_id = ?',
        [departmentId]
      );
      
      if (relatedCourses[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: '无法删除部门，存在关联的课程'
        });
      }
      
      await req.app.locals.pool.query(
        'DELETE FROM departments WHERE id = ?',
        [departmentId]
      );
      
      res.status(200).json({
        success: true,
        message: '部门删除成功'
      });
    } catch (error) {
      console.error('删除部门失败:', error);
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      });
    }
  }
};

// 所有路由都需要验证token
router.use(verifyToken);

// 获取所有部门
router.get('/', departmentController.getAllDepartments);

// 获取单个部门
router.get('/:id', departmentController.getDepartment);

// 创建部门（仅限管理员）
router.post('/', checkRole(['admin']), departmentController.createDepartment);

// 更新部门（仅限管理员）
router.put('/:id', checkRole(['admin']), departmentController.updateDepartment);

// 删除部门（仅限管理员）
router.delete('/:id', checkRole(['admin']), departmentController.deleteDepartment);

module.exports = router;