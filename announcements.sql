CREATE TABLE announcements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  publisher_id INT NOT NULL,
  publish_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_published TINYINT(1) DEFAULT 1,
  category ENUM('general', 'course', 'exam', 'system') DEFAULT 'general',
  FOREIGN KEY (publisher_id) REFERENCES users(id)
);