import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  uniqueIndex,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// 1. IDENTITY, ROLES & PROFILES
// ============================================================================

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').unique(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'),
    fullName: text('full_name').notNull(),
    avatarUrl: text('avatar_url'),
    phone: text('phone'),
    locale: text('locale').notNull().default('ar'),
    accountStatus: text('account_status').notNull().default('ACTIVE'), // ACTIVE | SUSPENDED | PENDING
    emailVerified: boolean('email_verified').notNull().default(false),
    resetTokenHash: text('reset_token_hash'),
    resetTokenExpiresAt: timestamp('reset_token_expires_at'),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('users_email_idx').on(table.email),
    index('users_status_idx').on(table.accountStatus),
  ]
);

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // STUDENT | TEACHER | MENTOR | EXPERT | CENTER_OWNER | CENTER_STAFF | ADMIN
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  description: text('description'),
});

export const userRoles = pgTable(
  'user_roles',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    assignedAt: timestamp('assigned_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('user_roles_user_role_uq').on(table.userId, table.roleId),
    index('user_roles_user_idx').on(table.userId),
  ]
);

// ============================================================================
// 2. EDUCATIONAL TAXONOMY (ADMIN-CONFIGURABLE WITHOUT CODE CHANGES)
// ============================================================================

export const educationalStages = pgTable('educational_stages', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
});

export const fields = pgTable('fields', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  descriptionAr: text('description_ar'),
  iconName: text('icon_name').default('BookOpen'),
  isActive: boolean('is_active').notNull().default(true),
});

