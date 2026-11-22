import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  roles,
  users,
  userRoles,
  educationalStages,
  fields,
  subjects,
  skills,
  studentProfiles,
  providerProfiles,
  centers,
  centerMembers,
  userSkills,
  portfolios,
  cvs,
  skillPassports,
  certificates,
  verifications,
  reports,
  courses,
  courseLessons,
  enrollments,
  progress,
  lessonProgress,
  studyGroups,
  groupMembers,
  taskCategories,
  educationalTasks,
  taskOffers,
  taskStatusHistory,
  availability,
  bookings,
  sessions,
  payments,
  earnings,
  reviews,
  quizzes,
  questions,
  quizAnswers,
  assignments,
  conversations,
  conversationMembers,
  messages,
  notifications,
  platformSettings,
  teachingSessions,
  sessionEnrollments,
  teacherAvailability,
} from '../db/schema.ts';
import { ensureEgyptianCurriculumSeeded } from './curriculumSeed.ts';

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = runSeed().catch((err) => {
    seedPromise = null;
    throw err;
  });
  return seedPromise;
}

async function runSeed(): Promise<void> {
  const existingRoles = await db.select().from(roles).limit(1);
  if (existingRoles.length > 0) {
    await ensureLessonSessionsSeeded();
    await ensureEgyptianCurriculumSeeded();
    return;
  }

  // 1. Roles
  const roleSeeds = [
    { code: 'STUDENT', nameAr: 'طالب / متعلّم', nameEn: 'Student / Learner', description: 'تصفح الدورات ونشر المهام التعليمية وحجز الجلسات' },
    { code: 'TEACHER', nameAr: 'معلّم / مدرّب', nameEn: 'Teacher / Instructor', description: 'إنشاء الدورات وتقديم العروض على المهام التعليمية' },
    { code: 'MENTOR', nameAr: 'مرشد مهني', nameEn: 'Mentor', description: 'تقديم جلسات الإرشاد العملي ومرافقة المتعلّمين' },
    { code: 'EXPERT', nameAr: 'خبير / مستشار', nameEn: 'Expert / Consultant', description: 'تقديم الاستشارات التقنية والأكاديمية المتخصصة' },
    { code: 'CENTER_OWNER', nameAr: 'مالك مركز تعليمي', nameEn: 'Educational Center Owner', description: 'إدارة المركز التعليمي والمدربين والدورات' },
    { code: 'CENTER_STAFF', nameAr: 'موظف مركز تعليمي', nameEn: 'Center Staff', description: 'صلاحيات تشغيلية محددة داخل المركز التعليمي' },
    { code: 'ADMIN', nameAr: 'مدير المنصة', nameEn: 'Platform Administrator', description: 'الإشراف العام وإدارة التصنيفات والتوثيق والمدفوعات' },
  ];
  const insertedRoles = await db.insert(roles).values(roleSeeds).returning();
  const roleMap = new Map(insertedRoles.map((r) => [r.code, r.id]));

  // 2. Educational Stages
  const stageSeeds = [
    { slug: 'primary', nameAr: 'المرحلة الابتدائية', nameEn: 'Primary School', sortOrder: 1 },
    { slug: 'preparatory', nameAr: 'المرحلة الإعدادية / المتوسطة', nameEn: 'Preparatory School', sortOrder: 2 },
    { slug: 'secondary', nameAr: 'المرحلة الثانوية', nameEn: 'Secondary School', sortOrder: 3 },
    { slug: 'university', nameAr: 'طلاب الجامعات', nameEn: 'University Students', sortOrder: 4 },
    { slug: 'graduates', nameAr: 'خريجو الجامعات', nameEn: 'University Graduates', sortOrder: 5 },
    { slug: 'professionals', nameAr: 'المهنيون والعاملون', nameEn: 'Professionals', sortOrder: 6 },
    { slug: 'lifelong', nameAr: 'التعلّم مدى الحياة', nameEn: 'Lifelong Learners', sortOrder: 7 },
  ];
  const insertedStages = await db.insert(educationalStages).values(stageSeeds).returning();
  const stageMap = new Map(insertedStages.map((s) => [s.slug, s.id]));

  // 3. Fields (14+ core fields)
  const fieldSeeds = [
    { slug: 'programming', nameAr: 'البرمجة', nameEn: 'Programming', descriptionAr: 'أساسيات البرمجة وهياكل البيانات والخوارزميات', iconName: 'Code2' },
    { slug: 'web-development', nameAr: 'تطوير الويب', nameEn: 'Web Development', descriptionAr: 'تطوير الواجهات الأمامية والخلفية والتطبيقات المتكاملة', iconName: 'Globe' },
    { slug: 'artificial-intelligence', nameAr: 'الذكاء الاصطناعي', nameEn: 'Artificial Intelligence', descriptionAr: 'تعلّم الآلة والنماذج اللغوية والرؤية الحاسوبية', iconName: 'Cpu' },
    { slug: 'cybersecurity', nameAr: 'الأمن السيبراني', nameEn: 'Cybersecurity', descriptionAr: 'حماية الشبكات واختبار الاختراق والأمن السحابي', iconName: 'ShieldCheck' },
    { slug: 'data-science', nameAr: 'علوم البيانات', nameEn: 'Data Science', descriptionAr: 'تحليل البيانات والإحصاء وقواعد البيانات', iconName: 'BarChart3' },
    { slug: 'software-engineering', nameAr: 'هندسة البرمجيات', nameEn: 'Software Engineering', descriptionAr: 'المعمارية والاختبارات وإدارة جودة الأنظمة', iconName: 'Layers' },
    { slug: 'ui-ux-design', nameAr: 'تصميم واجهات وتجربة المستخدم', nameEn: 'UI/UX Design', descriptionAr: 'أبحاث المستخدم والنماذج الأولية وأنظمة التصميم', iconName: 'PenTool' },
    { slug: 'graphic-design', nameAr: 'التصميم الجرافيكي', nameEn: 'Graphic Design', descriptionAr: 'الهوية البصرية والخطوط والتصميم الإعلاني', iconName: 'Palette' },
    { slug: 'business', nameAr: 'إدارة الأعمال', nameEn: 'Business', descriptionAr: 'ريادة الأعمال واستراتيجيات النمو والتشغيل', iconName: 'Briefcase' },
    { slug: 'accounting', nameAr: 'المحاسبة والمالية', nameEn: 'Accounting', descriptionAr: 'المحاسبة المالية والتحليل المالي والتدقيق', iconName: 'Calculator' },
    { slug: 'marketing', nameAr: 'التسويق الرقمي', nameEn: 'Marketing', descriptionAr: 'استراتيجيات النمو والمحتوى وتحسين محركات البحث', iconName: 'Megaphone' },
    { slug: 'languages', nameAr: 'اللغات', nameEn: 'Languages', descriptionAr: 'اللغة الإنجليزية والعربية ولغات الأعمال', iconName: 'Languages' },
    { slug: 'digital-skills', nameAr: 'المهارات الرقمية', nameEn: 'Digital Skills', descriptionAr: 'الإنتاجية السحابية وتحليل الجداول والأدوات المكتبية', iconName: 'Laptop' },
    { slug: 'soft-skills', nameAr: 'المهارات الشخصية والقيادية', nameEn: 'Soft Skills', descriptionAr: 'التواصل الفعّال والعمل الجماعي وحل المشكلات', iconName: 'Users' },
  ];
  const insertedFields = await db.insert(fields).values(fieldSeeds).returning();
  const fieldMap = new Map(insertedFields.map((f) => [f.slug, f.id]));

  // 4. Subjects & Skills
  const subjectSeeds = [
    { fieldId: fieldMap.get('web-development')!, stageId: stageMap.get('university')!, slug: 'react-ts', nameAr: 'React و TypeScript', nameEn: 'React & TypeScript' },
    { fieldId: fieldMap.get('data-science')!, stageId: stageMap.get('university')!, slug: 'database-normalization', nameAr: 'تصميم وتطبيع قواعد البيانات', nameEn: 'Database Normalization & SQL' },
    { fieldId: fieldMap.get('programming')!, stageId: stageMap.get('secondary')!, slug: 'python-basics', nameAr: 'مقدمة في بايثون والخوارزميات', nameEn: 'Python & Algorithms' },
    { fieldId: fieldMap.get('ui-ux-design')!, stageId: stageMap.get('graduates')!, slug: 'design-systems', nameAr: 'أنظمة التصميم وتجربة المستخدم', nameEn: 'Design Systems & UX' },
    { fieldId: fieldMap.get('artificial-intelligence')!, stageId: stageMap.get('professionals')!, slug: 'applied-llm', nameAr: 'تطبيقات الذكاء الاصطناعي العملية', nameEn: 'Applied AI Engineering' },
    { fieldId: fieldMap.get('languages')!, stageId: stageMap.get('university')!, slug: 'business-english', nameAr: 'الإنجليزية المهنية والتقنية', nameEn: 'Technical & Business English' },
  ];
  const insertedSubjects = await db.insert(subjects).values(subjectSeeds).returning();
  const subjectMap = new Map(insertedSubjects.map((s) => [s.slug, s.id]));

  const skillSeeds = [
    { fieldId: fieldMap.get('web-development')!, slug: 'html-css', nameAr: 'HTML & CSS', nameEn: 'HTML & CSS' },
    { fieldId: fieldMap.get('web-development')!, slug: 'javascript-ts', nameAr: 'JavaScript / TypeScript', nameEn: 'JavaScript / TypeScript' },
    { fieldId: fieldMap.get('web-development')!, slug: 'react-frontend', nameAr: 'تطوير واجهات React', nameEn: 'React Frontend' },
    { fieldId: fieldMap.get('data-science')!, slug: 'sql-modeling', nameAr: 'نمذجة قواعد البيانات SQL', nameEn: 'SQL Modeling' },
    { fieldId: fieldMap.get('ui-ux-design')!, slug: 'figma-prototyping', nameAr: 'تصميم Figma والنماذج', nameEn: 'Figma Prototyping' },
    { fieldId: fieldMap.get('software-engineering')!, slug: 'git-ci', nameAr: 'إدارة الكود والعمل الجماعي Git', nameEn: 'Git & Team Workflows' },
  ];
  const insertedSkills = await db.insert(skills).values(skillSeeds).returning();

  // 5. Task Categories
  const categorySeeds = [
    { slug: 'concept-explanation', nameAr: 'شرح مادة أو مفهوم صعب', nameEn: 'Concept Explanation', descriptionAr: 'تبسيط موضوع دراسي أو برمجي مع أمثلة تطبيقية' },
    { slug: 'assignment-guidance', nameAr: 'إرشاد حول واجب أو مشروع جامعي', nameEn: 'University Assignment Guidance', descriptionAr: 'توجيه علمي لفهم المتطلبات وبناء الحل خطوة بخطوة' },
    { slug: 'practical-project', nameAr: 'بناء مشروع عملي حقيقي', nameEn: 'Practical Project Mentoring', descriptionAr: 'مرافقة تطبيقية لبناء مشروع جاهز لسوق العمل' },
    { slug: 'code-review', nameAr: 'مراجعة كود أو معمارية برمجية', nameEn: 'Code & Architecture Review', descriptionAr: 'تقييم وتحسين الجودة البرمجية والأداء' },
  ];
  const insertedCategories = await db.insert(taskCategories).values(categorySeeds).returning();
  const catMap = new Map(insertedCategories.map((c) => [c.slug, c.id]));

  // 6. Demo Users across all roles (clearly tagged isDemo = true)
  const demoUsersData = [
    { email: 'sara.student@demo.jusoor.edu', fullName: 'سارة المنصور', roleCodes: ['STUDENT'], isDemo: true },
    { email: 'tariq.teacher@demo.jusoor.edu', fullName: 'م. طارق الخطيب', roleCodes: ['TEACHER', 'MENTOR'], isDemo: true },
    { email: 'layla.mentor@demo.jusoor.edu', fullName: 'د. ليلى الحسن', roleCodes: ['MENTOR', 'EXPERT'], isDemo: true },
    { email: 'omar.expert@demo.jusoor.edu', fullName: 'م. عمر الشريف', roleCodes: ['EXPERT', 'TEACHER'], isDemo: true },
    { email: 'center.owner@demo.jusoor.edu', fullName: 'أ. خالد العتيبي', roleCodes: ['CENTER_OWNER'], isDemo: true },
    { email: 'center.staff@demo.jusoor.edu', fullName: 'نورة القحطاني', roleCodes: ['CENTER_STAFF'], isDemo: true },
    { email: 'admin@demo.jusoor.edu', fullName: 'إدارة منصة جسور', roleCodes: ['ADMIN'], isDemo: true },
  ];

  const userByEmail = new Map<string, number>();
  for (const u of demoUsersData) {
    const [inserted] = await db
      .insert(users)
      .values({
        email: u.email,
        fullName: u.fullName,
        emailVerified: true,
        accountStatus: 'ACTIVE',
        isDemo: u.isDemo,
      })
      .returning();
    userByEmail.set(u.email, inserted.id);

    for (const code of u.roleCodes) {
      const rId = roleMap.get(code);
      if (rId) {
        await db.insert(userRoles).values({ userId: inserted.id, roleId: rId });
      }
    }
  }

  const studentId = userByEmail.get('sara.student@demo.jusoor.edu')!;
  const teacherId = userByEmail.get('tariq.teacher@demo.jusoor.edu')!;
  const mentorId = userByEmail.get('layla.mentor@demo.jusoor.edu')!;
  const expertId = userByEmail.get('omar.expert@demo.jusoor.edu')!;
  const centerOwnerId = userByEmail.get('center.owner@demo.jusoor.edu')!;
  const centerStaffId = userByEmail.get('center.staff@demo.jusoor.edu')!;
  const adminId = userByEmail.get('admin@demo.jusoor.edu')!;

  // 7. Profiles
  await db.insert(studentProfiles).values({
    userId: studentId,
    stageId: stageMap.get('university')!,
    learningGoal: 'الانتقال من معرفة أساسيات الويب إلى بناء مشاريع شركات حقيقية في React و TypeScript',
    bio: 'طالبة هندسة برمجيات في السنة الثالثة، مهتمة بتطوير الويب وتصميم قواعد البيانات.',
    careerInterest: 'مهندسة واجهات أمامية (Frontend Engineer)',
  });

  await db.insert(providerProfiles).values([
    {
      userId: teacherId,
      providerType: 'TEACHER',
      headline: 'مهندس برمجيات أول ومعلّم React و Node.js',
      bio: 'خبرة 8 سنوات في بناء منصات الويب وتدريب أكثر من 400 متعلّم على مشاريع إنتاجية حقيقية.',
      qualifications: 'ماجستير هندسة البرمجيات — مدرّب معتمد',
      yearsExperience: 8,
      hourlyRate: '35.00',
      verificationStatus: 'VERIFIED',
      ratingAvg: '4.90',
      reviewsCount: 24,
    },
    {
      userId: mentorId,
      providerType: 'MENTOR',
      headline: 'مرشدة مهنية في مشاريع الويب وتأهيل المطورين لسوق العمل',
      bio: 'أساعد المتعلّمين الذين يعرفون الأساسيات على كسر حاجز التطبيق العملي والعمل ضمن فرق هندسية.',
      qualifications: 'دكتوراه في نظم المعلومات — قائدة فرق تقنية سابقاً',
      yearsExperience: 10,
      hourlyRate: '45.00',
      verificationStatus: 'VERIFIED',
      ratingAvg: '4.95',
      reviewsCount: 31,
    },
    {
      userId: expertId,
      providerType: 'EXPERT',
      headline: 'خبير قواعد بيانات ومعمارية الأنظمة السحابية',
      bio: 'استشارات متقدمة في تصميم قواعد البيانات، الأداء، والأمن السيبراني للشركات الناشئة والطلاب.',
      qualifications: 'مهندس معماري سحابي معتمد',
      yearsExperience: 12,
      hourlyRate: '60.00',
      verificationStatus: 'VERIFIED',
      ratingAvg: '4.85',
      reviewsCount: 18,
    },
  ]);

  // 8. Educational Center + Staff
  const [center] = await db
    .insert(centers)
    .values({
      ownerUserId: centerOwnerId,
      name: 'أكاديمية الأفق للتقنية والمهارات الرقمية',
      slug: 'horizon-tech-academy',
      description: 'مركز تعليمي متخصص في المعسكرات التطبيقية وهندسة البرمجيات والذكاء الاصطناعي وربط الخريجين بسوق العمل.',
      city: 'الرياض',
      country: 'المملكة العربية السعودية',
      website: 'https://horizon-academy.example.edu',
      bannerUrl: '/src/assets/images/center_academy_hub_1795328020183.jpg',
      verificationStatus: 'VERIFIED',
    })
    .returning();

  await db.insert(centerMembers).values([
    {
      centerId: center.id,
      userId: centerOwnerId,
      memberRole: 'OWNER',
      jobTitle: 'مدير الأكاديمية والمؤسس',
      permissionsJson: ['MANAGE_CENTER', 'MANAGE_STAFF', 'MANAGE_COURSES', 'VIEW_REPORTS'],
    },
    {
      centerId: center.id,
      userId: teacherId,
      memberRole: 'INSTRUCTOR',
      jobTitle: 'مدرّس تطوير الويب و React',
      permissionsJson: ['MANAGE_COURSES'],
    },
    {
      centerId: center.id,
      userId: centerStaffId,
      memberRole: 'STAFF',
      jobTitle: 'منسّقة شؤون الطلاب والتسجيل',
      permissionsJson: ['VIEW_ENROLLMENTS', 'MANAGE_COURSES'],
    },
  ]);

  // 9. Professional Dev (Skills, CV, Portfolio, Skill Passport)
  await db.insert(userSkills).values([
    { userId: studentId, skillId: insertedSkills[0].id, proficiencyLevel: 'ADVANCED', verifiedByPassport: true },
    { userId: studentId, skillId: insertedSkills[1].id, proficiencyLevel: 'INTERMEDIATE', verifiedByPassport: true },
    { userId: studentId, skillId: insertedSkills[3].id, proficiencyLevel: 'BEGINNER', verifiedByPassport: false },
  ]);

  await db.insert(cvs).values({
    userId: studentId,
    headline: 'مطوّرة واجهات أمامية متدرّبة | طالبة هندسة برمجيات',
    summary: 'أسعى للانتقال من التطبيقات التعليمية الصغيرة إلى بناء منتجات ويب متكاملة بمعايير هندسية احترافية.',
    educationJson: [{ institution: 'جامعة الملك سعود', degree: 'بكالوريوس هندسة البرمجيات', year: '2023 - حتى الآن' }],
    experienceJson: [{ role: 'متدرّبة تطوير واجهات', organization: 'مبادرة بناة الويب', period: 'صيف 2025', highlights: 'تطوير صفحات متجاوبة وربط واجهات REST API' }],
    languagesJson: ['العربية (اللغة الأم)', 'الإنجليزية (متقدم)'],
  });

  await db.insert(portfolios).values({
    userId: studentId,
    title: 'منصة إدارة المهام الجامعية المتجاوبة',
    description: 'تطبيق ويب لإدارة الجداول الدراسية والمشاريع الجماعية باستخدام HTML و CSS و JavaScript.',
    projectUrl: 'https://github.com/demo-sara/uni-tasks',
    imageUrl: '/src/assets/images/course_web_engineering_1795328020586.jpg',
    skillsSummary: 'HTML5 · CSS3 · JavaScript · REST APIs',
    completedAt: '2026-02',
  });

  await db.insert(skillPassports).values({
    userId: studentId,
    passportCode: 'JSR-PASS-2026-001',
    verifiedSkillsCount: 2,
    completedTasksCount: 1,
    completedCoursesCount: 1,
  });

  // 10. Courses, Lessons, Quizzes, Assignments, Enrollments & Progress
  const [course1, course2, course3] = await db
    .insert(courses)
    .values([
      {
        instructorUserId: teacherId,
        centerId: center.id,
        fieldId: fieldMap.get('web-development')!,
        subjectId: subjectMap.get('react-ts')!,
        stageId: stageMap.get('graduates')!,
        title: 'هندسة تطبيقات React و TypeScript لمشاريع الشركات',
        slug: 'react-typescript-production',
        subtitle: 'انتقل من الأساسيات النظرية إلى بناء تطبيقات حقيقية قابلة للصيانة والاختبار',
        description: 'دورة عملية مكثفة تغطي معمارية المكونات، إدارة الحالة، الربط مع واجهات برمجة التطبيقات، وأفضل ممارسات كتابة TypeScript في بيئات العمل.',
        level: 'INTERMEDIATE',
        price: '79.00',
        thumbnailUrl: '/src/assets/images/course_web_engineering_1795328020586.jpg',
        status: 'PUBLISHED',
        isDemo: true,
      },
      {
        instructorUserId: expertId,
        centerId: center.id,
        fieldId: fieldMap.get('data-science')!,
        subjectId: subjectMap.get('database-normalization')!,
        stageId: stageMap.get('university')!,
        title: 'تصميم قواعد البيانات العلائقية والتطبيع (1NF إلى BCNF)',
        slug: 'relational-database-mastery',
        subtitle: 'مفاتيح الربط، الفهارس، المعاملات، وتصميم مخططات ERD خالية من التكرار',
        description: 'شرح عملي عميق لتصميم قواعد البيانات العلائقية، حل مشكلات الأداء، وكتابة استعلامات SQL الاحترافية.',
        level: 'BEGINNER',
        price: '49.00',
        thumbnailUrl: '/src/assets/images/course_ai_data_1795328019851.jpg',
        status: 'PUBLISHED',
        isDemo: true,
      },
      {
        instructorUserId: mentorId,
        centerId: null,
        fieldId: fieldMap.get('ui-ux-design')!,
        subjectId: subjectMap.get('design-systems')!,
        stageId: stageMap.get('professionals')!,
        title: 'تصميم واجهات المنتجات الرقمية العربية وتجربة RTL',
        slug: 'arabic-rtl-design-systems',
        subtitle: 'بناء أنظمة تصميم متوازنة تدعم العربية والإنجليزية بدقة بصرية عالية',
        description: 'دليل شامل لبناء واجهات SaaS احترافية، اختيار الخطوط العربية، وتطبيق معايير الوصولية والتباين.',
        level: 'INTERMEDIATE',
        price: '0.00',
        thumbnailUrl: '/src/assets/images/course_uiux_design_1795328020176.jpg',
        status: 'PUBLISHED',
        isDemo: true,
      },
    ])
    .returning();

  const [l1, l2, l3] = await db
    .insert(courseLessons)
    .values([
      {
        courseId: course1.id,
        title: '01. الفارق بين المشاريع التعليمية ومشاريع الشركات الحقيقية',
        content: 'تحليل هيكلة المجلدات، فصل طبقة البيانات عن طبقة العرض، وإدارة الأخطاء بشكل موثوق.',
        durationMinutes: 22,
        sortOrder: 1,
        isFreePreview: true,
      },
      {
        courseId: course1.id,
        title: '02. تصميم الأنواع الصارمة (TypeScript Contracts) والواجهات',
        content: 'استخدام TypeScript لحماية تدفق البيانات بين الخادم والواجهة وتقليل الأخطاء أثناء التشغيل.',
        durationMinutes: 28,
        sortOrder: 2,
        isFreePreview: false,
      },
      {
        courseId: course1.id,
        title: '03. التكامل مع APIs ومعالجة حالات التحميل والفشل',
        content: 'أنماط جلب البيانات، التحقق من المدخلات، وتجربة المستخدم في الشبكات البطيئة.',
        durationMinutes: 35,
        sortOrder: 3,
        isFreePreview: false,
      },
    ])
    .returning();

  await db.insert(courseLessons).values([
    {
      courseId: course2.id,
      title: '01. المفاهيم الأساسية للجداول والمفاتيح الأولية والأجنبية',
      content: 'فهم الكيانات والعلاقات 1:1 و 1:N و M:N وكيفية تمثيلها في مخطط ERD.',
      durationMinutes: 25,
      sortOrder: 1,
      isFreePreview: true,
    },
    {
      courseId: course2.id,
      title: '02. قواعد التطبيع الثلاث الأولى مع أمثلة عملية',
      content: 'إزالة التكرار وضمان سلامة البيانات عبر التطبيع التدريجي.',
      durationMinutes: 30,
      sortOrder: 2,
      isFreePreview: false,
    },
    {
      courseId: course3.id,
      title: '01. مبادئ القراءة من اليمين لليسار وتوازن الشبكات',
      content: 'كيف نصمم واجهات عربية مريحة بصرياً دون ترجمة حرفية مكسورة.',
      durationMinutes: 20,
      sortOrder: 1,
      isFreePreview: true,
    },
  ]);

  // Quiz & Assignment for Course 1
  const [quiz1] = await db
    .insert(quizzes)
    .values({
      courseId: course1.id,
      title: 'اختبار جاهزية معمارية React',
      description: 'اختبار سريع لقياس فهمك لهيكلة المشاريع الإنتاجية.',
      passingScore: 70,
    })
    .returning();

  const [q1, q2] = await db
    .insert(questions)
    .values([
      { quizId: quiz1.id, questionText: 'ما الهدف الأساسي من فصل منطق الأعمال النقي عن مكونات React؟', points: 50, sortOrder: 1 },
      { quizId: quiz1.id, questionText: 'أين يجب تنفيذ التحقق من الصلاحيات وحساب الأسعار في التطبيقات الإنتاجية؟', points: 50, sortOrder: 2 },
    ])
    .returning();

  await db.insert(quizAnswers).values([
    { questionId: q1.id, answerText: 'تسهيل الاختبار السريع ومنع تشابك الواجهة مع القواعد التجارية', isCorrect: true },
    { questionId: q1.id, answerText: 'زيادة عدد الملفات فقط دون فائدة عملية', isCorrect: false },
    { questionId: q2.id, answerText: 'في الواجهة الأمامية فقط لتخفيف الضغط', isCorrect: false },
    { questionId: q2.id, answerText: 'في الخادم (Backend) مع التحقق من قاعدة البيانات', isCorrect: true },
  ]);

  await db.insert(assignments).values({
    courseId: course1.id,
    title: 'مشروع تطبيقي: تقسيم وحدة إدارة المهام إلى طبقات نظيفة',
    instructions: 'قدّم ملخصاً لهيكلة الملفات والواجهات البرمجية لميزة إدارة المهام مع توضيح معالجة الأخطاء.',
    maxScore: 100,
    dueDate: '2026-12-15',
  });

  // Enrollment + Progress for demo student in Course 1 & Course 3
  const [enr1] = await db
    .insert(enrollments)
    .values({ courseId: course1.id, studentUserId: studentId, status: 'ACTIVE' })
    .returning();
  await db.insert(progress).values({
    enrollmentId: enr1.id,
    completedLessonsCount: 1,
    totalLessonsCount: 3,
    completionPercent: 33,
  });
  await db.insert(lessonProgress).values({
    enrollmentId: enr1.id,
    lessonId: l1.id,
    isCompleted: true,
    completedAt: new Date(),
  });

  const [enr3] = await db
    .insert(enrollments)
    .values({ courseId: course3.id, studentUserId: studentId, status: 'COMPLETED', completedAt: new Date() })
    .returning();
  await db.insert(progress).values({
    enrollmentId: enr3.id,
    completedLessonsCount: 1,
    totalLessonsCount: 1,
    completionPercent: 100,
  });

  await db.insert(certificates).values({
    userId: studentId,
    courseId: course3.id,
    title: 'شهادة إتمام: تصميم واجهات المنتجات الرقمية العربية وتجربة RTL',
    issuerName: 'منصة جسور | JUSOOR',
    credentialCode: 'JSR-CERT-2026-8841',
  });

  // Study Group
  const [sg] = await db
    .insert(studyGroups)
    .values({
      courseId: course1.id,
      fieldId: fieldMap.get('web-development')!,
      creatorUserId: studentId,
      name: 'مجموعة تطبيق React لمشاريع سوق العمل',
      description: 'مجموعة نقاش وتطبيق أسبوعي لمراجعة الكود وبناء مشاريع حقيقية معاً.',
      maxMembers: 20,
    })
    .returning();
  await db.insert(groupMembers).values([
    { groupId: sg.id, userId: studentId, role: 'OWNER' },
    { groupId: sg.id, userId: teacherId, role: 'MENTOR' },
  ]);

  // 11. Educational Tasks & Offers (Core Marketplace)
  const [task1, task2, task3] = await db
    .insert(educationalTasks)
    .values([
      {
        studentUserId: studentId,
        categoryId: catMap.get('assignment-guidance')!,
        fieldId: fieldMap.get('data-science')!,
        subjectId: subjectMap.get('database-normalization')!,
        stageId: stageMap.get('university')!,
        title: 'أحتاج معلماً يشرح لي تطبيع قواعد البيانات (1NF, 2NF, 3NF) على مشروع الجامعة',
        description: 'لدي جدول طلبات ومبيعات متشابك في مشروع مادة قواعد البيانات، وأحتاج جلسة عملية لفهم كيفية تفكيكه إلى جداول مطبّعة دون أخطاء.',
        requiredSkills: 'SQL · ERD · Database Normalization',
        budget: '45.00',
        expectedDuration: 'جلستان (ساعتان إجمالاً)',
        preferredMethod: 'ONLINE',
        deadline: '2026-12-05',
        status: 'OFFERS_RECEIVED',
        isDemo: true,
      },
      {
        studentUserId: studentId,
        categoryId: catMap.get('practical-project')!,
        fieldId: fieldMap.get('web-development')!,
        subjectId: subjectMap.get('react-ts')!,
        stageId: stageMap.get('graduates')!,
        title: 'أعرف HTML و CSS و JavaScript لكن أريد بناء أول مشروع React بمعايير الشركات',
        description: 'أنهيت الأساسيات النظرية لكنني أتعثر عند بدء مشروع حقيقي. أريد مرشداً يراجع معي البنية والتكامل مع الـ API خطوة بخطوة.',
        requiredSkills: 'HTML · CSS · JavaScript · React',
        budget: '110.00',
        expectedDuration: 'أسبوعان (4 جلسات متابعة)',
        preferredMethod: 'ONLINE',
        deadline: '2026-12-18',
        status: 'OPEN',
        isDemo: true,
      },
      {
        studentUserId: studentId,
        categoryId: catMap.get('concept-explanation')!,
        fieldId: fieldMap.get('programming')!,
        subjectId: subjectMap.get('python-basics')!,
        stageId: stageMap.get('secondary')!,
        title: 'فهم الحلقات التكرارية والدوال في بايثون من الصفر',
        description: 'أواجه صعوبة في تتبع الدوال العودية والحلقات المتداخلة وأحتاج شرحاً مبسطاً مع تمارين عملية.',
        requiredSkills: 'Python',
        budget: '30.00',
        expectedDuration: 'ساعة ونصف',
        preferredMethod: 'ONLINE',
        deadline: '2026-11-30',
        status: 'COMPLETED',
        isDemo: true,
      },
    ])
    .returning();

  const [offer1, offer2] = await db
    .insert(taskOffers)
    .values([
      {
        taskId: task1.id,
        teacherUserId: expertId,
        proposal: 'سأشرح لك التطبيع عملياً على مخطط مشروعك الجامعي خطوة بخطوة مع تحويله إلى SQL جاهز والتأكد من عدم وجود تكرار.',
        proposedPrice: '40.00',
        expectedDuration: 'جلستان × 60 دقيقة',
        deliveryMethod: 'ONLINE',
        additionalNotes: 'يشمل ملف تلخيص ومخطط ERD مصحح',
        status: 'PENDING',
      },
      {
        taskId: task1.id,
        teacherUserId: teacherId,
        proposal: 'نراجع معاً الجداول الحالية ونطبق قواعد 1NF و 2NF و 3NF بمثال حي على PostgreSQL مع اختبار الاستعلامات.',
        proposedPrice: '45.00',
        expectedDuration: 'ساعتان في جلسة مركزة أو جلستين',
        deliveryMethod: 'ONLINE',
        additionalNotes: 'متاح غداً ومساء اليوم',
        status: 'PENDING',
      },
    ])
    .returning();

  await db.insert(taskStatusHistory).values([
    { taskId: task1.id, changedByUserId: studentId, fromStatus: 'DRAFT', toStatus: 'OPEN', note: 'تم نشر المهمة التعليمية' },
    { taskId: task1.id, offerId: offer1.id, changedByUserId: expertId, fromStatus: 'OPEN', toStatus: 'OFFERS_RECEIVED', note: 'تقديم عرض من م. عمر الشريف' },
    { taskId: task1.id, offerId: offer2.id, changedByUserId: teacherId, fromStatus: 'OFFERS_RECEIVED', toStatus: 'OFFERS_RECEIVED', note: 'تقديم عرض من م. طارق الخطيب' },
    { taskId: task2.id, changedByUserId: studentId, fromStatus: 'DRAFT', toStatus: 'OPEN', note: 'تم نشر المهمة التعليمية' },
    { taskId: task3.id, changedByUserId: studentId, fromStatus: 'DELIVERED', toStatus: 'COMPLETED', note: 'تم تأكيد الإتمام بنجاح' },
  ]);

  // 12. Availability & Bookings
  const [slot1, slot2, slot3] = await db
    .insert(availability)
    .values([
      { providerUserId: mentorId, dayOfWeek: 'الإثنين', slotDate: '2026-11-24', startTime: '18:00', endTime: '19:00', serviceType: 'MENTORSHIP', isBooked: true },
      { providerUserId: mentorId, dayOfWeek: 'الأربعاء', slotDate: '2026-11-26', startTime: '19:00', endTime: '20:00', serviceType: 'MENTORSHIP', isBooked: false },
      { providerUserId: expertId, dayOfWeek: 'الخميس', slotDate: '2026-11-27', startTime: '20:00', endTime: '21:00', serviceType: 'CONSULTATION', isBooked: false },
      { providerUserId: teacherId, dayOfWeek: 'السبت', slotDate: '2026-11-29', startTime: '17:00', endTime: '18:00', serviceType: 'PRIVATE_LESSON', isBooked: false },
    ])
    .returning();

  const [booking1] = await db
    .insert(bookings)
    .values({
      studentUserId: studentId,
      providerUserId: mentorId,
      availabilityId: slot1.id,
      serviceType: 'MENTORSHIP',
      topic: 'خطة الانتقال لبناء أول مشروع React بمستوى شركات التقنية',
      notes: 'مراجعة الكود الحالي وتحديد خطة العمل للأسبوع القادم.',
      scheduledStart: '2026-11-24 18:00',
      scheduledEnd: '2026-11-24 19:00',
      price: '45.00',
      status: 'CONFIRMED',
      isDemo: true,
    })
    .returning();

  await db.insert(sessions).values({
    bookingId: booking1.id,
    meetingLink: 'https://meet.jusoor.example/session-101',
    sessionNotes: 'جلسة تقييم أولية وبداية المشروع التطبيقي',
    status: 'SCHEDULED',
  });

  // 13. Financial Records (Clearly labeled Sandbox/Pending Mode)
  const [pay1] = await db
    .insert(payments)
    .values({
      payerUserId: studentId,
      payeeUserId: teacherId,
      entityType: 'COURSE_ENROLLMENT',
      entityId: enr1.id,
      amount: '79.00',
      commissionAmount: '7.90',
      netAmount: '71.10',
      paymentMode: 'SANDBOX_PENDING',
      status: 'PENDING_SETUP',
      paymentReference: 'JSR-SBX-2026-0001',
    })
    .returning();

  await db.insert(earnings).values({
    providerUserId: teacherId,
    paymentId: pay1.id,
    grossAmount: '79.00',
    commissionAmount: '7.90',
    netAmount: '71.10',
    status: 'PENDING',
  });

  // 14. Conversations, Messages & Notifications
  const [conv1] = await db
    .insert(conversations)
    .values({
      subject: 'مناقشة مهمة: تطبيع قواعد البيانات لمشروع الجامعة',
      taskId: task1.id,
    })
    .returning();

  await db.insert(conversationMembers).values([
    { conversationId: conv1.id, userId: studentId },
    { conversationId: conv1.id, userId: expertId },
  ]);

  await db.insert(messages).values([
    {
      conversationId: conv1.id,
      senderUserId: expertId,
      body: 'أهلاً سارة، اطلعت على تفاصيل المهمة ويمكننا تقسيم الجداول بوضوح خلال أول 45 دقيقة.',
    },
    {
      conversationId: conv1.id,
      senderUserId: studentId,
      body: 'ممتاز جداً مهندس عمر، هل أجهز ملف الـ Schema الحالي قبل الجلسة؟',
    },
  ]);

  await db.insert(notifications).values([
    {
      userId: studentId,
      type: 'TASK_OFFER',
      title: 'عرض جديد على مهمتك التعليمية',
      body: 'قدّم م. عمر الشريف عرضاً بقيمة 40 دولاراً لمهمة تطبيع قواعد البيانات.',
      linkUrl: `/tasks/${task1.id}`,
    },
    {
      userId: studentId,
      type: 'BOOKING',
      title: 'تم تأكيد جلسة الإرشاد المهني',
      body: 'موعدك مع د. ليلى الحسن مؤكد يوم الإثنين الساعة 18:00.',
      linkUrl: '/bookings',
    },
  ]);

  // 15. Reviews, Verifications, Reports, Platform Settings
  await db.insert(reviews).values({
    authorUserId: studentId,
    targetUserId: teacherId,
    courseId: course1.id,
    rating: 5,
    comment: 'شرح عملي ممتاز ربط المفاهيم مباشرة بطريقة العمل داخل الفرق الهندسية.',
  });

  await db.insert(verifications).values({
    userId: teacherId,
    entityType: 'PROVIDER',
    documentTitle: 'شهادة ماجستير هندسة البرمجيات واعتماد التدريب',
    status: 'APPROVED',
    reviewedByUserId: adminId,
    reviewNotes: 'تمت مطابقة الوثائق بنجاح.',
    reviewedAt: new Date(),
  });

  await db.insert(reports).values({
    reporterUserId: studentId,
    targetType: 'TASK',
    targetId: task2.id,
    reason: 'استفسار حول تسعير المهمة',
    details: 'هل يمكن تجزئة الميزانية على مرحلتين؟ (بلاغ توضيحي تجريبي)',
    status: 'OPEN',
  });

  await db.insert(platformSettings).values([
    { key: 'commission_rate_percent', value: '10', description: 'نسبة عمولة المنصة الافتراضية (%)' },
    { key: 'payment_gateway_mode', value: 'SANDBOX_PENDING', description: 'وضع بوابة الدفع الحالي' },
    { key: 'allow_public_registration', value: 'true', description: 'السماح بتسجيل حسابات جديدة' },
  ]);

  await ensureLessonSessionsSeeded();
  await ensureEgyptianCurriculumSeeded();
}

