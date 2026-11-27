import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  academicYears,
  baccalaureatePathways,
  courseLessons,
  courses,
  curriculumSubjects,
  curriculumVersions,
  educationalGrades,
  educationalStages,
  educationalSystems,
  fields,
  providerProfiles,
  roles,
  secondaryDivisions,
  subjects,
  teacherTeachingAssignments,
  teachingSessions,
  userRoles,
  users,
} from '../db/schema.ts';
import { hashPassword } from './auth.ts';

interface AssignmentRule {
  systemCode:
    | 'PRIMARY_GENERAL'
    | 'PREPARATORY_GENERAL'
    | 'GENERAL_SECONDARY'
    | 'EGYPTIAN_BACCALAUREATE';
  gradeSlugs: string[];
  subjectSlugs: string[];
  divisionCodes?: string[];
  pathwayCodes?: string[];
  languages: string[];
  religiousVariant?: string;
  hourlyRate: string;
  supportsOnline: boolean;
  supportsInPerson: boolean;
  notes?: string;
}

interface StageTeacherDef {
  email: string;
  fullName: string;
  headline: string;
  bio: string;
  qualifications: string;
  yearsExperience: number;
  hourlyRate: string;
  rules: AssignmentRule[];
}

const DEMO_QUAL_SUFFIX = '(ملف عرض تجريبي قيد التوثيق)';