export const subjects = pgTable(
  'subjects',
  {
    id: serial('id').primaryKey(),
    fieldId: integer('field_id')
      .notNull()
      .references(() => fields.id, { onDelete: 'cascade' }),
    stageId: integer('stage_id').references(() => educationalStages.id, {
      onDelete: 'set null',
    }),
    slug: text('slug').notNull().unique(),
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en').notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [index('subjects_field_idx').on(table.fieldId)]
);

export const skills = pgTable(
  'skills',
  {
    id: serial('id').primaryKey(),
    fieldId: integer('field_id')
      .notNull()
      .references(() => fields.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull().unique(),
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en').notNull(),
  },
  (table) => [index('skills_field_idx').on(table.fieldId)]
);

export const educationalSystems = pgTable(
  'educational_systems',
  {
    id: serial('id').primaryKey(),
    stageId: integer('stage_id')
      .notNull()
      .references(() => educationalStages.id, { onDelete: 'cascade' }),
    code: text('code').notNull().unique(), // PRIMARY_GENERAL | PREPARATORY_GENERAL | GENERAL_SECONDARY | EGYPTIAN_BACCALAUREATE
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en').notNull(),
    descriptionAr: text('description_ar'),
    descriptionEn: text('description_en'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [index('educational_systems_stage_idx').on(table.stageId)]
);

export const educationalGrades = pgTable(
  'educational_grades',
  {
    id: serial('id').primaryKey(),
    stageId: integer('stage_id')
      .notNull()
      .references(() => educationalStages.id, { onDelete: 'cascade' }),
    systemId: integer('system_id')
      .notNull()
      .references(() => educationalSystems.id, { onDelete: 'cascade' }),
    gradeNumber: integer('grade_number').notNull(),
    slug: text('slug').notNull().unique(),
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    index('educational_grades_stage_idx').on(table.stageId),
    index('educational_grades_system_idx').on(table.systemId),
  ]
);

export const secondaryDivisions = pgTable(
  'secondary_divisions',
  {
    id: serial('id').primaryKey(),
    systemId: integer('system_id')
      .notNull()
      .references(() => educationalSystems.id, { onDelete: 'cascade' }),
    gradeId: integer('grade_id')
      .notNull()
      .references(() => educationalGrades.id, { onDelete: 'cascade' }),
    code: text('code').notNull().unique(),
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    index('secondary_divisions_system_grade_idx').on(table.systemId, table.gradeId),
  ]
);

export const baccalaureatePathways = pgTable(
  'baccalaureate_pathways',
  {
    id: serial('id').primaryKey(),
    systemId: integer('system_id')
      .notNull()
      .references(() => educationalSystems.id, { onDelete: 'cascade' }),
    gradeId: integer('grade_id')
      .notNull()
      .references(() => educationalGrades.id, { onDelete: 'cascade' }),
    code: text('code').notNull().unique(),
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en').notNull(),
    descriptionAr: text('description_ar'),
    descriptionEn: text('description_en'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    index('baccalaureate_pathways_system_grade_idx').on(table.systemId, table.gradeId),
  ]
);

export const academicYears = pgTable('academic_years', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // e.g. 2026/2027
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  startDate: text('start_date'),
  endDate: text('end_date'),
  isCurrent: boolean('is_current').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const curriculumVersions = pgTable(
  'curriculum_versions',
  {
    id: serial('id').primaryKey(),
    academicYearId: integer('academic_year_id')
      .notNull()
      .references(() => academicYears.id, { onDelete: 'cascade' }),
    versionCode: text('version_code').notNull().unique(),
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en').notNull(),
    description: text('description'),
    copiedFromVersionId: integer('copied_from_version_id'),
    isActive: boolean('is_active').notNull().default(true),
    isPublished: boolean('is_published').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('curriculum_versions_year_idx').on(table.academicYearId)]
);

export const gradeSubjects = pgTable(
  'grade_subjects',
  {
    id: serial('id').primaryKey(),
    gradeId: integer('grade_id')
      .notNull()
      .references(() => educationalGrades.id, { onDelete: 'cascade' }),
    subjectId: integer('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('grade_subjects_grade_subject_uq').on(table.gradeId, table.subjectId),
  ]
);

export const curriculumSubjects = pgTable(
  'curriculum_subjects',
  {
    id: serial('id').primaryKey(),
    curriculumVersionId: integer('curriculum_version_id')
      .notNull()
      .references(() => curriculumVersions.id, { onDelete: 'cascade' }),
    academicYearId: integer('academic_year_id')
      .notNull()
      .references(() => academicYears.id, { onDelete: 'cascade' }),
    stageId: integer('stage_id')
      .notNull()
      .references(() => educationalStages.id, { onDelete: 'cascade' }),
    systemId: integer('system_id')
      .notNull()
      .references(() => educationalSystems.id, { onDelete: 'cascade' }),
    gradeId: integer('grade_id')
      .notNull()
      .references(() => educationalGrades.id, { onDelete: 'cascade' }),
    divisionId: integer('division_id').references(() => secondaryDivisions.id, {
      onDelete: 'set null',
    }),
    pathwayId: integer('pathway_id').references(() => baccalaureatePathways.id, {
      onDelete: 'set null',
    }),
    gradeSubjectId: integer('grade_subject_id').references(() => gradeSubjects.id, {
      onDelete: 'set null',
    }),
    subjectId: integer('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    subjectType: text('subject_type').notNull().default('CORE'), // CORE | NON_TOTAL | ACTIVITY | ELECTIVE | SPECIALIZATION | ADDITIONAL_SCHOOL | RELIGIOUS | FOREIGN_LANGUAGE
    isCompulsory: boolean('is_compulsory').notNull().default(true),
    isElective: boolean('is_elective').notNull().default(false),
    isSpecialization: boolean('is_specialization').notNull().default(false),
    isIncludedInTotal: boolean('is_included_in_total').notNull().default(true),
    isPassFail: boolean('is_pass_fail').notNull().default(false),
    isNonTotal: boolean('is_non_total').notNull().default(false),
    isActivity: boolean('is_activity').notNull().default(false),
    passThresholdPercent: integer('pass_threshold_percent'),
    electiveGroupCode: text('elective_group_code'),
    defaultLanguageOfInstruction: text('default_language_of_instruction')
      .notNull()
      .default('ar'),
    languagesOfInstructionJson: jsonb('languages_of_instruction_json')
      .$type<string[]>()
      .notNull()
      .default(['ar']),
    curriculumVariantsJson: jsonb('curriculum_variants_json')
      .$type<string[]>()
      .notNull()
      .default([]),
    notesAr: text('notes_ar'),
    notesEn: text('notes_en'),
    isAvailableForTeacherAssignment: boolean('is_available_for_teacher_assignment')
      .notNull()
      .default(true),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('curriculum_subjects_version_grade_idx').on(
      table.curriculumVersionId,
      table.gradeId
    ),
    index('curriculum_subjects_system_grade_idx').on(table.systemId, table.gradeId),
    index('curriculum_subjects_division_idx').on(table.divisionId),
    index('curriculum_subjects_pathway_idx').on(table.pathwayId),
    index('curriculum_subjects_subject_idx').on(table.subjectId),
  ]
);

export const teacherTeachingAssignments = pgTable(
  'teacher_teaching_assignments',
  {
    id: serial('id').primaryKey(),
    teacherUserId: integer('teacher_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    curriculumSubjectId: integer('curriculum_subject_id')
      .notNull()
      .references(() => curriculumSubjects.id, { onDelete: 'cascade' }),
    subjectId: integer('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    gradeId: integer('grade_id')
      .notNull()
      .references(() => educationalGrades.id, { onDelete: 'cascade' }),
    systemId: integer('system_id')
      .notNull()
      .references(() => educationalSystems.id, { onDelete: 'cascade' }),
    divisionId: integer('division_id').references(() => secondaryDivisions.id, {
      onDelete: 'set null',
    }),
    pathwayId: integer('pathway_id').references(() => baccalaureatePathways.id, {
      onDelete: 'set null',
    }),
    languagesOfferedJson: jsonb('languages_offered_json')
      .$type<string[]>()
      .notNull()
      .default(['ar']),
    religiousVariant: text('religious_variant'),
    hourlyRate: numeric('hourly_rate', { precision: 10, scale: 2 }),
    currency: text('currency').notNull().default('USD'),
    supportsOnline: boolean('supports_online').notNull().default(true),
    supportsInPerson: boolean('supports_in_person').notNull().default(false),
    notes: text('notes'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('teacher_assignments_teacher_curr_subj_uq').on(
      table.teacherUserId,
      table.curriculumSubjectId
    ),
    index('teacher_assignments_curr_subj_idx').on(table.curriculumSubjectId),
    index('teacher_assignments_teacher_idx').on(table.teacherUserId),
    index('teacher_assignments_grade_subj_idx').on(table.gradeId, table.subjectId),
  ]
);

export const studentProfiles = pgTable('student_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  stageId: integer('stage_id').references(() => educationalStages.id, {
    onDelete: 'set null',
  }),
  learningGoal: text('learning_goal'),
  bio: text('bio'),
  careerInterest: text('career_interest'),
  preferredLanguage: text('preferred_language').notNull().default('ar'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const providerProfiles = pgTable(
  'provider_profiles',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerType: text('provider_type').notNull().default('TEACHER'), // TEACHER | MENTOR | EXPERT
    headline: text('headline').notNull(),
    bio: text('bio').notNull(),
    qualifications: text('qualifications'),
    yearsExperience: integer('years_experience').notNull().default(1),
    hourlyRate: numeric('hourly_rate', { precision: 10, scale: 2 })
      .notNull()
      .default('25.00'),
    currency: text('currency').notNull().default('USD'),
    verificationStatus: text('verification_status').notNull().default('PENDING'), // PENDING | VERIFIED | REJECTED
    ratingAvg: numeric('rating_avg', { precision: 3, scale: 2 })
      .notNull()
      .default('0.00'),
    reviewsCount: integer('reviews_count').notNull().default(0),
    isAcceptingTasks: boolean('is_accepting_tasks').notNull().default(true),
    isAcceptingBookings: boolean('is_accepting_bookings').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('provider_type_idx').on(table.providerType),
    index('provider_verification_idx').on(table.verificationStatus),
  ]
);

// ============================================================================
// 3. EDUCATIONAL CENTERS & STAFF
// ============================================================================

export interface CenterWorkingHourDay {
  dayOfWeek: number; // 0 (Sun) .. 6 (Sat)
  isOpen: boolean;
  openTime: string; // HH:mm
  closeTime: string; // HH:mm
  note?: string;
}

export interface CenterBookingPolicies {
  allowStudentBookings: boolean;
  requireApproval: boolean;
  minBookingNoticeHours: number;
  allowCancellation: boolean;
  minCancellationNoticeHours: number;
  maxReschedulesPerBooking: number;
  policySummary: string;
}

export interface CenterNotificationSettings {
  notifyNewStudentRegistration: boolean;
  notifyNewCourseEnrollment: boolean;
  notifyBookingRequests: boolean;
  notifyCancellations: boolean;
  notifyPaymentUpdates: boolean;
  notifyStaffActivities: boolean;
}

export const centers = pgTable('centers', {
  id: serial('id').primaryKey(),
  ownerUserId: integer('owner_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull(),
  city: text('city').notNull(),
  country: text('country').notNull(),
  governorate: text('governorate'),
  street: text('street'),
  buildingDetails: text('building_details'),
  address: text('address'),
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),
  phone: text('phone'),
  secondaryPhone: text('secondary_phone'),
  website: text('website'),
  logoUrl: text('logo_url'),
  bannerUrl: text('banner_url'),
  verificationStatus: text('verification_status').notNull().default('PENDING'),
  workingHoursJson: jsonb('working_hours_json')
    .$type<CenterWorkingHourDay[]>()
    .notNull()
    .default([]),
  bookingPoliciesJson: jsonb('booking_policies_json')
    .$type<CenterBookingPolicies | null>(),
  notificationSettingsJson: jsonb('notification_settings_json')
    .$type<CenterNotificationSettings | null>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const centerMembers = pgTable(
  'center_members',
  {
    id: serial('id').primaryKey(),
    centerId: integer('center_id')
      .notNull()
      .references(() => centers.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    memberRole: text('member_role').notNull().default('STAFF'), // OWNER | MANAGER | INSTRUCTOR | STAFF
    jobTitle: text('job_title').notNull().default(''),
    employmentType: text('employment_type').notNull().default('PART_TIME'), // FULL_TIME | PART_TIME | CONTRACT | FREELANCE
    permissionsJson: jsonb('permissions_json').$type<string[]>().notNull().default([]),
    status: text('status').notNull().default('ACTIVE'), // ACTIVE | INACTIVE
    notes: text('notes'),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('center_members_center_user_uq').on(table.centerId, table.userId),
    index('center_members_user_idx').on(table.userId),
  ]
);

export const centerBranches = pgTable(
  'center_branches',
  {
    id: serial('id').primaryKey(),
    centerId: integer('center_id')
      .notNull()
      .references(() => centers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    city: text('city').notNull(),
    address: text('address').notNull(),
    phone: text('phone'),
    isMain: boolean('is_main').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('center_branches_center_idx').on(table.centerId)]
);

export const centerRooms = pgTable(
  'center_rooms',
  {
    id: serial('id').primaryKey(),
    centerId: integer('center_id')
      .notNull()
      .references(() => centers.id, { onDelete: 'cascade' }),
    branchId: integer('branch_id')
      .notNull()
      .references(() => centerBranches.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    roomNumber: text('room_number').notNull().default(''),
    capacity: integer('capacity').notNull().default(20),
    equipmentNotes: text('equipment_notes'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('center_rooms_center_idx').on(table.centerId),
    index('center_rooms_branch_idx').on(table.branchId),
  ]
);

export const centerTeacherAssignments = pgTable(
  'center_teacher_assignments',
  {
    id: serial('id').primaryKey(),
    centerId: integer('center_id')
      .notNull()
      .references(() => centers.id, { onDelete: 'cascade' }),
    memberId: integer('member_id')
      .notNull()
      .references(() => centerMembers.id, { onDelete: 'cascade' }),
    teacherUserId: integer('teacher_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subjectId: integer('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    stageId: integer('stage_id')
      .notNull()
      .references(() => educationalStages.id, { onDelete: 'cascade' }),
    systemId: integer('system_id').references(() => educationalSystems.id, {
      onDelete: 'set null',
    }),
    gradeId: integer('grade_id').references(() => educationalGrades.id, {
      onDelete: 'set null',
    }),
    divisionId: integer('division_id').references(() => secondaryDivisions.id, {
      onDelete: 'set null',
    }),
    pathwayId: integer('pathway_id').references(() => baccalaureatePathways.id, {
      onDelete: 'set null',
    }),
    notes: text('notes'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('center_teacher_assignments_center_idx').on(table.centerId),
    index('center_teacher_assignments_member_idx').on(table.memberId),
    index('center_teacher_assignments_teacher_idx').on(table.teacherUserId),
  ]
);

export const centerStudents = pgTable(
  'center_students',
  {
    id: serial('id').primaryKey(),
    centerId: integer('center_id')
      .notNull()
      .references(() => centers.id, { onDelete: 'cascade' }),
    studentUserId: integer('student_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    phone: text('phone'),
    stageId: integer('stage_id').references(() => educationalStages.id, {
      onDelete: 'set null',
    }),
    gradeId: integer('grade_id').references(() => educationalGrades.id, {
      onDelete: 'set null',
    }),
    guardianName: text('guardian_name'),
    guardianPhone: text('guardian_phone'),
    notes: text('notes'),
    status: text('status').notNull().default('ACTIVE'), // ACTIVE | INACTIVE
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('center_students_center_user_uq').on(table.centerId, table.studentUserId),
    index('center_students_center_idx').on(table.centerId),
    index('center_students_user_idx').on(table.studentUserId),
  ]
);

export const centerAttendance = pgTable(
  'center_attendance',
  {
    id: serial('id').primaryKey(),
    centerId: integer('center_id')
      .notNull()
      .references(() => centers.id, { onDelete: 'cascade' }),
    studentUserId: integer('student_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: integer('course_id').references(() => courses.id, {
      onDelete: 'set null',
    }),
    teacherUserId: integer('teacher_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    attendanceDate: text('attendance_date').notNull(), // YYYY-MM-DD
    status: text('status').notNull().default('PRESENT'), // PRESENT | ABSENT | LATE | EXCUSED
    notes: text('notes'),
    recordedByUserId: integer('recorded_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('center_attendance_center_student_idx').on(table.centerId, table.studentUserId),
    index('center_attendance_date_idx').on(table.attendanceDate),
  ]
);

export const centerStudentPayments = pgTable(
  'center_student_payments',
  {
    id: serial('id').primaryKey(),
    centerId: integer('center_id')
      .notNull()
      .references(() => centers.id, { onDelete: 'cascade' }),
    studentUserId: integer('student_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: integer('course_id').references(() => courses.id, {
      onDelete: 'set null',
    }),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
    currency: text('currency').notNull().default('EGP'),
    status: text('status').notNull().default('PAID'), // PAID | PENDING | PARTIAL | OVERDUE | REFUNDED
    paymentMethod: text('payment_method').notNull().default('CASH'), // CASH | CARD | TRANSFER | WALLET
    referenceCode: text('reference_code'),
    notes: text('notes'),
    paidAt: text('paid_at').notNull(), // YYYY-MM-DD
    recordedByUserId: integer('recorded_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('center_student_payments_center_student_idx').on(
      table.centerId,
      table.studentUserId
    ),
  ]
);

// ============================================================================
// 4. PROFESSIONAL DEVELOPMENT, SKILLS, CV, PORTFOLIO, VERIFICATION
// ============================================================================

export const userSkills = pgTable(
  'user_skills',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    skillId: integer('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    proficiencyLevel: text('proficiency_level').notNull().default('INTERMEDIATE'), // BEGINNER | INTERMEDIATE | ADVANCED | EXPERT
    verifiedByPassport: boolean('verified_by_passport').notNull().default(false),
  },
  (table) => [uniqueIndex('user_skills_uq').on(table.userId, table.skillId)]
);

export const portfolios = pgTable(
  'portfolios',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    projectUrl: text('project_url'),
    imageUrl: text('image_url'),
    skillsSummary: text('skills_summary'),
    completedAt: text('completed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('portfolios_user_idx').on(table.userId)]
);

export const cvs = pgTable('cvs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  headline: text('headline').notNull(),
  summary: text('summary').notNull(),
  educationJson: jsonb('education_json')
    .$type<Array<{ institution: string; degree: string; year: string }>>()
    .notNull()
    .default([]),
  experienceJson: jsonb('experience_json')
    .$type<Array<{ role: string; organization: string; period: string; highlights: string }>>()
    .notNull()
    .default([]),
  languagesJson: jsonb('languages_json').$type<string[]>().notNull().default(['العربية']),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const skillPassports = pgTable('skill_passports', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  passportCode: text('passport_code').notNull().unique(),
  verifiedSkillsCount: integer('verified_skills_count').notNull().default(0),
  completedTasksCount: integer('completed_tasks_count').notNull().default(0),
  completedCoursesCount: integer('completed_courses_count').notNull().default(0),
  issuedAt: timestamp('issued_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================================================
// 5. COURSES, LESSONS, ENROLLMENTS, ASSESSMENTS & PROGRESS
// ============================================================================

export const courses = pgTable(
  'courses',
  {
    id: serial('id').primaryKey(),
    instructorUserId: integer('instructor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    centerId: integer('center_id').references(() => centers.id, {
      onDelete: 'set null',
    }),
    fieldId: integer('field_id')
      .notNull()
      .references(() => fields.id, { onDelete: 'restrict' }),
    subjectId: integer('subject_id').references(() => subjects.id, {
      onDelete: 'set null',
    }),
    stageId: integer('stage_id').references(() => educationalStages.id, {
      onDelete: 'set null',
    }),
    systemId: integer('system_id').references(() => educationalSystems.id, {
      onDelete: 'set null',
    }),
    gradeId: integer('grade_id').references(() => educationalGrades.id, {
      onDelete: 'set null',
    }),
    divisionId: integer('division_id').references(() => secondaryDivisions.id, {
      onDelete: 'set null',
    }),
    pathwayId: integer('pathway_id').references(() => baccalaureatePathways.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(),
    subtitle: text('subtitle').notNull(),
    description: text('description').notNull(),
    customFieldName: text('custom_field_name'),
    targetAudience: text('target_audience'),
    level: text('level').notNull().default('BEGINNER'), // BEGINNER | INTERMEDIATE | ADVANCED
    language: text('language').notNull().default('ar'),
    price: numeric('price', { precision: 10, scale: 2 }).notNull().default('0.00'),
    currency: text('currency').notNull().default('USD'),
    maxStudents: integer('max_students'),
    enrollmentStatus: text('enrollment_status').notNull().default('OPEN'), // OPEN | PAUSED | CLOSED
    thumbnailUrl: text('thumbnail_url'),
    coverImageKey: text('cover_image_key'),
    status: text('status').notNull().default('DRAFT'), // DRAFT | PUBLISHED | PAUSED | CLOSED | ARCHIVED
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('courses_field_idx').on(table.fieldId),
    index('courses_status_idx').on(table.status),
    index('courses_instructor_idx').on(table.instructorUserId),
  ]
);

export const courseLessons = pgTable(
  'course_lessons',
  {
    id: serial('id').primaryKey(),
    courseId: integer('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    moduleTitle: text('module_title'),
    title: text('title').notNull(),
    content: text('content').notNull(),
    videoUrl: text('video_url'),
    durationMinutes: integer('duration_minutes').notNull().default(15),
    sortOrder: integer('sort_order').notNull().default(1),
    isFreePreview: boolean('is_free_preview').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('lessons_course_idx').on(table.courseId)]
);

export const enrollments = pgTable(
  'enrollments',
  {
    id: serial('id').primaryKey(),
    courseId: integer('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'restrict' }),
    studentUserId: integer('student_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: text('status').notNull().default('ACTIVE'), // ACTIVE | COMPLETED | CANCELLED
    enrolledAt: timestamp('enrolled_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
  },
  (table) => [
    uniqueIndex('enrollments_course_student_uq').on(
      table.courseId,
      table.studentUserId
    ),
    index('enrollments_student_idx').on(table.studentUserId),
  ]
);

export const progress = pgTable('progress', {
  id: serial('id').primaryKey(),
  enrollmentId: integer('enrollment_id')
    .notNull()
    .unique()
    .references(() => enrollments.id, { onDelete: 'cascade' }),
  completedLessonsCount: integer('completed_lessons_count').notNull().default(0),
  totalLessonsCount: integer('total_lessons_count').notNull().default(0),
  completionPercent: integer('completion_percent').notNull().default(0),
  lastAccessedAt: timestamp('last_accessed_at').notNull().defaultNow(),
});

export const lessonProgress = pgTable(
  'lesson_progress',
  {
    id: serial('id').primaryKey(),
    enrollmentId: integer('enrollment_id')
      .notNull()
      .references(() => enrollments.id, { onDelete: 'cascade' }),
    lessonId: integer('lesson_id')
      .notNull()
      .references(() => courseLessons.id, { onDelete: 'cascade' }),
    isCompleted: boolean('is_completed').notNull().default(false),
    completedAt: timestamp('completed_at'),
  },
  (table) => [
    uniqueIndex('lesson_progress_uq').on(table.enrollmentId, table.lessonId),
  ]
);

export const certificates = pgTable(
  'certificates',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: integer('course_id').references(() => courses.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    issuerName: text('issuer_name').notNull(),
    credentialCode: text('credential_code').notNull().unique(),
    issuedAt: timestamp('issued_at').notNull().defaultNow(),
  },
  (table) => [index('certificates_user_idx').on(table.userId)]
);

export const quizzes = pgTable(
  'quizzes',
  {
    id: serial('id').primaryKey(),
    courseId: integer('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    passingScore: integer('passing_score').notNull().default(70),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('quizzes_course_idx').on(table.courseId)]
);

export const questions = pgTable(
  'questions',
  {
    id: serial('id').primaryKey(),
    quizId: integer('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    questionText: text('question_text').notNull(),
    questionType: text('question_type').notNull().default('MULTIPLE_CHOICE'),
    points: integer('points').notNull().default(10),
    sortOrder: integer('sort_order').notNull().default(1),
  },
  (table) => [index('questions_quiz_idx').on(table.quizId)]
);

export const quizAnswers = pgTable(
  'quiz_answers',
  {
    id: serial('id').primaryKey(),
    questionId: integer('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    answerText: text('answer_text').notNull(),
    isCorrect: boolean('is_correct').notNull().default(false),
  },
  (table) => [index('quiz_answers_question_idx').on(table.questionId)]
);

export const quizAttempts = pgTable(
  'quiz_attempts',
  {
    id: serial('id').primaryKey(),
    quizId: integer('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    studentUserId: integer('student_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    score: integer('score').notNull().default(0),
    maxScore: integer('max_score').notNull().default(0),
    passed: boolean('passed').notNull().default(false),
    submittedAt: timestamp('submitted_at').notNull().defaultNow(),
  },
  (table) => [index('quiz_attempts_student_idx').on(table.studentUserId)]
);

export const quizAttemptAnswers = pgTable(
  'quiz_attempt_answers',
  {
    id: serial('id').primaryKey(),
    attemptId: integer('attempt_id')
      .notNull()
      .references(() => quizAttempts.id, { onDelete: 'cascade' }),
    questionId: integer('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    selectedAnswerId: integer('selected_answer_id')
      .notNull()
      .references(() => quizAnswers.id, { onDelete: 'cascade' }),
    isCorrect: boolean('is_correct').notNull().default(false),
  },
  (table) => [index('attempt_answers_attempt_idx').on(table.attemptId)]
);

export const assignments = pgTable(
  'assignments',
  {
    id: serial('id').primaryKey(),
    courseId: integer('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    instructions: text('instructions').notNull(),
    maxScore: integer('max_score').notNull().default(100),
    dueDate: text('due_date'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('assignments_course_idx').on(table.courseId)]
);

export const assignmentSubmissions = pgTable(
  'assignment_submissions',
  {
    id: serial('id').primaryKey(),
    assignmentId: integer('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    studentUserId: integer('student_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    submissionText: text('submission_text').notNull(),
    attachmentUrl: text('attachment_url'),
    score: integer('score'),
    feedback: text('feedback'),
    status: text('status').notNull().default('SUBMITTED'), // SUBMITTED | GRADED
    submittedAt: timestamp('submitted_at').notNull().defaultNow(),
    gradedAt: timestamp('graded_at'),
  },
  (table) => [
    index('submissions_assignment_idx').on(table.assignmentId),
    index('submissions_student_idx').on(table.studentUserId),
  ]
);

export const studyGroups = pgTable('study_groups', {
  id: serial('id').primaryKey(),
  courseId: integer('course_id').references(() => courses.id, {
    onDelete: 'set null',
  }),
  fieldId: integer('field_id').references(() => fields.id, {
    onDelete: 'set null',
  }),
  creatorUserId: integer('creator_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  maxMembers: integer('max_members').notNull().default(25),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const groupMembers = pgTable(
  'group_members',
  {
    id: serial('id').primaryKey(),
    groupId: integer('group_id')
      .notNull()
      .references(() => studyGroups.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('MEMBER'),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('group_members_uq').on(table.groupId, table.userId)]
);

// ============================================================================
// 6. EDUCATIONAL TASK MARKETPLACE (CORE FEATURE)
// ============================================================================

export const taskCategories = pgTable('task_categories', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  descriptionAr: text('description_ar'),
});

export const educationalTasks = pgTable(
  'educational_tasks',
  {
    id: serial('id').primaryKey(),
    studentUserId: integer('student_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => taskCategories.id, { onDelete: 'restrict' }),
    fieldId: integer('field_id')
      .notNull()
      .references(() => fields.id, { onDelete: 'restrict' }),
    subjectId: integer('subject_id').references(() => subjects.id, {
      onDelete: 'set null',
    }),
    stageId: integer('stage_id').references(() => educationalStages.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    requiredSkills: text('required_skills').notNull().default(''),
    budget: numeric('budget', { precision: 10, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('USD'),
    expectedDuration: text('expected_duration').notNull(),
    preferredMethod: text('preferred_method').notNull().default('ONLINE'), // ONLINE | HYBRID | IN_PERSON
    deadline: text('deadline').notNull(),
    status: text('status').notNull().default('OPEN'), // OPEN | OFFERS_RECEIVED | OFFER_ACCEPTED | IN_PROGRESS | DELIVERED | COMPLETED | CANCELLED | DISPUTED
    acceptedOfferId: integer('accepted_offer_id'),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('tasks_status_idx').on(table.status),
    index('tasks_student_idx').on(table.studentUserId),
    index('tasks_field_idx').on(table.fieldId),
  ]
);

export const taskAttachments = pgTable(
  'task_attachments',
  {
    id: serial('id').primaryKey(),
    taskId: integer('task_id')
      .notNull()
      .references(() => educationalTasks.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    fileUrl: text('file_url').notNull(),
    mimeType: text('mime_type').notNull().default('application/pdf'),
  },
  (table) => [index('task_attachments_task_idx').on(table.taskId)]
);

export const taskOffers = pgTable(
  'task_offers',
  {
    id: serial('id').primaryKey(),
    taskId: integer('task_id')
      .notNull()
      .references(() => educationalTasks.id, { onDelete: 'cascade' }),
    teacherUserId: integer('teacher_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    proposal: text('proposal').notNull(),
    proposedPrice: numeric('proposed_price', { precision: 10, scale: 2 }).notNull(),
    expectedDuration: text('expected_duration').notNull(),
    deliveryMethod: text('delivery_method').notNull().default('ONLINE'),
    additionalNotes: text('additional_notes'),
    status: text('status').notNull().default('PENDING'), // PENDING | ACCEPTED | REJECTED | WITHDRAWN
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('task_offers_task_teacher_uq').on(
      table.taskId,
      table.teacherUserId
    ),
    index('task_offers_task_idx').on(table.taskId),
    index('task_offers_teacher_idx').on(table.teacherUserId),
  ]
);

export const taskDeliverables = pgTable(
  'task_deliverables',
  {
    id: serial('id').primaryKey(),
    taskId: integer('task_id')
      .notNull()
      .references(() => educationalTasks.id, { onDelete: 'cascade' }),
    submittedByUserId: integer('submitted_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    summary: text('summary').notNull(),
    deliverableUrl: text('deliverable_url'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('task_deliverables_task_idx').on(table.taskId)]
);

export const taskStatusHistory = pgTable(
  'task_status_history',
  {
    id: serial('id').primaryKey(),
    taskId: integer('task_id')
      .notNull()
      .references(() => educationalTasks.id, { onDelete: 'cascade' }),
    offerId: integer('offer_id').references(() => taskOffers.id, {
      onDelete: 'set null',
    }),
    changedByUserId: integer('changed_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    fromStatus: text('from_status').notNull(),
    toStatus: text('to_status').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('task_history_task_idx').on(table.taskId)]
);

// ============================================================================
// 7. AVAILABILITY, BOOKINGS & SESSIONS
// ============================================================================

export const availability = pgTable(
  'availability',
  {
    id: serial('id').primaryKey(),
    providerUserId: integer('provider_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    dayOfWeek: text('day_of_week').notNull(),
    slotDate: text('slot_date').notNull(), // YYYY-MM-DD
    startTime: text('start_time').notNull(), // HH:mm
    endTime: text('end_time').notNull(), // HH:mm
    serviceType: text('service_type').notNull().default('MENTORSHIP'), // PRIVATE_LESSON | MENTORSHIP | CONSULTATION
    isBooked: boolean('is_booked').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('availability_provider_slot_uq').on(
      table.providerUserId,
      table.slotDate,
      table.startTime
    ),
    index('availability_provider_idx').on(table.providerUserId),
  ]
);

export const bookings = pgTable(
  'bookings',
  {
    id: serial('id').primaryKey(),
    studentUserId: integer('student_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    providerUserId: integer('provider_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    availabilityId: integer('availability_id').references(() => availability.id, {
      onDelete: 'set null',
    }),
    serviceType: text('service_type').notNull().default('MENTORSHIP'), // PRIVATE_LESSON | MENTORSHIP | CONSULTATION
    topic: text('topic').notNull(),
    notes: text('notes'),
    scheduledStart: text('scheduled_start').notNull(),
    scheduledEnd: text('scheduled_end').notNull(),
    price: numeric('price', { precision: 10, scale: 2 }).notNull().default('25.00'),
    currency: text('currency').notNull().default('USD'),
    status: text('status').notNull().default('PENDING'), // PENDING | CONFIRMED | RESCHEDULED | COMPLETED | CANCELLED
    cancellationReason: text('cancellation_reason'),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('bookings_student_idx').on(table.studentUserId),
    index('bookings_provider_idx').on(table.providerUserId),
  ]
);

export const sessions = pgTable(
  'sessions',
  {
    id: serial('id').primaryKey(),
    bookingId: integer('booking_id')
      .notNull()
      .unique()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    meetingLink: text('meeting_link'),
    sessionNotes: text('session_notes'),
    startedAt: timestamp('started_at'),
    endedAt: timestamp('ended_at'),
    status: text('status').notNull().default('SCHEDULED'),
  },
  (table) => [index('sessions_booking_idx').on(table.bookingId)]
);

export const teachingSessions = pgTable(
  'teaching_sessions',
  {
    id: serial('id').primaryKey(),
    teacherUserId: integer('teacher_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subjectId: integer('subject_id').references(() => subjects.id, {
      onDelete: 'set null',
    }),
    curriculumSubjectId: integer('curriculum_subject_id').references(
      () => curriculumSubjects.id,
      { onDelete: 'set null' }
    ),
    systemId: integer('system_id').references(() => educationalSystems.id, {
      onDelete: 'set null',
    }),
    gradeId: integer('grade_id').references(() => educationalGrades.id, {
      onDelete: 'set null',
    }),
    stageId: integer('stage_id').references(() => educationalStages.id, {
      onDelete: 'set null',
    }),
    divisionId: integer('division_id').references(() => secondaryDivisions.id, {
      onDelete: 'set null',
    }),
    pathwayId: integer('pathway_id').references(() => baccalaureatePathways.id, {
      onDelete: 'set null',
    }),
    sessionType: text('session_type').notNull(), // ONE_TO_ONE | GROUP
    title: text('title').notNull(),
    description: text('description'),
    startTime: timestamp('start_time').notNull(),
    endTime: timestamp('end_time').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    capacity: integer('capacity').notNull().default(1),
    minStudents: integer('min_students'),
    price: numeric('price', { precision: 10, scale: 2 }).notNull().default('0.00'),
    currency: text('currency').notNull().default('USD'),
    deliveryMode: text('delivery_mode').notNull().default('ONLINE'), // ONLINE | IN_PERSON
    location: text('location'),
    governorate: text('governorate'),
    city: text('city'),
    district: text('district'),
    streetName: text('street_name'),
    buildingOrCenterName: text('building_or_center_name'),
    locationNotes: text('location_notes'),
    isDemoLocation: boolean('is_demo_location').notNull().default(false),
    meetingUrl: text('meeting_url'),
    registrationDeadline: timestamp('registration_deadline'),
    status: text('status').notNull().default('OPEN'), // OPEN | FULL | CANCELLED | COMPLETED
    seedKey: text('seed_key'),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('teaching_sessions_seed_key_uq').on(table.seedKey),
    index('teaching_sessions_teacher_idx').on(table.teacherUserId),
    index('teaching_sessions_subject_idx').on(table.subjectId),
    index('teaching_sessions_curr_subject_idx').on(table.curriculumSubjectId),
    index('teaching_sessions_system_idx').on(table.systemId),
    index('teaching_sessions_grade_idx').on(table.gradeId),
    index('teaching_sessions_division_idx').on(table.divisionId),
    index('teaching_sessions_pathway_idx').on(table.pathwayId),
    index('teaching_sessions_delivery_idx').on(table.deliveryMode),
    index('teaching_sessions_type_status_idx').on(
      table.sessionType,
      table.status
    ),
    index('teaching_sessions_start_idx').on(table.startTime),
  ]
);

export const sessionEnrollments = pgTable(
  'session_enrollments',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .notNull()
      .references(() => teachingSessions.id, { onDelete: 'cascade' }),
    studentUserId: integer('student_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    notes: text('notes'),
    status: text('status').notNull().default('PENDING'), // PENDING | ACCEPTED | REJECTED | CANCELLED
    requestedAt: timestamp('requested_at').notNull().defaultNow(),
    respondedAt: timestamp('responded_at'),
    cancelledAt: timestamp('cancelled_at'),
    cancellationReason: text('cancellation_reason'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('session_enrollments_session_idx').on(table.sessionId),
    index('session_enrollments_student_idx').on(table.studentUserId),
    index('session_enrollments_status_idx').on(table.status),
  ]
);

export const teacherAvailability = pgTable(
  'teacher_availability',
  {
    id: serial('id').primaryKey(),
    teacherUserId: integer('teacher_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(), // 0 (Sun) .. 6 (Sat)
    startTime: text('start_time').notNull(), // HH:mm
    endTime: text('end_time').notNull(), // HH:mm
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('teacher_availability_teacher_idx').on(table.teacherUserId)]
);

// ============================================================================
// 8. FINANCIAL SYSTEM (PAYMENTS, COMMISSIONS & EARNINGS)
// ============================================================================

export const payments = pgTable(
  'payments',
  {
    id: serial('id').primaryKey(),
    payerUserId: integer('payer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    payeeUserId: integer('payee_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    entityType: text('entity_type').notNull(), // COURSE_ENROLLMENT | TASK_OFFER | BOOKING
    entityId: integer('entity_id').notNull(),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    commissionAmount: numeric('commission_amount', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    netAmount: numeric('net_amount', { precision: 10, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('USD'),
    paymentMode: text('payment_mode').notNull().default('SANDBOX_PENDING'), // SANDBOX_PENDING | GATEWAY_LIVE
    status: text('status').notNull().default('PENDING_SETUP'), // PENDING_SETUP | PENDING | HELD | RELEASED | REFUNDED | FAILED
    paymentReference: text('payment_reference').notNull().unique(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('payments_payer_idx').on(table.payerUserId),
    index('payments_payee_idx').on(table.payeeUserId),
  ]
);

export const earnings = pgTable(
  'earnings',
  {
    id: serial('id').primaryKey(),
    providerUserId: integer('provider_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    paymentId: integer('payment_id')
      .notNull()
      .unique()
      .references(() => payments.id, { onDelete: 'restrict' }),
    grossAmount: numeric('gross_amount', { precision: 10, scale: 2 }).notNull(),
    commissionAmount: numeric('commission_amount', {
      precision: 10,
      scale: 2,
    }).notNull(),
    netAmount: numeric('net_amount', { precision: 10, scale: 2 }).notNull(),
    status: text('status').notNull().default('PENDING'), // PENDING | AVAILABLE | WITHDRAWN
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('earnings_provider_idx').on(table.providerUserId)]
);

// ============================================================================
// 9. MESSAGING, NOTIFICATIONS, REVIEWS, REPORTS & VERIFICATIONS
// ============================================================================

export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  subject: text('subject').notNull(),
  taskId: integer('task_id').references(() => educationalTasks.id, {
    onDelete: 'set null',
  }),
  bookingId: integer('booking_id').references(() => bookings.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const conversationMembers = pgTable(
  'conversation_members',
  {
    id: serial('id').primaryKey(),
    conversationId: integer('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lastReadAt: timestamp('last_read_at'),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('conversation_members_uq').on(
      table.conversationId,
      table.userId
    ),
    index('conversation_members_user_idx').on(table.userId),
  ]
);

export const messages = pgTable(
  'messages',
  {
    id: serial('id').primaryKey(),
    conversationId: integer('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderUserId: integer('sender_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    body: text('body').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('messages_conversation_idx').on(table.conversationId)]
);

export const messageAttachments = pgTable(
  'message_attachments',
  {
    id: serial('id').primaryKey(),
    messageId: integer('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    fileUrl: text('file_url').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSize: integer('file_size').notNull().default(0),
  },
  (table) => [index('message_attachments_msg_idx').on(table.messageId)]
);

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // TASK_OFFER | OFFER_ACCEPTED | BOOKING | MESSAGE | SYSTEM
    title: text('title').notNull(),
    body: text('body').notNull(),
    linkUrl: text('link_url'),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('notifications_user_idx').on(table.userId)]
);

export const reviews = pgTable(
  'reviews',
  {
    id: serial('id').primaryKey(),
    authorUserId: integer('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    targetUserId: integer('target_user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    courseId: integer('course_id').references(() => courses.id, {
      onDelete: 'cascade',
    }),
    taskId: integer('task_id').references(() => educationalTasks.id, {
      onDelete: 'set null',
    }),
    rating: integer('rating').notNull(),
    comment: text('comment').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('reviews_target_user_idx').on(table.targetUserId),
    index('reviews_course_idx').on(table.courseId),
  ]
);

export const verifications = pgTable('verifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  centerId: integer('center_id').references(() => centers.id, {
    onDelete: 'cascade',
  }),
  entityType: text('entity_type').notNull(), // PROVIDER | CENTER
  documentTitle: text('document_title').notNull(),
  documentUrl: text('document_url'),
  status: text('status').notNull().default('PENDING'), // PENDING | APPROVED | REJECTED
  reviewedByUserId: integer('reviewed_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  reviewNotes: text('review_notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at'),
});

export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  reporterUserId: integer('reporter_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  targetType: text('target_type').notNull(), // COURSE | TASK | USER | REVIEW
  targetId: integer('target_id').notNull(),
  reason: text('reason').notNull(),
  details: text('details').notNull(),
  status: text('status').notNull().default('OPEN'), // OPEN | UNDER_REVIEW | RESOLVED | DISMISSED
  resolutionNote: text('resolution_note'),
  resolvedByUserId: integer('resolved_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at'),
});

// ============================================================================
// 10. AI LEARNING ROADMAPS & RECOMMENDATIONS (RELATIONALLY LINKED)
// ============================================================================

export const learningRoadmaps = pgTable(
  'learning_roadmaps',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    diagnosedGap: text('diagnosed_gap').notNull(),
    recommendedSolutionType: text('recommended_solution_type').notNull(), // MENTORSHIP | COURSE | TASK | CONSULTATION
    aiModelUsed: text('ai_model_used').notNull(),
    isAiGenerated: boolean('is_ai_generated').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('roadmaps_user_idx').on(table.userId)]
);

export const roadmapSteps = pgTable(
  'roadmap_steps',
  {
    id: serial('id').primaryKey(),
    roadmapId: integer('roadmap_id')
      .notNull()
      .references(() => learningRoadmaps.id, { onDelete: 'cascade' }),
    stepOrder: integer('step_order').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    actionType: text('action_type').notNull(), // COURSE | MENTORSHIP | TASK | PROJECT
    isCompleted: boolean('is_completed').notNull().default(false),
  },
  (table) => [index('roadmap_steps_roadmap_idx').on(table.roadmapId)]
);

export const aiRecommendations = pgTable(
  'ai_recommendations',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roadmapId: integer('roadmap_id').references(() => learningRoadmaps.id, {
      onDelete: 'cascade',
    }),
    targetType: text('target_type').notNull(), // COURSE | PROVIDER | TASK
    recommendedCourseId: integer('recommended_course_id').references(
      () => courses.id,
      { onDelete: 'set null' }
    ),
    recommendedProviderUserId: integer('recommended_provider_user_id').references(
      () => users.id,
      { onDelete: 'set null' }
    ),
    rationale: text('rationale').notNull(),
    isConfiguredRealAi: boolean('is_configured_real_ai').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('ai_recommendations_user_idx').on(table.userId)]
);

export const platformSettings = pgTable('platform_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ one, many }) => ({
  userRoles: many(userRoles),
  studentProfile: one(studentProfiles, {
    fields: [users.id],
    references: [studentProfiles.userId],
  }),
  providerProfile: one(providerProfiles, {
    fields: [users.id],
    references: [providerProfiles.userId],
  }),
  courses: many(courses),
  enrollments: many(enrollments),
  tasks: many(educationalTasks),
  offers: many(taskOffers),
  notifications: many(notifications),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  instructor: one(users, {
    fields: [courses.instructorUserId],
    references: [users.id],
  }),
  center: one(centers, {
    fields: [courses.centerId],
    references: [centers.id],
  }),
  field: one(fields, {
    fields: [courses.fieldId],
    references: [fields.id],
  }),
  lessons: many(courseLessons),
  enrollments: many(enrollments),
  quizzes: many(quizzes),
}));

export const educationalTasksRelations = relations(
  educationalTasks,
  ({ one, many }) => ({
    student: one(users, {
      fields: [educationalTasks.studentUserId],
      references: [users.id],
    }),
    category: one(taskCategories, {
      fields: [educationalTasks.categoryId],
      references: [taskCategories.id],
    }),
    field: one(fields, {
      fields: [educationalTasks.fieldId],
      references: [fields.id],
    }),
    offers: many(taskOffers),
    deliverables: many(taskDeliverables),
    history: many(taskStatusHistory),
  })
);

export const teachingSessionsRelations = relations(
  teachingSessions,
  ({ one, many }) => ({
    teacher: one(users, {
      fields: [teachingSessions.teacherUserId],
      references: [users.id],
    }),
    subject: one(subjects, {
      fields: [teachingSessions.subjectId],
      references: [subjects.id],
    }),
    curriculumSubject: one(curriculumSubjects, {
      fields: [teachingSessions.curriculumSubjectId],
      references: [curriculumSubjects.id],
    }),
    system: one(educationalSystems, {
      fields: [teachingSessions.systemId],
      references: [educationalSystems.id],
    }),
    grade: one(educationalGrades, {
      fields: [teachingSessions.gradeId],
      references: [educationalGrades.id],
    }),
    stage: one(educationalStages, {
      fields: [teachingSessions.stageId],
      references: [educationalStages.id],
    }),
    division: one(secondaryDivisions, {
      fields: [teachingSessions.divisionId],
      references: [secondaryDivisions.id],
    }),
    pathway: one(baccalaureatePathways, {
      fields: [teachingSessions.pathwayId],
      references: [baccalaureatePathways.id],
    }),
    enrollments: many(sessionEnrollments),
  })
);

export const sessionEnrollmentsRelations = relations(
  sessionEnrollments,
  ({ one }) => ({
    session: one(teachingSessions, {
      fields: [sessionEnrollments.sessionId],
      references: [teachingSessions.id],
    }),
    student: one(users, {
      fields: [sessionEnrollments.studentUserId],
      references: [users.id],
    }),
  })
);

export const curriculumSubjectsRelations = relations(
  curriculumSubjects,
  ({ one, many }) => ({
    curriculumVersion: one(curriculumVersions, {
      fields: [curriculumSubjects.curriculumVersionId],
      references: [curriculumVersions.id],
    }),
    academicYear: one(academicYears, {
      fields: [curriculumSubjects.academicYearId],
      references: [academicYears.id],
    }),
    stage: one(educationalStages, {
      fields: [curriculumSubjects.stageId],
      references: [educationalStages.id],
    }),
    system: one(educationalSystems, {
      fields: [curriculumSubjects.systemId],
      references: [educationalSystems.id],
    }),
    grade: one(educationalGrades, {
      fields: [curriculumSubjects.gradeId],
      references: [educationalGrades.id],
    }),
    division: one(secondaryDivisions, {
      fields: [curriculumSubjects.divisionId],
      references: [secondaryDivisions.id],
    }),
    pathway: one(baccalaureatePathways, {
      fields: [curriculumSubjects.pathwayId],
      references: [baccalaureatePathways.id],
    }),
    subject: one(subjects, {
      fields: [curriculumSubjects.subjectId],
      references: [subjects.id],
    }),
    teacherAssignments: many(teacherTeachingAssignments),
  })
);

export const teacherTeachingAssignmentsRelations = relations(
  teacherTeachingAssignments,
  ({ one }) => ({
    teacher: one(users, {
      fields: [teacherTeachingAssignments.teacherUserId],
      references: [users.id],
    }),
    curriculumSubject: one(curriculumSubjects, {
      fields: [teacherTeachingAssignments.curriculumSubjectId],
      references: [curriculumSubjects.id],
    }),
    subject: one(subjects, {
      fields: [teacherTeachingAssignments.subjectId],
      references: [subjects.id],
    }),
    grade: one(educationalGrades, {
      fields: [teacherTeachingAssignments.gradeId],
      references: [educationalGrades.id],
    }),
  })
);