async function ensureLessonSessionsSeeded(): Promise<void> {
  const existing = await db
    .select({ id: teachingSessions.id })
    .from(teachingSessions)
    .limit(1);
  if (existing.length > 0) return;

  const [demoUsers, demoSubjects, demoStages] = await Promise.all([
    db.select({ id: users.id, email: users.email }).from(users),
    db.select({ id: subjects.id, slug: subjects.slug }).from(subjects),
    db.select({ id: educationalStages.id, slug: educationalStages.slug }).from(educationalStages),
  ]);

  const userMap = new Map(demoUsers.map((u) => [u.email, u.id]));
  const subjectMap = new Map(demoSubjects.map((s) => [s.slug, s.id]));
  const stageMap = new Map(demoStages.map((s) => [s.slug, s.id]));

  const studentId = userMap.get('sara.student@demo.jusoor.edu');
  const teacherId = userMap.get('tariq.teacher@demo.jusoor.edu');
  const mentorId = userMap.get('layla.mentor@demo.jusoor.edu');
  const expertId = userMap.get('omar.expert@demo.jusoor.edu');

  if (!teacherId || !mentorId || !expertId) return;

  const daysFromNow = (days: number, hourUtc: number, minuteUtc = 0) => {
    const d = new Date(Date.now() + days * 86_400_000);
    d.setUTCHours(hourUtc, minuteUtc, 0, 0);
    return d;
  };

  await db.insert(teacherAvailability).values([
    { teacherUserId: teacherId, dayOfWeek: 0, startTime: '17:00', endTime: '21:00', isActive: true },
    { teacherUserId: teacherId, dayOfWeek: 2, startTime: '18:00', endTime: '21:00', isActive: true },
    { teacherUserId: mentorId, dayOfWeek: 1, startTime: '16:00', endTime: '20:00', isActive: true },
    { teacherUserId: expertId, dayOfWeek: 4, startTime: '19:00', endTime: '22:00', isActive: true },
  ]);

  const insertedSessions = await db
    .insert(teachingSessions)
    .values([
      {
        teacherUserId: teacherId,
        subjectId: subjectMap.get('react-ts') ?? null,
        stageId: stageMap.get('graduates') ?? null,
        sessionType: 'ONE_TO_ONE',
        title: 'جلسة فردية: مراجعة كود React وبناء معمارية المشروع',
        description: 'جلسة فردية مخصصة لمناقشة التحديات العملية في TypeScript وهيكلة التطبيقات.',
        startTime: daysFromNow(4, 17, 0),
        endTime: daysFromNow(4, 18, 0),
        durationMinutes: 60,
        capacity: 1,
        minStudents: null,
        price: '35.00',
        deliveryMode: 'ONLINE',
        meetingUrl: 'https://meet.jusoor.example/one-to-one-react',
        registrationDeadline: daysFromNow(3, 23, 0),
        status: 'OPEN',
        isDemo: true,
      },
      {
        teacherUserId: teacherId,
        subjectId: subjectMap.get('react-ts') ?? null,
        stageId: stageMap.get('university') ?? null,
        sessionType: 'GROUP',
        title: 'ورشة عمل جماعية: بناء تطبيق React متكامل بمعايير الشركات',
        description: 'جلسة تطبيقية تفاعلية لمجموعة من المتعلّمين لتطوير لوحة تحكم حقيقية والربط مع الخادم.',
        startTime: daysFromNow(6, 18, 0),
        endTime: daysFromNow(6, 20, 0),
        durationMinutes: 120,
        capacity: 8,
        minStudents: 3,
        price: '18.00',
        deliveryMode: 'ONLINE',
        meetingUrl: 'https://meet.jusoor.example/group-react-workshop',
        registrationDeadline: daysFromNow(5, 22, 0),
        status: 'OPEN',
        isDemo: true,
      },
      {
        teacherUserId: expertId,
        subjectId: subjectMap.get('database-normalization') ?? null,
        stageId: stageMap.get('university') ?? null,
        sessionType: 'GROUP',
        title: 'معمل جماعي: تطبيع قواعد البيانات وتصميم ERD (1NF-BCNF)',
        description: 'حل أمثلة واقعية على تطبيع قواعد البيانات وتجنب أخطاء الأداء والاستعلامات.',
        startTime: daysFromNow(8, 19, 0),
        endTime: daysFromNow(8, 20, 30),
        durationMinutes: 90,
        capacity: 10,
        minStudents: 2,
        price: '15.00',
        deliveryMode: 'IN_PERSON',
        location: 'مركز أكاديمية الأفق — قاعة البيانات (الرياض)',
        registrationDeadline: daysFromNow(7, 20, 0),
        status: 'OPEN',
        isDemo: true,
      },
      {
        teacherUserId: mentorId,
        subjectId: subjectMap.get('design-systems') ?? null,
        stageId: stageMap.get('professionals') ?? null,
        sessionType: 'ONE_TO_ONE',
        title: 'جلسة إرشاد فردية: مراجعة معرض الأعمال وتجربة RTL',
        description: 'تقييم فردي مباشر لمشاريع التصميم الخاصة بك وخطة تحسينها لسوق العمل.',
        startTime: daysFromNow(9, 16, 0),
        endTime: daysFromNow(9, 17, 0),
        durationMinutes: 60,
        capacity: 1,
        minStudents: null,
        price: '45.00',
        deliveryMode: 'ONLINE',
        meetingUrl: 'https://meet.jusoor.example/one-to-one-ux',
        registrationDeadline: daysFromNow(8, 20, 0),
        status: 'OPEN',
        isDemo: true,
      },
    ])
    .returning();

  if (studentId && insertedSessions.length >= 2) {
    await db.insert(sessionEnrollments).values([
      {
        sessionId: insertedSessions[1].id,
        studentUserId: studentId,
        notes: 'أرغب بالتركيز على ربط نماذج React مع واجهات REST API.',
        status: 'ACCEPTED',
        respondedAt: new Date(),
      },
    ]);
  }
}

// Allow direct CLI execution: npx tsx src/server/seed.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  ensureSeeded()
    .then(() => {
      console.log('JUSOOR database seeded successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
