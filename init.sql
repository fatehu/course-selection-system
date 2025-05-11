-- 创建数据库
CREATE DATABASE course_selection_system;
USE course_selection_system;

-- 用户表（学生、教师、管理员）
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    role ENUM('student', 'teacher', 'admin') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 学院表
CREATE TABLE departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

-- 课程表
CREATE TABLE courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    credits INT NOT NULL,
    department_id INT,
    FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- 课程安排表（具体上课时间、地点）
CREATE TABLE sections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    teacher_id INT NOT NULL,
    semester VARCHAR(20) NOT NULL,
    time_slot VARCHAR(100) NOT NULL,
    location VARCHAR(100) NOT NULL,
    capacity INT NOT NULL,
    current_enrollment INT DEFAULT 0,
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (teacher_id) REFERENCES users(id)
);

-- 选课记录表
CREATE TABLE enrollments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    section_id INT NOT NULL,
    status ENUM('enrolled', 'dropped', 'waitlisted') DEFAULT 'enrolled',
    enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (section_id) REFERENCES sections(id),
    UNIQUE KEY (student_id, section_id)
);

INSERT INTO departments (name, description) VALUES 
('物理学院', '物理学院提供理论物理、应用物理等专业教育'),
('化学学院', '化学学院专注于无机化学、有机化学、分析化学等领域研究'),
('生物学院', '生物学院涵盖分子生物学、生态学、遗传学等专业方向'),
('工程学院', '工程学院设有机械工程、电气工程、土木工程等专业'),
('工商管理学院', '工商管理学院提供企业管理、市场营销、财务管理等专业课程'),
('外国语学院', '外国语学院设有英语、日语、法语、西班牙语等多个语种专业'),
('文学院', '文学院以中国文学、比较文学、语言学等为主要研究方向'),
('历史学院', '历史学院专注于中国史、世界史、考古学等专业研究'),
('艺术学院', '艺术学院设有绘画、雕塑、设计等专业'),
('音乐学院', '音乐学院提供器乐演奏、声乐、作曲与指挥等专业培养');

INSERT INTO users (username, password, name, email, role) VALUES
('admin', '$2b$10$S.p3Z3FUjJ9mFPdGIEIxA..wEXAKoSOLamkE3HcmnASIrTXqZj0z2', '管理员', 'admin@university.edu', 'admin'),
('teacher1', '$2b$10$S.p3Z3FUjJ9mFPdGIEIxA..wEXAKoSOLamkE3HcmnASIrTXqZj0z2', '张教授', 'zhang@university.edu', 'teacher'),
('student1', '$2b$10$S.p3Z3FUjJ9mFPdGIEIxA..wEXAKoSOLamkE3HcmnASIrTXqZj0z2', '李同学', 'li@university.edu', 'student');

INSERT INTO courses (code, name, description, credits, department_id) VALUES
('CS101', '计算机科学导论', '本课程介绍计算机科学的基本概念和原理', 3, 1),
('CS201', '数据结构', '本课程介绍常见数据结构和算法', 4, 1),
('MATH101', '高等数学', '本课程介绍微积分和线性代数的基础知识', 4, 2);

INSERT INTO sections (course_id, teacher_id, semester, time_slot, location, capacity) VALUES
(1, 2, '2025春季', '周一 08:00-09:40', '主楼301', 50),
(2, 2, '2025春季', '周三 10:00-11:40', '主楼302', 40),
(3, 2, '2025春季', '周五 14:00-15:40', '理科楼101', 60);

INSERT INTO users (username, PASSWORD, NAME, email, ROLE) VALUES
('admin1', '$2b$10$S.p3Z3FUjJ9mFPdGIEIxA..wEXAKoSOLamkE3HcmnASIrTXqZj0z2', '管理员', 'admin@university.edu', 'admin');