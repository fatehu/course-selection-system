const fs = require('fs-extra');
const path = require('path');
const { verifyToken } = require('../middleware/authMiddleware');

// 配置文件保存路径
const SETTINGS_DIR = path.join(process.cwd(), 'data/settings');
const getSettingsPath = (userId) => path.join(SETTINGS_DIR, `advisor-settings-${userId}.json`);

// 默认设置
const defaultSettings = {
  aiName: '学习辅导员',
  aiDescription: '专门帮助学生解答选课和专业学习相关的问题',
  systemPrompt: '你是一名专业的学校辅导员，专门帮助学生解答选课和专业学习相关的问题。你掌握了各专业的培养方案、课程设置和学分要求等信息。\n\n你的职责是：\n1. 帮助学生了解各专业的培养方案、课程设置和学分要求\n2. 解答学生关于选课、课程内容、学分要求等问题\n3. 提供合理的学习规划和建议\n4. 解释课程之间的关联和先修要求\n\n在回答问题时，请提供准确、全面且易于理解的解答。如果学生询问的信息不在你知识范围内，请礼貌地告知并建议他们咨询教务处或相关学院。\n\n请记住我们之前的对话内容，保持连贯性。如果学生的问题涉及到之前讨论过的内容，请基于之前的对话进行回答。',
  temperature: 0.7,
  maxTokens: 1000,
  historyLength: 10
};

// 确保设置目录存在
fs.ensureDirSync(SETTINGS_DIR);

// 获取用户的AI设置
const getSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const settingsPath = getSettingsPath(userId);
    
    // 检查是否存在用户设置文件
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      res.json({
        success: true,
        settings
      });
    } else {
      // 返回默认设置
      res.json({
        success: true,
        settings: defaultSettings
      });
    }
  } catch (error) {
    console.error('获取AI设置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '服务器内部错误'
    });
  }
};

// 保存用户的AI设置
const saveSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const settingsPath = getSettingsPath(userId);
    const newSettings = req.body;
    
    // 验证必要字段
    const requiredFields = ['systemPrompt', 'temperature', 'maxTokens'];
    for (const field of requiredFields) {
      if (newSettings[field] === undefined) {
        return res.status(400).json({
          success: false,
          error: `缺少必要字段: ${field}`
        });
      }
    }
    
    // 验证数值范围
    if (newSettings.temperature < 0 || newSettings.temperature > 1) {
      return res.status(400).json({
        success: false,
        error: '温度参数必须在0和1之间'
      });
    }
    
    if (newSettings.maxTokens < 100 || newSettings.maxTokens > 4000) {
      return res.status(400).json({
        success: false,
        error: '最大token数必须在100和4000之间'
      });
    }
    
    if (newSettings.historyLength < 1 || newSettings.historyLength > 50) {
      return res.status(400).json({
        success: false,
        error: '历史消息数量必须在1和50之间'
      });
    }
    
    // 保存设置
    await fs.writeFile(settingsPath, JSON.stringify(newSettings, null, 2));
    
    res.json({
      success: true,
      message: '设置保存成功'
    });
  } catch (error) {
    console.error('保存AI设置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '服务器内部错误'
    });
  }
};

// 重置用户的AI设置
const resetSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const settingsPath = getSettingsPath(userId);
    
    // 检查是否存在用户设置文件
    if (fs.existsSync(settingsPath)) {
      fs.unlinkSync(settingsPath);
    }
    
    res.json({
      success: true,
      message: '设置已重置为默认值',
      settings: defaultSettings
    });
  } catch (error) {
    console.error('重置AI设置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '服务器内部错误'
    });
  }
};

module.exports = {
  getSettings,
  saveSettings,
  resetSettings
};