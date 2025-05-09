// server/routes/advisor.js
const express = require('express');
const router = express.Router();
const { askQuestion } = require('../controllers/advisorController');

// AI辅导员问答接口
router.post('/ask', askQuestion);

module.exports = router;