const STAGE_TEACHERS: StageTeacherDef[] = [
  // =========================================================================
  // A. PRIMARY STAGE (PRIMARY_GENERAL) — Grades 1..6 ONLY
  // =========================================================================
  // Primary Arabic (3 new; plus existing yasser.arabic@demo.jusoor.edu scoped to Primary 4..6 Arabic)
  {
    email: 'prim.arabic.1@teachers.demo.jusoor.edu',
    fullName: 'أ. أحمد محمد',
    headline: 'معلم لغة عربية وتأسيس القراءة والكتابة — المرحلة الابتدائية',
    bio: 'متخصص في تأسيس اللغة العربية والنحو والإملاء لطلاب الصفوف الابتدائية من الأول حتى السادس بأسلوب مبسط وتفاعلي.',
    qualifications: `ليسانس لغة عربية وتربية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '18.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-1', 'primary-2', 'primary-3', 'primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-arabic'],
        languages: ['ar'],
        hourlyRate: '18.00',
        supportsOnline: true,
        supportsInPerson: true,
        notes: 'تأسيس القرائية والنحو التعبيري للمرحلة الابتدائية',
      },
    ],
  },
  {
    email: 'prim.arabic.2@teachers.demo.jusoor.edu',
    fullName: 'أ. هبة إبراهيم',
    headline: 'معلمة لغة عربية ونحو — المرحلة الابتدائية (الصفوف 1–6)',
    bio: 'أساعد تلاميذ المرحلة الابتدائية على إتقان القراءة السليمة والخط العربي وفهم القواعد النحوية الأساسية.',
    qualifications: `بكالوريوس تربية لغة عربية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '16.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-1', 'primary-2', 'primary-3', 'primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-arabic'],
        languages: ['ar'],
        hourlyRate: '16.00',
        supportsOnline: true,
        supportsInPerson: false,
        notes: 'تبسيط النحو والتعبير الكتابي للصفوف الابتدائية',
      },
    ],
  },
  {
    email: 'prim.arabic.3@teachers.demo.jusoor.edu',
    fullName: 'أ. كريم حسن',
    headline: 'معلم لغة عربية وتنمية المهارات اللغوية — الابتدائي',
    bio: 'تدريس منهج اللغة العربية المطور للمرحلة الابتدائية مع تدريبات إملائية وقصص تعليمية تفاعلية.',
    qualifications: `ليسانس دار العلوم ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 6,
    hourlyRate: '17.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-1', 'primary-2', 'primary-3', 'primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-arabic'],
        languages: ['ar'],
        hourlyRate: '17.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Primary English (Connect & Connect Plus)
  {
    email: 'prim.english.1@teachers.demo.jusoor.edu',
    fullName: 'أ. أحمد مصطفى',
    headline: 'معلم لغة إنجليزية (Connect & Connect Plus) — المرحلة الابتدائية',
    bio: 'متخصص في تدريس اللغة الإنجليزية للمرحلة الابتدائية وفق منهجي Connect و Connect Plus مع التركيز على النطق والقراءة.',
    qualifications: `بكالوريوس تربية لغة إنجليزية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '20.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-1', 'primary-2', 'primary-3', 'primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-english'],
        languages: ['en', 'ar'],
        hourlyRate: '20.00',
        supportsOnline: true,
        supportsInPerson: true,
        notes: 'تغطية شاملة لمنهج Connect و Connect Plus الابتدائي',
      },
    ],
  },
  {
    email: 'prim.english.2@teachers.demo.jusoor.edu',
    fullName: 'أ. سارة محمود',
    headline: 'معلمة لغة إنجليزية وتأسيس الصوتيات — الابتدائي',
    bio: 'تدريس اللغة الإنجليزية للصغار باستخدام الأنشطة السمعية والبصرية وبناء الحصيلة اللغوية للصفوف من الأول للسادس الابتدائي.',
    qualifications: `ليسانس آداب قسم اللغة الإنجليزية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 6,
    hourlyRate: '19.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-1', 'primary-2', 'primary-3', 'primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-english'],
        languages: ['en'],
        hourlyRate: '19.00',
        supportsOnline: true,
        supportsInPerson: false,
        notes: 'تركيز على Phonics ومهارات القراءة في Connect',
      },
    ],
  },
  {
    email: 'prim.english.3@teachers.demo.jusoor.edu',
    fullName: 'أ. منى إبراهيم',
    headline: 'معلمة لغة إنجليزية للمرحلة الابتدائية — عربي ولغات',
    bio: 'شرح مبسط لقواعد ومفردات اللغة الإنجليزية للصفوف الابتدائية مع متابعة أسبوعية للواجبات والاختبارات.',
    qualifications: `بكالوريوس ألسن لغة إنجليزية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 5,
    hourlyRate: '18.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-1', 'primary-2', 'primary-3', 'primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-english'],
        languages: ['en', 'ar'],
        hourlyRate: '18.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Primary Mathematics (3 new + existing ahmed.math scoped to Primary 4..6 Math)
  {
    email: 'prim.math.1@teachers.demo.jusoor.edu',
    fullName: 'أ. محمود أحمد',
    headline: 'معلم رياضيات — المرحلة الابتدائية (عربي ولغات)',
    bio: 'متخصص في تأسيس المهارات الحسابية والكسور والهندسة لتلاميذ المرحلة الابتدائية باللغتين العربية والإنجليزية.',
    qualifications: `بكالوريوس تربية رياضيات ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 10,
    hourlyRate: '20.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-1', 'primary-2', 'primary-3', 'primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-mathematics'],
        languages: ['ar', 'en'],
        hourlyRate: '20.00',
        supportsOnline: true,
        supportsInPerson: true,
        notes: 'تأسيس الحساب والهندسة للصفوف الابتدائية',
      },
    ],
  },
  {
    email: 'prim.math.2@teachers.demo.jusoor.edu',
    fullName: 'أ. سلمى إبراهيم',
    headline: 'معلمة رياضيات (Math) — المرحلة الابتدائية لغات وعربي',
    bio: 'أساعد طلاب الابتدائي على فهم مسائل الكلام الرياضية وتطبيق استراتيجيات الحساب الذهني بثقة.',
    qualifications: `بكالوريوس علوم وتربية قسم رياضيات ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '21.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-1', 'primary-2', 'primary-3', 'primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-mathematics'],
        languages: ['en', 'ar', 'fr'],
        hourlyRate: '21.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'prim.math.3@teachers.demo.jusoor.edu',
    fullName: 'أ. يوسف خالد',
    headline: 'معلم رياضيات وتدريبات التفكير المنطقي — الابتدائي',
    bio: 'تدريس منهج الرياضيات للصفوف الابتدائية مع أوراق عمل تفاعلية وحل نماذج التقييمات الشهرية.',
    qualifications: `بكالوريوس تربية رياضيات ابتدائي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 6,
    hourlyRate: '18.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-1', 'primary-2', 'primary-3', 'primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-mathematics'],
        languages: ['ar', 'en'],
        hourlyRate: '18.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Primary Science (Grades 4..6; plus existing salma.science scoped to Primary 4..6 Science)
  {
    email: 'prim.science.1@teachers.demo.jusoor.edu',
    fullName: 'أ. منى أحمد',
    headline: 'معلمة علوم (Science) — الصفوف الرابع والخامس والسادس الابتدائي',
    bio: 'شرح مبسط لمفاهيم العلوم الطبيعية والطاقة والكائنات الحية للصفوف العليا بالمرحلة الابتدائية.',
    qualifications: `بكالوريوس علوم وتربية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '20.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-science'],
        languages: ['ar', 'en'],
        hourlyRate: '20.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'prim.science.2@teachers.demo.jusoor.edu',
    fullName: 'أ. رنا محمود',
    headline: 'معلمة علوم للمدارس العربية واللغات — المرحلة الابتدائية',
    bio: 'تقديم تجارب توضيحية وأنشطة استكشافية تساعد طلاب الصف الرابع والخامس والسادس على استيعاب مادة العلوم.',
    qualifications: `بكالوريوس تربية شعبة علوم ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 6,
    hourlyRate: '19.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-science'],
        languages: ['en', 'ar', 'fr'],
        hourlyRate: '19.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'prim.science.3@teachers.demo.jusoor.edu',
    fullName: 'أ. كريم خالد',
    headline: 'معلم علوم وتطبيقات استكشافية — الابتدائي',
    bio: 'تبسيط وحدات العلوم في المنهج الابتدائي الجديد وربطها بأمثلة من الحياة اليومية للطلاب.',
    qualifications: `بكالوريوس علوم تطبيقية ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 5,
    hourlyRate: '18.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-science'],
        languages: ['ar', 'en'],
        hourlyRate: '18.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Primary Social Studies (Grades 4..6)
  {
    email: 'prim.social.1@teachers.demo.jusoor.edu',
    fullName: 'أ. حنان عبد العزيز',
    headline: 'معلمة دراسات اجتماعية — المرحلة الابتدائية (الصفوف 4–6)',
    bio: 'تدريس الجغرافيا والتاريخ المصري لطلاب المرحلة الابتدائية باستخدام الخرائط الذهنية والقصص التاريخية.',
    qualifications: `ليسانس تربية تاريخ وجغرافيا ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '16.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-social-studies'],
        languages: ['ar'],
        hourlyRate: '16.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'prim.social.2@teachers.demo.jusoor.edu',
    fullName: 'أ. تامر فاروق',
    headline: 'معلم دراسات اجتماعية — الابتدائي',
    bio: 'مساعدة طلاب الصف الرابع والخامس والسادس الابتدائي على قراءة الخرائط وفهم المفاهيم الجغرافية والتاريخية.',
    qualifications: `ليسانس آداب جغرافيا ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '15.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-social-studies'],
        languages: ['ar'],
        hourlyRate: '15.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'prim.social.3@teachers.demo.jusoor.edu',
    fullName: 'أ. دعاء صلاح',
    headline: 'معلمة دراسات اجتماعية ومهارات الخرائط — الابتدائي',
    bio: 'مراجعات دورية وتلخيصات مرئية لمادة الدراسات الاجتماعية للمرحلة الابتدائية.',
    qualifications: `ليسانس تربية دراسات اجتماعية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 5,
    hourlyRate: '15.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-social-studies'],
        languages: ['ar'],
        hourlyRate: '15.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Primary Religious Education (Grades 1..6)
  {
    email: 'prim.religion.1@teachers.demo.jusoor.edu',
    fullName: 'أ. عبد الله سعيد',
    headline: 'معلم تربية دينية إسلامية — المرحلة الابتدائية',
    bio: 'تعليم القيم والعبادات والقصص التربوية لطلاب الصفوف من الأول إلى السادس الابتدائي بأسلوب محبب.',
    qualifications: `ليسانس دراسات إسلامية ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '15.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-1', 'primary-2', 'primary-3', 'primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-religious-ed'],
        languages: ['ar'],
        religiousVariant: 'ISLAMIC',
        hourlyRate: '15.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'prim.religion.2@teachers.demo.jusoor.edu',
    fullName: 'أ. أسماء فؤاد',
    headline: 'معلمة تربية دينية إسلامية — الصفوف الابتدائية',
    bio: 'تحفيظ وشرح مبسط لموضوعات التربية الدينية الإسلامية في المنهج الابتدائي.',
    qualifications: `ليسانس أصول دين وتربية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 6,
    hourlyRate: '14.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-1', 'primary-2', 'primary-3', 'primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-religious-ed'],
        languages: ['ar'],
        religiousVariant: 'ISLAMIC',
        hourlyRate: '14.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'prim.religion.3@teachers.demo.jusoor.edu',
    fullName: 'أ. مينا جرجس',
    headline: 'معلم تربية دينية مسيحية — المرحلة الابتدائية',
    bio: 'تدريس منهج التربية الدينية المسيحية للمرحلة الابتدائية مع التركيز على القيم الأخلاقية والمفاهيم الأساسية.',
    qualifications: `بكالوريوس دراسات تربوية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '15.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-1', 'primary-2', 'primary-3', 'primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-religious-ed'],
        languages: ['ar'],
        religiousVariant: 'CHRISTIAN',
        hourlyRate: '15.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Primary ICT (Grades 4..6)
  {
    email: 'prim.ict.1@teachers.demo.jusoor.edu',
    fullName: 'م. رامي نبيل',
    headline: 'معلم تكنولوجيا المعلومات والاتصالات (ICT) — الابتدائي',
    bio: 'تقديم أساسيات الحاسب والأمان الرقمي وتطبيقات تكنولوجيا المعلومات للصفوف الرابع والخامس والسادس الابتدائي.',
    qualifications: `بكالوريوس حاسبات ومعلومات ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 6,
    hourlyRate: '18.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-ict-primary'],
        languages: ['ar', 'en'],
        hourlyRate: '18.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'prim.ict.2@teachers.demo.jusoor.edu',
    fullName: 'أ. ندى شوقي',
    headline: 'معلمة تكنولوجيا المعلومات والاتصالات — عربي ولغات (الابتدائي)',
    bio: 'شرح عملي لمادة ICT الابتدائية باللغتين العربية والإنجليزية مع تطبيقات على البحث الآمن وبرامج العروض.',
    qualifications: `بكالوريوس تكنولوجيا التعليم ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 5,
    hourlyRate: '17.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-ict-primary'],
        languages: ['en', 'ar', 'fr'],
        hourlyRate: '17.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'prim.ict.3@teachers.demo.jusoor.edu',
    fullName: 'أ. حسن علام',
    headline: 'معلم مهارات رقمية و ICT — المرحلة الابتدائية',
    bio: 'تنمية مهارات استخدام الحاسب والإنترنت الآمن وتنفيذ المشروعات الرقمية الصغيرة لطلاب الابتدائي.',
    qualifications: `بكالوريوس نظم معلومات تربوية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 4,
    hourlyRate: '16.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-ict-primary'],
        languages: ['ar', 'en'],
        hourlyRate: '16.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },

  // Primary Art Education (Grades 4..6)
  {
    email: 'prim.art.1@teachers.demo.jusoor.edu',
    fullName: 'أ. لمياء رشدي',
    headline: 'معلمة تربية فنية ورسم — المرحلة الابتدائية',
    bio: 'تنمية مهارات الرسم والتلوين والأشغال الفنية لتلاميذ الصفوف الرابع والخامس والسادس الابتدائي.',
    qualifications: `بكالوريوس تربية فنية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '15.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-art-ed'],
        languages: ['ar'],
        hourlyRate: '15.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'prim.art.2@teachers.demo.jusoor.edu',
    fullName: 'أ. مصطفى عزت',
    headline: 'معلم تربية فنية وتشكيل — الابتدائي',
    bio: 'ورش تطبيقية في التصميم الفني والألوان والخامات البيئية لطلاب المرحلة الابتدائية.',
    qualifications: `بكالوريوس فنون جميلة ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 6,
    hourlyRate: '15.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-art-ed'],
        languages: ['ar'],
        hourlyRate: '15.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'prim.art.3@teachers.demo.jusoor.edu',
    fullName: 'أ. إنجي وائل',
    headline: 'معلمة تربية فنية — المرحلة الابتدائية',
    bio: 'توجيه التلاميذ في مشروعات الرسم التعبيري والتذوق الفني للمرحلة الابتدائية.',
    qualifications: `بكالوريوس تربية نوعية قسم تربية فنية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 5,
    hourlyRate: '14.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-art-ed'],
        languages: ['ar'],
        hourlyRate: '14.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },

  // Primary Physical & Health Education (Grades 1..6)
  {
    email: 'prim.pe.1@teachers.demo.jusoor.edu',
    fullName: 'ك. شادي رفعت',
    headline: 'معلم تربية بدنية وصحية — المرحلة الابتدائية',
    bio: 'إعداد برامج التوافق العضلي والعادات الصحية السليمة لتلاميذ الصفوف الابتدائية.',
    qualifications: `بكالوريوس تربية رياضية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '15.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-1', 'primary-2', 'primary-3', 'primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-pe-health'],
        languages: ['ar'],
        hourlyRate: '15.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'prim.pe.2@teachers.demo.jusoor.edu',
    fullName: 'ك. يارا محسن',
    headline: 'معلمة تربية بدنية وصحية — الابتدائي',
    bio: 'تعليم التمرينات الحركية والتوعية الغذائية والصحية للمرحلة الابتدائية.',
    qualifications: `بكالوريوس تربية رياضية وصحية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 5,
    hourlyRate: '14.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-1', 'primary-2', 'primary-3', 'primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-pe-health'],
        languages: ['ar'],
        hourlyRate: '14.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'prim.pe.3@teachers.demo.jusoor.edu',
    fullName: 'ك. بلال طارق',
    headline: 'معلم تربية بدنية وأنشطة حركية — الابتدائي',
    bio: 'تطوير اللياقة الأساسية والمهارات الحركية الفردية والجماعية لتلاميذ المرحلة الابتدائية.',
    qualifications: `بكالوريوس تربية رياضية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 6,
    hourlyRate: '15.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-1', 'primary-2', 'primary-3', 'primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-pe-health'],
        languages: ['ar'],
        hourlyRate: '15.00',
        supportsOnline: false,
        supportsInPerson: true,
      },
    ],
  },

  // Primary Tokkatsu Activities (Grades 1..3)
  {
    email: 'prim.tokkatsu.1@teachers.demo.jusoor.edu',
    fullName: 'أ. مروة الزهيري',
    headline: 'معلّمة ومنسّقة أنشطة التوكاتسو — الصفوف الأولى الابتدائية',
    bio: 'تطبيق أنشطة التوكاتسو لبناء الشخصية والعمل التعاوني والانضباط اليومي للصفوف الأول والثاني والثالث الابتدائي.',
    qualifications: `بكالوريوس تربية طفولة مبكرة ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 6,
    hourlyRate: '15.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-1', 'primary-2', 'primary-3'],
        subjectSlugs: ['eg-tokkatsu'],
        languages: ['ar'],
        hourlyRate: '15.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'prim.tokkatsu.2@teachers.demo.jusoor.edu',
    fullName: 'أ. شريف عبد الباقي',
    headline: 'ميسّر أنشطة التوكاتسو والمهارات الحياتية — الابتدائي',
    bio: 'تدريب التلاميذ الصغار على مهارات القيادة الصفية وحل المشكلات الجماعية عبر أنشطة التوكاتسو.',
    qualifications: `بكالوريوس تربية ابتدائي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 5,
    hourlyRate: '14.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-1', 'primary-2', 'primary-3'],
        subjectSlugs: ['eg-tokkatsu'],
        languages: ['ar'],
        hourlyRate: '14.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'prim.tokkatsu.3@teachers.demo.jusoor.edu',
    fullName: 'أ. غادة منير',
    headline: 'معلمة أنشطة التوكاتسو والتعلم الاجتماعي — الابتدائي',
    bio: 'جلسات تفاعلية لتنمية المسؤولية والتعاون وتنظيم الوقت لدى تلاميذ الصفوف الأولى.',
    qualifications: `ليسانس تربية وعلم نفس ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 4,
    hourlyRate: '14.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-1', 'primary-2', 'primary-3'],
        subjectSlugs: ['eg-tokkatsu'],
        languages: ['ar'],
        hourlyRate: '14.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },

  // Primary Music Education (Grades 4..6)
  {
    email: 'prim.music.1@teachers.demo.jusoor.edu',
    fullName: 'أ. نسمة فكري',
    headline: 'معلمة تربية موسيقية — المرحلة الابتدائية',
    bio: 'تنمية التذوق الموسيقي والصولفيج المبسط والأناشيد المدرسية للصفوف الرابع والخامس والسادس الابتدائي.',
    qualifications: `بكالوريوس تربية موسيقية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '15.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-music-ed'],
        languages: ['ar'],
        hourlyRate: '15.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'prim.music.2@teachers.demo.jusoor.edu',
    fullName: 'أ. حاتم وجدي',
    headline: 'معلم تربية موسيقية وإيقاع — الابتدائي',
    bio: 'تدريس مبادئ الإيقاع والمقامات الأساسية وتدريب الكورال المدرسي لطلاب الابتدائي.',
    qualifications: `بكالوريوس تربية نوعية قسم موسيقى ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 6,
    hourlyRate: '14.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-music-ed'],
        languages: ['ar'],
        hourlyRate: '14.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'prim.music.3@teachers.demo.jusoor.edu',
    fullName: 'أ. ريم مجدي',
    headline: 'معلمة تربية موسيقية وأنشطة صوتية — الابتدائي',
    bio: 'جلسات تعليمية في القراءة الإيقاعية والغناء التربوي للمرحلة الابتدائية.',
    qualifications: `بكالوريوس تربية موسيقية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 4,
    hourlyRate: '14.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-music-ed'],
        languages: ['ar'],
        hourlyRate: '14.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },

  // Primary Practical & Vocational Skills (Grades 4..6)
  {
    email: 'prim.skills.1@teachers.demo.jusoor.edu',
    fullName: 'أ. صلاح البنا',
    headline: 'معلم مهارات الزراعة والصناعة وإدارة الأسرة — الابتدائي',
    bio: 'إشراف عملي على الأنشطة المهنية والزراعية والصناعية وإدارة الأسرة لطلاب الصفوف الرابع حتى السادس الابتدائي.',
    qualifications: `بكالوريوس تربية تعليم أساسي ومهارات مهنية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '14.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-agri-skills', 'eg-ind-skills', 'eg-family-mgmt'],
        languages: ['ar'],
        hourlyRate: '14.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'prim.skills.2@teachers.demo.jusoor.edu',
    fullName: 'أ. سحر بدر',
    headline: 'معلمة المهارات الحياتية والمهنية — المرحلة الابتدائية',
    bio: 'تبسيط مشروعات الزراعة المنزلية والمهارات الصناعية وإدارة شؤون الأسرة لتلاميذ الابتدائي.',
    qualifications: `بكالوريوس اقتصاد منزلي وتربية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '14.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-agri-skills', 'eg-ind-skills', 'eg-family-mgmt'],
        languages: ['ar'],
        hourlyRate: '14.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'prim.skills.3@teachers.demo.jusoor.edu',
    fullName: 'أ. عادل زكريا',
    headline: 'معلم المهارات العملية والأنشطة التطبيقية — الابتدائي',
    bio: 'تدريب عملي للطلاب على المشروعات الصفية في الزراعة والصناعة وتنظيم الأسرة.',
    qualifications: `بكالوريوس تربية عملي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 6,
    hourlyRate: '14.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-agri-skills', 'eg-ind-skills', 'eg-family-mgmt'],
        languages: ['ar'],
        hourlyRate: '14.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Primary Media, Theater & Libraries (Grades 4..6)
  {
    email: 'prim.media.1@teachers.demo.jusoor.edu',
    fullName: 'أ. دينا العوضي',
    headline: 'أخصائية إعلام تربوي ومكتبات ومسرح — المرحلة الابتدائية',
    bio: 'تنمية مهارات القراءة والبحث في المكتبة والإذاعة المدرسية والمسرح التعليمي للصفوف الرابع والخامس والسادس.',
    qualifications: `بكالوريوس تربية نوعية إعلام تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '15.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-edu-media', 'eg-drama-ed', 'eg-libraries'],
        languages: ['ar'],
        hourlyRate: '15.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'prim.media.2@teachers.demo.jusoor.edu',
    fullName: 'أ. وائل سليمان',
    headline: 'معلم مسرح مدرسي وإعلام تربوي ومكتبات — الابتدائي',
    bio: 'تطوير مهارات الإلقاء والتمثيل المسرحي والاطلاع المنهجي لدى تلاميذ المرحلة الابتدائية.',
    qualifications: `ليسانس مكتبات وإعلام تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 6,
    hourlyRate: '14.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-edu-media', 'eg-drama-ed', 'eg-libraries'],
        languages: ['ar'],
        hourlyRate: '14.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'prim.media.3@teachers.demo.jusoor.edu',
    fullName: 'أ. سماح لطفي',
    headline: 'أخصائية مكتبات وتربية مسرحية — المرحلة الابتدائية',
    bio: 'مساعدة التلاميذ على تلخيص القصص وتقديم فقرات الإعلام التربوي والأنشطة المسرحية.',
    qualifications: `ليسانس مكتبات ومعلومات ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 5,
    hourlyRate: '14.00',
    rules: [
      {
        systemCode: 'PRIMARY_GENERAL',
        gradeSlugs: ['primary-4', 'primary-5', 'primary-6'],
        subjectSlugs: ['eg-edu-media', 'eg-drama-ed', 'eg-libraries'],
        languages: ['ar'],
        hourlyRate: '14.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // =========================================================================
  // B. PREPARATORY STAGE (PREPARATORY_GENERAL) — Grades 1..3 ONLY
  // =========================================================================
  // Preparatory Arabic
  {
    email: 'prep.arabic.1@teachers.demo.jusoor.edu',
    fullName: 'أ. محمد إبراهيم',
    headline: 'معلم لغة عربية ونحو — المرحلة الإعدادية',
    bio: 'متخصص في تدريس النحو والقراءة والنصوص والإنشاء لطلاب الصفوف الأول والثاني والثالث الإعدادي والشهادة الإعدادية.',
    qualifications: `ليسانس دار العلوم ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 11,
    hourlyRate: '22.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2', 'prep-3'],
        subjectSlugs: ['eg-arabic'],
        languages: ['ar'],
        hourlyRate: '22.00',
        supportsOnline: true,
        supportsInPerson: true,
        notes: 'تأسيس النحو والإعراب وحل امتحانات الشهادة الإعدادية',
      },
    ],
  },
  {
    email: 'prep.arabic.2@teachers.demo.jusoor.edu',
    fullName: 'أ. هبة خالد',
    headline: 'معلمة لغة عربية وبلاغة مبسطة — الإعدادي',
    bio: 'شرح وافٍ لقواعد الإعراب والمشتقات وتدريبات القصة والتعبير لطلاب المرحلة الإعدادية.',
    qualifications: `ليسانس تربية لغة عربية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '20.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2', 'prep-3'],
        subjectSlugs: ['eg-arabic'],
        languages: ['ar'],
        hourlyRate: '20.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'prep.arabic.3@teachers.demo.jusoor.edu',
    fullName: 'أ. محمود سمير',
    headline: 'معلم لغة عربية للمرحلة الإعدادية',
    bio: 'مراجعات مركزة وقطع نحوية تطبيقية لإعداد طلاب الصفوف الإعدادية للاختبارات النهائية.',
    qualifications: `ليسانس آداب لغة عربية ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '19.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2', 'prep-3'],
        subjectSlugs: ['eg-arabic'],
        languages: ['ar'],
        hourlyRate: '19.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Preparatory English
  {
    email: 'prep.english.1@teachers.demo.jusoor.edu',
    fullName: 'أ. محمد عادل',
    headline: 'معلم لغة إنجليزية (لغة أجنبية أولى) — المرحلة الإعدادية',
    bio: 'شرح قواعد اللغة الإنجليزية والمحادثة والقطع والباراجراف لطلاب الصفوف الأول والثاني والثالث الإعدادي.',
    qualifications: `ليسانس تربية لغة إنجليزية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 10,
    hourlyRate: '24.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2', 'prep-3'],
        subjectSlugs: ['eg-english-first-foreign'],
        languages: ['en', 'ar'],
        hourlyRate: '24.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'prep.english.2@teachers.demo.jusoor.edu',
    fullName: 'أ. نورهان خالد',
    headline: 'معلمة لغة إنجليزية — المرحلة الإعدادية',
    bio: 'تدريب طلاب المرحلة الإعدادية على حل المحادثات والأسئلة التراكمية والكتابة الأكاديمية المبسطة.',
    qualifications: `بكالوريوس ألسن لغة إنجليزية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '22.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2', 'prep-3'],
        subjectSlugs: ['eg-english-first-foreign'],
        languages: ['en'],
        hourlyRate: '22.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'prep.english.3@teachers.demo.jusoor.edu',
    fullName: 'أ. كريم سمير',
    headline: 'معلم لغة إنجليزية ومهارات الاستماع والقراءة — الإعدادي',
    bio: 'تأهيل طلاب الإعدادي لاختبارات اللغة الإنجليزية من خلال تطبيقات القواعد والمفردات.',
    qualifications: `ليسانس آداب إنجليزي ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 6,
    hourlyRate: '21.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2', 'prep-3'],
        subjectSlugs: ['eg-english-first-foreign'],
        languages: ['en', 'ar'],
        hourlyRate: '21.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Preparatory Mathematics
  {
    email: 'prep.math.1@teachers.demo.jusoor.edu',
    fullName: 'أ. عمر سمير',
    headline: 'معلم رياضيات (جبر وهندسة) — المرحلة الإعدادية',
    bio: 'تبسيط الجبر والهندسة الإقليدية وحساب المثلثات المبدئي لطلاب الصفوف الإعدادية باللغتين العربية والإنجليزية.',
    qualifications: `بكالوريوس تربية رياضيات ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 11,
    hourlyRate: '24.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2', 'prep-3'],
        subjectSlugs: ['eg-mathematics'],
        languages: ['ar', 'en'],
        hourlyRate: '24.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'prep.math.2@teachers.demo.jusoor.edu',
    fullName: 'أ. نورهان علي',
    headline: 'معلمة رياضيات (Math) — المرحلة الإعدادية عربي ولغات',
    bio: 'شرح البرهان الهندسي وحل المعادلات لطلاب الصفوف الأول والثاني والثالث الإعدادي بأسلوب منظم.',
    qualifications: `بكالوريوس علوم رياضيات ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '23.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2', 'prep-3'],
        subjectSlugs: ['eg-mathematics'],
        languages: ['en', 'ar', 'fr'],
        hourlyRate: '23.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'prep.math.3@teachers.demo.jusoor.edu',
    fullName: 'أ. أحمد حسن',
    headline: 'معلم رياضيات وتأهيل الشهادة الإعدادية',
    bio: 'تدريب مكثف على مسائل الهندسة والتحليل الجبري وحل نماذج الامتحانات للمرحلة الإعدادية.',
    qualifications: `بكالوريوس هندسة ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '25.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2', 'prep-3'],
        subjectSlugs: ['eg-mathematics'],
        languages: ['ar', 'en'],
        hourlyRate: '25.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Preparatory Science
  {
    email: 'prep.science.1@teachers.demo.jusoor.edu',
    fullName: 'أ. مريم سمير',
    headline: 'معلمة علوم (Science) — المرحلة الإعدادية',
    bio: 'شرح مبسط لوحدات الكيمياء والفيزياء والأحياء ضمن مادة العلوم للمرحلة الإعدادية باللغتين العربية والإنجليزية.',
    qualifications: `بكالوريوس علوم وتربية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '23.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2', 'prep-3'],
        subjectSlugs: ['eg-science'],
        languages: ['ar', 'en'],
        hourlyRate: '23.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'prep.science.2@teachers.demo.jusoor.edu',
    fullName: 'أ. إسلام علي',
    headline: 'معلم علوم للمرحلة الإعدادية — عربي ولغات',
    bio: 'تجارب تفاعلية وحل مسائل الحركة والضوء والتفاعلات الكيميائية والوراثة لطلاب الإعدادي.',
    qualifications: `بكالوريوس تربية علوم ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '22.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2', 'prep-3'],
        subjectSlugs: ['eg-science'],
        languages: ['en', 'ar', 'fr'],
        hourlyRate: '22.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'prep.science.3@teachers.demo.jusoor.edu',
    fullName: 'أ. ياسمين حسن',
    headline: 'معلمة علوم وإعداد اختبارات الشهادة الإعدادية',
    bio: 'تبسيط المعادلات الكيميائية والمفاهيم الفيزيائية والبيولوجية للصفوف الثلاثة الإعدادية.',
    qualifications: `بكالوريوس علوم كيمياء وأحياء ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 6,
    hourlyRate: '21.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2', 'prep-3'],
        subjectSlugs: ['eg-science'],
        languages: ['ar', 'en'],
        hourlyRate: '21.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Preparatory Social Studies
  {
    email: 'prep.social.1@teachers.demo.jusoor.edu',
    fullName: 'أ. أيمن السعيد',
    headline: 'معلم دراسات اجتماعية (تاريخ وجغرافيا) — المرحلة الإعدادية',
    bio: 'تحليل الأحداث التاريخية وخرائط العالم والوطن العربي لطلاب الصفوف الإعدادية الثلاثة.',
    qualifications: `ليسانس تربية تاريخ ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 10,
    hourlyRate: '18.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2', 'prep-3'],
        subjectSlugs: ['eg-social-studies'],
        languages: ['ar'],
        hourlyRate: '18.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'prep.social.2@teachers.demo.jusoor.edu',
    fullName: 'أ. رشا جمال',
    headline: 'معلمة دراسات اجتماعية — المرحلة الإعدادية',
    bio: 'تلخيصات مركزة وأسئلة بما تفسر وما النتائج المترتبة لطلاب المرحلة الإعدادية.',
    qualifications: `ليسانس آداب جغرافيا ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '17.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2', 'prep-3'],
        subjectSlugs: ['eg-social-studies'],
        languages: ['ar'],
        hourlyRate: '17.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'prep.social.3@teachers.demo.jusoor.edu',
    fullName: 'أ. هشام بركات',
    headline: 'معلم دراسات اجتماعية وتاريخ حديث — الإعدادي',
    bio: 'إعداد طلاب الشهادة الإعدادية لدراسة التاريخ الحديث والجغرافيا السياسية والاقتصادية.',
    qualifications: `ليسانس تربية دراسات اجتماعية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '18.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2', 'prep-3'],
        subjectSlugs: ['eg-social-studies'],
        languages: ['ar'],
        hourlyRate: '18.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Preparatory Religious Education
  {
    email: 'prep.religion.1@teachers.demo.jusoor.edu',
    fullName: 'أ. خالد الدسوقي',
    headline: 'معلم تربية دينية إسلامية — المرحلة الإعدادية',
    bio: 'شرح مقرر التربية الدينية الإسلامية والتجويد والسيرة النبوية لطلاب الصفوف الإعدادية.',
    qualifications: `ليسانس شريعة ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '16.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2', 'prep-3'],
        subjectSlugs: ['eg-religious-ed-islamic-christian'],
        languages: ['ar'],
        religiousVariant: 'ISLAMIC',
        hourlyRate: '16.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'prep.religion.2@teachers.demo.jusoor.edu',
    fullName: 'أ. سميرة عبد الرحمن',
    headline: 'معلمة تربية دينية إسلامية — الإعدادي',
    bio: 'مراجعات وتدريبات متكاملة في التربية الدينية الإسلامية للمرحلة الإعدادية.',
    qualifications: `ليسانس دراسات إسلامية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '15.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2', 'prep-3'],
        subjectSlugs: ['eg-religious-ed-islamic-christian'],
        languages: ['ar'],
        religiousVariant: 'ISLAMIC',
        hourlyRate: '15.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'prep.religion.3@teachers.demo.jusoor.edu',
    fullName: 'أ. بطرس نصيف',
    headline: 'معلم تربية دينية مسيحية — المرحلة الإعدادية',
    bio: 'تدريس منهج التربية الدينية المسيحية لطلاب المرحلة الإعدادية ومراجعة موضوعات الكتاب المقرر.',
    qualifications: `بكالوريوس دراسات تربوية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '16.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2', 'prep-3'],
        subjectSlugs: ['eg-religious-ed-islamic-christian'],
        languages: ['ar'],
        religiousVariant: 'CHRISTIAN',
        hourlyRate: '16.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Preparatory Computer & ICT
  {
    email: 'prep.ict.1@teachers.demo.jusoor.edu',
    fullName: 'م. أحمد الجندي',
    headline: 'معلم الكمبيوتر وتكنولوجيا المعلومات — المرحلة الإعدادية',
    bio: 'تدريس أساسيات البرمجة المرئية وخرائط التدفق وقواعد البيانات المبسطة لطلاب المرحلة الإعدادية.',
    qualifications: `بكالوريوس حاسبات ومعلومات ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '20.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2', 'prep-3'],
        subjectSlugs: ['eg-ict-prep'],
        languages: ['ar', 'en'],
        hourlyRate: '20.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'prep.ict.2@teachers.demo.jusoor.edu',
    fullName: 'أ. آية ممدوح',
    headline: 'معلمة كمبيوتر وتكنولوجيا المعلومات — عربي ولغات (الإعدادي)',
    bio: 'شرح عملي للـ HTML و Scratch و Visual Basic المقررة بالمرحلة الإعدادية.',
    qualifications: `بكالوريوس تكنولوجيا التعليم والحاسب ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 6,
    hourlyRate: '19.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2', 'prep-3'],
        subjectSlugs: ['eg-ict-prep'],
        languages: ['en', 'ar', 'fr'],
        hourlyRate: '19.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'prep.ict.3@teachers.demo.jusoor.edu',
    fullName: 'م. زياد نصار',
    headline: 'معلم مهارات الحاسب وتكنولوجيا الاتصالات — الإعدادي',
    bio: 'مراجعة الاختبارات العملية والنظرية لمادة الكمبيوتر للمرحلة الإعدادية.',
    qualifications: `بكالوريوس نظم ومعلومات ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 5,
    hourlyRate: '18.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2', 'prep-3'],
        subjectSlugs: ['eg-ict-prep'],
        languages: ['ar', 'en'],
        hourlyRate: '18.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },

  // Preparatory Second Foreign Language (Grades 1..2)
  {
    email: 'prep.lang2.1@teachers.demo.jusoor.edu',
    fullName: 'أ. سيلفيا فريد',
    headline: 'معلمة اللغة الأجنبية الثانية (فرنسية / إيطالية) — الإعدادي',
    bio: 'تأسيس اللغة الفرنسية والإيطالية كلغة ثانية لطلاب الصف الأول والثاني الإعدادي.',
    qualifications: `ليسانس ألسن لغة فرنسية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '19.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2'],
        subjectSlugs: ['eg-second-foreign-lang'],
        languages: ['fr', 'ar'],
        hourlyRate: '19.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'prep.lang2.2@teachers.demo.jusoor.edu',
    fullName: 'أ. حازم رأفت',
    headline: 'معلم اللغة الأجنبية الثانية (ألمانية / إسبانية) — الإعدادي',
    bio: 'تبسيط أساسيات النطق والمفردات والمحادثات اليومية باللغة الألمانية والإسبانية للمرحلة الإعدادية.',
    qualifications: `ليسانس ألسن لغة ألمانية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 6,
    hourlyRate: '20.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2'],
        subjectSlugs: ['eg-second-foreign-lang'],
        languages: ['de', 'ar'],
        hourlyRate: '20.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'prep.lang2.3@teachers.demo.jusoor.edu',
    fullName: 'أ. مريم لبيب',
    headline: 'معلمة لغة فرنسية (لغة ثانية) — المرحلة الإعدادية',
    bio: 'تدريس قواعد ومفردات اللغة الفرنسية المقررة بالمرحلة الإعدادية بأسلوب تفاعلي.',
    qualifications: `ليسانس تربية لغة فرنسية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 5,
    hourlyRate: '18.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2'],
        subjectSlugs: ['eg-second-foreign-lang'],
        languages: ['fr', 'ar'],
        hourlyRate: '18.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Preparatory Industrial/Agricultural Skills & Entrepreneurship (Grades 1..2)
  {
    email: 'prep.skills.1@teachers.demo.jusoor.edu',
    fullName: 'أ. فريد عثمان',
    headline: 'معلم مهارات الصناعة والزراعة وريادة الأعمال — الإعدادي',
    bio: 'توجيه طلاب الصفين الأول والثاني الإعدادي في مشروعات المهارات الصناعية والزراعية وريادة الأعمال.',
    qualifications: `بكالوريوس تعليم صناعي وتربية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '15.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2'],
        subjectSlugs: ['eg-ind-entrepreneurship', 'eg-agri-entrepreneurship'],
        languages: ['ar'],
        hourlyRate: '15.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'prep.skills.2@teachers.demo.jusoor.edu',
    fullName: 'أ. نجلاء حسين',
    headline: 'معلمة ريادة الأعمال والمهارات التطبيقية — الإعدادي',
    bio: 'مساعدة الطلاب على تصميم مشروعات ريادة الأعمال المصغرة والأنشطة الزراعية والصناعية.',
    qualifications: `بكالوريوس علوم زراعية ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 6,
    hourlyRate: '15.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2'],
        subjectSlugs: ['eg-ind-entrepreneurship', 'eg-agri-entrepreneurship'],
        languages: ['ar'],
        hourlyRate: '15.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'prep.skills.3@teachers.demo.jusoor.edu',
    fullName: 'أ. مدحت الشهاوي',
    headline: 'معلم الأنشطة الصناعية والزراعية — المرحلة الإعدادية',
    bio: 'إعداد النماذج العملية وخطط العمل المبسطة لطلاب المرحلة الإعدادية.',
    qualifications: `بكالوريوس تربية تعليم فني ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '14.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2'],
        subjectSlugs: ['eg-ind-entrepreneurship', 'eg-agri-entrepreneurship'],
        languages: ['ar'],
        hourlyRate: '14.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Preparatory Libraries/Research, Media & Theater (Grades 1..3)
  {
    email: 'prep.media.1@teachers.demo.jusoor.edu',
    fullName: 'أ. عزة شحاتة',
    headline: 'أخصائية المكتبات ومهارات البحث والإعلام والمسرح — الإعدادي',
    bio: 'تدريب طلاب الإعدادي على إعداد الأبحاث المكتبية والإلقاء الإذاعي والمسرح المدرسي.',
    qualifications: `ليسانس مكتبات ومعلومات ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '15.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2', 'prep-3'],
        subjectSlugs: ['eg-libraries-research', 'eg-edu-media', 'eg-drama-ed'],
        languages: ['ar'],
        hourlyRate: '15.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'prep.media.2@teachers.demo.jusoor.edu',
    fullName: 'أ. باسل فوزي',
    headline: 'معلم الإعلام التربوي والتربية المسرحية — الإعدادي',
    bio: 'تطوير مهارات العرض والتقديم والكتابة الصحفية والتمثيل التربوي لطلاب المرحلة الإعدادية.',
    qualifications: `بكالوريوس تربية نوعية إعلام ومسرح ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 6,
    hourlyRate: '15.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2', 'prep-3'],
        subjectSlugs: ['eg-libraries-research', 'eg-edu-media', 'eg-drama-ed'],
        languages: ['ar'],
        hourlyRate: '15.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'prep.media.3@teachers.demo.jusoor.edu',
    fullName: 'أ. رانيا عبد السلام',
    headline: 'معلمة مهارات البحث والمكتبات والمسرح — الإعدادي',
    bio: 'إرشاد طلاب الإعدادي في توثيق المصادر وإعداد التقارير البحثية والأنشطة الثقافية.',
    qualifications: `ليسانس إعلام تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 5,
    hourlyRate: '14.00',
    rules: [
      {
        systemCode: 'PREPARATORY_GENERAL',
        gradeSlugs: ['prep-1', 'prep-2', 'prep-3'],
        subjectSlugs: ['eg-libraries-research', 'eg-edu-media', 'eg-drama-ed'],
        languages: ['ar'],
        hourlyRate: '14.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // =========================================================================
  // C. GENERAL SECONDARY (GENERAL_SECONDARY) — Grades 1..3 ONLY
  // =========================================================================
  // Gen Sec Arabic (All grades & divisions)
  {
    email: 'sec.arabic.1@teachers.demo.jusoor.edu',
    fullName: 'أ. علاء الدين فتحي',
    headline: 'معلم لغة عربية (نحو وبلاغة وأدب) — الثانوية العامة',
    bio: 'تدريس النحو والبلاغة والأدب والنصوص المتحررة لطلاب الثانوية العامة بنظام التقييم الحديث.',
    qualifications: `ليسانس دار العلوم تخصص نحو وبلاغة ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 13,
    hourlyRate: '30.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2', 'gen-sec-3'],
        subjectSlugs: ['eg-arabic'],
        languages: ['ar'],
        hourlyRate: '30.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'sec.arabic.2@teachers.demo.jusoor.edu',
    fullName: 'أ. شيماء نبيل',
    headline: 'معلمة لغة عربية وقراءة ونصوص متحررة — الثانوية العامة',
    bio: 'تدريب طلاب الصفوف الأول والثاني والثالث الثانوي على تحليل النصوص الأدبية وحل أسئلة البلاغة.',
    qualifications: `ليسانس تربية لغة عربية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '28.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2', 'gen-sec-3'],
        subjectSlugs: ['eg-arabic'],
        languages: ['ar'],
        hourlyRate: '28.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'sec.arabic.3@teachers.demo.jusoor.edu',
    fullName: 'أ. مجدي عبد الوهاب',
    headline: 'معلم لغة عربية وتعبير مقالي — الثانوية العامة',
    bio: 'مراجعات شاملة لوحدات النحو السبع والتعبير المقالي للثانوية العامة.',
    qualifications: `ليسانس آداب لغة عربية ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 11,
    hourlyRate: '29.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2', 'gen-sec-3'],
        subjectSlugs: ['eg-arabic'],
        languages: ['ar'],
        hourlyRate: '29.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Gen Sec First Foreign Language (English)
  {
    email: 'sec.english.1@teachers.demo.jusoor.edu',
    fullName: 'أ. عمر أحمد',
    headline: 'معلم لغة إنجليزية (لغة أجنبية أولى) — الثانوية العامة',
    bio: 'تدريس اللغة الإنجليزية لطلاب الثانوية العامة مع تركيز على القواعد المتقدمة والترجمة والمقال.',
    qualifications: `ليسانس تربية لغة إنجليزية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 12,
    hourlyRate: '32.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2', 'gen-sec-3'],
        subjectSlugs: ['eg-first-foreign-lang'],
        languages: ['en', 'ar'],
        hourlyRate: '32.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'sec.english.2@teachers.demo.jusoor.edu',
    fullName: 'أ. سلمى عبد العزيز',
    headline: 'معلمة لغة إنجليزية (لغة أجنبية أولى) — الثانوية العامة',
    bio: 'تأهيل طلاب الصفوف الثلاثة بالثانوية العامة لإتقان الفهم القرائي والكتابة الأكاديمية.',
    qualifications: `بكالوريوس ألسن لغة إنجليزية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '30.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2', 'gen-sec-3'],
        subjectSlugs: ['eg-first-foreign-lang'],
        languages: ['en'],
        hourlyRate: '30.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'sec.english.3@teachers.demo.jusoor.edu',
    fullName: 'أ. محمود سامح',
    headline: 'معلم لغة إنجليزية وترجمة ومقال — الثانوية العامة',
    bio: 'مراجعات مركزة لقواعد الوحدات وحل نماذج امتحانات الثانوية العامة للغة الأجنبية الأولى.',
    qualifications: `ليسانس آداب لغة إنجليزية ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 10,
    hourlyRate: '31.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2', 'gen-sec-3'],
        subjectSlugs: ['eg-first-foreign-lang'],
        languages: ['en', 'ar'],
        hourlyRate: '31.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Gen Sec Mathematics (G1, G2 Sci/Lit, G3 Scientific Math ONLY)
  {
    email: 'sec.math.1@teachers.demo.jusoor.edu',
    fullName: 'أ. حازم محمود',
    headline: 'معلم رياضيات (بحتة وتطبيقية) — الثانوية العامة',
    bio: 'تدريس الجبر والهندسة الفراغية والتفاضل والتكامل والديناميكا والاستاتيكا لشعبة علمي رياضة وصفوف الثانوية العامة.',
    qualifications: `بكالوريوس تربية رياضيات ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 14,
    hourlyRate: '34.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2'],
        subjectSlugs: ['eg-mathematics'],
        languages: ['ar', 'en'],
        hourlyRate: '32.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-3'],
        divisionCodes: ['GEN_SEC_3_SCI_MATH'],
        subjectSlugs: ['eg-mathematics'],
        languages: ['ar', 'en'],
        hourlyRate: '35.00',
        supportsOnline: true,
        supportsInPerson: true,
        notes: 'تخصص الرياضيات البحتة والتطبيقية لشعبة علمي رياضة',
      },
    ],
  },
  {
    email: 'sec.math.2@teachers.demo.jusoor.edu',
    fullName: 'أ. شريف محمد',
    headline: 'معلم رياضيات (Math) — الثانوية العامة عربي ولغات',
    bio: 'شرح عميق لمسائل التفاضل والتكامل والجبر والهندسة التحليلية لطلاب الثانوية العامة.',
    qualifications: `بكالوريوس هندسة ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 11,
    hourlyRate: '33.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2'],
        subjectSlugs: ['eg-mathematics'],
        languages: ['en', 'ar', 'fr'],
        hourlyRate: '32.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-3'],
        divisionCodes: ['GEN_SEC_3_SCI_MATH'],
        subjectSlugs: ['eg-mathematics'],
        languages: ['en', 'ar', 'fr'],
        hourlyRate: '35.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'sec.math.3@teachers.demo.jusoor.edu',
    fullName: 'أ. منار سامي',
    headline: 'معلمة رياضيات — الثانوية العامة (الأول والثاني وعلمي رياضة)',
    bio: 'تبسيط الميكانيكا وحساب المثلثات والتفاضل مع تدريبات متدرجة على أفكار المسائل العليا.',
    qualifications: `بكالوريوس علوم رياضيات ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '30.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2'],
        subjectSlugs: ['eg-mathematics'],
        languages: ['ar', 'en'],
        hourlyRate: '29.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-3'],
        divisionCodes: ['GEN_SEC_3_SCI_MATH'],
        subjectSlugs: ['eg-mathematics'],
        languages: ['ar', 'en'],
        hourlyRate: '32.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Gen Sec Statistics (Grade 3 Literary ONLY)
  {
    email: 'sec.stats.1@teachers.demo.jusoor.edu',
    fullName: 'أ. يحيى زهران',
    headline: 'معلم إحصاء — الصف الثالث الثانوي الأدبي',
    bio: 'شرح مبسط لقوانين الارتباط والانحدار والاحتمالات والمتغيرات العشوائية لطلاب الشعبة الأدبية.',
    qualifications: `بكالوريوس تجارة وإحصاء ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 10,
    hourlyRate: '26.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-3'],
        divisionCodes: ['GEN_SEC_3_LITERARY'],
        subjectSlugs: ['eg-statistics'],
        languages: ['ar', 'en'],
        hourlyRate: '26.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'sec.stats.2@teachers.demo.jusoor.edu',
    fullName: 'أ. هالة العطار',
    headline: 'معلمة إحصاء تطبيقي — الثانوية العامة (أدبي)',
    bio: 'حل جميع مسائل الإحصاء وبنوك الأسئلة لطلاب الصف الثالث الثانوي الأدبي.',
    qualifications: `بكالوريوس اقتصاد وعلوم سياسية قسم إحصاء ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '25.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-3'],
        divisionCodes: ['GEN_SEC_3_LITERARY'],
        subjectSlugs: ['eg-statistics'],
        languages: ['ar', 'en', 'fr'],
        hourlyRate: '25.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'sec.stats.3@teachers.demo.jusoor.edu',
    fullName: 'أ. أمير صبحي',
    headline: 'معلم إحصاء واحتمالات — الثانوية العامة الأدبي',
    bio: 'تقديم خطوات عملية سريعة لحساب معاملات الارتباط والتوزيع الطبيعي.',
    qualifications: `بكالوريوس تربية رياضيات وإحصاء ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '24.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-3'],
        divisionCodes: ['GEN_SEC_3_LITERARY'],
        subjectSlugs: ['eg-statistics'],
        languages: ['ar', 'en'],
        hourlyRate: '24.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Gen Sec Integrated Sciences (Grade 1)
  {
    email: 'sec.intsci.1@teachers.demo.jusoor.edu',
    fullName: 'أ. وائل الشافعي',
    headline: 'معلم العلوم المتكاملة — الصف الأول الثانوي العام',
    bio: 'تدريس منهج العلوم المتكاملة للصف الأول الثانوي بربط مفاهيم الفيزياء والكيمياء والأحياء والبيئة.',
    qualifications: `بكالوريوس علوم وتربية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '28.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1'],
        subjectSlugs: ['eg-integrated-science'],
        languages: ['ar', 'en'],
        hourlyRate: '28.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'sec.intsci.2@teachers.demo.jusoor.edu',
    fullName: 'أ. سارة الزيات',
    headline: 'معلمة العلوم المتكاملة (Integrated Sciences) — أولى ثانوي',
    bio: 'شرح تفاعلي باللغتين العربية والإنجليزية لوحدات الغلاف المائي والجوي والطاقة للصف الأول الثانوي.',
    qualifications: `ماجستير تدريس العلوم ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '27.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1'],
        subjectSlugs: ['eg-integrated-science'],
        languages: ['en', 'ar', 'fr'],
        hourlyRate: '27.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'sec.intsci.3@teachers.demo.jusoor.edu',
    fullName: 'أ. محمد الهواري',
    headline: 'معلم العلوم المتكاملة — الصف الأول الثانوي',
    bio: 'تبسيط العلاقات البيئية والعمليات الكيميائية والفيزيائية في منهج العلوم المتكاملة.',
    qualifications: `بكالوريوس علوم بيئية ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 6,
    hourlyRate: '26.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1'],
        subjectSlugs: ['eg-integrated-science'],
        languages: ['ar', 'en'],
        hourlyRate: '26.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Gen Sec Physics (G2 Scientific, G3 Sci-Bio & Sci-Math)
  {
    email: 'sec.physics.1@teachers.demo.jusoor.edu',
    fullName: 'أ. حسام الديب',
    headline: 'معلم فيزياء — الثانوية العامة (الشعبة العلمية)',
    bio: 'شرح شامل لميكانيكا الموائع والكهربائية والمغناطيسية والفيزياء الحديثة لطلاب الصفين الثاني والثالث الثانوي.',
    qualifications: `بكالوريوس علوم فيزياء ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 12,
    hourlyRate: '34.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-2', 'gen-sec-3'],
        divisionCodes: ['GEN_SEC_2_SCIENTIFIC', 'GEN_SEC_3_SCI_BIO', 'GEN_SEC_3_SCI_MATH'],
        subjectSlugs: ['eg-physics'],
        languages: ['ar', 'en'],
        hourlyRate: '34.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'sec.physics.2@teachers.demo.jusoor.edu',
    fullName: 'أ. نيفين قاسم',
    headline: 'معلمة فيزياء (Physics) — الثانوية العامة عربي ولغات',
    bio: 'تدريب طلاب القسم العلمي على تحليل الرسوم البيانية ومسائل الدوائر الكهربائية والحث الكهرومغناطيسي.',
    qualifications: `بكالوريوس تربية فيزياء ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '32.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-2', 'gen-sec-3'],
        divisionCodes: ['GEN_SEC_2_SCIENTIFIC', 'GEN_SEC_3_SCI_BIO', 'GEN_SEC_3_SCI_MATH'],
        subjectSlugs: ['eg-physics'],
        languages: ['en', 'ar', 'fr'],
        hourlyRate: '32.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'sec.physics.3@teachers.demo.jusoor.edu',
    fullName: 'أ. رامز سيف',
    headline: 'معلم فيزياء ومسائل المستويات العليا — الثانوية العامة',
    bio: 'حل مسائل كتاب الامتحان والنماذج الاسترشادية خطوة بخطوة لطلاب الشعبة العلمية.',
    qualifications: `بكالوريوس هندسة ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 10,
    hourlyRate: '33.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-2', 'gen-sec-3'],
        divisionCodes: ['GEN_SEC_2_SCIENTIFIC', 'GEN_SEC_3_SCI_BIO', 'GEN_SEC_3_SCI_MATH'],
        subjectSlugs: ['eg-physics'],
        languages: ['ar', 'en'],
        hourlyRate: '33.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Gen Sec Chemistry (G2 Scientific, G3 Sci-Bio & Sci-Math)
  {
    email: 'sec.chem.1@teachers.demo.jusoor.edu',
    fullName: 'أ. معتز الحفناوي',
    headline: 'معلم كيمياء — الثانوية العامة (الشعبة العلمية)',
    bio: 'تبسيط الكيمياء العضوية والعناصر الانتقالية والاتزان الكيميائي والكهربية لطلاب الثانوية العامة.',
    qualifications: `بكالوريوس علوم كيمياء ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 12,
    hourlyRate: '33.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-2', 'gen-sec-3'],
        divisionCodes: ['GEN_SEC_2_SCIENTIFIC', 'GEN_SEC_3_SCI_BIO', 'GEN_SEC_3_SCI_MATH'],
        subjectSlugs: ['eg-chemistry'],
        languages: ['ar', 'en'],
        hourlyRate: '33.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'sec.chem.2@teachers.demo.jusoor.edu',
    fullName: 'أ. داليا الرفاعي',
    headline: 'معلمة كيمياء (Chemistry) — الثانوية العامة عربي ولغات',
    bio: 'تأسيس المعادلات الكيميائية وحساب المول والتحليل الكيميائي لطلاب الصف الثاني والثالث الثانوي.',
    qualifications: `بكالوريوس تربية كيمياء ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '31.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-2', 'gen-sec-3'],
        divisionCodes: ['GEN_SEC_2_SCIENTIFIC', 'GEN_SEC_3_SCI_BIO', 'GEN_SEC_3_SCI_MATH'],
        subjectSlugs: ['eg-chemistry'],
        languages: ['en', 'ar', 'fr'],
        hourlyRate: '31.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'sec.chem.3@teachers.demo.jusoor.edu',
    fullName: 'أ. عمرو منصور',
    headline: 'معلم كيمياء عضوية وغير عضوية — الثانوية العامة',
    bio: 'ربط التفاعلات العضوية والتحويلات الكيميائية بخرائط ذهنية واضحة لطلاب القسم العلمي.',
    qualifications: `بكالوريوس صيدلة ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '32.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-2', 'gen-sec-3'],
        divisionCodes: ['GEN_SEC_2_SCIENTIFIC', 'GEN_SEC_3_SCI_BIO', 'GEN_SEC_3_SCI_MATH'],
        subjectSlugs: ['eg-chemistry'],
        languages: ['ar', 'en'],
        hourlyRate: '32.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Gen Sec Biology (Grade 3 Scientific Sciences ONLY)
  {
    email: 'sec.bio.1@teachers.demo.jusoor.edu',
    fullName: 'د. نادية شكري',
    headline: 'معلمة أحياء — الصف الثالث الثانوي (علمي علوم)',
    bio: 'شرح مفصل للدعامة والحركة والتنسيق الهرموني والتكاثر والمناعة والـ DNA لشعبة علمي علوم.',
    qualifications: `بكالوريوس علوم أحياء ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 13,
    hourlyRate: '34.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-3'],
        divisionCodes: ['GEN_SEC_3_SCI_BIO'],
        subjectSlugs: ['eg-biology'],
        languages: ['ar', 'en'],
        hourlyRate: '34.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'sec.bio.2@teachers.demo.jusoor.edu',
    fullName: 'أ. فادي جلال',
    headline: 'معلم أحياء (Biology) — علمي علوم عربي ولغات',
    bio: 'تحليل الرسوم التشريحية والتجارب البيولوجية وأسئلة الفهم لطلاب شعبة علمي علوم.',
    qualifications: `بكالوريوس تربية بيولوجي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '32.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-3'],
        divisionCodes: ['GEN_SEC_3_SCI_BIO'],
        subjectSlugs: ['eg-biology'],
        languages: ['en', 'ar', 'fr'],
        hourlyRate: '32.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'sec.bio.3@teachers.demo.jusoor.edu',
    fullName: 'أ. أسماء رجب',
    headline: 'معلمة أحياء وبيولوجيا جزيئية — علمي علوم',
    bio: 'مراجعات مكثفة على فصول البيولوجيا الجزيئية والمناعة لطلاب الصف الثالث الثانوي علمي علوم.',
    qualifications: `بكالوريوس علوم قسم حيوان ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '30.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-3'],
        divisionCodes: ['GEN_SEC_3_SCI_BIO'],
        subjectSlugs: ['eg-biology'],
        languages: ['ar', 'en'],
        hourlyRate: '30.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Gen Sec History (G1, G2 Sci/Lit, G3 Literary)
  {
    email: 'sec.history.1@teachers.demo.jusoor.edu',
    fullName: 'أ. أشرف الجبالي',
    headline: 'معلم تاريخ — الثانوية العامة',
    bio: 'ربط الأحداث التاريخية والتحليل السياسي لوحدات التاريخ للصفوف الأول والثاني والثالث الثانوي.',
    qualifications: `ليسانس تربية تاريخ ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 12,
    hourlyRate: '27.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2'],
        subjectSlugs: ['eg-history'],
        languages: ['ar'],
        hourlyRate: '26.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-3'],
        divisionCodes: ['GEN_SEC_3_LITERARY'],
        subjectSlugs: ['eg-history'],
        languages: ['ar'],
        hourlyRate: '28.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'sec.history.2@teachers.demo.jusoor.edu',
    fullName: 'أ. منال سليم',
    headline: 'معلمة تاريخ وحدات مصر والعالم الحديث — الثانوية العامة',
    bio: 'تحليل النصوص والوثائق التاريخية والأسئلة الاستنتاجية لطلاب الثانوية العامة.',
    qualifications: `ليسانس آداب تاريخ ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '25.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2'],
        subjectSlugs: ['eg-history'],
        languages: ['ar'],
        hourlyRate: '24.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-3'],
        divisionCodes: ['GEN_SEC_3_LITERARY'],
        subjectSlugs: ['eg-history'],
        languages: ['ar'],
        hourlyRate: '26.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'sec.history.3@teachers.demo.jusoor.edu',
    fullName: 'أ. باسم القاضي',
    headline: 'معلم تاريخ — المرحلة الثانوية العامة',
    bio: 'تسهيل تسلسل الحقب التاريخية وعقد المقارنات المنهجية للثانوية العامة.',
    qualifications: `ليسانس تربية تاريخ وحضارة ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '25.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2'],
        subjectSlugs: ['eg-history'],
        languages: ['ar'],
        hourlyRate: '24.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-3'],
        divisionCodes: ['GEN_SEC_3_LITERARY'],
        subjectSlugs: ['eg-history'],
        languages: ['ar'],
        hourlyRate: '26.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Gen Sec Geography (G2 Literary, G3 Literary)
  {
    email: 'sec.geo.1@teachers.demo.jusoor.edu',
    fullName: 'أ. عاطف شرف',
    headline: 'معلم جغرافيا سياسية وتنمية — الثانوية العامة (أدبي)',
    bio: 'تدريس جغرافية التنمية والجغرافيا السياسية وتحليل الخرائط لطلاب الشعبة الأدبية.',
    qualifications: `ليسانس آداب جغرافيا وخرائط ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 11,
    hourlyRate: '27.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-2', 'gen-sec-3'],
        divisionCodes: ['GEN_SEC_2_LITERARY', 'GEN_SEC_3_LITERARY'],
        subjectSlugs: ['eg-geography'],
        languages: ['ar'],
        hourlyRate: '27.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'sec.geo.2@teachers.demo.jusoor.edu',
    fullName: 'أ. رحاب كامل',
    headline: 'معلمة جغرافيا — الشعبة الأدبية بالثانوية العامة',
    bio: 'تبسيط وحدات الحدود السياسية والتكتلات الاقتصادية والمنظمات الدولية مع تدريبات الخرائط.',
    qualifications: `ليسانس تربية جغرافيا ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '25.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-2', 'gen-sec-3'],
        divisionCodes: ['GEN_SEC_2_LITERARY', 'GEN_SEC_3_LITERARY'],
        subjectSlugs: ['eg-geography'],
        languages: ['ar'],
        hourlyRate: '25.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'sec.geo.3@teachers.demo.jusoor.edu',
    fullName: 'أ. نادر سلامة',
    headline: 'معلم جغرافيا ونظم معلومات جغرافية مبسطة — الأدبي',
    bio: 'تدريب طلاب القسم الأدبي على قراءة خرائط العالم والأسئلة التطبيقية.',
    qualifications: `ليسانس آداب جغرافيا ونظم ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '24.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-2', 'gen-sec-3'],
        divisionCodes: ['GEN_SEC_2_LITERARY', 'GEN_SEC_3_LITERARY'],
        subjectSlugs: ['eg-geography'],
        languages: ['ar'],
        hourlyRate: '24.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Gen Sec Philosophy & Logic (Grade 1)
  {
    email: 'sec.phil.1@teachers.demo.jusoor.edu',
    fullName: 'أ. طه رضوان',
    headline: 'معلم فلسفة ومنطق — الصف الأول الثانوي العام',
    bio: 'شرح مبادئ التفكير الفلسفي والمنطقي وتطبيقات القياس والاستدلال لطلاب الصف الأول الثانوي.',
    qualifications: `ليسانس آداب فلسفة ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 10,
    hourlyRate: '24.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1'],
        subjectSlugs: ['eg-philosophy-logic'],
        languages: ['ar'],
        hourlyRate: '24.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'sec.phil.2@teachers.demo.jusoor.edu',
    fullName: 'أ. سمية نصر',
    headline: 'معلمة فلسفة ومنطق — أولى ثانوي عام',
    bio: 'تقديم أمثلة حياتية لتبسيط أساليب التفكير الفلسفي وقواعد المنطق.',
    qualifications: `ليسانس تربية مواد فلسفية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '22.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1'],
        subjectSlugs: ['eg-philosophy-logic'],
        languages: ['ar'],
        hourlyRate: '22.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'sec.phil.3@teachers.demo.jusoor.edu',
    fullName: 'أ. جلال حلمي',
    headline: 'معلم فلسفة ومنطق — الثانوية العامة',
    bio: 'تدريب طلاب الصف الأول الثانوي على الأسئلة المقالية والموضوعية في الفلسفة والمنطق.',
    qualifications: `ليسانس فلسفة وعلم نفس ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '23.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1'],
        subjectSlugs: ['eg-philosophy-logic'],
        languages: ['ar'],
        hourlyRate: '23.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Gen Sec Psychology & Sociology (Grade 2 Literary)
  {
    email: 'sec.psych.1@teachers.demo.jusoor.edu',
    fullName: 'أ. نسرين صادق',
    headline: 'معلمة علم النفس والاجتماع — الصف الثاني الثانوي (أدبي)',
    bio: 'تبسيط مدارس علم النفس والعمليات المعرفية والتنشئة الاجتماعية لطلاب الشعبة الأدبية.',
    qualifications: `ليسانس تربية علم نفس واجتماع ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '25.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-2'],
        divisionCodes: ['GEN_SEC_2_LITERARY'],
        subjectSlugs: ['eg-psychology-sociology'],
        languages: ['ar'],
        hourlyRate: '25.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'sec.psych.2@teachers.demo.jusoor.edu',
    fullName: 'أ. كمال عز الدين',
    headline: 'معلم علم نفس واجتماع — الشعبة الأدبية',
    bio: 'ربط النظريات النفسية والاجتماعية بأسئلة التطبيق والفهم للصف الثاني الثانوي.',
    qualifications: `ليسانس آداب علم نفس ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '24.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-2'],
        divisionCodes: ['GEN_SEC_2_LITERARY'],
        subjectSlugs: ['eg-psychology-sociology'],
        languages: ['ar'],
        hourlyRate: '24.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'sec.psych.3@teachers.demo.jusoor.edu',
    fullName: 'أ. ليلى نصار',
    headline: 'معلمة علم النفس والاجتماع — ثانية ثانوي أدبي',
    bio: 'مراجعات دورية ومقارنات منهجية لمفاهيم الإدراك والدوافع والبناء الاجتماعي.',
    qualifications: `ليسانس علم اجتماع وتربية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 6,
    hourlyRate: '23.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-2'],
        divisionCodes: ['GEN_SEC_2_LITERARY'],
        subjectSlugs: ['eg-psychology-sociology'],
        languages: ['ar'],
        hourlyRate: '23.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Gen Sec Programming & AI (Grade 1 — plus existing tariq.teacher@demo.jusoor.edu scoped strictly to Gen Sec 1 Programming & AI)
  {
    email: 'sec.prog.2@teachers.demo.jusoor.edu',
    fullName: 'م. يحيى العزب',
    headline: 'معلم البرمجة والذكاء الاصطناعي — الصف الأول الثانوي العام',
    bio: 'شرح أساسيات البرمجة بلغة بايثون ومفاهيم الذكاء الاصطناعي وتحليل البيانات لطلاب أولى ثانوي عام.',
    qualifications: `بكالوريوس هندسة حاسبات ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '28.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1'],
        subjectSlugs: ['eg-programming-ai'],
        languages: ['ar', 'en'],
        hourlyRate: '28.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'sec.prog.3@teachers.demo.jusoor.edu',
    fullName: 'م. روان أيمن',
    headline: 'معلمة البرمجة والذكاء الاصطناعي — أولى ثانوي عام',
    bio: 'تطبيقات عملية في الخوارزميات ومفاهيم تعلم الآلة المبسطة لطلاب الصف الأول الثانوي.',
    qualifications: `بكالوريوس ذكاء اصطناعي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 5,
    hourlyRate: '27.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1'],
        subjectSlugs: ['eg-programming-ai'],
        languages: ['en', 'ar'],
        hourlyRate: '27.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Gen Sec Second Foreign Language (All grades & divisions)
  {
    email: 'sec.lang2.1@teachers.demo.jusoor.edu',
    fullName: 'أ. سيلين مرقص',
    headline: 'معلمة اللغة الأجنبية الثانية (فرنسية) — الثانوية العامة',
    bio: 'تدريس اللغة الفرنسية كلغة ثانية لصفوف الثانوية العامة الثلاثة وحل أسئلة الوثيقة والمواقف والإيميل.',
    qualifications: `ليسانس ألسن لغة فرنسية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 10,
    hourlyRate: '24.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2', 'gen-sec-3'],
        subjectSlugs: ['eg-second-foreign-lang'],
        languages: ['fr', 'ar'],
        hourlyRate: '24.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'sec.lang2.2@teachers.demo.jusoor.edu',
    fullName: 'أ. هاني الباز',
    headline: 'معلم اللغة الأجنبية الثانية (ألمانية / إيطالية) — الثانوية العامة',
    bio: 'تدريب طلاب الثانوية العامة على القواعد والموضوعات في اللغة الألمانية والإيطالية.',
    qualifications: `ليسانس ألسن لغة ألمانية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '25.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2', 'gen-sec-3'],
        subjectSlugs: ['eg-second-foreign-lang'],
        languages: ['de', 'ar'],
        hourlyRate: '25.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'sec.lang2.3@teachers.demo.jusoor.edu',
    fullName: 'أ. فيروز حمدان',
    headline: 'معلمة اللغة الأجنبية الثانية (إسبانية / فرنسية) — الثانوية العامة',
    bio: 'مراجعات مركزة للغة الثانية لطلاب الأول والثاني والثالث الثانوي العام.',
    qualifications: `ليسانس لغات وترجمة ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '23.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2', 'gen-sec-3'],
        subjectSlugs: ['eg-second-foreign-lang'],
        languages: ['fr', 'ar'],
        hourlyRate: '23.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Gen Sec Religious Education (All grades & divisions)
  {
    email: 'sec.religion.1@teachers.demo.jusoor.edu',
    fullName: 'أ. أنس عبد القادر',
    headline: 'معلم تربية دينية إسلامية — الثانوية العامة',
    bio: 'شرح منهج التربية الدينية الإسلامية للمرحلة الثانوية مع تدريبات على الفهم والتفسير.',
    qualifications: `ليسانس شريعة ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 10,
    hourlyRate: '18.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2', 'gen-sec-3'],
        subjectSlugs: ['eg-religious-ed'],
        languages: ['ar'],
        religiousVariant: 'ISLAMIC',
        hourlyRate: '18.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'sec.religion.2@teachers.demo.jusoor.edu',
    fullName: 'أ. زينب المتولي',
    headline: 'معلمة تربية دينية إسلامية — الثانوية العامة',
    bio: 'مراجعة مبسطة ومنظمة لموضوعات التربية الدينية الإسلامية بالصفوف الثلاثة الثانوية.',
    qualifications: `ليسانس دراسات إسلامية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '17.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2', 'gen-sec-3'],
        subjectSlugs: ['eg-religious-ed'],
        languages: ['ar'],
        religiousVariant: 'ISLAMIC',
        hourlyRate: '17.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'sec.religion.3@teachers.demo.jusoor.edu',
    fullName: 'أ. كيرلس ماهر',
    headline: 'معلم تربية دينية مسيحية — الثانوية العامة',
    bio: 'تدريس منهج التربية الدينية المسيحية لطلاب المرحلة الثانوية العامة وإعداد الاختبارات.',
    qualifications: `بكالوريوس علوم تربوية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '18.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2', 'gen-sec-3'],
        subjectSlugs: ['eg-religious-ed'],
        languages: ['ar'],
        religiousVariant: 'CHRISTIAN',
        hourlyRate: '18.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Gen Sec National Education (Grades 2..3 all divisions)
  {
    email: 'sec.national.1@teachers.demo.jusoor.edu',
    fullName: 'أ. ماجد عفيفي',
    headline: 'معلم التربية الوطنية — الثانوية العامة',
    bio: 'شرح مبادئ الدستور والقانون والديمقراطية والمشاركة المجتمعية لطلاب الصفين الثاني والثالث الثانوي.',
    qualifications: `ليسانس حقوق ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 10,
    hourlyRate: '18.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-2', 'gen-sec-3'],
        subjectSlugs: ['eg-national-education'],
        languages: ['ar'],
        hourlyRate: '18.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'sec.national.2@teachers.demo.jusoor.edu',
    fullName: 'أ. سهام البنا',
    headline: 'معلمة التربية الوطنية — الثانوية العامة',
    bio: 'مراجعات مركزة وبنوك أسئلة في مادة التربية الوطنية للصف الثاني والثالث الثانوي.',
    qualifications: `ليسانس فلسفة واجتماع وتربية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '17.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-2', 'gen-sec-3'],
        subjectSlugs: ['eg-national-education'],
        languages: ['ar'],
        hourlyRate: '17.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'sec.national.3@teachers.demo.jusoor.edu',
    fullName: 'أ. عصام درويش',
    headline: 'معلم تربية وطنية وثقافة قانونية — الثانوية العامة',
    bio: 'تبسيط فصول الدستور والأحزاب والمواطنة لاجتياز اختبار التربية الوطنية بتفوق.',
    qualifications: `ليسانس آداب ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '17.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-2', 'gen-sec-3'],
        subjectSlugs: ['eg-national-education'],
        languages: ['ar'],
        hourlyRate: '17.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Gen Sec PE Sport (Grades 1..2)
  {
    email: 'sec.pe.1@teachers.demo.jusoor.edu',
    fullName: 'ك. سيف الإسلام',
    headline: 'معلم التربية الرياضية — الثانوية العامة',
    bio: 'إعداد برامج اللياقة البدنية والتدريب الرياضي لطلاب الصفين الأول والثاني الثانوي العام.',
    qualifications: `بكالوريوس تربية رياضية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '18.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2'],
        subjectSlugs: ['eg-pe-sport'],
        languages: ['ar'],
        hourlyRate: '18.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'sec.pe.2@teachers.demo.jusoor.edu',
    fullName: 'ك. نور الهدى',
    headline: 'معلمة التربية الرياضية واللياقة — الثانوية العامة',
    bio: 'التوجيه الرياضي والثقافة الصحية للنشء في المرحلة الثانوية العامة.',
    qualifications: `بكالوريوس تربية رياضية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 6,
    hourlyRate: '17.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2'],
        subjectSlugs: ['eg-pe-sport'],
        languages: ['ar'],
        hourlyRate: '17.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'sec.pe.3@teachers.demo.jusoor.edu',
    fullName: 'ك. أدهم فاروق',
    headline: 'معلم تربية رياضية وألعاب جماعية — الثانوية العامة',
    bio: 'ممارسة وتقييم المهارات الرياضية الأساسية في الصفوف الثانوية.',
    qualifications: `بكالوريوس تربية رياضية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '17.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2'],
        subjectSlugs: ['eg-pe-sport'],
        languages: ['ar'],
        hourlyRate: '17.00',
        supportsOnline: false,
        supportsInPerson: true,
      },
    ],
  },

  // Gen Sec Cultural & Arts Activities (Grades 1..2)
  {
    email: 'sec.artact.1@teachers.demo.jusoor.edu',
    fullName: 'أ. ميرفت زكي',
    headline: 'مشرفة الأنشطة الفنية والموسيقية والمسرحية والإعلامية — الثانوية العامة',
    bio: 'توجيه طلاب الصفين الأول والثاني الثانوي في أنشطة التربية الفنية والموسيقى والمسرح والصحافة والمكتبات والكشافة.',
    qualifications: `بكالوريوس تربية نوعية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 10,
    hourlyRate: '16.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2'],
        subjectSlugs: [
          'eg-art-ed',
          'eg-music-ed',
          'eg-scouts',
          'eg-theater-acting',
          'eg-journalism-broadcasting',
          'eg-reading-libraries',
        ],
        languages: ['ar'],
        hourlyRate: '16.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'sec.artact.2@teachers.demo.jusoor.edu',
    fullName: 'أ. هشام العبد',
    headline: 'معلم الأنشطة الثقافية والإذاعية والكشفية — الثانوية العامة',
    bio: 'مساعدة طلاب الثانوية العامة على تنفيذ ملفات الأنشطة الثقافية والفنية والمكتبية.',
    qualifications: `بكالوريوس إعلام وتربية مسرحية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '16.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2'],
        subjectSlugs: [
          'eg-art-ed',
          'eg-music-ed',
          'eg-scouts',
          'eg-theater-acting',
          'eg-journalism-broadcasting',
          'eg-reading-libraries',
        ],
        languages: ['ar'],
        hourlyRate: '16.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'sec.artact.3@teachers.demo.jusoor.edu',
    fullName: 'أ. ريمون عياد',
    headline: 'معلم الأنشطة التربوية والفنية والمكتبات — الثانوية العامة',
    bio: 'إعداد المشروعات الثقافية والمسرحية والموسيقية لصفوف الثانوية العامة.',
    qualifications: `بكالوريوس تربية فنية وموسيقية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '15.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2'],
        subjectSlugs: [
          'eg-art-ed',
          'eg-music-ed',
          'eg-scouts',
          'eg-theater-acting',
          'eg-journalism-broadcasting',
          'eg-reading-libraries',
        ],
        languages: ['ar'],
        hourlyRate: '15.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Gen Sec Technical, Science & Entrepreneurship Activities (Grades 1..2)
  {
    email: 'sec.techact.1@teachers.demo.jusoor.edu',
    fullName: 'أ. إيهاب شوقي',
    headline: 'مشرف الأنشطة العلمية والتكنولوجية وريادة الأعمال — الثانوية العامة',
    bio: 'إرشاد طلاب الثانوية العامة في النشاط العلمي الإبداعي وتكنولوجيا الصناعة والزراعة وخدمة المجتمع وريادة الأعمال.',
    qualifications: `بكالوريوس علوم وتكنولوجيا التعليم ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '17.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2'],
        subjectSlugs: [
          'eg-home-economics',
          'eg-community-service',
          'eg-creative-science-act',
          'eg-industrial-tech',
          'eg-agri-tech',
          'eg-entrepreneurship-projects',
        ],
        languages: ['ar'],
        hourlyRate: '17.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'sec.techact.2@teachers.demo.jusoor.edu',
    fullName: 'أ. أماني رشاد',
    headline: 'معلمة الاقتصاد المنزلي وريادة الأعمال وخدمة المجتمع — الثانوية العامة',
    bio: 'دعم الطلاب في إعداد مبادرات خدمة البيئة والاقتصاد المنزلي والمشروعات الريادية.',
    qualifications: `بكالوريوس اقتصاد منزلي وتربية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '16.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2'],
        subjectSlugs: [
          'eg-home-economics',
          'eg-community-service',
          'eg-creative-science-act',
          'eg-industrial-tech',
          'eg-agri-tech',
          'eg-entrepreneurship-projects',
        ],
        languages: ['ar'],
        hourlyRate: '16.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'sec.techact.3@teachers.demo.jusoor.edu',
    fullName: 'أ. جهاد فتح الله',
    headline: 'معلم التكنولوجيا التطبيقية والنشاط العلمي — الثانوية العامة',
    bio: 'تقييم وتوجيه مشروعات النشاط العلمي الإبداعي والتكنولوجيا الصناعية والزراعية بالثانوية العامة.',
    qualifications: `بكالوريوس تعليم فني وتطبيقي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 6,
    hourlyRate: '16.00',
    rules: [
      {
        systemCode: 'GENERAL_SECONDARY',
        gradeSlugs: ['gen-sec-1', 'gen-sec-2'],
        subjectSlugs: [
          'eg-home-economics',
          'eg-community-service',
          'eg-creative-science-act',
          'eg-industrial-tech',
          'eg-agri-tech',
          'eg-entrepreneurship-projects',
        ],
        languages: ['ar'],
        hourlyRate: '16.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // =========================================================================
  // D. EGYPTIAN BACCALAUREATE (EGYPTIAN_BACCALAUREATE) — Grades 1..3 ONLY
  // =========================================================================
  // Bacc Arabic (bacc-1 & bacc-2 all pathways)
  {
    email: 'bacc.arabic.1@teachers.demo.jusoor.edu',
    fullName: 'د. شريف الغمراوي',
    headline: 'معلم اللغة العربية — نظام البكالوريا المصرية',
    bio: 'تدريس اللغة العربية والمهارات اللغوية والتحليل النصي لطلاب المرحلة التمهيدية والصف الثاني بنظام البكالوريا المصرية.',
    qualifications: `ليسانس لغة عربية ودراسات عليا تربوية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 12,
    hourlyRate: '34.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1', 'bacc-2'],
        subjectSlugs: ['eg-arabic'],
        languages: ['ar'],
        hourlyRate: '34.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'bacc.arabic.2@teachers.demo.jusoor.edu',
    fullName: 'أ. حنان الجمل',
    headline: 'معلمة اللغة العربية — البكالوريا المصرية',
    bio: 'إعداد طلاب البكالوريا المصرية في التعبير والكتابة النقدية والبلاغة العربية.',
    qualifications: `ليسانس تربية لغة عربية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '30.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1', 'bacc-2'],
        subjectSlugs: ['eg-arabic'],
        languages: ['ar'],
        hourlyRate: '30.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'bacc.arabic.3@teachers.demo.jusoor.edu',
    fullName: 'أ. طارق البشري',
    headline: 'معلم لغة عربية وأدب — البكالوريا المصرية',
    bio: 'تدريب طلاب البكالوريا على مهارات القراءة الناقدة والنحو التطبيقي.',
    qualifications: `ليسانس دار العلوم ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 10,
    hourlyRate: '31.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1', 'bacc-2'],
        subjectSlugs: ['eg-arabic'],
        languages: ['ar'],
        hourlyRate: '31.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Bacc First Foreign Language (bacc-1 & bacc-2 all pathways)
  {
    email: 'bacc.lang1.1@teachers.demo.jusoor.edu',
    fullName: 'أ. نادية فهمي',
    headline: 'معلمة اللغة الأجنبية الأولى — نظام البكالوريا المصرية',
    bio: 'تدريس اللغة الإنجليزية والمهارات الأكاديمية للغة الأجنبية الأولى في البكالوريا المصرية.',
    qualifications: `بكالوريوس ألسن ودبلوم مناهج دولية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 11,
    hourlyRate: '35.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1', 'bacc-2'],
        subjectSlugs: ['eg-first-foreign-lang'],
        languages: ['en', 'ar'],
        hourlyRate: '35.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'bacc.lang1.2@teachers.demo.jusoor.edu',
    fullName: 'أ. بسام الدسوقي',
    headline: 'معلم اللغة الأجنبية الأولى — البكالوريا المصرية',
    bio: 'تطوير مهارات المقال البحثي والترجمة والفهم المتقدم لطلاب البكالوريا المصرية.',
    qualifications: `ليسانس تربية لغة إنجليزية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '32.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1', 'bacc-2'],
        subjectSlugs: ['eg-first-foreign-lang'],
        languages: ['en'],
        hourlyRate: '32.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'bacc.lang1.3@teachers.demo.jusoor.edu',
    fullName: 'أ. علياء شوكت',
    headline: 'معلمة لغات أجنبية أولى — البكالوريا المصرية',
    bio: 'تأهيل طلاب البكالوريا المصرية لاختبارات اللغة الأجنبية الأولى بالمسارات التخصصية.',
    qualifications: `بكالوريوس لغات وترجمة فورية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '33.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1', 'bacc-2'],
        subjectSlugs: ['eg-first-foreign-lang'],
        languages: ['en', 'fr'],
        hourlyRate: '33.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Bacc Egyptian History (bacc-1 & bacc-2 all pathways)
  {
    email: 'bacc.history.1@teachers.demo.jusoor.edu',
    fullName: 'د. محمد عبد المقصود',
    headline: 'معلم التاريخ المصري — نظام البكالوريا المصرية',
    bio: 'دراسة معمقة للتاريخ المصري القديم والحديث والمعاصر لطلاب البكالوريا المصرية.',
    qualifications: `ليسانس آداب تاريخ مصري ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 12,
    hourlyRate: '30.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1', 'bacc-2'],
        subjectSlugs: ['eg-egyptian-history'],
        languages: ['ar'],
        hourlyRate: '30.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'bacc.history.2@teachers.demo.jusoor.edu',
    fullName: 'أ. سهير الوكيل',
    headline: 'معلمة التاريخ المصري — البكالوريا المصرية',
    bio: 'تحليل الحضارة المصرية وتاريخ مصر الحديث لطلاب المسارات الأربعة بالبكالوريا.',
    qualifications: `ليسانس تربية تاريخ ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '28.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1', 'bacc-2'],
        subjectSlugs: ['eg-egyptian-history'],
        languages: ['ar'],
        hourlyRate: '28.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'bacc.history.3@teachers.demo.jusoor.edu',
    fullName: 'أ. راضي شعلان',
    headline: 'معلم التاريخ المصري والوثائق التاريخية — البكالوريا',
    bio: 'مراجعات وتدريبات نقدية على أحداث التاريخ المصري لطلاب البكالوريا.',
    qualifications: `ليسانس تاريخ ودبلوم دراسات تاريخية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '29.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1', 'bacc-2'],
        subjectSlugs: ['eg-egyptian-history'],
        languages: ['ar'],
        hourlyRate: '29.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Bacc Integrated Sciences (bacc-1)
  {
    email: 'bacc.intsci.1@teachers.demo.jusoor.edu',
    fullName: 'أ. حسام البدوي',
    headline: 'معلم العلوم المتكاملة — المرحلة التمهيدية للبكالوريا المصرية',
    bio: 'تدريس العلوم المتكاملة لطلاب الصف الأول الثانوي بالبكالوريا المصرية وتهيئتهم لمسارات الطب والهندسة.',
    qualifications: `بكالوريوس علوم ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '30.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1'],
        subjectSlugs: ['eg-integrated-science'],
        languages: ['ar', 'en'],
        hourlyRate: '30.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'bacc.intsci.2@teachers.demo.jusoor.edu',
    fullName: 'أ. ميساء حمدي',
    headline: 'معلمة العلوم المتكاملة — البكالوريا المصرية (تمهيدي)',
    bio: 'شرح وحدات العلوم المتكاملة بالعربية والإنجليزية والفرنسية لطلاب البكالوريا المصرية.',
    qualifications: `بكالوريوس تربية علوم ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '29.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1'],
        subjectSlugs: ['eg-integrated-science'],
        languages: ['en', 'ar', 'fr'],
        hourlyRate: '29.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'bacc.intsci.3@teachers.demo.jusoor.edu',
    fullName: 'أ. وليد العيسوي',
    headline: 'معلم العلوم المتكاملة والمشروعات العلمية — البكالوريا',
    bio: 'تبسيط التداخل بين الكيمياء والفيزياء والأحياء في المرحلة التمهيدية للبكالوريا.',
    qualifications: `بكالوريوس علوم تطبيقية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 6,
    hourlyRate: '28.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1'],
        subjectSlugs: ['eg-integrated-science'],
        languages: ['ar', 'en'],
        hourlyRate: '28.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Bacc Philosophy & Logic (bacc-1)
  {
    email: 'bacc.phil.1@teachers.demo.jusoor.edu',
    fullName: 'د. عادل السنهوري',
    headline: 'معلم الفلسفة والمنطق — البكالوريا المصرية (المرحلة التمهيدية)',
    bio: 'بناء التفكير النقدي والاستدلال المنطقي لطلاب المرحلة التمهيدية بالبكالوريا المصرية.',
    qualifications: `ليسانس فلسفة ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 11,
    hourlyRate: '28.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1'],
        subjectSlugs: ['eg-philosophy-logic'],
        languages: ['ar'],
        hourlyRate: '28.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'bacc.phil.2@teachers.demo.jusoor.edu',
    fullName: 'أ. إيمان المليجي',
    headline: 'معلمة الفلسفة والمنطق — البكالوريا المصرية',
    bio: 'تدريب طلاب البكالوريا على مهارات الحجاج المنطقي وتحليل القضايا الفلسفية.',
    qualifications: `ليسانس تربية مواد فلسفية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '26.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1'],
        subjectSlugs: ['eg-philosophy-logic'],
        languages: ['ar'],
        hourlyRate: '26.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'bacc.phil.3@teachers.demo.jusoor.edu',
    fullName: 'أ. سامي العطار',
    headline: 'معلم الفلسفة والمنطق — البكالوريا المصرية',
    bio: 'تطبيقات عملية على مبادئ المنطق الصوري والتفكير العلمي لطلاب البكالوريا.',
    qualifications: `ليسانس آداب فلسفة ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '26.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1'],
        subjectSlugs: ['eg-philosophy-logic'],
        languages: ['ar'],
        hourlyRate: '26.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Bacc Mathematics & Advanced Mathematics (bacc-1, BACC_2_MED, BACC_3_BUS, BACC_3_ENG)
  {
    email: 'bacc.math.1@teachers.demo.jusoor.edu',
    fullName: 'د. أكرم عبد الفتاح',
    headline: 'معلم الرياضيات والرياضيات المتقدمة — البكالوريا المصرية',
    bio: 'تدريس الرياضيات التمهيدية والتخصصية والمستوى المتقدم لطلاب مسارات الهندسة والطب والأعمال في البكالوريا المصرية.',
    qualifications: `بكالوريوس هندسة ورياضيات تطبيقية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 13,
    hourlyRate: '38.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1'],
        subjectSlugs: ['eg-mathematics'],
        languages: ['ar', 'en'],
        hourlyRate: '34.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-2'],
        pathwayCodes: ['BACC_2_MED'],
        subjectSlugs: ['eg-mathematics'],
        languages: ['ar', 'en'],
        hourlyRate: '36.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-3'],
        pathwayCodes: ['BACC_3_BUS'],
        subjectSlugs: ['eg-mathematics'],
        languages: ['ar', 'en'],
        hourlyRate: '36.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-3'],
        pathwayCodes: ['BACC_3_ENG'],
        subjectSlugs: ['eg-mathematics-adv'],
        languages: ['ar', 'en'],
        hourlyRate: '40.00',
        supportsOnline: true,
        supportsInPerson: true,
        notes: 'تخصص الرياضيات المستوى المتقدم لمسار الهندسة وعلوم الحاسب',
      },
    ],
  },
  {
    email: 'bacc.math.2@teachers.demo.jusoor.edu',
    fullName: 'أ. راندا صقر',
    headline: 'معلمة رياضيات ومستوى متقدم — البكالوريا المصرية (عربي ولغات)',
    bio: 'شرح التفاضل والتكامل المتقدم والجبر الخطي والمصفوفات لطلاب مسارات البكالوريا المصرية.',
    qualifications: `بكالوريوس علوم رياضيات ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 10,
    hourlyRate: '36.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1'],
        subjectSlugs: ['eg-mathematics'],
        languages: ['en', 'ar', 'fr'],
        hourlyRate: '33.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-2'],
        pathwayCodes: ['BACC_2_MED'],
        subjectSlugs: ['eg-mathematics'],
        languages: ['en', 'ar', 'fr'],
        hourlyRate: '35.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-3'],
        pathwayCodes: ['BACC_3_BUS'],
        subjectSlugs: ['eg-mathematics'],
        languages: ['en', 'ar', 'fr'],
        hourlyRate: '35.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-3'],
        pathwayCodes: ['BACC_3_ENG'],
        subjectSlugs: ['eg-mathematics-adv'],
        languages: ['en', 'ar', 'fr'],
        hourlyRate: '38.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'bacc.math.3@teachers.demo.jusoor.edu',
    fullName: 'أ. تيمور حجازي',
    headline: 'معلم رياضيات متقدمة — البكالوريا المصرية',
    bio: 'تدريب مكثف على مسائل التحليل الرياضي والدوال والرياضيات المالية في نظام البكالوريا.',
    qualifications: `بكالوريوس تربية رياضيات ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '35.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1'],
        subjectSlugs: ['eg-mathematics'],
        languages: ['ar', 'en'],
        hourlyRate: '32.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-2'],
        pathwayCodes: ['BACC_2_MED'],
        subjectSlugs: ['eg-mathematics'],
        languages: ['ar', 'en'],
        hourlyRate: '34.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-3'],
        pathwayCodes: ['BACC_3_BUS'],
        subjectSlugs: ['eg-mathematics'],
        languages: ['ar', 'en'],
        hourlyRate: '34.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-3'],
        pathwayCodes: ['BACC_3_ENG'],
        subjectSlugs: ['eg-mathematics-adv'],
        languages: ['ar', 'en'],
        hourlyRate: '37.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Bacc Physics & Advanced Physics (BACC_2_MED & BACC_3_ENG)
  {
    email: 'bacc.physics.1@teachers.demo.jusoor.edu',
    fullName: 'د. باهر توفيق',
    headline: 'معلم الفيزياء والفيزياء المتقدمة — البكالوريا المصرية',
    bio: 'تدريس الفيزياء التخصصية والفيزياء المتقدمة لطلاب مساري الطب والهندسة بالبكالوريا المصرية.',
    qualifications: `بكالوريوس علوم فيزياء ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 12,
    hourlyRate: '38.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-2'],
        pathwayCodes: ['BACC_2_MED'],
        subjectSlugs: ['eg-physics'],
        languages: ['ar', 'en'],
        hourlyRate: '35.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-3'],
        pathwayCodes: ['BACC_3_ENG'],
        subjectSlugs: ['eg-physics-adv'],
        languages: ['ar', 'en'],
        hourlyRate: '40.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'bacc.physics.2@teachers.demo.jusoor.edu',
    fullName: 'أ. سلمى الهلالي',
    headline: 'معلمة الفيزياء المتقدمة (Advanced Physics) — البكالوريا',
    bio: 'تبسيط الميكانيكا والموجات والفيزياء الحديثة والكهربية باللغتين العربية والإنجليزية لطلاب البكالوريا.',
    qualifications: `بكالوريوس تربية فيزياء ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '36.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-2'],
        pathwayCodes: ['BACC_2_MED'],
        subjectSlugs: ['eg-physics'],
        languages: ['en', 'ar', 'fr'],
        hourlyRate: '34.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-3'],
        pathwayCodes: ['BACC_3_ENG'],
        subjectSlugs: ['eg-physics-adv'],
        languages: ['en', 'ar', 'fr'],
        hourlyRate: '38.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'bacc.physics.3@teachers.demo.jusoor.edu',
    fullName: 'أ. عماد حشاد',
    headline: 'معلم الفيزياء المتقدمة — مسار الهندسة والطب (البكالوريا)',
    bio: 'تطبيقات ومسائل تحليلية متقدمة في الفيزياء لطلاب البكالوريا المصرية.',
    qualifications: `بكالوريوس هندسة فيزيائية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 10,
    hourlyRate: '37.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-2'],
        pathwayCodes: ['BACC_2_MED'],
        subjectSlugs: ['eg-physics'],
        languages: ['ar', 'en'],
        hourlyRate: '35.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-3'],
        pathwayCodes: ['BACC_3_ENG'],
        subjectSlugs: ['eg-physics-adv'],
        languages: ['ar', 'en'],
        hourlyRate: '39.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Bacc Chemistry & Advanced Chemistry (BACC_2_ENG & BACC_3_MED)
  {
    email: 'bacc.chem.1@teachers.demo.jusoor.edu',
    fullName: 'د. حازم المغربي',
    headline: 'معلم الكيمياء والكيمياء المتقدمة — البكالوريا المصرية',
    bio: 'تدريس الكيمياء والكيمياء المتقدمة والعضوية والحيوية لطلاب مساري الهندسة والطب في البكالوريا المصرية.',
    qualifications: `بكالوريوس علوم كيمياء ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 12,
    hourlyRate: '38.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-2'],
        pathwayCodes: ['BACC_2_ENG'],
        subjectSlugs: ['eg-chemistry'],
        languages: ['ar', 'en'],
        hourlyRate: '35.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-3'],
        pathwayCodes: ['BACC_3_MED'],
        subjectSlugs: ['eg-chemistry-adv'],
        languages: ['ar', 'en'],
        hourlyRate: '39.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'bacc.chem.2@teachers.demo.jusoor.edu',
    fullName: 'أ. نيرة شوقي',
    headline: 'معلمة الكيمياء المتقدمة (Advanced Chemistry) — البكالوريا',
    bio: 'شرح الكيمياء التحليلية والعضوية والحرارية باللغتين العربية والإنجليزية لطلاب البكالوريا.',
    qualifications: `بكالوريوس تربية كيمياء ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '36.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-2'],
        pathwayCodes: ['BACC_2_ENG'],
        subjectSlugs: ['eg-chemistry'],
        languages: ['en', 'ar', 'fr'],
        hourlyRate: '34.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-3'],
        pathwayCodes: ['BACC_3_MED'],
        subjectSlugs: ['eg-chemistry-adv'],
        languages: ['en', 'ar', 'fr'],
        hourlyRate: '38.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'bacc.chem.3@teachers.demo.jusoor.edu',
    fullName: 'أ. رأفت نجم',
    headline: 'معلم الكيمياء التخصصية والمتقدمة — البكالوريا المصرية',
    bio: 'تطبيقات متقدمة في المعايرة والتفاعلات العضوية لطلاب البكالوريا المصرية.',
    qualifications: `بكالوريوس صيدلة ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '36.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-2'],
        pathwayCodes: ['BACC_2_ENG'],
        subjectSlugs: ['eg-chemistry'],
        languages: ['ar', 'en'],
        hourlyRate: '34.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-3'],
        pathwayCodes: ['BACC_3_MED'],
        subjectSlugs: ['eg-chemistry-adv'],
        languages: ['ar', 'en'],
        hourlyRate: '38.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Bacc Advanced Biology (BACC_3_MED ONLY)
  {
    email: 'bacc.bio.1@teachers.demo.jusoor.edu',
    fullName: 'د. ريهام عبد الغني',
    headline: 'معلمة الأحياء – مستوى متقدم (مسار الطب وعلوم الحياة — البكالوريا)',
    bio: 'تدريس الفسيولوجيا المتقدمة والوراثة الجزيئية والمناعة لطلاب الصف الثالث بمسار الطب وعلوم الحياة.',
    qualifications: `بكالوريوس علوم بيولوجيا جزيئية ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 12,
    hourlyRate: '40.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-3'],
        pathwayCodes: ['BACC_3_MED'],
        subjectSlugs: ['eg-biology-adv'],
        languages: ['ar', 'en'],
        hourlyRate: '40.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'bacc.bio.2@teachers.demo.jusoor.edu',
    fullName: 'أ. مهاب نصار',
    headline: 'معلم الأحياء المتقدمة (Advanced Biology) — البكالوريا المصرية',
    bio: 'تحليل الحالات السريرية المبسطة والتجارب الخلوية لمسار الطب وعلوم الحياة بالبكالوريا.',
    qualifications: `بكالوريوس تربية أحياء ولغات ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '38.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-3'],
        pathwayCodes: ['BACC_3_MED'],
        subjectSlugs: ['eg-biology-adv'],
        languages: ['en', 'ar', 'fr'],
        hourlyRate: '38.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'bacc.bio.3@teachers.demo.jusoor.edu',
    fullName: 'د. سلوى الشناوي',
    headline: 'معلمة أحياء مستوى متقدم — مسار الطب وعلوم الحياة',
    bio: 'إعداد طلاب الصف الثالث بالبكالوريا في مسار الطب لإتقان موضوعات الوراثة والأنسجة الحيوية.',
    qualifications: `بكالوريوس علوم طبية وحيوية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 10,
    hourlyRate: '39.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-3'],
        pathwayCodes: ['BACC_3_MED'],
        subjectSlugs: ['eg-biology-adv'],
        languages: ['ar', 'en'],
        hourlyRate: '39.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Bacc Programming & CS/AI (bacc-1 & BACC_2_ENG)
  {
    email: 'bacc.ai.1@teachers.demo.jusoor.edu',
    fullName: 'م. كريم التونسي',
    headline: 'معلم البرمجة وعلوم الحاسب والذكاء الاصطناعي — البكالوريا المصرية',
    bio: 'تدريس الخوارزميات وهياكل البيانات وتطبيقات الذكاء الاصطناعي لطلاب الصف الأول التمهيدي ومسار الهندسة بالبكالوريا.',
    qualifications: `بكالوريوس هندسة حاسبات وذكاء اصطناعي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '38.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1'],
        subjectSlugs: ['eg-programming-cs-ai'],
        languages: ['ar', 'en'],
        hourlyRate: '34.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-2'],
        pathwayCodes: ['BACC_2_ENG'],
        subjectSlugs: ['eg-programming-ai'],
        languages: ['ar', 'en'],
        hourlyRate: '38.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'bacc.ai.2@teachers.demo.jusoor.edu',
    fullName: 'م. لينا الدجوي',
    headline: 'معلمة البرمجة والذكاء الاصطناعي — مسار الهندسة وعلوم الحاسب',
    bio: 'مشروعات برمجية وتطبيقات تعلم الآلة وهندسة الأوامر لطلاب البكالوريا المصرية.',
    qualifications: `بكالوريوس علوم حاسب ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '36.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1'],
        subjectSlugs: ['eg-programming-cs-ai'],
        languages: ['en', 'ar'],
        hourlyRate: '33.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-2'],
        pathwayCodes: ['BACC_2_ENG'],
        subjectSlugs: ['eg-programming-ai'],
        languages: ['en', 'ar'],
        hourlyRate: '36.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'bacc.ai.3@teachers.demo.jusoor.edu',
    fullName: 'م. مازن الغريب',
    headline: 'معلم علوم الحاسب والذكاء الاصطناعي — البكالوريا المصرية',
    bio: 'شرح عملي لأساسيات بايثون والشبكات ونماذج الذكاء الاصطناعي التمهيدية لطلاب البكالوريا.',
    qualifications: `بكالوريوس ذكاء اصطناعي وهندسة برمجيات ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 6,
    hourlyRate: '35.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1'],
        subjectSlugs: ['eg-programming-cs-ai'],
        languages: ['ar', 'en'],
        hourlyRate: '32.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-2'],
        pathwayCodes: ['BACC_2_ENG'],
        subjectSlugs: ['eg-programming-ai'],
        languages: ['ar', 'en'],
        hourlyRate: '35.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Bacc Business, Accounting & Financial Culture (BACC_2_* & BACC_2_BUS)
  {
    email: 'bacc.bus.1@teachers.demo.jusoor.edu',
    fullName: 'أ. خالد السمان',
    headline: 'معلم المحاسبة وإدارة الأعمال والثقافة المالية — البكالوريا المصرية',
    bio: 'شرح مبادئ المحاسبة المالية والقوائم المالية وإدارة الأعمال والثقافة المالية لطلاب البكالوريا المصرية.',
    qualifications: `بكالوريوس تجارة قسم محاسبة ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 11,
    hourlyRate: '32.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-2'],
        pathwayCodes: ['BACC_2_BUS'],
        subjectSlugs: ['eg-accounting', 'eg-business-admin'],
        languages: ['ar', 'en'],
        hourlyRate: '33.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-2'],
        subjectSlugs: ['eg-financial-culture'],
        languages: ['ar', 'en'],
        hourlyRate: '28.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'bacc.bus.2@teachers.demo.jusoor.edu',
    fullName: 'أ. راندا المنياوي',
    headline: 'معلمة إدارة الأعمال والمحاسبة والثقافة المالية — البكالوريا',
    bio: 'دراسة حالات تطبيقية في التسويق والتمويل والمحاسبة والثقافة المالية لصف الثاني بالبكالوريا.',
    qualifications: `بكالوريوس إدارة أعمال ولغات ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '30.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-2'],
        pathwayCodes: ['BACC_2_BUS'],
        subjectSlugs: ['eg-accounting', 'eg-business-admin'],
        languages: ['en', 'ar'],
        hourlyRate: '31.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-2'],
        subjectSlugs: ['eg-financial-culture'],
        languages: ['en', 'ar'],
        hourlyRate: '27.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'bacc.bus.3@teachers.demo.jusoor.edu',
    fullName: 'أ. تامر عبد الستار',
    headline: 'معلم المحاسبة والتمويل والثقافة المالية — البكالوريا المصرية',
    bio: 'تبسيط قيود اليومية والميزانية ومهارات التخطيط المالي الشخصي لطلاب البكالوريا المصرية.',
    qualifications: `بكالوريوس تجارة وإدارة مالية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '29.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-2'],
        pathwayCodes: ['BACC_2_BUS'],
        subjectSlugs: ['eg-accounting', 'eg-business-admin'],
        languages: ['ar', 'en'],
        hourlyRate: '30.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-2'],
        subjectSlugs: ['eg-financial-culture'],
        languages: ['ar', 'en'],
        hourlyRate: '26.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Bacc Advanced Economics (BACC_3_BUS — plus existing omar.expert & layla.mentor scoped to BACC_3_BUS Economics)
  {
    email: 'bacc.econ.3@teachers.demo.jusoor.edu',
    fullName: 'د. نوران الجندي',
    headline: 'معلمة الاقتصاد – مستوى متقدم (مسار الأعمال — البكالوريا المصرية)',
    bio: 'تدريس الاقتصاد الكلي والجزئي والسياسات النقدية والتجارة الدولية لطلاب الصف الثالث مسار الأعمال.',
    qualifications: `بكالوريوس اقتصاد وعلوم سياسية ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 10,
    hourlyRate: '38.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-3'],
        pathwayCodes: ['BACC_3_BUS'],
        subjectSlugs: ['eg-economics-adv'],
        languages: ['ar', 'en'],
        hourlyRate: '38.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Bacc Psychology (BACC_2_ARTS ONLY)
  {
    email: 'bacc.psych.1@teachers.demo.jusoor.edu',
    fullName: 'د. غادة الشرقاوي',
    headline: 'معلمة علم النفس — مسار الآداب والفنون (البكالوريا المصرية)',
    bio: 'شرح مناهج البحث النفسي والنمو والتعلم والإدراك لطلاب الصف الثاني بمسار الآداب والفنون.',
    qualifications: `ليسانس علم نفس ودبلوم إرشاد نفسي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 10,
    hourlyRate: '30.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-2'],
        pathwayCodes: ['BACC_2_ARTS'],
        subjectSlugs: ['eg-psychology'],
        languages: ['ar'],
        hourlyRate: '30.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'bacc.psych.2@teachers.demo.jusoor.edu',
    fullName: 'أ. مؤمن شريف',
    headline: 'معلم علم النفس — البكالوريا المصرية (مسار الآداب والفنون)',
    bio: 'ربط النظريات النفسية بالدراسات التطبيقية وأسئلة التفكير الناقد في البكالوريا.',
    qualifications: `ليسانس تربية علم نفس ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '28.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-2'],
        pathwayCodes: ['BACC_2_ARTS'],
        subjectSlugs: ['eg-psychology'],
        languages: ['ar'],
        hourlyRate: '28.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'bacc.psych.3@teachers.demo.jusoor.edu',
    fullName: 'أ. ولاء حسني',
    headline: 'معلمة علم النفس المعرفي والاجتماعي — البكالوريا',
    bio: 'مراجعات وتلخيصات شاملة لموضوعات علم النفس لطلاب مسار الآداب والفنون.',
    qualifications: `ليسانس آداب علم نفس ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '27.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-2'],
        pathwayCodes: ['BACC_2_ARTS'],
        subjectSlugs: ['eg-psychology'],
        languages: ['ar'],
        hourlyRate: '27.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Bacc Advanced Geography (BACC_3_ARTS ONLY)
  {
    email: 'bacc.geo.1@teachers.demo.jusoor.edu',
    fullName: 'د. صلاح البدري',
    headline: 'معلم الجغرافيا – مستوى متقدم (مسار الآداب والفنون — البكالوريا)',
    bio: 'تدريس الجغرافيا المتقدمة وتحليل الظواهر الجغرافية والخرائط لطلاب الصف الثالث مسار الآداب والفنون.',
    qualifications: `ليسانس جغرافيا ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 11,
    hourlyRate: '32.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-3'],
        pathwayCodes: ['BACC_3_ARTS'],
        subjectSlugs: ['eg-geography-adv'],
        languages: ['ar'],
        hourlyRate: '32.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'bacc.geo.2@teachers.demo.jusoor.edu',
    fullName: 'أ. هدى النجار',
    headline: 'معلمة الجغرافيا المتقدمة — البكالوريا المصرية',
    bio: 'إعداد طلاب الصف الثالث بالبكالوريا لتحليل الخرائط الموضوعية والبيانات السكانية والبيئية.',
    qualifications: `ليسانس تربية جغرافيا ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '30.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-3'],
        pathwayCodes: ['BACC_3_ARTS'],
        subjectSlugs: ['eg-geography-adv'],
        languages: ['ar'],
        hourlyRate: '30.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'bacc.geo.3@teachers.demo.jusoor.edu',
    fullName: 'أ. فوزي عبد المجيد',
    headline: 'معلم الجغرافيا الإقليمية والمتقدمة — البكالوريا المصرية',
    bio: 'شرح وافٍ لوحدات الجغرافيا المتقدمة والتكتلات الجغرافية لمسار الآداب والفنون.',
    qualifications: `ليسانس آداب جغرافيا ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '30.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-3'],
        pathwayCodes: ['BACC_3_ARTS'],
        subjectSlugs: ['eg-geography-adv'],
        languages: ['ar'],
        hourlyRate: '30.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Bacc Statistics (BACC_3_ARTS ONLY)
  {
    email: 'bacc.stats.1@teachers.demo.jusoor.edu',
    fullName: 'د. مازن السعيد',
    headline: 'معلم الإحصاء — الصف الثالث مسار الآداب والفنون (البكالوريا)',
    bio: 'شرح الإحصاء الوصفي والاستدلالي والاحتمالات لطلاب الصف الثالث بمسار الآداب والفنون في البكالوريا المصرية.',
    qualifications: `بكالوريوس إحصاء تطبيقي ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 10,
    hourlyRate: '30.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-3'],
        pathwayCodes: ['BACC_3_ARTS'],
        subjectSlugs: ['eg-statistics'],
        languages: ['ar', 'en'],
        hourlyRate: '30.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'bacc.stats.2@teachers.demo.jusoor.edu',
    fullName: 'أ. رشا الفقي',
    headline: 'معلمة الإحصاء — البكالوريا المصرية (عربي ولغات)',
    bio: 'تطبيقات عملية على الجداول الإحصائية والارتباط والانحدار لطلاب البكالوريا المصرية.',
    qualifications: `بكالوريوس تربية رياضيات وإحصاء ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '28.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-3'],
        pathwayCodes: ['BACC_3_ARTS'],
        subjectSlugs: ['eg-statistics'],
        languages: ['en', 'ar', 'fr'],
        hourlyRate: '28.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'bacc.stats.3@teachers.demo.jusoor.edu',
    fullName: 'أ. سامح عبد الله',
    headline: 'معلم الإحصاء التربوي والاحتمالات — البكالوريا المصرية',
    bio: 'تدريب طلاب مسار الآداب والفنون على حل مسائل الإحصاء بسرعة ودقة.',
    qualifications: `بكالوريوس تجارة وإحصاء ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '27.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-3'],
        pathwayCodes: ['BACC_3_ARTS'],
        subjectSlugs: ['eg-statistics'],
        languages: ['ar', 'en'],
        hourlyRate: '27.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Bacc Second Foreign Language (bacc-1 & BACC_2_ARTS)
  {
    email: 'bacc.lang2.1@teachers.demo.jusoor.edu',
    fullName: 'أ. كلير بولس',
    headline: 'معلمة اللغة الأجنبية الثانية (فرنسية) — البكالوريا المصرية',
    bio: 'تدريس اللغة الفرنسية كلغة أجنبية ثانية في المرحلة التمهيدية ومسار الآداب بالبكالوريا المصرية.',
    qualifications: `ليسانس ألسن لغة فرنسية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '28.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1'],
        subjectSlugs: ['eg-second-foreign-lang'],
        languages: ['fr', 'ar'],
        hourlyRate: '27.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-2'],
        pathwayCodes: ['BACC_2_ARTS'],
        subjectSlugs: ['eg-second-foreign-lang'],
        languages: ['fr', 'ar'],
        hourlyRate: '29.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'bacc.lang2.2@teachers.demo.jusoor.edu',
    fullName: 'أ. مهند رستم',
    headline: 'معلم اللغة الأجنبية الثانية (ألمانية / إسبانية) — البكالوريا المصرية',
    bio: 'تأهيل طلاب البكالوريا المصرية في المحادثة والقواعد والكتابة باللغة الثانية.',
    qualifications: `ليسانس ألسن لغة ألمانية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '29.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1'],
        subjectSlugs: ['eg-second-foreign-lang'],
        languages: ['de', 'ar'],
        hourlyRate: '28.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-2'],
        pathwayCodes: ['BACC_2_ARTS'],
        subjectSlugs: ['eg-second-foreign-lang'],
        languages: ['de', 'ar'],
        hourlyRate: '30.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'bacc.lang2.3@teachers.demo.jusoor.edu',
    fullName: 'أ. دينا العرابي',
    headline: 'معلمة اللغة الأجنبية الثانية (إيطالية / فرنسية) — البكالوريا',
    bio: 'مراجعات وتدريبات متكاملة للغة الأجنبية الثانية لطلاب البكالوريا المصرية.',
    qualifications: `ليسانس لغات وترجمة ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '27.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1'],
        subjectSlugs: ['eg-second-foreign-lang'],
        languages: ['fr', 'ar'],
        hourlyRate: '26.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-2'],
        pathwayCodes: ['BACC_2_ARTS'],
        subjectSlugs: ['eg-second-foreign-lang'],
        languages: ['fr', 'ar'],
        hourlyRate: '28.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Bacc Religious Education (bacc-1 & bacc-3 all pathways — 70% threshold in grade 3)
  {
    email: 'bacc.religion.1@teachers.demo.jusoor.edu',
    fullName: 'أ. بلال الرفاعي',
    headline: 'معلم التربية الدينية الإسلامية — نظام البكالوريا المصرية',
    bio: 'تدريس مقرر التربية الدينية الإسلامية وإعداد طلاب الصف الثالث بالبكالوريا لاجتياز نسبة النجاح المطلوبة (70%).',
    qualifications: `ليسانس دراسات إسلامية ودبلوم تربوي ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 10,
    hourlyRate: '20.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1', 'bacc-3'],
        subjectSlugs: ['eg-religious-ed'],
        languages: ['ar'],
        religiousVariant: 'ISLAMIC',
        hourlyRate: '20.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'bacc.religion.2@teachers.demo.jusoor.edu',
    fullName: 'أ. فاطمة السعدني',
    headline: 'معلمة التربية الدينية الإسلامية — البكالوريا المصرية',
    bio: 'شرح وافٍ وتدريبات متدرجة لمادة التربية الدينية لطلاب البكالوريا المصرية.',
    qualifications: `ليسانس شريعة ودراسات تربوية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 8,
    hourlyRate: '19.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1', 'bacc-3'],
        subjectSlugs: ['eg-religious-ed'],
        languages: ['ar'],
        religiousVariant: 'ISLAMIC',
        hourlyRate: '19.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'bacc.religion.3@teachers.demo.jusoor.edu',
    fullName: 'أ. مرقس حبيب',
    headline: 'معلم التربية الدينية المسيحية — البكالوريا المصرية',
    bio: 'تدريس مقرر التربية الدينية المسيحية للصفين الأول والثالث بنظام البكالوريا المصرية.',
    qualifications: `بكالوريوس دراسات تربوية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '20.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1', 'bacc-3'],
        subjectSlugs: ['eg-religious-ed'],
        languages: ['ar'],
        religiousVariant: 'CHRISTIAN',
        hourlyRate: '20.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },

  // Bacc PE & Selected Activity (bacc-1..3)
  {
    email: 'bacc.pe.1@teachers.demo.jusoor.edu',
    fullName: 'ك. هيثم علام',
    headline: 'معلم التربية الرياضية والنشاط المختار — البكالوريا المصرية',
    bio: 'الإشراف على أنشطة التربية الرياضية والنشاط التربوي والمهني المختار لطلاب نظام البكالوريا المصرية.',
    qualifications: `بكالوريوس تربية رياضية وإدارة أنشطة ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 9,
    hourlyRate: '18.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1', 'bacc-2', 'bacc-3'],
        subjectSlugs: ['eg-pe-sport', 'eg-pe-activity', 'eg-bacc-selected-activity'],
        languages: ['ar'],
        hourlyRate: '18.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
  {
    email: 'bacc.pe.2@teachers.demo.jusoor.edu',
    fullName: 'ك. سارة الدالي',
    headline: 'معلمة اللياقة البدنية والنشاط التربوي — البكالوريا المصرية',
    bio: 'متابعة خطط النشاط الرياضي والمهني المعتمد لطلاب الصفوف الثلاثة بالبكالوريا.',
    qualifications: `بكالوريوس تربية رياضية ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 7,
    hourlyRate: '17.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1', 'bacc-2', 'bacc-3'],
        subjectSlugs: ['eg-pe-sport', 'eg-pe-activity', 'eg-bacc-selected-activity'],
        languages: ['ar'],
        hourlyRate: '17.00',
        supportsOnline: true,
        supportsInPerson: false,
      },
    ],
  },
  {
    email: 'bacc.pe.3@teachers.demo.jusoor.edu',
    fullName: 'ك. زياد الشربيني',
    headline: 'معلم النشاط الرياضي والمهني — البكالوريا المصرية',
    bio: 'توجيه طلاب البكالوريا في الأنشطة الرياضية والمهنية المختارة وتقييم الأداء الفصلي.',
    qualifications: `بكالوريوس تربية رياضية وتنمية مهارات ${DEMO_QUAL_SUFFIX}`,
    yearsExperience: 6,
    hourlyRate: '17.00',
    rules: [
      {
        systemCode: 'EGYPTIAN_BACCALAUREATE',
        gradeSlugs: ['bacc-1', 'bacc-2', 'bacc-3'],
        subjectSlugs: ['eg-pe-sport', 'eg-pe-activity', 'eg-bacc-selected-activity'],
        languages: ['ar'],
        hourlyRate: '17.00',
        supportsOnline: true,
        supportsInPerson: true,
      },
    ],
  },
];

