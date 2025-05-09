CREATE TABLE announcements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  publisher_id INT NOT NULL,
  publish_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_published TINYINT(1) DEFAULT 1,
  category ENUM('general', 'course', 'exam', 'system') DEFAULT 'general',
  FOREIGN KEY (publisher_id) REFERENCES users(id)
);`course_selection_system`

-- 插入系统公告示例数据
INSERT INTO announcements (title, content, publisher_id, publish_time, is_published, category) VALUES
('系统升级通知', '本系统将于2025年1月15日23:00至次日5:00进行维护升级，期间暂停服务，请各位师生提前安排好相关操作。', 1, '2025-01-10 10:00:00', 1, 'system'),
('2025春季学期选课通知', '2025春季学期选课将于2025年2月1日开始，至2月15日结束，请各位同学在规定时间内完成选课。', 1, '2025-01-20 15:30:00', 1, 'general'),
('计算机学院课程调整通知', '因教师安排调整，CS201课程（数据结构）上课时间由周三10:00-11:40调整为周四14:00-15:40，上课地点不变。', 2, '2025-01-25 09:15:00', 1, 'course'),
('2024秋季学期期末考试安排', '2024秋季学期期末考试将于2025年1月20日至1月30日进行，请各位同学做好复习准备。', 1, '2025-01-05 16:45:00', 1, 'exam'),
('图书馆延长开放时间通知', '为满足同学们备考需求，图书馆将于2025年1月15日至1月30日延长开放时间至23:00。', 1, '2025-01-12 11:20:00', 1, 'general');