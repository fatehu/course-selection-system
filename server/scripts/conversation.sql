-- 会话表
CREATE TABLE `conversations` (
  `id` VARCHAR(50) NOT NULL,
  `user_id` INT NOT NULL,
  `title` VARCHAR(255) DEFAULT '新对话',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_user_id` (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 会话消息表
CREATE TABLE `conversation_messages` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `conversation_id` VARCHAR(50) NOT NULL,
  `role` ENUM('user', 'assistant') NOT NULL,
  `content` TEXT NOT NULL,
  `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_conversation_id` (`conversation_id`),
  FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;