// Existing core demo teachers — strictly scoped to ONE stage/system each (zero cross-stage mixing)
const EXISTING_DEMO_TEACHER_SCOPES: Record<string, AssignmentRule[]> = {
  // Primary Mathematics ONLY (preserves 0-course teacher requirement on primary-4 eg-mathematics)
  'ahmed.math@demo.jusoor.edu': [
    {
      systemCode: 'PRIMARY_GENERAL',
      gradeSlugs: ['primary-4', 'primary-5', 'primary-6'],
      subjectSlugs: ['eg-mathematics'],
      languages: ['ar', 'en'],
      hourlyRate: '22.00',
      supportsOnline: true,
      supportsInPerson: true,
      notes: 'تأسيس الرياضيات والكسور للمرحلة الابتدائية (عربي ولغات)',
    },
  ],
  // Primary Science ONLY
  'salma.science@demo.jusoor.edu': [
    {
      systemCode: 'PRIMARY_GENERAL',
      gradeSlugs: ['primary-4', 'primary-5', 'primary-6'],
      subjectSlugs: ['eg-science'],
      languages: ['ar', 'en'],
      hourlyRate: '24.00',
      supportsOnline: true,
      supportsInPerson: false,
      notes: 'تدريس العلوم للصفوف الرابع والخامس والسادس الابتدائي',
    },
  ],
  // Primary Arabic ONLY
  'yasser.arabic@demo.jusoor.edu': [
    {
      systemCode: 'PRIMARY_GENERAL',
      gradeSlugs: ['primary-4', 'primary-5', 'primary-6'],
      subjectSlugs: ['eg-arabic'],
      languages: ['ar'],
      hourlyRate: '20.00',
      supportsOnline: true,
      supportsInPerson: true,
      notes: 'تأسيس اللغة العربية والنحو للمرحلة الابتدائية',
    },
  ],
  // General Secondary Programming & AI ONLY
  'tariq.teacher@demo.jusoor.edu': [
    {
      systemCode: 'GENERAL_SECONDARY',
      gradeSlugs: ['gen-sec-1'],
      subjectSlugs: ['eg-programming-ai'],
      languages: ['ar', 'en'],
      hourlyRate: '35.00',
      supportsOnline: true,
      supportsInPerson: false,
      notes: 'أساسيات البرمجة والذكاء الاصطناعي للصف الأول الثانوي العام',
    },
  ],
  // Egyptian Baccalaureate Grade 3 Business Economics ONLY
  'layla.mentor@demo.jusoor.edu': [
    {
      systemCode: 'EGYPTIAN_BACCALAUREATE',
      gradeSlugs: ['bacc-3'],
      pathwayCodes: ['BACC_3_BUS'],
      subjectSlugs: ['eg-economics-adv'],
      languages: ['ar', 'en'],
      hourlyRate: '40.00',
      supportsOnline: true,
      supportsInPerson: false,
      notes: 'الاقتصاد المتقدم ودراسات السوق لمسار الأعمال بالبكالوريا المصرية',
    },
  ],
  // Egyptian Baccalaureate Grade 3 Business Economics ONLY
  'omar.expert@demo.jusoor.edu': [
    {
      systemCode: 'EGYPTIAN_BACCALAUREATE',
      gradeSlugs: ['bacc-3'],
      pathwayCodes: ['BACC_3_BUS'],
      subjectSlugs: ['eg-economics-adv'],
      languages: ['ar', 'en'],
      hourlyRate: '45.00',
      supportsOnline: true,
      supportsInPerson: true,
      notes: 'الاقتصاد الكلي والجزئي لمسار الأعمال بالبكالوريا المصرية',
    },
  ],
};

