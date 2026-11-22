-- ============================================================================
-- JUSOOR (جسور) — MySQL 8.0+ Reference DDL Schema (53 Normalized Tables)
-- ============================================================================
-- Note: The live AI Studio runtime uses Cloud SQL (PostgreSQL) with Drizzle ORM
-- (`src/db/schema.ts`), because Cloud SQL in this environment provisions
-- PostgreSQL. This file provides 1:1 relational DDL parity for teams deploying
-- JUSOOR to an external MySQL 8.0+ / MariaDB 10.6+ server.
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NULL,
  firebase_uid VARCHAR(128) NULL UNIQUE,
  full_name VARCHAR(200) NOT NULL,
  avatar_url TEXT NULL,
  phone VARCHAR(40) NULL,
  locale VARCHAR(8) NOT NULL DEFAULT 'ar',
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  account_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  reset_token_hash TEXT NULL,
  reset_token_expires_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roles (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name_ar VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  description TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_roles (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY user_roles_user_role_uq (user_id, role_id),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions_auth (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_auth_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_resets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  used_at DATETIME NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS educational_stages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(60) NOT NULL UNIQUE,
  name_ar VARCHAR(120) NOT NULL,
  name_en VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fields (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(80) NOT NULL UNIQUE,
  name_ar VARCHAR(120) NOT NULL,
  name_en VARCHAR(120) NOT NULL,
  description_ar TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subjects (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  field_id BIGINT NOT NULL,
  name_ar VARCHAR(120) NOT NULL,
  name_en VARCHAR(120) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_subjects_field FOREIGN KEY (field_id) REFERENCES fields(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS skills (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(80) NOT NULL UNIQUE,
  name_ar VARCHAR(120) NOT NULL,
  name_en VARCHAR(120) NOT NULL,
  field_id BIGINT NULL,
  CONSTRAINT fk_skills_field FOREIGN KEY (field_id) REFERENCES fields(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_categories (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(60) NOT NULL UNIQUE,
  name_ar VARCHAR(140) NOT NULL,
  name_en VARCHAR(140) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS student_profiles (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE,
  stage_id BIGINT NULL,
  learning_goal TEXT NULL,
  career_interest VARCHAR(200) NULL,
  bio TEXT NULL,
  CONSTRAINT fk_student_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_student_profiles_stage FOREIGN KEY (stage_id) REFERENCES educational_stages(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS provider_profiles (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE,
  provider_type VARCHAR(40) NOT NULL,
  headline VARCHAR(240) NOT NULL,
  bio TEXT NOT NULL,
  qualifications TEXT NULL,
  years_experience INT NOT NULL DEFAULT 1,
  hourly_rate DECIMAL(10, 2) NOT NULL DEFAULT 25.00,
  currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  verification_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  rating_avg DECIMAL(3, 2) NOT NULL DEFAULT 5.00,
  reviews_count INT NOT NULL DEFAULT 0,
  is_accepting_tasks BOOLEAN NOT NULL DEFAULT TRUE,
  is_accepting_bookings BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_provider_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS provider_fields (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  provider_user_id BIGINT NOT NULL,
  field_id BIGINT NOT NULL,
  UNIQUE KEY provider_fields_uq (provider_user_id, field_id),
  CONSTRAINT fk_pf_user FOREIGN KEY (provider_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_pf_field FOREIGN KEY (field_id) REFERENCES fields(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS provider_stages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  provider_user_id BIGINT NOT NULL,
  stage_id BIGINT NOT NULL,
  UNIQUE KEY provider_stages_uq (provider_user_id, stage_id),
  CONSTRAINT fk_ps_user FOREIGN KEY (provider_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ps_stage FOREIGN KEY (stage_id) REFERENCES educational_stages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS centers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  owner_user_id BIGINT NOT NULL,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  city VARCHAR(120) NOT NULL,
  country VARCHAR(120) NOT NULL,
  website VARCHAR(255) NULL,
  logo_url TEXT NULL,
  verification_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_centers_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS center_staff (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  center_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  title VARCHAR(140) NOT NULL,
  job_title VARCHAR(160) NOT NULL DEFAULT '',
  can_manage_courses BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_instructors BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_enrollments BOOLEAN NOT NULL DEFAULT TRUE,
  can_view_finance BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY center_staff_uq (center_id, user_id),
  CONSTRAINT fk_cs_center FOREIGN KEY (center_id) REFERENCES centers(id) ON DELETE CASCADE,
  CONSTRAINT fk_cs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS center_instructors (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  center_id BIGINT NOT NULL,
  instructor_user_id BIGINT NOT NULL,
  specialty VARCHAR(200) NOT NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY center_instructors_uq (center_id, instructor_user_id),
  CONSTRAINT fk_ci_center FOREIGN KEY (center_id) REFERENCES centers(id) ON DELETE CASCADE,
  CONSTRAINT fk_ci_user FOREIGN KEY (instructor_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS courses (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  instructor_user_id BIGINT NOT NULL,
  center_id BIGINT NULL,
  field_id BIGINT NOT NULL,
  stage_id BIGINT NULL,
  subject_id BIGINT NULL,
  title VARCHAR(240) NOT NULL,
  slug VARCHAR(160) NOT NULL UNIQUE,
  subtitle VARCHAR(320) NOT NULL,
  description TEXT NOT NULL,
  level VARCHAR(32) NOT NULL DEFAULT 'BEGINNER',
  language VARCHAR(16) NOT NULL DEFAULT 'ar',
  price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  thumbnail_url TEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED',
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_courses_instructor FOREIGN KEY (instructor_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_courses_center FOREIGN KEY (center_id) REFERENCES centers(id) ON DELETE SET NULL,
  CONSTRAINT fk_courses_field FOREIGN KEY (field_id) REFERENCES fields(id) ON DELETE RESTRICT,
  CONSTRAINT fk_courses_stage FOREIGN KEY (stage_id) REFERENCES educational_stages(id) ON DELETE SET NULL,
  CONSTRAINT fk_courses_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_sections (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  course_id BIGINT NOT NULL,
  title VARCHAR(200) NOT NULL,
  sort_order INT NOT NULL DEFAULT 1,
  CONSTRAINT fk_course_sections_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_lessons (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  course_id BIGINT NOT NULL,
  section_id BIGINT NULL,
  title VARCHAR(240) NOT NULL,
  content TEXT NOT NULL,
  video_url TEXT NULL,
  duration_minutes INT NOT NULL DEFAULT 20,
  sort_order INT NOT NULL DEFAULT 1,
  is_free_preview BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_cl_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_cl_section FOREIGN KEY (section_id) REFERENCES course_sections(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_skills (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  course_id BIGINT NOT NULL,
  skill_id BIGINT NOT NULL,
  UNIQUE KEY course_skills_uq (course_id, skill_id),
  CONSTRAINT fk_csk_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_csk_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS enrollments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  course_id BIGINT NOT NULL,
  student_user_id BIGINT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  enrolled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  UNIQUE KEY enrollments_course_student_uq (course_id, student_user_id),
  CONSTRAINT fk_enr_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_enr_student FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS progress (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  enrollment_id BIGINT NOT NULL UNIQUE,
  completed_lessons_count INT NOT NULL DEFAULT 0,
  total_lessons_count INT NOT NULL DEFAULT 0,
  completion_percent INT NOT NULL DEFAULT 0,
  last_accessed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_progress_enr FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lesson_progress (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  enrollment_id BIGINT NOT NULL,
  lesson_id BIGINT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at DATETIME NULL,
  UNIQUE KEY lesson_progress_uq (enrollment_id, lesson_id),
  CONSTRAINT fk_lp_enr FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  CONSTRAINT fk_lp_lesson FOREIGN KEY (lesson_id) REFERENCES course_lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quizzes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  course_id BIGINT NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  passing_score INT NOT NULL DEFAULT 60,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_quizzes_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS questions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  quiz_id BIGINT NOT NULL,
  question_text TEXT NOT NULL,
  question_type VARCHAR(32) NOT NULL DEFAULT 'MCQ',
  points INT NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 1,
  CONSTRAINT fk_questions_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quiz_answers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  question_id BIGINT NOT NULL,
  answer_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_qa_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  quiz_id BIGINT NOT NULL,
  student_user_id BIGINT NOT NULL,
  score INT NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_qat_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  CONSTRAINT fk_qat_student FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quiz_attempt_answers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  attempt_id BIGINT NOT NULL,
  question_id BIGINT NOT NULL,
  selected_answer_id BIGINT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_qaa_attempt FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  CONSTRAINT fk_qaa_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  CONSTRAINT fk_qaa_selected FOREIGN KEY (selected_answer_id) REFERENCES quiz_answers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assignments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  course_id BIGINT NOT NULL,
  title VARCHAR(200) NOT NULL,
  instructions TEXT NOT NULL,
  max_score INT NOT NULL DEFAULT 100,
  due_date VARCHAR(40) NULL,
  CONSTRAINT fk_assignments_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  assignment_id BIGINT NOT NULL,
  student_user_id BIGINT NOT NULL,
  submission_text TEXT NOT NULL,
  attachment_url TEXT NULL,
  score INT NULL,
  feedback TEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED',
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_as_assignment FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  CONSTRAINT fk_as_student FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS educational_tasks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  student_user_id BIGINT NOT NULL,
  category_id BIGINT NOT NULL,
  field_id BIGINT NOT NULL,
  subject_id BIGINT NULL,
  stage_id BIGINT NULL,
  title VARCHAR(240) NOT NULL,
  description TEXT NOT NULL,
  required_skills VARCHAR(400) NOT NULL DEFAULT '',
  budget DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  expected_duration VARCHAR(120) NOT NULL,
  preferred_method VARCHAR(32) NOT NULL DEFAULT 'ONLINE',
  deadline VARCHAR(40) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  accepted_offer_id BIGINT NULL,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tasks_student FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_tasks_category FOREIGN KEY (category_id) REFERENCES task_categories(id) ON DELETE RESTRICT,
  CONSTRAINT fk_tasks_field FOREIGN KEY (field_id) REFERENCES fields(id) ON DELETE RESTRICT,
  CONSTRAINT fk_tasks_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
  CONSTRAINT fk_tasks_stage FOREIGN KEY (stage_id) REFERENCES educational_stages(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_offers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  task_id BIGINT NOT NULL,
  teacher_user_id BIGINT NOT NULL,
  proposal TEXT NOT NULL,
  proposed_price DECIMAL(10, 2) NOT NULL,
  expected_duration VARCHAR(120) NOT NULL,
  delivery_method VARCHAR(32) NOT NULL DEFAULT 'ONLINE',
  additional_notes TEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY task_offers_task_teacher_uq (task_id, teacher_user_id),
  CONSTRAINT fk_offers_task FOREIGN KEY (task_id) REFERENCES educational_tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_offers_teacher FOREIGN KEY (teacher_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_attachments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  task_id BIGINT NOT NULL,
  file_name VARCHAR(200) NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ta_task FOREIGN KEY (task_id) REFERENCES educational_tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_deliverables (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  task_id BIGINT NOT NULL,
  submitted_by_user_id BIGINT NOT NULL,
  summary TEXT NOT NULL,
  deliverable_url TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_td_task FOREIGN KEY (task_id) REFERENCES educational_tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_td_user FOREIGN KEY (submitted_by_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_status_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  task_id BIGINT NOT NULL,
  offer_id BIGINT NULL,
  changed_by_user_id BIGINT NOT NULL,
  from_status VARCHAR(32) NOT NULL,
  to_status VARCHAR(32) NOT NULL,
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tsh_task FOREIGN KEY (task_id) REFERENCES educational_tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_tsh_offer FOREIGN KEY (offer_id) REFERENCES task_offers(id) ON DELETE SET NULL,
  CONSTRAINT fk_tsh_user FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS availability (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  provider_user_id BIGINT NOT NULL,
  day_of_week VARCHAR(32) NOT NULL,
  slot_date VARCHAR(20) NOT NULL,
  start_time VARCHAR(16) NOT NULL,
  end_time VARCHAR(16) NOT NULL,
  service_type VARCHAR(32) NOT NULL DEFAULT 'MENTORSHIP',
  is_booked BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE KEY availability_provider_slot_uq (provider_user_id, slot_date, start_time),
  CONSTRAINT fk_avail_provider FOREIGN KEY (provider_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bookings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  student_user_id BIGINT NOT NULL,
  provider_user_id BIGINT NOT NULL,
  availability_id BIGINT NULL,
  service_type VARCHAR(32) NOT NULL,
  topic VARCHAR(240) NOT NULL,
  notes TEXT NULL,
  scheduled_start VARCHAR(40) NOT NULL,
  scheduled_end VARCHAR(40) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  cancellation_reason TEXT NULL,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_bookings_student FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_bookings_provider FOREIGN KEY (provider_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_bookings_avail FOREIGN KEY (availability_id) REFERENCES availability(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT NOT NULL UNIQUE,
  meeting_link TEXT NULL,
  session_notes TEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
  started_at DATETIME NULL,
  ended_at DATETIME NULL,
  CONSTRAINT fk_sessions_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  subject VARCHAR(200) NOT NULL,
  task_id BIGINT NULL,
  booking_id BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_conv_task FOREIGN KEY (task_id) REFERENCES educational_tasks(id) ON DELETE SET NULL,
  CONSTRAINT fk_conv_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversation_members (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY conv_members_uq (conversation_id, user_id),
  CONSTRAINT fk_cm_conv FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT NOT NULL,
  sender_user_id BIGINT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_msg_conv FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_sender FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  link_url VARCHAR(255) NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS study_groups (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  course_id BIGINT NULL,
  creator_user_id BIGINT NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  max_members INT NOT NULL DEFAULT 25,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sg_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
  CONSTRAINT fk_sg_creator FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS group_members (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  group_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'MEMBER',
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY group_members_uq (group_id, user_id),
  CONSTRAINT fk_gm_group FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_gm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  payer_user_id BIGINT NOT NULL,
  payee_user_id BIGINT NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id BIGINT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  commission_amount DECIMAL(10, 2) NOT NULL,
  net_amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  payment_mode VARCHAR(32) NOT NULL DEFAULT 'SANDBOX_PENDING',
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING_SETUP',
  payment_reference VARCHAR(120) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pay_payer FOREIGN KEY (payer_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pay_payee FOREIGN KEY (payee_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS earnings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  provider_user_id BIGINT NOT NULL,
  payment_id BIGINT NOT NULL,
  gross_amount DECIMAL(10, 2) NOT NULL,
  commission_amount DECIMAL(10, 2) NOT NULL,
  net_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_earn_provider FOREIGN KEY (provider_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_earn_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payout_requests (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  provider_user_id BIGINT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING_SETUP',
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pr_provider FOREIGN KEY (provider_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cvs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE,
  headline VARCHAR(240) NOT NULL,
  summary TEXT NOT NULL,
  education_json JSON NOT NULL,
  experience_json JSON NOT NULL,
  languages_json JSON NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cvs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS portfolios (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  project_url TEXT NULL,
  image_url TEXT NULL,
  skills_summary VARCHAR(300) NULL,
  completed_at VARCHAR(40) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_portfolios_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_skills (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  skill_id BIGINT NOT NULL,
  proficiency_level VARCHAR(32) NOT NULL DEFAULT 'INTERMEDIATE',
  verified_by_passport BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE KEY user_skills_uq (user_id, skill_id),
  CONSTRAINT fk_usk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_usk_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS certificates (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  course_id BIGINT NULL,
  title VARCHAR(240) NOT NULL,
  issuer_name VARCHAR(200) NOT NULL,
  credential_code VARCHAR(120) NOT NULL UNIQUE,
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cert_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_cert_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS skill_passports (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE,
  passport_code VARCHAR(120) NOT NULL UNIQUE,
  verified_skills_count INT NOT NULL DEFAULT 0,
  completed_tasks_count INT NOT NULL DEFAULT 0,
  completed_courses_count INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_roadmaps (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  title VARCHAR(240) NOT NULL,
  diagnosed_gap TEXT NOT NULL,
  recommended_solution_type VARCHAR(40) NOT NULL,
  ai_model_used VARCHAR(80) NULL,
  is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roadmap_steps (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  roadmap_id BIGINT NOT NULL,
  step_order INT NOT NULL DEFAULT 1,
  title VARCHAR(240) NOT NULL,
  description TEXT NOT NULL,
  action_type VARCHAR(40) NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_rs_roadmap FOREIGN KEY (roadmap_id) REFERENCES learning_roadmaps(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  roadmap_id BIGINT NULL,
  target_type VARCHAR(40) NOT NULL,
  recommended_course_id BIGINT NULL,
  recommended_provider_user_id BIGINT NULL,
  rationale TEXT NOT NULL,
  is_configured_real_ai BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_air_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_air_roadmap FOREIGN KEY (roadmap_id) REFERENCES learning_roadmaps(id) ON DELETE SET NULL,
  CONSTRAINT fk_air_course FOREIGN KEY (recommended_course_id) REFERENCES courses(id) ON DELETE SET NULL,
  CONSTRAINT fk_air_provider FOREIGN KEY (recommended_provider_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reviews (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  author_user_id BIGINT NOT NULL,
  target_user_id BIGINT NULL,
  course_id BIGINT NULL,
  task_id BIGINT NULL,
  booking_id BIGINT NULL,
  rating INT NOT NULL,
  comment TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rev_author FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_rev_target FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_rev_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_rev_task FOREIGN KEY (task_id) REFERENCES educational_tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_rev_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reports (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  reporter_user_id BIGINT NOT NULL,
  target_type VARCHAR(40) NOT NULL,
  target_id BIGINT NOT NULL,
  reason VARCHAR(200) NOT NULL,
  details TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  resolution_note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rep_reporter FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS verifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  center_id BIGINT NULL,
  document_summary TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  reviewed_by_user_id BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ver_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ver_center FOREIGN KEY (center_id) REFERENCES centers(id) ON DELETE CASCADE,
  CONSTRAINT fk_ver_reviewer FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS platform_settings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(120) NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
