import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  roles,
  users,
  userRoles,
  providerProfiles,
  centers,
  centerMembers,
  educationalStages,
  educationalGrades,
  fields,
  subjects,
  curriculumSubjects,
  courses,
  courseLessons,
  quizzes,
  questions,
  quizAnswers,
  taskCategories,
  educationalTasks,
  taskOffers,
  taskStatusHistory,
  availability,
  teachingSessions,
  teacherTeachingAssignments,
} from '../db/schema.ts';
import {
  formatOfflineAddress,
  validateTaskDeadline,
  validateSessionSchedule,
  validateAvailabilitySlot,
} from '../lib/domain.ts';

function isoDateDaysFromNow(daysAhead: number): string {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateAtUtcHour(daysAhead: number, hourUtc: number, minuteUtc = 0): Date {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  d.setUTCHours(hourUtc, minuteUtc, 0, 0);
  return d;
}

const ARABIC_WEEKDAYS = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

function arabicDayOfWeek(isoDate: string): string {
  const dt = new Date(`${isoDate}T12:00:00Z`);
  return ARABIC_WEEKDAYS[dt.getUTCDay()] ?? 'الإثنين';
}

export async function seedRealisticPlatformData(): Promise<{
  centersAdded: number;
  coursesAdded: number;
  quizzesAdded: number;
  tasksAdded: number;
  sessionsAdded: number;
  availabilityAdded: number;
}> {
  let centersAdded = 0;
  let coursesAdded = 0;
  let quizzesAdded = 0;
  let tasksAdded = 0;
  let sessionsAdded = 0;
  let availabilityAdded = 0;

  const [
    roleRows,
    stageRows,
    gradeRows,
    fieldRows,
    subjectRows,
    categoryRows,
    existingUsers,
  ] = await Promise.all([
    db.select().from(roles),
    db.select().from(educationalStages),
    db.select().from(educationalGrades),
    db.select().from(fields),
    db.select().from(subjects),
    db.select().from(taskCategories),
    db.select({ id: users.id, email: users.email, fullName: users.fullName }).from(users),
  ]);

  const roleMap = new Map(roleRows.map((r) => [r.code, r.id]));
  const stageMap = new Map(stageRows.map((s) => [s.slug, s.id]));
  const gradeMap = new Map(gradeRows.map((g) => [g.slug, g]));
  const fieldMap = new Map(fieldRows.map((f) => [f.slug, f.id]));
  const subjectMap = new Map(subjectRows.map((s) => [s.slug, s.id]));
  const categoryMap = new Map(categoryRows.map((c) => [c.slug, c.id]));
  const userIdByEmail = new Map(existingUsers.map((u) => [u.email.toLowerCase(), u.id]));

  // --------------------------------------------------------------------------
  // 1. Realistic Demo Educators & Center Owners (Egyptian Platform Personas)
  // --------------------------------------------------------------------------
  const realisticUsers = [
    {
      email: 'karim.salem@demo.jusoor.edu',
      fullName: 'م. كريم سالم',
      roleCodes: ['TEACHER', 'EXPERT'],
      providerType: 'TEACHER',
      headline: 'مهندس برمجيات ومعلّم Python وهياكل البيانات',
      bio: 'خبرة 9 سنوات في تدريس الخوارزميات وهياكل البيانات وتطبيقات الذكاء الاصطناعي لطلاب الثانوية والجامعات.',
      qualifications: 'ماجستير علوم الحاسب — جامعة القاهرة',
      yearsExperience: 9,
      hourlyRate: '320.00',
      currency: 'EGP',
      verificationStatus: 'VERIFIED',
      ratingAvg: '4.90',
      reviewsCount: 19,
    },
    {
      email: 'mona.fouad@demo.jusoor.edu',
      fullName: 'د. منى فؤاد',
      roleCodes: ['TEACHER', 'MENTOR'],
      providerType: 'TEACHER',
      headline: 'أستاذة الفيزياء والعلوم المتكاملة للمرحلة الثانوية',
      bio: 'تبسيط قوانين الميكانيكا والكهرباء والفيزياء الحديثة عبر التجارب التفاعلية وحل نماذج الامتحانات.',
      qualifications: 'دكتوراه في الفيزياء التطبيقية — جامعة عين شمس',
      yearsExperience: 12,
      hourlyRate: '280.00',
      currency: 'EGP',
      verificationStatus: 'VERIFIED',
      ratingAvg: '4.92',
      reviewsCount: 27,
    },
    {
      email: 'sherif.nabil@demo.jusoor.edu',
      fullName: 'أ. شريف نبيل',
      roleCodes: ['CENTER_OWNER', 'TEACHER'],
      providerType: 'TEACHER',
      headline: 'مؤسس مركز المعرفة للرياضيات واللغات',
      bio: 'أشرف على برامج تأسيس الرياضيات واللغة الإنجليزية في القاهرة والإسكندرية وفق أحدث مناهج 2026/2027.',
      qualifications: 'ماجستير المناهج وطرق تدريس الرياضيات — جامعة الإسكندرية',
      yearsExperience: 14,
      hourlyRate: '300.00',
      currency: 'EGP',
      verificationStatus: 'VERIFIED',
      ratingAvg: '4.88',
      reviewsCount: 22,
    },
    {
      email: 'nadia.mansour@demo.jusoor.edu',
      fullName: 'أ. نادية منصور',
      roleCodes: ['EXPERT', 'TEACHER'],
      providerType: 'EXPERT',
      headline: 'خبيرة المحاسبة المالية والتحليل المالي',
      bio: 'تدريب عملي لطلاب التجارة والمهنيين على إعداد القوائم المالية وتحليل التدفقات النقدية.',
      qualifications: 'زمالة المحاسبين القانونيين — خبرة 11 عاماً',
      yearsExperience: 11,
      hourlyRate: '350.00',
      currency: 'EGP',
      verificationStatus: 'VERIFIED',
      ratingAvg: '4.86',
      reviewsCount: 14,
    },
    {
      email: 'youssef.student@demo.jusoor.edu',
      fullName: 'يوسف عبد الرحمن',
      roleCodes: ['STUDENT'],
    },
  ];

  for (const u of realisticUsers) {
    let uid = userIdByEmail.get(u.email.toLowerCase());
    if (!uid) {
      const [inserted] = await db
        .insert(users)
        .values({
          email: u.email.toLowerCase(),
          fullName: u.fullName,
          emailVerified: true,
          accountStatus: 'ACTIVE',
          isDemo: true,
        })
        .returning({ id: users.id });
      uid = inserted.id;
      userIdByEmail.set(u.email.toLowerCase(), uid);
    }

    for (const code of u.roleCodes) {
      const rId = roleMap.get(code);
      if (rId) {
        await db
          .insert(userRoles)
          .values({ userId: uid, roleId: rId })
          .onConflictDoNothing();
      }
    }

    if ('providerType' in u && u.providerType) {
      await db
        .insert(providerProfiles)
        .values({
          userId: uid,
          providerType: u.providerType,
          headline: u.headline!,
          bio: u.bio!,
          qualifications: u.qualifications!,
          yearsExperience: u.yearsExperience!,
          hourlyRate: u.hourlyRate!,
          currency: u.currency!,
          verificationStatus: u.verificationStatus!,
          ratingAvg: u.ratingAvg!,
          reviewsCount: u.reviewsCount!,
        })
        .onConflictDoNothing();
    }
  }

  const saraStudentId = userIdByEmail.get('sara.student@demo.jusoor.edu');
  const youssefStudentId = userIdByEmail.get('youssef.student@demo.jusoor.edu') || saraStudentId;
  const tariqTeacherId = userIdByEmail.get('tariq.teacher@demo.jusoor.edu');
  const laylaMentorId = userIdByEmail.get('layla.mentor@demo.jusoor.edu');
  const omarExpertId = userIdByEmail.get('omar.expert@demo.jusoor.edu');
  const karimId = userIdByEmail.get('karim.salem@demo.jusoor.edu')!;
  const monaId = userIdByEmail.get('mona.fouad@demo.jusoor.edu')!;
  const sherifId = userIdByEmail.get('sherif.nabil@demo.jusoor.edu')!;
  const nadiaId = userIdByEmail.get('nadia.mansour@demo.jusoor.edu')!;

  const fallbackTeacherId = tariqTeacherId || karimId;
  const fallbackStudentId = saraStudentId || youssefStudentId || karimId;

  // --------------------------------------------------------------------------
  // 2. Realistic Egyptian Educational Centers
  // --------------------------------------------------------------------------
  const centerDefs = [
    {
      slug: 'maadi-stem-academy',
      ownerUserId: sherifId,
      name: 'أكاديمية النيل للعلوم والتفوق — المعادي',
      description:
        'مركز تعليمي متكامل يقدم حصصاً تفاعلية ومراجعات منهجية لطلاب الابتدائية والإعدادية والثانوية العامة والبكالوريا في القاهرة.',
      city: 'القاهرة',
      country: 'مصر',
      website: 'https://nile-stem.example.edu',
      bannerUrl: '/src/assets/images/center_academy_hub_1795328020183.jpg',
      verificationStatus: 'VERIFIED',
      members: [
        {
          userId: sherifId,
          memberRole: 'OWNER',
          jobTitle: 'مدير الأكاديمية ورئيس قسم الرياضيات',
          permissions: ['MANAGE_CENTER', 'MANAGE_STAFF', 'MANAGE_COURSES', 'VIEW_REPORTS'],
        },
        {
          userId: monaId,
          memberRole: 'INSTRUCTOR',
          jobTitle: 'مدرّسة أولى فيزياء وعلوم متكاملة',
          permissions: ['MANAGE_COURSES'],
        },
        {
          userId: karimId,
          memberRole: 'INSTRUCTOR',
          jobTitle: 'مدرّس البرمجة والذكاء الاصطناعي',
          permissions: ['MANAGE_COURSES'],
        },
      ],
    },
    {
      slug: 'smouha-future-institute',
      ownerUserId: sherifId,
      name: 'معهد المستقبل للتدريب التطبيقي — سموحة',
      description:
        'بيئة تعليمية حديثة في الإسكندرية تدمج بين الإعداد الأكاديمي ومهارات البرمجة والمحاسبة وسوق العمل.',
      city: 'الإسكندرية',
      country: 'مصر',
      website: 'https://smouha-future.example.edu',
      bannerUrl: '/src/assets/images/hero_jusoor_learning_1795328020437.jpg',
      verificationStatus: 'VERIFIED',
      members: [
        {
          userId: sherifId,
          memberRole: 'OWNER',
          jobTitle: 'المشرف العام ومؤسس المعهد',
          permissions: ['MANAGE_CENTER', 'MANAGE_STAFF', 'MANAGE_COURSES', 'VIEW_REPORTS'],
        },
        {
          userId: nadiaId,
          memberRole: 'INSTRUCTOR',
          jobTitle: 'محاضرة المحاسبة المالية وإدارة الأعمال',
          permissions: ['MANAGE_COURSES'],
        },
        ...(omarExpertId
          ? [
              {
                userId: omarExpertId,
                memberRole: 'INSTRUCTOR',
                jobTitle: 'مستشار هندسة البيانات وقواعد SQL',
                permissions: ['MANAGE_COURSES'],
              },
            ]
          : []),
      ],
    },
    {
      slug: 'dokki-arabic-humanities-hub',
      ownerUserId: monaId,
      name: 'دار البيان للغة العربية واللغات — الدقي',
      description:
        'مركز متخصص في إتقان اللغة العربية والنحو والبلاغة واللغة الإنجليزية لجميع صفوف التعليم العام في الجيزة.',
      city: 'الجيزة',
      country: 'مصر',
      website: 'https://bayan-dokki.example.edu',
      bannerUrl: '/src/assets/images/center_academy_hub_1795328020183.jpg',
      verificationStatus: 'VERIFIED',
      members: [
        {
          userId: monaId,
          memberRole: 'OWNER',
          jobTitle: 'مديرة المركز ومشرفة المناهج العلمية',
          permissions: ['MANAGE_CENTER', 'MANAGE_STAFF', 'MANAGE_COURSES', 'VIEW_REPORTS'],
        },
        ...(laylaMentorId
          ? [
              {
                userId: laylaMentorId,
                memberRole: 'INSTRUCTOR',
                jobTitle: 'مرشدة التطوير الأكاديمي والمهارات اللغوية',
                permissions: ['MANAGE_COURSES'],
              },
            ]
          : []),
      ],
    },
  ];

  const centerIdBySlug = new Map<string, number>();
  const existingCenters = await db
    .select({ id: centers.id, slug: centers.slug })
    .from(centers);
  for (const c of existingCenters) centerIdBySlug.set(c.slug, c.id);

  for (const c of centerDefs) {
    let cid = centerIdBySlug.get(c.slug);
    if (!cid) {
      const [inserted] = await db
        .insert(centers)
        .values({
          ownerUserId: c.ownerUserId,
          name: c.name,
          slug: c.slug,
          description: c.description,
          city: c.city,
          country: c.country,
          website: c.website,
          bannerUrl: c.bannerUrl,
          verificationStatus: c.verificationStatus,
        })
        .returning({ id: centers.id });
      cid = inserted.id;
      centerIdBySlug.set(c.slug, cid);
      centersAdded += 1;
    }

    for (const m of c.members) {
      await db
        .insert(centerMembers)
        .values({
          centerId: cid,
          userId: m.userId,
          memberRole: m.memberRole,
          jobTitle: m.jobTitle,
          permissionsJson: m.permissions,
          status: 'ACTIVE',
        })
        .onConflictDoNothing();
    }
  }

  // --------------------------------------------------------------------------
  // 3. Rich Courses + Lessons + Quizzes (Preserves all existing real courses)
  // --------------------------------------------------------------------------
  const maadiCenterId = centerIdBySlug.get('maadi-stem-academy') ?? null;
  const smouhaCenterId = centerIdBySlug.get('smouha-future-institute') ?? null;
  const dokkiCenterId = centerIdBySlug.get('dokki-arabic-humanities-hub') ?? null;

  const courseDefs = [
    {
      slug: 'physics-mechanics-secondary-eg',
      instructorUserId: monaId,
      centerId: maadiCenterId,
      fieldSlug: 'sciences',
      subjectSlug: 'eg-physics',
      stageSlug: 'secondary',
      title: 'الفيزياء للثانوية العامة: الحركة والقوة وقوانين نيوتن',
      subtitle: 'فهم عميق لقوانين الديناميكا وحل المسائل البيانية خطوة بخطوة',
      description:
        'دورة شاملة تغطي قوانين نيوتن للحركة، الشغل والطاقة، وكمية التحرك مع تدريبات محلولة على أسئلة النظام الحديث.',
      level: 'INTERMEDIATE',
      price: '250.00',
      currency: 'EGP',
      thumbnailUrl: '/src/assets/images/course_ai_data_1795328019851.jpg',
      lessons: [
        {
          title: '01. كمية التحرك وقانون نيوتن الثاني',
          content: 'ربط معدل التغير في كمية التحرك بالقوة المحصلة وقراءة الرسوم البيانية بدقة.',
          durationMinutes: 28,
          isFreePreview: true,
        },
        {
          title: '02. تطبيقات الحركة الدائرية والجاذبية الكونية',
          content: 'تحليل القوة الجاذبة المركزية وحركة الأقمار الصناعية مع أمثلة امتحانية.',
          durationMinutes: 32,
          isFreePreview: false,
        },
        {
          title: '03. الشغل والطاقة الميكانيكية وقانون البقاء',
          content: 'حساب الشغل المبذول وتطبيقات طاقة الوضع والحركة في الأنظمة المحافظة.',
          durationMinutes: 30,
          isFreePreview: false,
        },
      ],
      quiz: {
        title: 'اختبار تطبيقي على قوانين نيوتن والطاقة',
        description: 'تحقق من استيعابك لمفاهيم الديناميكا الأساسية.',
        questions: [
          {
            questionText: 'إذا تضاعفت القوة المحصلة المؤثرة على جسم ثابت الكتلة، فإن عجلته:',
            answers: [
              { answerText: 'تتضاعف إلى المثلين', isCorrect: true },
              { answerText: 'تقل إلى النصف', isCorrect: false },
              { answerText: 'تبقى ثابتة لا تتغير', isCorrect: false },
            ],
          },
          {
            questionText: 'وحدة قياس كمية التحرك في النظام الدولي SI هي:',
            answers: [
              { answerText: 'kg·m/s', isCorrect: true },
              { answerText: 'N/m²', isCorrect: false },
              { answerText: 'Joule/s', isCorrect: false },
            ],
          },
        ],
      },
    },
    {
      slug: 'python-data-structures-bacc-ai',
      instructorUserId: karimId,
      centerId: maadiCenterId,
      fieldSlug: 'artificial-intelligence',
      subjectSlug: 'eg-programming-ai',
      stageSlug: 'secondary',
      title: 'البرمجة والذكاء الاصطناعي بلغة Python — البكالوريا المصرية',
      subtitle: 'بناء الخوارزميات وهياكل البيانات وتحليل النماذج الذكية من الصفر',
      description:
        'مسار عملي موجه لطلاب مسار الهندسة وعلوم الحاسب لتعلّم Python وهياكل القوائم والقواميس والتعامل مع البيانات.',
      level: 'BEGINNER',
      price: '320.00',
      currency: 'EGP',
      thumbnailUrl: '/src/assets/images/course_web_engineering_1795328020586.jpg',
      lessons: [
        {
          title: '01. المتغيرات والتحكم في التدفق وبناء الدوال في Python',
          content: 'كتابة دوال نظيفة ومعالجة الحلقات التكرارية والشروط المنطقية.',
          durationMinutes: 25,
          isFreePreview: true,
        },
        {
          title: '02. القوائم والقواميس والمجموعات (Lists & Dictionaries)',
          content: 'اختيار بنية البيانات الأنسب لحل المشكلات البرمجية بكفاءة زمنية عالية.',
          durationMinutes: 35,
          isFreePreview: false,
        },
        {
          title: '03. مقدمة عملية في تعلّم الآلة وتقييم النماذج',
          content: 'تقسيم البيانات إلى تدريب واختبار وفهم دقة التنبؤ.',
          durationMinutes: 40,
          isFreePreview: false,
        },
      ],
      quiz: {
        title: 'اختبار أساسيات Python وهياكل البيانات',
        description: 'قياس فهمك لاختيار التراكيب البرمجية المناسبة.',
        questions: [
          {
            questionText: 'أي بنية بيانات في Python تسمح بالبحث السريع عبر المفتاح (Key-Value)؟',
            answers: [
              { answerText: 'القاموس (dict)', isCorrect: true },
              { answerText: 'الصف الثابت (tuple)', isCorrect: false },
              { answerText: 'السلسلة النصية (str)', isCorrect: false },
            ],
          },
          {
            questionText: 'ما الغرض من تقسيم البيانات إلى مجموعة تدريب ومجموعة اختبار؟',
            answers: [
              { answerText: 'قياس قدرة النموذج على التعميم على بيانات جديدة', isCorrect: true },
              { answerText: 'تقليل عدد أسطر الكود فقط', isCorrect: false },
              { answerText: 'حذف الأعمدة النصية تلقائياً', isCorrect: false },
            ],
          },
        ],
      },
    },
    {
      slug: 'prep-algebra-geometry-foundations',
      instructorUserId: sherifId,
      centerId: maadiCenterId,
      fieldSlug: 'mathematics',
      subjectSlug: 'eg-mathematics',
      stageSlug: 'preparatory',
      title: 'تأسيس الجبر والهندسة التحليلية — المرحلة الإعدادية',
      subtitle: 'إتقان المعادلات التربيعية والتناسب والبرهان الهندسي بأسلوب مرئي',
      description:
        'برنامج تدريبي منظم لطلاب الصفوف الإعدادية يعالج فجوات الأساسيات في التحليل والكسور الجبرية والهندسة.',
      level: 'BEGINNER',
      price: '180.00',
      currency: 'EGP',
      thumbnailUrl: '/src/assets/images/hero_jusoor_learning_1795328020437.jpg',
      lessons: [
        {
          title: '01. تحليل المقدار الثلاثي والفرق بين مربعين',
          content: 'استراتيجيات التحليل السريع والتحقق من صحة الحلول بالتعويض.',
          durationMinutes: 24,
          isFreePreview: true,
        },
        {
          title: '02. حل معادلتين من الدرجة الأولى في متغيرين',
          content: 'الربط بين الحل الجبري بالحذف والتعويض والتمثيل البياني.',
          durationMinutes: 28,
          isFreePreview: false,
        },
        {
          title: '03. منهجية كتابة البرهان الهندسي المنظم',
          content: 'تحويل المعطيات إلى خطوات استنتاج مترابطة في مسائل الدائرة والمثلث.',
          durationMinutes: 26,
          isFreePreview: false,
        },
      ],
      quiz: {
        title: 'اختبار مهارات الجبر الإعدادي',
        description: 'تمارين سريعة على التحليل وحل المعادلات.',
        questions: [
          {
            questionText: 'ما تحليل المقدار (س² - 25) تحليلاً تاماً؟',
            answers: [
              { answerText: '(س - 5)(س + 5)', isCorrect: true },
              { answerText: '(س - 5)²', isCorrect: false },
              { answerText: '(س + 25)(س - 1)', isCorrect: false },
            ],
          },
        ],
      },
    },
    {
      slug: 'arabic-grammar-rhetoric-masterclass',
      instructorUserId: laylaMentorId || monaId,
      centerId: dokkiCenterId,
      fieldSlug: 'arabic-language',
      subjectSlug: 'eg-arabic',
      stageSlug: 'secondary',
      title: 'إتقان النحو والبلاغة العربية — من التأسيس إلى الإبداع',
      subtitle: 'خرائط ذهنية للإعراب، المشتقات، والصور البيانية لطلاب الثانوي',
      description:
        'منهج مبسط يساعد الطالب على الإعراب الصحيح وفهم التذوق البلاغي وتحليل النصوص المتحررة دون حفظ آلي.',
      level: 'INTERMEDIATE',
      price: '210.00',
      currency: 'EGP',
      thumbnailUrl: '/src/assets/images/center_academy_hub_1795328020183.jpg',
      lessons: [
        {
          title: '01. علامات الإعراب الأصلية والفرعية في الأسماء والأفعال',
          content: 'تمييز حالات الرفع والنصب والجزم والجر في الجمل المركبة.',
          durationMinutes: 22,
          isFreePreview: true,
        },
        {
          title: '02. المشتقات العاملة وتطبيقاتها في النصوص',
          content: 'اسم الفاعل وصيغ المبالغة واسم المفعول وإعراب معمولها.',
          durationMinutes: 27,
          isFreePreview: false,
        },
        {
          title: '03. التشبيه والاستعارة والكناية في النصوص المتحررة',
          content: 'كيف تحدد سر الجمال البلاغي بدقة في أسئلة القراءة والشعر.',
          durationMinutes: 25,
          isFreePreview: false,
        },
      ],
      quiz: {
        title: 'تطبيقات النحو والبلاغة',
        description: 'اختبار قصير لقياس التمييز النحوي والبلاغي.',
        questions: [
          {
            questionText: 'عند حذف المشبه به والإبقاء على صفة من لوازمه تكون الصورة:',
            answers: [
              { answerText: 'استعارة مكنية', isCorrect: true },
              { answerText: 'تشبيهاً بليغاً', isCorrect: false },
              { answerText: 'استعارة تصريحية', isCorrect: false },
            ],
          },
        ],
      },
    },
    {
      slug: 'primary-math-mental-skills-g4-g6',
      instructorUserId: sherifId,
      centerId: maadiCenterId,
      fieldSlug: 'mathematics',
      subjectSlug: 'eg-mathematics',
      stageSlug: 'primary',
      title: 'الرياضيات الذهنية والكسور لطلاب الصفوف الرابع والخامس والسادس',
      subtitle: 'فهم الكسور الاعتيادية والعشرية والمساحات بطريقة بصرية محببة',
      description:
        'تأسيس عملي يرفع ثقة طالب المرحلة الابتدائية في حل المسائل اللفظية والعمليات على الكسور والنسب.',
      level: 'BEGINNER',
      price: '140.00',
      currency: 'EGP',
      thumbnailUrl: '/src/assets/images/hero_jusoor_learning_1795328020437.jpg',
      lessons: [
        {
          title: '01. الكسور المتكافئة وتوحيد المقامات بالتمثيل البصري',
          content: 'مقارنة الكسور وجمعها وطرحها باستخدام النماذج الشريطية.',
          durationMinutes: 20,
          isFreePreview: true,
        },
        {
          title: '02. القسمة المطولة بخطوات واضحة بدون تعقيد',
          content: 'تدرّج عملي لحل مسائل القسمة على رقم ورقمين والتحقق من الباقي.',
          durationMinutes: 25,
          isFreePreview: false,
        },
        {
          title: '03. تطبيقات المحيط والمساحة على الأشكال الهندسية',
          content: 'التمييز بين المحيط والمساحة في المسائل الحياتية.',
          durationMinutes: 22,
          isFreePreview: false,
        },
      ],
      quiz: {
        title: 'اختبار الكسور والقسمة للمرحلة الابتدائية',
        description: 'أسئلة تأسيسية خفيفة لتثبيت الفهم.',
        questions: [
          {
            questionText: 'ما الكسر المكافئ للكسر 3/4 عند ضرب البسط والمقام في 2؟',
            answers: [
              { answerText: '6/8', isCorrect: true },
              { answerText: '5/6', isCorrect: false },
              { answerText: '3/8', isCorrect: false },
            ],
          },
        ],
      },
    },
    {
      slug: 'financial-accounting-statements-analysis',
      instructorUserId: nadiaId,
      centerId: smouhaCenterId,
      fieldSlug: 'accounting',
      subjectSlug: 'eg-accounting',
      stageSlug: 'university',
      title: 'المحاسبة المالية وقراءة القوائم المالية للشركات',
      subtitle: 'من القيود اليومية وميزان المراجعة حتى قائمة الدخل والمركز المالي',
      description:
        'دورة عملية لطلاب كليات التجارة ورواد الأعمال لفهم الدورة المحاسبية الكاملة وتحليل النسب المالية.',
      level: 'INTERMEDIATE',
      price: '290.00',
      currency: 'EGP',
      thumbnailUrl: '/src/assets/images/course_ai_data_1795328019851.jpg',
      lessons: [
        {
          title: '01. معادلة الميزانية وتحليل العمليات المالية',
          content: 'فهم طرفي القيد المزدوج وتأثير المعاملات على الأصول والالتزامات.',
          durationMinutes: 26,
          isFreePreview: true,
        },
        {
          title: '02. التسويات الجردية والإيرادات والمصروفات المستحقة',
          content: 'إعداد قيود التسوية في نهاية الفترة المالية وفق أساس الاستحقاق.',
          durationMinutes: 34,
          isFreePreview: false,
        },
        {
          title: '03. إعداد وتحليل قائمة التدفقات النقدية',
          content: 'الربط بين الأنشطة التشغيلية والاستثمارية والتمويلية.',
          durationMinutes: 30,
          isFreePreview: false,
        },
      ],
      quiz: {
        title: 'اختبار الدورة المحاسبية والقوائم',
        description: 'تقييم سريع لفهم القيد المزدوج والقوائم المالية.',
        questions: [
          {
            questionText: 'أي قائمة توضح المركز المالي للشركة في لحظة زمنية محددة؟',
            answers: [
              { answerText: 'قائمة المركز المالي (الميزانية العمومية)', isCorrect: true },
              { answerText: 'قائمة التغير في حقوق الملكية فقط', isCorrect: false },
              { answerText: 'دفتر اليومية المساعد', isCorrect: false },
            ],
          },
        ],
      },
    },
    {
      slug: 'organic-chemistry-reactions-guide',
      instructorUserId: monaId,
      centerId: maadiCenterId,
      fieldSlug: 'sciences',
      subjectSlug: 'eg-chemistry',
      stageSlug: 'secondary',
      title: 'الكيمياء العضوية: الهيدروكربونات والمشتقات بأسلوب الترابط',
      subtitle: 'خريطة تحويلات شاملة للتفاعلات العضوية وتسمية IUPAC',
      description:
        'شرح متسلسل يربط الألكانات والألكينات والكحولات والأحماض الكربوكسيلية في مخططات واضحة تسهل المراجعة.',
      level: 'ADVANCED',
      price: '275.00',
      currency: 'EGP',
      thumbnailUrl: '/src/assets/images/course_ai_data_1795328019851.jpg',
      lessons: [
        {
          title: '01. قواعد تسمية المركبات العضوية بنظام IUPAC',
          content: 'تحديد أطول سلسلة كربونية وترقيم التفرعات والمجموعات الوظيفية.',
          durationMinutes: 28,
          isFreePreview: true,
        },
        {
          title: '02. تفاعلات الإضافة والاستبدال وقاعدة ماركونيكوف',
          content: 'توقع النواتج الرئيسية في تفاعلات الألكينات والألكاينات.',
          durationMinutes: 32,
          isFreePreview: false,
        },
        {
          title: '03. الأسترة والأكسدة في الكحولات والأحماض العضوية',
          content: 'تحويلات المجموعات الوظيفية وأسئلة الربط متعدد الخطوات.',
          durationMinutes: 35,
          isFreePreview: false,
        },
      ],
      quiz: {
        title: 'اختبار التسمية والتفاعلات العضوية',
        description: 'مراجعة سريعة لقواعد الإضافة والأسترة.',
        questions: [
          {
            questionText: 'ينتج الإستر والماء عند تفاعل الحمض الكربوكسيلي مع:',
            answers: [
              { answerText: 'الكحول', isCorrect: true },
              { answerText: 'الألكان', isCorrect: false },
              { answerText: 'البنزين العطري مباشرة بدون حفاز', isCorrect: false },
            ],
          },
        ],
      },
    },
    {
      slug: 'academic-english-writing-communication',
      instructorUserId: laylaMentorId || fallbackTeacherId,
      centerId: dokkiCenterId,
      fieldSlug: 'languages',
      subjectSlug: 'business-english',
      stageSlug: 'university',
      title: 'الكتابة الأكاديمية والتواصل المهني باللغة الإنجليزية',
      subtitle: 'صياغة المقالات والتقارير التقنية والعروض التقديمية بثقة',
      description:
        'برنامج تطبيقي لتطوير مهارات بناء الفقرة الأكاديمية وتجنب الأخطاء الشائعة في البريد المهني والمقابلات.',
      level: 'INTERMEDIATE',
      price: '0.00',
      currency: 'EGP',
      thumbnailUrl: '/src/assets/images/course_uiux_design_1795328020176.jpg',
      lessons: [
        {
          title: '01. هيكلة الفقرة المتماسكة وكتابة جملة الموضوع',
          content: 'استخدام أدوات الربط المنطقي وبناء الحجج الواضحة.',
          durationMinutes: 22,
          isFreePreview: true,
        },
        {
          title: '02. صياغة المراسلات الرسمية والتقارير المختصرة',
          content: 'قوالب احترافية للتواصل مع الجامعات والشركات العالمية.',
          durationMinutes: 26,
          isFreePreview: false,
        },
        {
          title: '03. مراجعة القواعد الشائعة وتحسين الأسلوب',
          content: 'ضبط الأزمنة وبناء الجمل المركبة بوضوح وإيجاز.',
          durationMinutes: 24,
          isFreePreview: false,
        },
      ],
      quiz: {
        title: 'اختبار صياغة الكتابة الأكاديمية',
        description: 'تحقق من اختيار التعبيرات والأزمنة السليمة.',
        questions: [
          {
            questionText: 'ما الوظيفة الأساسية لـ Topic Sentence في بداية الفقرة؟',
            answers: [
              { answerText: 'تقديم الفكرة الرئيسية التي تشرحها الجمل الداعمة', isCorrect: true },
              { answerText: 'ختام البحث بالكامل وإدراج المراجع', isCorrect: false },
              { answerText: 'استبدال عنوان المقال بالكامل', isCorrect: false },
            ],
          },
        ],
      },
    },
  ];

  const existingCourseSlugs = new Set(
    (await db.select({ slug: courses.slug }).from(courses)).map((c) => c.slug)
  );

  for (const c of courseDefs) {
    if (existingCourseSlugs.has(c.slug)) continue;
    const fieldId =
      fieldMap.get(c.fieldSlug) ??
      fieldMap.get('programming') ??
      Array.from(fieldMap.values())[0];
    if (!fieldId) continue;

    const [createdCourse] = await db
      .insert(courses)
      .values({
        instructorUserId: c.instructorUserId,
        centerId: c.centerId,
        fieldId,
        subjectId: subjectMap.get(c.subjectSlug) ?? null,
        stageId: stageMap.get(c.stageSlug) ?? null,
        title: c.title,
        slug: c.slug,
        subtitle: c.subtitle,
        description: c.description,
        level: c.level,
        language: 'ar',
        price: c.price,
        currency: c.currency,
        thumbnailUrl: c.thumbnailUrl,
        status: 'PUBLISHED',
        isDemo: true,
      })
      .returning({ id: courses.id });

    coursesAdded += 1;

    await db.insert(courseLessons).values(
      c.lessons.map((l, idx) => ({
        courseId: createdCourse.id,
        title: l.title,
        content: l.content,
        durationMinutes: l.durationMinutes,
        sortOrder: idx + 1,
        isFreePreview: l.isFreePreview,
      }))
    );

    const [createdQuiz] = await db
      .insert(quizzes)
      .values({
        courseId: createdCourse.id,
        title: c.quiz.title,
        description: c.quiz.description,
        passingScore: 70,
      })
      .returning({ id: quizzes.id });
    quizzesAdded += 1;

    for (let qi = 0; qi < c.quiz.questions.length; qi++) {
      const qDef = c.quiz.questions[qi];
      const [createdQ] = await db
        .insert(questions)
        .values({
          quizId: createdQuiz.id,
          questionText: qDef.questionText,
          points: Math.round(100 / c.quiz.questions.length),
          sortOrder: qi + 1,
        })
        .returning({ id: questions.id });

      await db.insert(quizAnswers).values(
        qDef.answers.map((a) => ({
          questionId: createdQ.id,
          answerText: a.answerText,
          isCorrect: a.isCorrect,
        }))
      );
    }
  }

  // Add missing quizzes to existing demo courses (slugs from base seed only — never touch real course #4)
  const demoSlugsForQuizzes: Record<
    string,
    { title: string; description: string; qText: string; right: string; wrong: string }
  > = {
    'relational-database-mastery': {
      title: 'اختبار تطبيع قواعد البيانات (1NF - BCNF)',
      description: 'تحقق من فهمك للمفاتيح الأجنبية وإزالة التكرار.',
      qText: 'متى يكون الجدول محققاً للصيغة المعيارية الثالثة (3NF)؟',
      right: 'عندما يحقق 2NF ولا يعتمد أي عمود غير مفتاحي على عمود غير مفتاحي آخر',
      wrong: 'عند تخزين جميع القيم في عمود نصي واحد مفصول بفاصلة',
    },
    'arabic-rtl-design-systems': {
      title: 'اختبار أنظمة التصميم العربية RTL',
      description: 'تقييم فهم توازن الواجهات وتباين الألوان.',
      qText: 'ما المبدأ الأهم عند عكس واجهة من LTR إلى RTL؟',
      right: 'عكس اتجاه التدفق البصري والأيقونات الاتجاهية مع الحفاظ على ثبات الأرقام والرموز',
      wrong: 'تغيير محاذاة كل النصوص دون تعديل ترتيب العناصر والأيقونات',
    },
  };

  for (const [slug, qInfo] of Object.entries(demoSlugsForQuizzes)) {
    const [courseRow] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.slug, slug), eq(courses.isDemo, true)))
      .limit(1);
    if (!courseRow) continue;
    const existingQ = await db
      .select({ id: quizzes.id })
      .from(quizzes)
      .where(eq(quizzes.courseId, courseRow.id))
      .limit(1);
    if (existingQ.length > 0) continue;

    const [createdQuiz] = await db
      .insert(quizzes)
      .values({
        courseId: courseRow.id,
        title: qInfo.title,
        description: qInfo.description,
        passingScore: 70,
      })
      .returning({ id: quizzes.id });
    const [createdQ] = await db
      .insert(questions)
      .values({
        quizId: createdQuiz.id,
        questionText: qInfo.qText,
        points: 100,
        sortOrder: 1,
      })
      .returning({ id: questions.id });
    await db.insert(quizAnswers).values([
      { questionId: createdQ.id, answerText: qInfo.right, isCorrect: true },
      { questionId: createdQ.id, answerText: qInfo.wrong, isCorrect: false },
    ]);
    quizzesAdded += 1;
  }

  // --------------------------------------------------------------------------
  // 4. Realistic Educational Tasks & Teacher Offers (Near-Future Valid Deadlines)
  // --------------------------------------------------------------------------
  const taskDefs = [
    {
      title: 'شرح وتطبيق قوانين نيوتن والحركة الدائرية للصف الأول الثانوي',
      description:
        'أحتاج جلسة تطبيقية لحل 15 مسألة متنوعة على كمية التحرك وقوانين نيوتن مع توضيح كيفية قراءة المنحنيات البيانية.',
      categorySlug: 'concept-explanation',
      fieldSlug: 'sciences',
      subjectSlug: 'eg-physics',
      stageSlug: 'secondary',
      requiredSkills: 'Physics · Newton Laws · Graphs',
      budget: '240.00',
      currency: 'EGP',
      expectedDuration: 'جلستان (ساعتان)',
      preferredMethod: 'ONLINE',
      deadlineDaysAhead: 14,
      offerTeacherId: monaId,
      offerProposal:
        'سنقسم الجلسة الأولى على فهم العلاقات البيانية وحل 8 مسائل، والثانية لتدريبات الامتحان الكاملة مع ملخص PDF.',
      offerPrice: '220.00',
    },
    {
      title: 'مراجعة الجبر وحل المعادلات التربيعية للصف الثاني الإعدادي',
      description:
        'ابني يواجه صعوبة في التحليل وتطبيقاته على حل المعادلات ويحتاج متابعة منظمة قبل اختبارات الشهر.',
      categorySlug: 'concept-explanation',
      fieldSlug: 'mathematics',
      subjectSlug: 'eg-mathematics',
      stageSlug: 'preparatory',
      requiredSkills: 'Algebra · Factoring · Equations',
      budget: '300.00',
      currency: 'EGP',
      expectedDuration: '3 حصص خلال أسبوعين',
      preferredMethod: 'HYBRID',
      deadlineDaysAhead: 21,
      offerTeacherId: sherifId,
      offerProposal:
        'أقدّم خطة مراجعة متدرجة تبدأ بتبسيط أنواع التحليل السبعة مع أوراق عمل محلولة ومتابعة واجب كل حصة.',
      offerPrice: '280.00',
    },
    {
      title: 'بناء مشروع هياكل البيانات والقوائم المترابطة بلغة Python',
      description:
        'لدي تكليف جامعي حول تنفيذ Stack و Queue و Linked List بلغة Python مع قياس التعقيد الزمني لكل عملية.',
      categorySlug: 'assignment-guidance',
      fieldSlug: 'programming',
      subjectSlug: 'python-basics',
      stageSlug: 'university',
      requiredSkills: 'Python · Data Structures · Complexity',
      budget: '450.00',
      currency: 'EGP',
      expectedDuration: '3 أيام (جلستا إرشاد)',
      preferredMethod: 'ONLINE',
      deadlineDaysAhead: 18,
      offerTeacherId: karimId,
      offerProposal:
        'نراجع تصميم الفئات خطوة بخطوة وتكتب بنفسك الدوال الأساسية مع اختبارات وحدات للتأكد من صحة الحالات الحدية.',
      offerPrice: '420.00',
    },
    {
      title: 'مراجعة شاملة لتحويلات الكيمياء العضوية وحل نماذج الثانوية',
      description:
        'أريد معلم كيمياء يساعدني في ربط تفاعلات الألكينات والكحولات والأحماض الكربوكسيلية وحل أسئلة الاختيار من متعدد.',
      categorySlug: 'concept-explanation',
      fieldSlug: 'sciences',
      subjectSlug: 'eg-chemistry',
      stageSlug: 'secondary',
      requiredSkills: 'Organic Chemistry · IUPAC · Reactions',
      budget: '260.00',
      currency: 'EGP',
      expectedDuration: 'جلستان مكثفتان',
      preferredMethod: 'ONLINE',
      deadlineDaysAhead: 25,
      offerTeacherId: monaId,
      offerProposal:
        'نرسم خريطة التحويلات العضوية كاملة مع التدريب على استخراج المجموعات الوظيفية من الصيغ البنائية.',
      offerPrice: '250.00',
    },
    {
      title: 'مراجعة وتحسين مقال أكاديمي بالإنجليزية لمنحة دراسية',
      description:
        'أعددت مسودة خطاب الدافع والمقال الأكاديمي باللغة الإنجليزية وأحتاج مراجعة لغوية وبنائية دون تغيير صوتي الشخصي.',
      categorySlug: 'code-review',
      fieldSlug: 'languages',
      subjectSlug: 'business-english',
      stageSlug: 'graduates',
      requiredSkills: 'Academic Writing · English Editing',
      budget: '350.00',
      currency: 'EGP',
      expectedDuration: 'يومين',
      preferredMethod: 'ONLINE',
      deadlineDaysAhead: 16,
      offerTeacherId: laylaMentorId || fallbackTeacherId,
      offerProposal:
        'أراجع النص فقرة بفقرة مع توضيح مواطن التحسين اللغوي وتقوية الترابط المنطقي بين الخبرات والأهداف.',
      offerPrice: '330.00',
    },
    {
      title: 'تطبيق عملي على تحليل القوائم المالية وإعداد موازنة لمشروع تخرج',
      description:
        'نعمل على مشروع تخرج في إدارة الأعمال ونحتاج مرشداً يراجع حسابات نقطة التعادل والنسب المالية للتقرير النهائي.',
      categorySlug: 'practical-project',
      fieldSlug: 'accounting',
      subjectSlug: 'eg-accounting',
      stageSlug: 'university',
      requiredSkills: 'Financial Analysis · Excel · Accounting',
      budget: '500.00',
      currency: 'EGP',
      expectedDuration: 'أسبوع (3 جلسات)',
      preferredMethod: 'ONLINE',
      deadlineDaysAhead: 30,
      offerTeacherId: nadiaId,
      offerProposal:
        'نراجع نموذج Excel وقائمة الدخل المتوقعة ونضبط نسب السيولة والربحية والعرض التقديمي أمام لجنة المناقشة.',
      offerPrice: '480.00',
    },
    {
      title: 'تأسيس القراءة والإملاء والنحو الأساسي لطالب في الصف الرابع الابتدائي',
      description:
        'نبحث عن معلمة أو معلم لغة عربية بأسلوب مشجع لتحسين الطلاقة القرائية والإملاء والتعبير الكتابي.',
      categorySlug: 'concept-explanation',
      fieldSlug: 'arabic-language',
      subjectSlug: 'eg-arabic',
      stageSlug: 'primary',
      requiredSkills: 'القرائية · الإملاء · النحو المبسط',
      budget: '200.00',
      currency: 'EGP',
      expectedDuration: '4 جلسات أسبوعية',
      preferredMethod: 'ONLINE',
      deadlineDaysAhead: 28,
      offerTeacherId: null,
      offerProposal: '',
      offerPrice: '',
    },
  ];

  const existingTaskTitles = new Set(
    (await db.select({ title: educationalTasks.title }).from(educationalTasks)).map((t) =>
      t.title.trim()
    )
  );

  for (const t of taskDefs) {
    if (existingTaskTitles.has(t.title.trim())) continue;
    const deadline = isoDateDaysFromNow(t.deadlineDaysAhead);
    const deadlineErr = validateTaskDeadline(deadline);
    if (deadlineErr) {
      throw new Error(`Invalid seed deadline for task "${t.title}": ${deadlineErr}`);
    }

    const categoryId =
      categoryMap.get(t.categorySlug) ?? Array.from(categoryMap.values())[0];
    const fieldId = fieldMap.get(t.fieldSlug) ?? Array.from(fieldMap.values())[0];
    if (!categoryId || !fieldId) continue;

    const initialStatus = t.offerTeacherId ? 'OFFERS_RECEIVED' : 'OPEN';
    const [createdTask] = await db
      .insert(educationalTasks)
      .values({
        studentUserId: fallbackStudentId,
        categoryId,
        fieldId,
        subjectId: subjectMap.get(t.subjectSlug) ?? null,
        stageId: stageMap.get(t.stageSlug) ?? null,
        title: t.title,
        description: t.description,
        requiredSkills: t.requiredSkills,
        budget: t.budget,
        currency: t.currency,
        expectedDuration: t.expectedDuration,
        preferredMethod: t.preferredMethod,
        deadline,
        status: initialStatus,
        isDemo: true,
      })
      .returning({ id: educationalTasks.id });
    tasksAdded += 1;

    await db.insert(taskStatusHistory).values({
      taskId: createdTask.id,
      changedByUserId: fallbackStudentId,
      fromStatus: 'DRAFT',
      toStatus: 'OPEN',
      note: 'نشر المهمة التعليمية عبر منصة جسور',
    });

    if (t.offerTeacherId && t.offerTeacherId !== fallbackStudentId) {
      const [createdOffer] = await db
        .insert(taskOffers)
        .values({
          taskId: createdTask.id,
          teacherUserId: t.offerTeacherId,
          proposal: t.offerProposal,
          proposedPrice: t.offerPrice,
          expectedDuration: t.expectedDuration,
          deliveryMethod: t.preferredMethod === 'HYBRID' ? 'ONLINE' : t.preferredMethod,
          status: 'PENDING',
        })
        .returning({ id: taskOffers.id });

      await db.insert(taskStatusHistory).values({
        taskId: createdTask.id,
        offerId: createdOffer.id,
        changedByUserId: t.offerTeacherId,
        fromStatus: 'OPEN',
        toStatus: 'OFFERS_RECEIVED',
        note: 'تقديم عرض تعليمي جديد',
      });
    }
  }

  // --------------------------------------------------------------------------
  // 5. Realistic Curriculum-Linked Teaching Sessions & Availability Slots
  // --------------------------------------------------------------------------
  const currSubRows = await db
    .select({
      id: curriculumSubjects.id,
      subjectId: curriculumSubjects.subjectId,
      gradeId: curriculumSubjects.gradeId,
      systemId: curriculumSubjects.systemId,
      stageId: curriculumSubjects.stageId,
      divisionId: curriculumSubjects.divisionId,
      pathwayId: curriculumSubjects.pathwayId,
      subjectSlug: subjects.slug,
      gradeSlug: educationalGrades.slug,
    })
    .from(curriculumSubjects)
    .innerJoin(subjects, eq(curriculumSubjects.subjectId, subjects.id))
    .innerJoin(educationalGrades, eq(curriculumSubjects.gradeId, educationalGrades.id))
    .where(eq(curriculumSubjects.isActive, true));

  const findCurrSub = (gradeSlug: string, subjectSlug: string) =>
    currSubRows.find(
      (r) => r.gradeSlug === gradeSlug && r.subjectSlug === subjectSlug
    );

  const sessionDefs = [
    {
      seedKey: 'realistic-session-01',
      teacherUserId: monaId,
      gradeSlug: 'gen-sec-1',
      subjectSlug: 'eg-integrated-science',
      sessionType: 'GROUP' as const,
      title: 'مراجعة العلوم المتكاملة — الغلاف الجوي والطاقة (الصف الأول الثانوي)',
      description: 'شرح تفاعلي للوحدة الأولى وحل أسئلة نماذج الوزارة 2026/2027.',
      daysAhead: 8,
      startHour: 16,
      durationMin: 90,
      capacity: 15,
      minStudents: 3,
      price: 120,
      deliveryMode: 'ONLINE' as const,
      meetingUrl: 'https://meet.jusoor.example/sci-g10-01',
    },
    {
      seedKey: 'realistic-session-02',
      teacherUserId: monaId,
      gradeSlug: 'gen-sec-2',
      subjectSlug: 'eg-physics',
      sessionType: 'ONE_TO_ONE' as const,
      title: 'حصة فردية فيزياء: موجات الصوت والضوء والانكسار (2 ثانوي علمي)',
      description: 'تشخيص نقاط الضعف الفردية وحل مسائل الانعكاس الكلي والمنشور الثلاثي.',
      daysAhead: 10,
      startHour: 17,
      durationMin: 60,
      capacity: 1,
      minStudents: null,
      price: 220,
      deliveryMode: 'ONLINE' as const,
      meetingUrl: 'https://meet.jusoor.example/phys-1on1-02',
    },
    {
      seedKey: 'realistic-session-03',
      teacherUserId: monaId,
      gradeSlug: 'gen-sec-3',
      subjectSlug: 'eg-physics',
      sessionType: 'GROUP' as const,
      title: 'معسكر حضوري: التيار الكهربي وقانون أوم وكيرشوف (3 ثانوي)',
      description: 'حل 40 فكرة مسألة متدرجة على الدوائر الكهربية في قاعة المعادي.',
      daysAhead: 13,
      startHour: 15,
      durationMin: 120,
      capacity: 18,
      minStudents: 4,
      price: 150,
      deliveryMode: 'IN_PERSON' as const,
      governorate: 'القاهرة',
      city: 'المعادي',
      district: 'دجلة',
      streetName: 'شارع 233',
      buildingOrCenterName: 'أكاديمية النيل للعلوم والتفوق',
      locationNotes: 'القاعة الكبرى — الدور الثاني',
    },
    {
      seedKey: 'realistic-session-04',
      teacherUserId: karimId,
      gradeSlug: 'bacc-2',
      subjectSlug: 'eg-programming-ai',
      sessionType: 'GROUP' as const,
      title: 'ورشة تطبيقية: الخوارزميات وهياكل البيانات بالبكالوريا المصرية',
      description: 'تطبيق مباشر بلغة Python على البحث الثنائي والترتيب وتحليل التعقيد.',
      daysAhead: 11,
      startHour: 18,
      durationMin: 90,
      capacity: 12,
      minStudents: 2,
      price: 140,
      deliveryMode: 'ONLINE' as const,
      meetingUrl: 'https://meet.jusoor.example/bacc-ai-04',
    },
    {
      seedKey: 'realistic-session-05',
      teacherUserId: karimId,
      gradeSlug: 'bacc-1',
      subjectSlug: 'eg-programming-cs-ai',
      sessionType: 'ONE_TO_ONE' as const,
      title: 'جلسة إرشاد فردية: تأسيس التفكير البرمجي و Python (البكالوريا 1)',
      description: 'جلسة مخصصة لبناء المشروع البرمجي الأول خطوة بخطوة.',
      daysAhead: 15,
      startHour: 19,
      durationMin: 60,
      capacity: 1,
      minStudents: null,
      price: 250,
      deliveryMode: 'ONLINE' as const,
      meetingUrl: 'https://meet.jusoor.example/bacc-1on1-05',
    },
    {
      seedKey: 'realistic-session-06',
      teacherUserId: sherifId,
      gradeSlug: 'prep-2',
      subjectSlug: 'eg-mathematics',
      sessionType: 'GROUP' as const,
      title: 'مجموعة تأسيس الجبر والهندسة — الصف الثاني الإعدادي (سموحة)',
      description: 'تدريبات تفاعلية على الأعداد الحقيقية ونظريات المثلث المتساوي الساقين.',
      daysAhead: 12,
      startHour: 16,
      durationMin: 90,
      capacity: 16,
      minStudents: 3,
      price: 110,
      deliveryMode: 'IN_PERSON' as const,
      governorate: 'الإسكندرية',
      city: 'سموحة',
      district: 'منطقة النوادي',
      streetName: 'شارع فوزي معاذ',
      buildingOrCenterName: 'معهد المستقبل للتدريب التطبيقي',
      locationNotes: 'قاعة الرياضيات 3',
    },
    {
      seedKey: 'realistic-session-07',
      teacherUserId: sherifId,
      gradeSlug: 'primary-5',
      subjectSlug: 'eg-mathematics',
      sessionType: 'GROUP' as const,
      title: 'مراجعة الكسور العشرية والمساحات — الصف الخامس الابتدائي',
      description: 'شرح مبسط بالأنشطة والتدريبات الحسابية المصورة.',
      daysAhead: 9,
      startHour: 15,
      durationMin: 60,
      capacity: 14,
      minStudents: 3,
      price: 90,
      deliveryMode: 'ONLINE' as const,
      meetingUrl: 'https://meet.jusoor.example/prim5-math-07',
    },
    {
      seedKey: 'realistic-session-08',
      teacherUserId: sherifId,
      gradeSlug: 'prep-3',
      subjectSlug: 'eg-mathematics',
      sessionType: 'ONE_TO_ONE' as const,
      title: 'حصة فردية: حساب المثلثات والهندسة التحليلية — الشهادة الإعدادية',
      description: 'مراجعة مكثفة لمعادلة الخط المستقيم والنسب المثلثية وحل المحافظات.',
      daysAhead: 17,
      startHour: 17,
      durationMin: 60,
      capacity: 1,
      minStudents: null,
      price: 200,
      deliveryMode: 'ONLINE' as const,
      meetingUrl: 'https://meet.jusoor.example/prep3-math-08',
    },
    {
      seedKey: 'realistic-session-09',
      teacherUserId: nadiaId,
      gradeSlug: 'bacc-2',
      subjectSlug: 'eg-accounting',
      sessionType: 'GROUP' as const,
      title: 'ورشة المحاسبة المالية وإعداد القوائم — مسار الأعمال',
      description: 'تطبيق عملي على تحليل الميزانية وقائمة الدخل للطلاب.',
      daysAhead: 19,
      startHour: 18,
      durationMin: 90,
      capacity: 12,
      minStudents: 2,
      price: 135,
      deliveryMode: 'ONLINE' as const,
      meetingUrl: 'https://meet.jusoor.example/bacc-acc-09',
    },
    {
      seedKey: 'realistic-session-10',
      teacherUserId: nadiaId,
      gradeSlug: 'bacc-3',
      subjectSlug: 'eg-economics-adv',
      sessionType: 'ONE_TO_ONE' as const,
      title: 'جلسة فردية: الاقتصاد الكلي وتحليل المؤشرات — البكالوريا 3',
      description: 'مناقشة فردية لأسئلة التفكير التحليلي والناتج القومي والتضخم.',
      daysAhead: 22,
      startHour: 19,
      durationMin: 60,
      capacity: 1,
      minStudents: null,
      price: 260,
      deliveryMode: 'ONLINE' as const,
      meetingUrl: 'https://meet.jusoor.example/bacc-econ-10',
    },
  ];

  const existingSeedKeys = new Set(
    (
      await db
        .select({ seedKey: teachingSessions.seedKey })
        .from(teachingSessions)
        .where(
          inArray(
            teachingSessions.seedKey,
            sessionDefs.map((s) => s.seedKey)
          )
        )
    )
      .map((r) => r.seedKey)
      .filter((k): k is string => Boolean(k))
  );

  for (const s of sessionDefs) {
    if (existingSeedKeys.has(s.seedKey)) continue;
    const cs = findCurrSub(s.gradeSlug, s.subjectSlug);
    const startTime = dateAtUtcHour(s.daysAhead, s.startHour, 0);
    const endTime = new Date(startTime.getTime() + s.durationMin * 60_000);
    const registrationDeadline = new Date(startTime.getTime() - 24 * 3_600_000);

    const location =
      s.deliveryMode === 'IN_PERSON'
        ? formatOfflineAddress({
            governorate: s.governorate,
            city: s.city,
            district: s.district,
            streetName: s.streetName,
            buildingOrCenterName: s.buildingOrCenterName,
            locationNotes: s.locationNotes,
          })
        : null;

    const schedErr = validateSessionSchedule({
      sessionType: s.sessionType,
      startTime,
      endTime,
      capacity: s.capacity,
      minStudents: s.minStudents,
      price: s.price,
      deliveryMode: s.deliveryMode,
      location,
      governorate: 'governorate' in s ? s.governorate : undefined,
      city: 'city' in s ? s.city : undefined,
      streetName: 'streetName' in s ? s.streetName : undefined,
      buildingOrCenterName:
        'buildingOrCenterName' in s ? s.buildingOrCenterName : undefined,
      registrationDeadline,
    });
    if (schedErr) {
      throw new Error(`Invalid realistic session ${s.seedKey}: ${schedErr}`);
    }

    if (cs) {
      await db
        .insert(teacherTeachingAssignments)
        .values({
          teacherUserId: s.teacherUserId,
          curriculumSubjectId: cs.id,
          subjectId: cs.subjectId,
          gradeId: cs.gradeId,
          systemId: cs.systemId,
          divisionId: cs.divisionId,
          pathwayId: cs.pathwayId,
          languagesOfferedJson: ['ar'],
          hourlyRate: s.price.toFixed(2),
          currency: 'EGP',
          supportsOnline: s.deliveryMode === 'ONLINE',
          supportsInPerson: s.deliveryMode === 'IN_PERSON',
          isActive: true,
        })
        .onConflictDoNothing();
    }

    await db.insert(teachingSessions).values({
      teacherUserId: s.teacherUserId,
      subjectId: cs?.subjectId ?? subjectMap.get(s.subjectSlug) ?? null,
      curriculumSubjectId: cs?.id ?? null,
      systemId: cs?.systemId ?? null,
      gradeId: cs?.gradeId ?? gradeMap.get(s.gradeSlug)?.id ?? null,
      stageId: cs?.stageId ?? null,
      divisionId: cs?.divisionId ?? null,
      pathwayId: cs?.pathwayId ?? null,
      sessionType: s.sessionType,
      title: s.title,
      description: s.description,
      startTime,
      endTime,
      durationMinutes: s.durationMin,
      capacity: s.capacity,
      minStudents: s.minStudents,
      price: s.price.toFixed(2),
      currency: 'EGP',
      deliveryMode: s.deliveryMode,
      location,
      governorate: 'governorate' in s ? s.governorate ?? null : null,
      city: 'city' in s ? s.city ?? null : null,
      district: 'district' in s ? s.district ?? null : null,
      streetName: 'streetName' in s ? s.streetName ?? null : null,
      buildingOrCenterName:
        'buildingOrCenterName' in s ? s.buildingOrCenterName ?? null : null,
      locationNotes: 'locationNotes' in s ? s.locationNotes ?? null : null,
      isDemoLocation: s.deliveryMode === 'IN_PERSON',
      meetingUrl: 'meetingUrl' in s ? s.meetingUrl ?? null : null,
      registrationDeadline,
      status: 'OPEN',
      seedKey: s.seedKey,
      isDemo: true,
    });
    sessionsAdded += 1;
  }

  // Availability slots for consultation / mentorship booking
  const availDefs = [
    {
      providerUserId: karimId,
      daysAhead: 6,
      startTime: '17:00',
      endTime: '18:00',
      serviceType: 'MENTORSHIP',
    },
    {
      providerUserId: karimId,
      daysAhead: 9,
      startTime: '18:30',
      endTime: '19:30',
      serviceType: 'CONSULTATION',
    },
    {
      providerUserId: monaId,
      daysAhead: 7,
      startTime: '16:00',
      endTime: '17:00',
      serviceType: 'PRIVATE_LESSON',
    },
    {
      providerUserId: sherifId,
      daysAhead: 10,
      startTime: '17:30',
      endTime: '18:30',
      serviceType: 'PRIVATE_LESSON',
    },
    {
      providerUserId: nadiaId,
      daysAhead: 11,
      startTime: '19:00',
      endTime: '20:00',
      serviceType: 'CONSULTATION',
    },
  ];

  for (const av of availDefs) {
    const slotDate = isoDateDaysFromNow(av.daysAhead);
    const avErr = validateAvailabilitySlot(slotDate, av.startTime, av.endTime);
    if (avErr) {
      throw new Error(`Invalid realistic availability slot: ${avErr}`);
    }
    const insertedAv = await db
      .insert(availability)
      .values({
        providerUserId: av.providerUserId,
        dayOfWeek: arabicDayOfWeek(slotDate),
        slotDate,
        startTime: av.startTime,
        endTime: av.endTime,
        serviceType: av.serviceType,
        isBooked: false,
      })
      .onConflictDoNothing()
      .returning({ id: availability.id });
    if (insertedAv.length > 0) {
      availabilityAdded += 1;
    }
  }

  // Ensure serial sequences remain synced cleanly after inserts
  await db.execute(
    sql`SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1))`
  );

  return {
    centersAdded,
    coursesAdded,
    quizzesAdded,
    tasksAdded,
    sessionsAdded,
    availabilityAdded,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedRealisticPlatformData()
    .then((summary) => {
      console.log('Realistic platform data seeded:', summary);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Realistic seed failed:', err);
      process.exit(1);
    });
}