export interface CoverageAuditRow {
  curriculumSubjectId: number;
  stageSlug: string;
  stageNameAr: string;
  systemCode: string;
  systemNameAr: string;
  gradeSlug: string;
  gradeNameAr: string;
  divisionCode: string | null;
  divisionNameAr: string | null;
  pathwayCode: string | null;
  pathwayNameAr: string | null;
  subjectSlug: string;
  subjectNameAr: string;
  subjectNameEn: string;
  distinctActiveTeachers: number;
  status: 'COMPLETE' | 'INCOMPLETE';
}

export interface CoverageAuditReport {
  academicYearCode: string;
  versionCode: string;
  totalContexts: number;
  completeContexts: number;
  incompleteContexts: number;
  totalDemoTeachers: number;
  totalStageTeacherProfiles: number;
  totalActiveAssignments: number;
  crossStageViolations: Array<{
    teacherUserId: number;
    email: string;
    fullName: string;
    systems: string[];
  }>;
  rows: CoverageAuditRow[];
}

export async function ensureStageSpecificDemoTeachersSeeded(): Promise<{
  createdUsers: number;
  createdAssignments: number;
  removedCrossStageAssignments: number;
  createdCourses: number;
  createdSessions: number;
}> {
  const [teacherRole] = await db
    .select()
    .from(roles)
    .where(eq(roles.code, 'TEACHER'))
    .limit(1);

  if (!teacherRole) {
    throw new Error('TEACHER role not found in roles table.');
  }

  // Load active curriculum subjects with full hierarchy metadata
  const [currentYear] = await db
    .select()
    .from(academicYears)
    .where(eq(academicYears.code, '2026/2027'))
    .limit(1);

  if (!currentYear) {
    throw new Error('Academic year 2026/2027 not seeded yet.');
  }

  const [activeVersion] = await db
    .select()
    .from(curriculumVersions)
    .where(
      and(
        eq(curriculumVersions.academicYearId, currentYear.id),
        eq(curriculumVersions.isActive, true)
      )
    )
    .limit(1);

  if (!activeVersion) {
    throw new Error('Active curriculum version for 2026/2027 not found.');
  }

  const allCsRows = await db
    .select({
      id: curriculumSubjects.id,
      stageId: curriculumSubjects.stageId,
      systemId: curriculumSubjects.systemId,
      gradeId: curriculumSubjects.gradeId,
      divisionId: curriculumSubjects.divisionId,
      pathwayId: curriculumSubjects.pathwayId,
      subjectId: curriculumSubjects.subjectId,
      systemCode: educationalSystems.code,
      gradeSlug: educationalGrades.slug,
      divisionCode: secondaryDivisions.code,
      pathwayCode: baccalaureatePathways.code,
      subjectSlug: subjects.slug,
    })
    .from(curriculumSubjects)
    .innerJoin(educationalSystems, eq(curriculumSubjects.systemId, educationalSystems.id))
    .innerJoin(educationalGrades, eq(curriculumSubjects.gradeId, educationalGrades.id))
    .innerJoin(subjects, eq(curriculumSubjects.subjectId, subjects.id))
    .leftJoin(secondaryDivisions, eq(curriculumSubjects.divisionId, secondaryDivisions.id))
    .leftJoin(baccalaureatePathways, eq(curriculumSubjects.pathwayId, baccalaureatePathways.id))
    .where(
      and(
        eq(curriculumSubjects.curriculumVersionId, activeVersion.id),
        eq(curriculumSubjects.isActive, true),
        eq(curriculumSubjects.isAvailableForTeacherAssignment, true)
      )
    );

  // Precompute valid scrypt password hash once for fast batch creation
  const sharedDemoPasswordHash = hashPassword('JusoorDemoTeacher!2026');

  let createdUsers = 0;
  let createdAssignments = 0;
  let removedCrossStageAssignments = 0;
  let createdCourses = 0;
  let createdSessions = 0;

  await db.transaction(async (tx) => {
    const existingUsers = await tx
      .select({ id: users.id, email: users.email, isDemo: users.isDemo })
      .from(users);
    const userByEmail = new Map(existingUsers.map((u) => [u.email, u]));

    const existingRoleAssignments = await tx
      .select({ userId: userRoles.userId, roleId: userRoles.roleId })
      .from(userRoles)
      .where(eq(userRoles.roleId, teacherRole.id));
    const existingProfiles = await tx
      .select({ userId: providerProfiles.userId })
      .from(providerProfiles);
    const hasTeacherRoleSet = new Set(existingRoleAssignments.map((r) => r.userId));
    const hasProfileSet = new Set(existingProfiles.map((p) => p.userId));

    const missingUsersToInsert: Array<typeof users.$inferInsert> = [];
    for (const teacher of STAGE_TEACHERS) {
      if (!userByEmail.has(teacher.email)) {
        missingUsersToInsert.push({
          email: teacher.email,
          passwordHash: sharedDemoPasswordHash,
          fullName: teacher.fullName,
          avatarUrl: null,
          locale: 'ar',
          accountStatus: 'ACTIVE',
          emailVerified: true,
          isDemo: true,
        });
      }
    }

    if (missingUsersToInsert.length > 0) {
      for (let i = 0; i < missingUsersToInsert.length; i += 100) {
        const chunk = missingUsersToInsert.slice(i, i + 100);
        const inserted = await tx
          .insert(users)
          .values(chunk)
          .onConflictDoNothing()
          .returning({ id: users.id, email: users.email });
        for (const row of inserted) {
          userByEmail.set(row.email, { id: row.id, email: row.email, isDemo: true });
          createdUsers++;
        }
      }
    }

    const rolesToInsert: Array<typeof userRoles.$inferInsert> = [];
    const profilesToInsert: Array<typeof providerProfiles.$inferInsert> = [];

    for (const teacher of STAGE_TEACHERS) {
      const userId = userByEmail.get(teacher.email)?.id;
      if (!userId) continue;
      if (!hasTeacherRoleSet.has(userId)) {
        rolesToInsert.push({ userId, roleId: teacherRole.id });
        hasTeacherRoleSet.add(userId);
      }
      if (!hasProfileSet.has(userId)) {
        profilesToInsert.push({
          userId,
          providerType: 'TEACHER',
          headline: teacher.headline,
          bio: teacher.bio,
          qualifications: teacher.qualifications,
          yearsExperience: teacher.yearsExperience,
          hourlyRate: teacher.hourlyRate,
          currency: 'USD',
          verificationStatus: 'PENDING',
          ratingAvg: '0.00',
          reviewsCount: 0,
          isAcceptingTasks: true,
          isAcceptingBookings: true,
        });
        hasProfileSet.add(userId);
      }
    }

    for (let i = 0; i < rolesToInsert.length; i += 100) {
      await tx
        .insert(userRoles)
        .values(rolesToInsert.slice(i, i + 100))
        .onConflictDoNothing();
    }
    for (let i = 0; i < profilesToInsert.length; i += 100) {
      await tx
        .insert(providerProfiles)
        .values(profilesToInsert.slice(i, i + 100))
        .onConflictDoNothing();
    }

    // 2. Enforce strict single-stage isolation for core existing demo teachers
    const scopedDemoEmails = Object.keys(EXISTING_DEMO_TEACHER_SCOPES);
    const scopedUserIds = scopedDemoEmails
      .map((em) => userByEmail.get(em))
      .filter((u): u is { id: number; email: string; isDemo: boolean } => Boolean(u && u.isDemo));

    const matchingCsForRules = (rules: AssignmentRule[]) => {
      const matched: Array<{
        cs: (typeof allCsRows)[number];
        rule: AssignmentRule;
      }> = [];
      const seenCsIds = new Set<number>();

      for (const rule of rules) {
        for (const cs of allCsRows) {
          if (cs.systemCode !== rule.systemCode) continue;
          if (!rule.gradeSlugs.includes(cs.gradeSlug)) continue;
          if (!rule.subjectSlugs.includes(cs.subjectSlug)) continue;
          if (rule.divisionCodes && (!cs.divisionCode || !rule.divisionCodes.includes(cs.divisionCode))) {
            continue;
          }
          if (rule.pathwayCodes && (!cs.pathwayCode || !rule.pathwayCodes.includes(cs.pathwayCode))) {
            continue;
          }
          if (!seenCsIds.has(cs.id)) {
            seenCsIds.add(cs.id);
            matched.push({ cs, rule });
          }
        }
      }
      return matched;
    };

    for (const u of scopedUserIds) {
      const rules = EXISTING_DEMO_TEACHER_SCOPES[u.email];
      const allowedMatches = matchingCsForRules(rules);
      const allowedCsIds = new Set(allowedMatches.map((m) => m.cs.id));

      const existingAssignments = await tx
        .select({
          id: teacherTeachingAssignments.id,
          curriculumSubjectId: teacherTeachingAssignments.curriculumSubjectId,
        })
        .from(teacherTeachingAssignments)
        .where(eq(teacherTeachingAssignments.teacherUserId, u.id));

      const staleIds = existingAssignments
        .filter((a) => !allowedCsIds.has(a.curriculumSubjectId))
        .map((a) => a.id);

      if (staleIds.length > 0) {
        await tx
          .delete(teacherTeachingAssignments)
          .where(inArray(teacherTeachingAssignments.id, staleIds));
        removedCrossStageAssignments += staleIds.length;
      }
    }

    // Update existing demo session #12 if tariq.teacher still owns a Baccalaureate session
    const tariqUser = userByEmail.get('tariq.teacher@demo.jusoor.edu');
    const baccAiTeacher = userByEmail.get('bacc.ai.1@teachers.demo.jusoor.edu');
    if (tariqUser && baccAiTeacher) {
      const baccAiCs = allCsRows.find(
        (cs) =>
          cs.systemCode === 'EGYPTIAN_BACCALAUREATE' &&
          cs.gradeSlug === 'bacc-2' &&
          cs.pathwayCode === 'BACC_2_ENG' &&
          cs.subjectSlug === 'eg-programming-ai'
      );
      if (baccAiCs) {
        await tx
          .update(teachingSessions)
          .set({ teacherUserId: baccAiTeacher.id })
          .where(
            and(
              eq(teachingSessions.teacherUserId, tariqUser.id),
              eq(teachingSessions.curriculumSubjectId, baccAiCs.id),
              eq(teachingSessions.isDemo, true)
            )
          );
      }
    }

    // Ensure ahmed.math, salma.science, yasser.arabic also have clean headlines matching their stage-only scope
    const headlineUpdates: Array<{ email: string; headline: string; bio: string }> = [
      {
        email: 'ahmed.math@demo.jusoor.edu',
        headline: 'معلم أول رياضيات — المرحلة الابتدائية (عربي ولغات)',
        bio: 'خبرة 11 عاماً في تدريس مناهج الرياضيات المصرية للمرحلة الابتدائية وتبسيط الكسور والعمليات الحسابية والهندسية.',
      },
      {
        email: 'salma.science@demo.jusoor.edu',
        headline: 'معلمة علوم (Science) — المرحلة الابتدائية (عربي ولغات)',
        bio: 'متخصصة في تدريس العلوم للصفوف الرابع والخامس والسادس الابتدائي بأسلوب تفاعلي وتجارب مبسطة.',
      },
      {
        email: 'yasser.arabic@demo.jusoor.edu',
        headline: 'معلم لغة عربية ونحو — المرحلة الابتدائية',
        bio: 'تدريس اللغة العربية والقراءة والنحو التأسيسي لتلاميذ الصفوف العليا بالمرحلة الابتدائية.',
      },
      {
        email: 'tariq.teacher@demo.jusoor.edu',
        headline: 'مهندس برمجيات ومعلّم البرمجة والذكاء الاصطناعي — الثانوية العامة',
        bio: 'خبرة 8 سنوات في تدريس البرمجة وتطوير الويب وتبسيط الذكاء الاصطناعي لطلاب الصف الأول الثانوي العام.',
      },
    ];

    for (const hu of headlineUpdates) {
      const u = userByEmail.get(hu.email);
      if (u && u.isDemo) {
        await tx
          .update(providerProfiles)
          .set({ headline: hu.headline, bio: hu.bio })
          .where(eq(providerProfiles.userId, u.id));
      }
    }

    // 3. Build & insert missing teacher_teaching_assignments in batches
    const existingAssignmentRows = await tx
      .select({
        teacherUserId: teacherTeachingAssignments.teacherUserId,
        curriculumSubjectId: teacherTeachingAssignments.curriculumSubjectId,
      })
      .from(teacherTeachingAssignments);

    const existingAssignKeySet = new Set(
      existingAssignmentRows.map((a) => `${a.teacherUserId}:${a.curriculumSubjectId}`)
    );

    const assignmentsToInsert: Array<typeof teacherTeachingAssignments.$inferInsert> = [];

    // New stage teachers
    for (const teacher of STAGE_TEACHERS) {
      const u = userByEmail.get(teacher.email)!;
      const matches = matchingCsForRules(teacher.rules);
      for (const { cs, rule } of matches) {
        const key = `${u.id}:${cs.id}`;
        if (existingAssignKeySet.has(key)) continue;
        existingAssignKeySet.add(key);
        assignmentsToInsert.push({
          teacherUserId: u.id,
          curriculumSubjectId: cs.id,
          subjectId: cs.subjectId,
          gradeId: cs.gradeId,
          systemId: cs.systemId,
          divisionId: cs.divisionId,
          pathwayId: cs.pathwayId,
          languagesOfferedJson: rule.languages,
          religiousVariant: rule.religiousVariant ?? null,
          hourlyRate: rule.hourlyRate,
          currency: 'USD',
          supportsOnline: rule.supportsOnline,
          supportsInPerson: rule.supportsInPerson,
          notes: rule.notes ?? null,
          isActive: true,
        });
      }
    }

    // Core existing demo teachers scoped rules
    for (const [email, rules] of Object.entries(EXISTING_DEMO_TEACHER_SCOPES)) {
      const u = userByEmail.get(email);
      if (!u || !u.isDemo) continue;
      const matches = matchingCsForRules(rules);
      for (const { cs, rule } of matches) {
        const key = `${u.id}:${cs.id}`;
        if (existingAssignKeySet.has(key)) continue;
        existingAssignKeySet.add(key);
        assignmentsToInsert.push({
          teacherUserId: u.id,
          curriculumSubjectId: cs.id,
          subjectId: cs.subjectId,
          gradeId: cs.gradeId,
          systemId: cs.systemId,
          divisionId: cs.divisionId,
          pathwayId: cs.pathwayId,
          languagesOfferedJson: rule.languages,
          religiousVariant: rule.religiousVariant ?? null,
          hourlyRate: rule.hourlyRate,
          currency: 'USD',
          supportsOnline: rule.supportsOnline,
          supportsInPerson: rule.supportsInPerson,
          notes: rule.notes ?? null,
          isActive: true,
        });
      }
    }

    // Insert in chunks of 200 to keep SQL statements well-sized
    for (let i = 0; i < assignmentsToInsert.length; i += 200) {
      const chunk = assignmentsToInsert.slice(i, i + 200);
      await tx.insert(teacherTeachingAssignments).values(chunk).onConflictDoNothing();
      createdAssignments += chunk.length;
    }

    // 4. Create a SMALL number (4) of realistic demo courses for selected teachers only
    //    (173+ stage teachers retain 0 published courses and remain fully discoverable)
    const allFields = await tx.select().from(fields);
    const allSubjects = await tx.select().from(subjects);
    const allStages = await tx.select().from(educationalStages);
    const existingCourseSlugs = await tx.select({ slug: courses.slug }).from(courses);

    const fieldIdBySlug = new Map(allFields.map((f) => [f.slug, f.id]));
    const subjectIdBySlug = new Map(allSubjects.map((s) => [s.slug, s.id]));
    const stageIdBySlug = new Map(allStages.map((s) => [s.slug, s.id]));
    const courseSlugSet = new Set(existingCourseSlugs.map((c) => c.slug));

    const selectiveCourses = [
      {
        teacherEmail: 'prim.english.1@teachers.demo.jusoor.edu',
        slug: 'demo-primary-4-connect-english',
        fieldSlug: 'languages',
        subjectSlug: 'eg-english',
        stageSlug: 'primary',
        title: 'تأسيس اللغة الإنجليزية (Connect) — الصف الرابع الابتدائي',
        subtitle: 'دورة تطبيقية لبناء مهارات القراءة والقواعد والصوتيات للمنهج الابتدائي',
        description: 'شرح وحدات الفصل الدراسي الأول مع أنشطة نطق وتدريبات على المفردات الأساسية للصف الرابع الابتدائي.',
        level: 'BEGINNER',
        language: 'en',
        price: '29.00',
        lessons: [
          { title: '01. قواعد النطق والربط الصوتي', content: 'مراجعة الأصوات المركبة وتكوين الجمل البسيطة.', durationMinutes: 20, isFreePreview: true },
          { title: '02. المفردات والصفات في منهج Connect', content: 'تطبيقات على التعبير عن الروتين اليومي والبيئة المحيطة.', durationMinutes: 25, isFreePreview: false },
        ],
      },
      {
        teacherEmail: 'prep.science.1@teachers.demo.jusoor.edu',
        slug: 'demo-prep-2-science-foundations',
        fieldSlug: 'sciences',
        subjectSlug: 'eg-science',
        stageSlug: 'preparatory',
        title: 'أساسيات العلوم والتفاعلات — الصف الثاني الإعدادي',
        subtitle: 'مراجعة مبسطة للجدول الدوري والروابط الكيميائية والموجات الصوتية',
        description: 'دورة مركزة لطلاب المرحلة الإعدادية تغطي المفاهيم الأساسية في الكيمياء والفيزياء المبسطة.',
        level: 'INTERMEDIATE',
        language: 'ar',
        price: '35.00',
        lessons: [
          { title: '01. تدرج الخواص في الجدول الدوري الحديث', content: 'فهم المجموعات الرئيسية والروابط الأيونية والتساهمية.', durationMinutes: 25, isFreePreview: true },
          { title: '02. الحركة الموجية وتطبيقاتها', content: 'الفرق بين الموجات الطولية والمستعرضة وحساب التردد.', durationMinutes: 25, isFreePreview: false },
        ],
      },
      {
        teacherEmail: 'sec.physics.1@teachers.demo.jusoor.edu',
        slug: 'demo-gen-sec-2-physics-waves',
        fieldSlug: 'sciences',
        subjectSlug: 'eg-physics',
        stageSlug: 'secondary',
        title: 'الفيزياء الموجية والضوء والموائع — الصف الثاني الثانوي',
        subtitle: 'تحليل قوانين الانكسار والتداخل والحيود وميكانيكا الموائع الساكنة والمتحركة',
        description: 'دورة تطبيقية لشرح مسائل الفيزياء لشعبة علمي بالثانوية العامة مع تدريبات على الرسوم البيانية.',
        level: 'INTERMEDIATE',
        language: 'ar',
        price: '45.00',
        lessons: [
          { title: '01. قوانين الانعكاس والانكسار والزاوية الحرجة', content: 'حل مسائل المنشور الثلاثي وتتبع المسار الضوئي.', durationMinutes: 30, isFreePreview: true },
          { title: '02. معادلة الاستمرارية واللزوجة في الموائع', content: 'تحليل تطبيقات السريان الهادئ والمضطرب.', durationMinutes: 30, isFreePreview: false },
        ],
      },
      {
        teacherEmail: 'bacc.bio.1@teachers.demo.jusoor.edu',
        slug: 'demo-bacc-3-med-adv-biology',
        fieldSlug: 'sciences',
        subjectSlug: 'eg-biology-adv',
        stageSlug: 'secondary',
        title: 'الأحياء المتقدمة والبيولوجيا الجزيئية — مسار الطب (البكالوريا)',
        subtitle: 'دراسة متعمقة في آليات تضاعف المادة الوراثية وتخليق البروتين والمناعة',
        description: 'محتوى تمهيدي متقدم لطلاب الصف الثالث بمسار الطب وعلوم الحياة بنظام البكالوريا المصرية.',
        level: 'ADVANCED',
        language: 'ar',
        price: '55.00',
        lessons: [
          { title: '01. البنية الجزيئية للأحماض النووية', content: 'فهم دور الإنزيمات في التضاعف والنسخ والترجمة.', durationMinutes: 35, isFreePreview: true },
          { title: '02. الاستجابة المناعية الخلوية والخلطية', content: 'تتبع آليات الدفاع النوعية وغير النوعية.', durationMinutes: 30, isFreePreview: false },
        ],
      },
    ];

    for (const sc of selectiveCourses) {
      if (courseSlugSet.has(sc.slug)) continue;
      const teacherUser = userByEmail.get(sc.teacherEmail);
      const fieldId = fieldIdBySlug.get(sc.fieldSlug);
      if (!teacherUser || !fieldId) continue;

      const [insertedCourse] = await tx
        .insert(courses)
        .values({
          instructorUserId: teacherUser.id,
          centerId: null,
          fieldId,
          subjectId: subjectIdBySlug.get(sc.subjectSlug) ?? null,
          stageId: stageIdBySlug.get(sc.stageSlug) ?? null,
          title: sc.title,
          slug: sc.slug,
          subtitle: sc.subtitle,
          description: sc.description,
          level: sc.level,
          language: sc.language,
          price: sc.price,
          currency: 'USD',
          thumbnailUrl: null,
          status: 'PUBLISHED',
          isDemo: true,
        })
        .returning({ id: courses.id });

      await tx.insert(courseLessons).values(
        sc.lessons.map((lesson, idx) => ({
          courseId: insertedCourse.id,
          title: lesson.title,
          content: lesson.content,
          durationMinutes: lesson.durationMinutes,
          sortOrder: idx + 1,
          isFreePreview: lesson.isFreePreview,
        }))
      );

      courseSlugSet.add(sc.slug);
      createdCourses++;
    }

    // 5. Create selective future ONE_TO_ONE & GROUP sessions across all 4 systems (NO fake enrollments)
    const existingDemoSessionTitles = new Set(
      (
        await tx
          .select({ title: teachingSessions.title })
          .from(teachingSessions)
          .where(eq(teachingSessions.isDemo, true))
      ).map((s) => s.title)
    );

    const daysAhead = (days: number, hourUtc: number, minuteUtc = 0) => {
      const d = new Date(Date.now() + days * 86_400_000);
      d.setUTCHours(hourUtc, minuteUtc, 0, 0);
      return d;
    };

    const findCs = (
      systemCode: string,
      gradeSlug: string,
      subjectSlug: string,
      divisionCode?: string,
      pathwayCode?: string
    ) =>
      allCsRows.find(
        (cs) =>
          cs.systemCode === systemCode &&
          cs.gradeSlug === gradeSlug &&
          cs.subjectSlug === subjectSlug &&
          (divisionCode ? cs.divisionCode === divisionCode : cs.divisionCode === null) &&
          (pathwayCode ? cs.pathwayCode === pathwayCode : cs.pathwayCode === null)
      );

    const selectiveSessions: Array<{
      teacherEmail: string;
      cs: (typeof allCsRows)[number] | undefined;
      sessionType: 'ONE_TO_ONE' | 'GROUP';
      title: string;
      description: string;
      startDay: number;
      startHour: number;
      durationMinutes: number;
      capacity: number;
      minStudents: number | null;
      price: string;
      deliveryMode: 'ONLINE' | 'IN_PERSON';
      meetingUrl: string;
    }> = [
      {
        teacherEmail: 'prim.english.2@teachers.demo.jusoor.edu',
        cs: findCs('PRIMARY_GENERAL', 'primary-4', 'eg-english'),
        sessionType: 'ONE_TO_ONE',
        title: 'جلسة فردية: تأسيس القراءة والصوتيات (Connect) — الصف الرابع الابتدائي',
        description: 'مراجعة فردية لنطق المفردات وتكوين الجمل البسيطة لطلاب الصف الرابع الابتدائي.',
        startDay: 6,
        startHour: 15,
        durationMinutes: 60,
        capacity: 1,
        minStudents: null,
        price: '19.00',
        deliveryMode: 'ONLINE',
        meetingUrl: 'https://meet.jusoor.example/prim4-english-1on1',
      },
      {
        teacherEmail: 'prim.math.1@teachers.demo.jusoor.edu',
        cs: findCs('PRIMARY_GENERAL', 'primary-4', 'eg-mathematics'),
        sessionType: 'GROUP',
        title: 'مجموعة تفاعلية: الحساب الذهني والكسور — الصف الرابع الابتدائي',
        description: 'تدريب جماعي مبسط على العمليات الحسابية والكسور الاعتيادية.',
        startDay: 7,
        startHour: 16,
        durationMinutes: 90,
        capacity: 10,
        minStudents: 3,
        price: '12.00',
        deliveryMode: 'ONLINE',
        meetingUrl: 'https://meet.jusoor.example/prim4-math-group',
      },
      {
        teacherEmail: 'prep.english.1@teachers.demo.jusoor.edu',
        cs: findCs('PREPARATORY_GENERAL', 'prep-2', 'eg-english-first-foreign'),
        sessionType: 'ONE_TO_ONE',
        title: 'حصة فردية: قواعد اللغة الإنجليزية والمحادثة — الصف الثاني الإعدادي',
        description: 'تطبيق مباشر على أزمنة الأفعال وكتابة الفقرة الإنجليزية للصف الثاني الإعدادي.',
        startDay: 8,
        startHour: 17,
        durationMinutes: 60,
        capacity: 1,
        minStudents: null,
        price: '24.00',
        deliveryMode: 'ONLINE',
        meetingUrl: 'https://meet.jusoor.example/prep2-english-1on1',
      },
      {
        teacherEmail: 'prep.math.1@teachers.demo.jusoor.edu',
        cs: findCs('PREPARATORY_GENERAL', 'prep-3', 'eg-mathematics'),
        sessionType: 'GROUP',
        title: 'مجموعة مراجعة الهندسة والجبر — الشهادة الإعدادية',
        description: 'حل مسائل الهندسة والبرهان ونماذج امتحانات الصف الثالث الإعدادي.',
        startDay: 9,
        startHour: 18,
        durationMinutes: 90,
        capacity: 12,
        minStudents: 3,
        price: '14.00',
        deliveryMode: 'ONLINE',
        meetingUrl: 'https://meet.jusoor.example/prep3-math-group',
      },
      {
        teacherEmail: 'sec.physics.1@teachers.demo.jusoor.edu',
        cs: findCs('GENERAL_SECONDARY', 'gen-sec-2', 'eg-physics', 'GEN_SEC_2_SCIENTIFIC'),
        sessionType: 'ONE_TO_ONE',
        title: 'حصة فردية: الفيزياء — الضوء والموائع (الثاني الثانوي العلمي)',
        description: 'شرح مسائل الانكسار واللزوجة مع خطوات الحل المنهجية لشعبة العلمي.',
        startDay: 10,
        startHour: 17,
        durationMinutes: 60,
        capacity: 1,
        minStudents: null,
        price: '34.00',
        deliveryMode: 'ONLINE',
        meetingUrl: 'https://meet.jusoor.example/gensec2-physics-1on1',
      },
      {
        teacherEmail: 'sec.bio.1@teachers.demo.jusoor.edu',
        cs: findCs('GENERAL_SECONDARY', 'gen-sec-3', 'eg-biology', 'GEN_SEC_3_SCI_BIO'),
        sessionType: 'GROUP',
        title: 'مجموعة الأحياء المركزة: الدعامة والحركة والهرمونات — علمي علوم',
        description: 'مناقشة الرسوم التوضيحية وأسئلة الفهم لشعبة علمي علوم بالثانوية العامة.',
        startDay: 11,
        startHour: 18,
        durationMinutes: 90,
        capacity: 15,
        minStudents: 4,
        price: '18.00',
        deliveryMode: 'ONLINE',
        meetingUrl: 'https://meet.jusoor.example/gensec3-bio-group',
      },
      {
        teacherEmail: 'sec.math.1@teachers.demo.jusoor.edu',
        cs: findCs('GENERAL_SECONDARY', 'gen-sec-3', 'eg-mathematics', 'GEN_SEC_3_SCI_MATH'),
        sessionType: 'ONE_TO_ONE',
        title: 'حصة فردية: التفاضل والتكامل — الثالث الثانوي علمي رياضة',
        description: 'حل مسائل القيم العظمى والصغرى والتكامل المحدد لشعبة علمي رياضة.',
        startDay: 12,
        startHour: 19,
        durationMinutes: 60,
        capacity: 1,
        minStudents: null,
        price: '35.00',
        deliveryMode: 'ONLINE',
        meetingUrl: 'https://meet.jusoor.example/gensec3-math-1on1',
      },
      {
        teacherEmail: 'bacc.bio.1@teachers.demo.jusoor.edu',
        cs: findCs('EGYPTIAN_BACCALAUREATE', 'bacc-3', 'eg-biology-adv', undefined, 'BACC_3_MED'),
        sessionType: 'ONE_TO_ONE',
        title: 'جلسة فردية: الأحياء المتقدمة — مسار الطب وعلوم الحياة (البكالوريا)',
        description: 'شرح معمق للبيولوجيا الجزيئية وتطبيقاتها لطلاب الصف الثالث بمسار الطب.',
        startDay: 13,
        startHour: 17,
        durationMinutes: 60,
        capacity: 1,
        minStudents: null,
        price: '40.00',
        deliveryMode: 'ONLINE',
        meetingUrl: 'https://meet.jusoor.example/bacc3-med-bio-1on1',
      },
      {
        teacherEmail: 'bacc.econ.3@teachers.demo.jusoor.edu',
        cs: findCs('EGYPTIAN_BACCALAUREATE', 'bacc-3', 'eg-economics-adv', undefined, 'BACC_3_BUS'),
        sessionType: 'GROUP',
        title: 'مجموعة الاقتصاد المتقدم — مسار الأعمال (البكالوريا المصرية)',
        description: 'تحليل المؤشرات الاقتصادية الكلية والسياسات المالية لطلاب الصف الثالث مسار الأعمال.',
        startDay: 14,
        startHour: 18,
        durationMinutes: 90,
        capacity: 10,
        minStudents: 3,
        price: '22.00',
        deliveryMode: 'ONLINE',
        meetingUrl: 'https://meet.jusoor.example/bacc3-bus-econ-group',
      },
    ];

    const sessionRowsToInsert: Array<typeof teachingSessions.$inferInsert> = [];
    for (const ss of selectiveSessions) {
      if (!ss.cs || existingDemoSessionTitles.has(ss.title)) continue;
      const teacherUser = userByEmail.get(ss.teacherEmail);
      if (!teacherUser) continue;

      const start = daysAhead(ss.startDay, ss.startHour, 0);
      const end = new Date(start.getTime() + ss.durationMinutes * 60_000);
      const deadline = new Date(start.getTime() - 12 * 3600_000);

      sessionRowsToInsert.push({
        teacherUserId: teacherUser.id,
        subjectId: ss.cs.subjectId,
        curriculumSubjectId: ss.cs.id,
        gradeId: ss.cs.gradeId,
        stageId: ss.cs.stageId,
        sessionType: ss.sessionType,
        title: ss.title,
        description: ss.description,
        startTime: start,
        endTime: end,
        durationMinutes: ss.durationMinutes,
        capacity: ss.capacity,
        minStudents: ss.minStudents,
        price: ss.price,
        currency: 'USD',
        deliveryMode: ss.deliveryMode,
        meetingUrl: ss.meetingUrl,
        registrationDeadline: deadline,
        status: 'OPEN',
        isDemo: true,
      });
      existingDemoSessionTitles.add(ss.title);
    }

    if (sessionRowsToInsert.length > 0) {
      await tx.insert(teachingSessions).values(sessionRowsToInsert);
      createdSessions = sessionRowsToInsert.length;
    }
  });

  return {
    createdUsers,
    createdAssignments,
    removedCrossStageAssignments,
    createdCourses,
    createdSessions,
  };
}

