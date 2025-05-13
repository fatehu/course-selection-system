`course_selection_system`CREATE TABLE announcements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  publisher_id INT NOT NULL,
  publish_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_published TINYINT(1) DEFAULT 1,
  category ENUM('general', 'course', 'exam', 'system') DEFAULT 'general',
  FOREIGN KEY (publisher_id) REFERENCES users(id)
);`course_selection_system`

ALTER TABLE reviews CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT * FROM announcements WHERE id = 1;

ALTER TABLE announcements ADD COLUMN is_locked TINYINT(1) DEFAULT 0;

-- 插入系统公告示例数据
`course_selection_system`

-- 插入系统公告（管理员发布）
INSERT INTO announcements (title, content, publisher_id, publish_time, is_published, category)
VALUES 
('系统维护通知', '系统将于2023-10-01 00:00至06:00进行维护升级，期间暂停服务。', 1, '2023-09-28 09:00:00', 1, 'system'),
('隐私政策更新', '我们更新了隐私政策，请所有用户务必查阅最新条款。', 1, '2023-09-25 14:30:00', 1, 'system');

-- 插入课程相关公告（教师发布）
INSERT INTO announcements (title, content, publisher_id, publish_time, is_published, category)
VALUES 
('《数据结构》课程调整', '原定于10月5日的课程调整为线上授课，腾讯会议号：123-456-789。', 2, '2023-09-30 10:15:00', 1, 'course'),
('《算法设计》作业提交', '第三章作业提交截止时间延长至10月10日23:59。', 2, '2023-09-27 16:20:00', 1, 'course'),
('《数据库原理》实验课取消', '10月8日的实验课因故取消，具体补课时间另行通知。', 3, '2023-09-29 11:00:00', 0, 'course'); -- 未发布

-- 插入考试安排公告
INSERT INTO announcements (title, content, publisher_id, publish_time, is_published, category)
VALUES 
('期中考试时间安排', '期中考试将于10月15日-10月17日进行，具体考场见附件。', 1, '2023-09-20 08:00:00', 1, 'exam'),
('《英语》期末考试通知', '期末考试时间为12月20日上午9:00-11:00，请携带学生证。', 4, '2023-09-22 15:00:00', 1, 'exam');

-- 插入普通通知（通用）
INSERT INTO announcements (title, content, publisher_id, publish_time, is_published, category)
VALUES 
('校园运动会报名', '秋季运动会将于10月25日举行，报名截止10月10日。', 5, '2023-09-15 13:00:00', 1, 'general'),
('图书馆开放时间调整', '国庆期间图书馆开放时间调整为9:00-17:00。', 1, '2023-09-26 17:00:00', 1, 'general'),
('学生社团招新', '本周五下午社团广场招新，欢迎参与！', 6, '2023-09-18 12:00:00', 0, 'general'); -- 未发布

INSERT INTO reviews (course_id, user_id, content) VALUES (1, 3, '这门课程很不错！');





-- 创建评价表
CREATE TABLE reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);