export async function runCoverageAudit(): Promise<CoverageAuditReport> {
  const [currentYear] = await db
    .select()
    .from(academicYears)
    .where(eq(academicYears.code, '2026/2027'))
    .limit(1);

  if (!currentYear) {
    throw new Error('Academic year 2026/2027 not found.');
  }

  const [activeVersion] = await db
    .select()
    .from(curriculumVersions)
    .where(
      and(
        eq(curriculumVersions.academicYearId, currentYear.id),
        eq(curriculumVersions.isActive, true)
      )
    )
    .limit(1);

  if (!activeVersion) {
    throw new Error('Active curriculum version not found.');
  }

  const csRows = await db
    .select({
      id: curriculumSubjects.id,
      stageSlug: educationalStages.slug,
      stageNameAr: educationalStages.nameAr,
      systemCode: educationalSystems.code,
      systemNameAr: educationalSystems.nameAr,
      gradeSlug: educationalGrades.slug,
      gradeNameAr: educationalGrades.nameAr,
      divisionCode: secondaryDivisions.code,
      divisionNameAr: secondaryDivisions.nameAr,
      pathwayCode: baccalaureatePathways.code,
      pathwayNameAr: baccalaureatePathways.nameAr,
      subjectSlug: subjects.slug,
      subjectNameAr: subjects.nameAr,
      subjectNameEn: subjects.nameEn,
    })
    .from(curriculumSubjects)
    .innerJoin(educationalStages, eq(curriculumSubjects.stageId, educationalStages.id))
    .innerJoin(educationalSystems, eq(curriculumSubjects.systemId, educationalSystems.id))
    .innerJoin(educationalGrades, eq(curriculumSubjects.gradeId, educationalGrades.id))
    .innerJoin(subjects, eq(curriculumSubjects.subjectId, subjects.id))
    .leftJoin(secondaryDivisions, eq(curriculumSubjects.divisionId, secondaryDivisions.id))
    .leftJoin(baccalaureatePathways, eq(curriculumSubjects.pathwayId, baccalaureatePathways.id))
    .where(
      and(
        eq(curriculumSubjects.curriculumVersionId, activeVersion.id),
        eq(curriculumSubjects.isActive, true),
        eq(curriculumSubjects.isAvailableForTeacherAssignment, true)
      )
    )
    .orderBy(
      asc(educationalStages.sortOrder),
      asc(educationalSystems.sortOrder),
      asc(educationalGrades.sortOrder),
      asc(secondaryDivisions.sortOrder),
      asc(baccalaureatePathways.sortOrder),
      asc(curriculumSubjects.sortOrder)
    );

  const activeAssignments = await db
    .select({
      curriculumSubjectId: teacherTeachingAssignments.curriculumSubjectId,
      teacherUserId: teacherTeachingAssignments.teacherUserId,
      email: users.email,
      fullName: users.fullName,
      isDemo: users.isDemo,
      systemCode: educationalSystems.code,
    })
    .from(teacherTeachingAssignments)
    .innerJoin(users, eq(teacherTeachingAssignments.teacherUserId, users.id))
    .innerJoin(educationalSystems, eq(teacherTeachingAssignments.systemId, educationalSystems.id))
    .where(
      and(
        eq(teacherTeachingAssignments.isActive, true),
        eq(users.accountStatus, 'ACTIVE')
      )
    );

  const teacherSetByCs = new Map<number, Set<number>>();
  const systemsByTeacher = new Map<
    number,
    { email: string; fullName: string; isDemo: boolean; systems: Set<string> }
  >();

  for (const a of activeAssignments) {
    const tSet = teacherSetByCs.get(a.curriculumSubjectId) ?? new Set<number>();
    tSet.add(a.teacherUserId);
    teacherSetByCs.set(a.curriculumSubjectId, tSet);

    const sysEntry = systemsByTeacher.get(a.teacherUserId) ?? {
      email: a.email,
      fullName: a.fullName,
      isDemo: a.isDemo,
      systems: new Set<string>(),
    };
    sysEntry.systems.add(a.systemCode);
    systemsByTeacher.set(a.teacherUserId, sysEntry);
  }

  const crossStageViolations = Array.from(systemsByTeacher.entries())
    .filter(([, entry]) => entry.systems.size > 1)
    .map(([teacherUserId, entry]) => ({
      teacherUserId,
      email: entry.email,
      fullName: entry.fullName,
      systems: Array.from(entry.systems),
    }));

  const rows: CoverageAuditRow[] = csRows.map((cs) => {
    const count = teacherSetByCs.get(cs.id)?.size ?? 0;
    return {
      curriculumSubjectId: cs.id,
      stageSlug: cs.stageSlug,
      stageNameAr: cs.stageNameAr,
      systemCode: cs.systemCode,
      systemNameAr: cs.systemNameAr,
      gradeSlug: cs.gradeSlug,
      gradeNameAr: cs.gradeNameAr,
      divisionCode: cs.divisionCode,
      divisionNameAr: cs.divisionNameAr,
      pathwayCode: cs.pathwayCode,
      pathwayNameAr: cs.pathwayNameAr,
      subjectSlug: cs.subjectSlug,
      subjectNameAr: cs.subjectNameAr,
      subjectNameEn: cs.subjectNameEn,
      distinctActiveTeachers: count,
      status: count >= 3 ? 'COMPLETE' : 'INCOMPLETE',
    };
  });

  const completeContexts = rows.filter((r) => r.status === 'COMPLETE').length;
  const incompleteContexts = rows.length - completeContexts;

  const [demoTeacherCountRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .innerJoin(providerProfiles, eq(providerProfiles.userId, users.id))
    .where(and(eq(users.isDemo, true), eq(users.accountStatus, 'ACTIVE')));

  const [stageTeacherProfilesRes] = await db
    .select({ count: sql<number>`count(distinct ${teacherTeachingAssignments.teacherUserId})::int` })
    .from(teacherTeachingAssignments)
    .where(eq(teacherTeachingAssignments.isActive, true));

  return {
    academicYearCode: currentYear.code,
    versionCode: activeVersion.versionCode,
    totalContexts: rows.length,
    completeContexts,
    incompleteContexts,
    totalDemoTeachers: demoTeacherCountRes?.count ?? 0,
    totalStageTeacherProfiles: stageTeacherProfilesRes?.count ?? 0,
    totalActiveAssignments: activeAssignments.length,
    crossStageViolations,
    rows,
  };
}
