import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  roles,
  users,
  userRoles,
  providerProfiles,
  educationalStages,
  fields,
  subjects,
  educationalSystems,
  educationalGrades,
  secondaryDivisions,
  baccalaureatePathways,
  academicYears,
  curriculumVersions,
  gradeSubjects,
  curriculumSubjects,
  teacherTeachingAssignments,
  teachingSessions,
} from '../db/schema.ts';

interface SubjectDef {
  slug: string;
  nameAr: string;
  nameEn: string;
  fieldSlug: string;
}

interface CurriculumItemSpec {
  subjectSlug: string;
  subjectType:
    | 'CORE'
    | 'NON_TOTAL'
    | 'ACTIVITY'
    | 'ELECTIVE'
    | 'SPECIALIZATION'
    | 'ADDITIONAL_SCHOOL'
    | 'RELIGIOUS'
    | 'FOREIGN_LANGUAGE';
  isCompulsory?: boolean;
  isElective?: boolean;
  isSpecialization?: boolean;
  isIncludedInTotal?: boolean;
  isPassFail?: boolean;
  isNonTotal?: boolean;
  isActivity?: boolean;
  passThresholdPercent?: number | null;
  electiveGroupCode?: string | null;
  languages?: string[];
  variants?: string[];
  notesAr?: string | null;
  notesEn?: string | null;
  isAvailableForTeacherAssignment?: boolean;
}

const GENERAL_EDUCATION_FIELDS = [
  { slug: 'arabic-language', nameAr: 'اللغة العربية', nameEn: 'Arabic Language', descriptionAr: 'اللغة العربية والنحو والأدب والبلاغة', iconName: 'BookOpen' },
  { slug: 'mathematics', nameAr: 'الرياضيات والإحصاء', nameEn: 'Mathematics & Statistics', descriptionAr: 'الرياضيات للمراحل التعليمية والرياضيات المتقدمة والإحصاء', iconName: 'Calculator' },
  { slug: 'sciences', nameAr: 'العلوم والفيزياء والكيمياء والأحياء', nameEn: 'Sciences, Physics, Chemistry & Biology', descriptionAr: 'العلوم المتكاملة والفيزياء والكيمياء والأحياء', iconName: 'FlaskConical' },
  { slug: 'social-studies', nameAr: 'الدراسات الاجتماعية والتاريخ والجغرافيا', nameEn: 'Social Studies, History & Geography', descriptionAr: 'الدراسات الاجتماعية والتاريخ المصري والجغرافيا والتربية الوطنية', iconName: 'Globe' },
  { slug: 'humanities', nameAr: 'الفلسفة وعلم النفس', nameEn: 'Philosophy & Psychology', descriptionAr: 'الفلسفة والمنطق وعلم النفس والاجتماع', iconName: 'Brain' },
  { slug: 'religious-education', nameAr: 'التربية الدينية', nameEn: 'Religious Education', descriptionAr: 'التربية الدينية الإسلامية والمسيحية', iconName: 'BookMarked' },
  { slug: 'arts-activities', nameAr: 'الأنشطة والمهارات التربوية', nameEn: 'Educational & Vocational Activities', descriptionAr: 'التربية الفنية والموسيقية والبدنية والتوكاتسو والمهارات العملية', iconName: 'Palette' },
];

const MASTER_SUBJECTS: SubjectDef[] = [
  { slug: 'eg-arabic', nameAr: 'اللغة العربية', nameEn: 'Arabic Language', fieldSlug: 'arabic-language' },
  { slug: 'eg-english', nameAr: 'اللغة الإنجليزية', nameEn: 'English Language', fieldSlug: 'languages' },
  { slug: 'eg-english-first-foreign', nameAr: 'اللغة الإنجليزية – لغة أجنبية أولى', nameEn: 'English – First Foreign Language', fieldSlug: 'languages' },
  { slug: 'eg-first-foreign-lang', nameAr: 'اللغة الأجنبية الأولى', nameEn: 'First Foreign Language', fieldSlug: 'languages' },
  { slug: 'eg-second-foreign-lang', nameAr: 'اللغة الأجنبية الثانية', nameEn: 'Second Foreign Language', fieldSlug: 'languages' },
  { slug: 'eg-mathematics', nameAr: 'الرياضيات', nameEn: 'Mathematics', fieldSlug: 'mathematics' },
  { slug: 'eg-mathematics-adv', nameAr: 'الرياضيات – مستوى متقدم', nameEn: 'Advanced Mathematics', fieldSlug: 'mathematics' },
  { slug: 'eg-statistics', nameAr: 'الإحصاء', nameEn: 'Statistics', fieldSlug: 'mathematics' },
  { slug: 'eg-science', nameAr: 'العلوم', nameEn: 'Science', fieldSlug: 'sciences' },
  { slug: 'eg-integrated-science', nameAr: 'العلوم المتكاملة', nameEn: 'Integrated Sciences', fieldSlug: 'sciences' },
  { slug: 'eg-physics', nameAr: 'الفيزياء', nameEn: 'Physics', fieldSlug: 'sciences' },
  { slug: 'eg-physics-adv', nameAr: 'الفيزياء – مستوى متقدم', nameEn: 'Advanced Physics', fieldSlug: 'sciences' },
  { slug: 'eg-chemistry', nameAr: 'الكيمياء', nameEn: 'Chemistry', fieldSlug: 'sciences' },
  { slug: 'eg-chemistry-adv', nameAr: 'الكيمياء – مستوى متقدم', nameEn: 'Advanced Chemistry', fieldSlug: 'sciences' },
  { slug: 'eg-biology', nameAr: 'الأحياء', nameEn: 'Biology', fieldSlug: 'sciences' },
  { slug: 'eg-biology-adv', nameAr: 'الأحياء – مستوى متقدم', nameEn: 'Advanced Biology', fieldSlug: 'sciences' },
  { slug: 'eg-social-studies', nameAr: 'الدراسات الاجتماعية', nameEn: 'Social Studies', fieldSlug: 'social-studies' },
  { slug: 'eg-history', nameAr: 'التاريخ', nameEn: 'History', fieldSlug: 'social-studies' },
  { slug: 'eg-egyptian-history', nameAr: 'التاريخ المصري', nameEn: 'Egyptian History', fieldSlug: 'social-studies' },
  { slug: 'eg-geography', nameAr: 'الجغرافيا', nameEn: 'Geography', fieldSlug: 'social-studies' },
  { slug: 'eg-geography-adv', nameAr: 'الجغرافيا – مستوى متقدم', nameEn: 'Advanced Geography', fieldSlug: 'social-studies' },
  { slug: 'eg-national-education', nameAr: 'التربية الوطنية', nameEn: 'National Education', fieldSlug: 'social-studies' },
  { slug: 'eg-philosophy-logic', nameAr: 'الفلسفة والمنطق', nameEn: 'Philosophy and Logic', fieldSlug: 'humanities' },
  { slug: 'eg-psychology-sociology', nameAr: 'علم النفس والاجتماع', nameEn: 'Psychology and Sociology', fieldSlug: 'humanities' },
  { slug: 'eg-psychology', nameAr: 'علم النفس', nameEn: 'Psychology', fieldSlug: 'humanities' },
  { slug: 'eg-religious-ed', nameAr: 'التربية الدينية', nameEn: 'Religious Education', fieldSlug: 'religious-education' },
  { slug: 'eg-religious-ed-islamic-christian', nameAr: 'التربية الدينية الإسلامية أو المسيحية', nameEn: 'Islamic or Christian Religious Education', fieldSlug: 'religious-education' },
  { slug: 'eg-ict-primary', nameAr: 'تكنولوجيا الاتصالات والمعلومات', nameEn: 'Information & Communication Technology (ICT)', fieldSlug: 'digital-skills' },
  { slug: 'eg-ict-prep', nameAr: 'الكمبيوتر وتكنولوجيا المعلومات والاتصالات', nameEn: 'Computer & Information and Communication Technology', fieldSlug: 'digital-skills' },
  { slug: 'eg-programming-ai', nameAr: 'البرمجة والذكاء الاصطناعي', nameEn: 'Programming and Artificial Intelligence', fieldSlug: 'artificial-intelligence' },
  { slug: 'eg-programming-cs-ai', nameAr: 'البرمجة وعلوم الحاسب / البرمجة والذكاء الاصطناعي', nameEn: 'Programming & Computer Science / AI', fieldSlug: 'artificial-intelligence' },
  { slug: 'eg-accounting', nameAr: 'المحاسبة', nameEn: 'Accounting', fieldSlug: 'accounting' },
  { slug: 'eg-business-admin', nameAr: 'إدارة الأعمال', nameEn: 'Business Administration', fieldSlug: 'business' },
  { slug: 'eg-economics-adv', nameAr: 'الاقتصاد – مستوى متقدم', nameEn: 'Advanced Economics', fieldSlug: 'business' },
  { slug: 'eg-financial-culture', nameAr: 'الثقافة المالية', nameEn: 'Financial Culture', fieldSlug: 'accounting' },
  { slug: 'eg-pe-health', nameAr: 'التربية البدنية والصحية', nameEn: 'Physical and Health Education', fieldSlug: 'arts-activities' },
  { slug: 'eg-pe-sport', nameAr: 'التربية الرياضية', nameEn: 'Physical Education', fieldSlug: 'arts-activities' },
  { slug: 'eg-pe-activity', nameAr: 'نشاط التربية الرياضية', nameEn: 'Physical Education Activity', fieldSlug: 'arts-activities' },
  { slug: 'eg-tokkatsu', nameAr: 'أنشطة التوكاتسو', nameEn: 'Tokkatsu Activities', fieldSlug: 'arts-activities' },
  { slug: 'eg-art-ed', nameAr: 'التربية الفنية', nameEn: 'Art Education', fieldSlug: 'arts-activities' },
  { slug: 'eg-music-ed', nameAr: 'التربية الموسيقية', nameEn: 'Music Education', fieldSlug: 'arts-activities' },
  { slug: 'eg-agri-skills', nameAr: 'مهارات الزراعة', nameEn: 'Agricultural Skills', fieldSlug: 'arts-activities' },
  { slug: 'eg-ind-skills', nameAr: 'مهارات الصناعة', nameEn: 'Industrial Skills', fieldSlug: 'arts-activities' },
  { slug: 'eg-family-mgmt', nameAr: 'مهارات إدارة الأسرة', nameEn: 'Family Management Skills', fieldSlug: 'arts-activities' },
  { slug: 'eg-edu-media', nameAr: 'الإعلام التربوي', nameEn: 'Educational Media', fieldSlug: 'arts-activities' },
  { slug: 'eg-drama-ed', nameAr: 'التربية المسرحية', nameEn: 'Theater Education', fieldSlug: 'arts-activities' },
  { slug: 'eg-libraries', nameAr: 'المكتبات', nameEn: 'Libraries', fieldSlug: 'arts-activities' },
  { slug: 'eg-ind-entrepreneurship', nameAr: 'مهارات الصناعة وريادة الأعمال', nameEn: 'Industrial Skills & Entrepreneurship', fieldSlug: 'arts-activities' },
  { slug: 'eg-agri-entrepreneurship', nameAr: 'مهارات الزراعة وريادة الأعمال', nameEn: 'Agricultural Skills & Entrepreneurship', fieldSlug: 'arts-activities' },
  { slug: 'eg-libraries-research', nameAr: 'المكتبات ومهارات البحث', nameEn: 'Libraries & Research Skills', fieldSlug: 'arts-activities' },
  { slug: 'eg-home-economics', nameAr: 'الاقتصاد المنزلي', nameEn: 'Home Economics', fieldSlug: 'arts-activities' },
  { slug: 'eg-scouts', nameAr: 'الكشافة والمرشدات', nameEn: 'Scouts and Guides', fieldSlug: 'arts-activities' },
  { slug: 'eg-theater-acting', nameAr: 'المسرح والتمثيل', nameEn: 'Theater and Acting', fieldSlug: 'arts-activities' },
  { slug: 'eg-journalism-broadcasting', nameAr: 'الصحافة والإذاعة', nameEn: 'Journalism and School Broadcasting', fieldSlug: 'arts-activities' },
  { slug: 'eg-community-service', nameAr: 'خدمة المجتمع وتنمية البيئة', nameEn: 'Community Service & Environmental Development', fieldSlug: 'arts-activities' },
  { slug: 'eg-creative-science-act', nameAr: 'النشاط العلمي الإبداعي', nameEn: 'Creative Scientific Activity', fieldSlug: 'sciences' },
  { slug: 'eg-reading-libraries', nameAr: 'المطالعة والمكتبات', nameEn: 'Reading and Libraries', fieldSlug: 'arts-activities' },
  { slug: 'eg-industrial-tech', nameAr: 'تكنولوجيا الصناعة', nameEn: 'Industrial Technology', fieldSlug: 'arts-activities' },
  { slug: 'eg-agri-tech', nameAr: 'تكنولوجيا الزراعة', nameEn: 'Agricultural Technology', fieldSlug: 'arts-activities' },
  { slug: 'eg-entrepreneurship-projects', nameAr: 'ريادة الأعمال والمشروعات', nameEn: 'Entrepreneurship and Projects', fieldSlug: 'business' },
  { slug: 'eg-bacc-selected-activity', nameAr: 'النشاط التربوي أو المهني المختار', nameEn: 'Selected Educational or Professional Activity', fieldSlug: 'arts-activities' },
];

const PRIMARY_1_3_ITEMS: CurriculumItemSpec[] = [
  { subjectSlug: 'eg-arabic', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar'] },
  {
    subjectSlug: 'eg-english',
    subjectType: 'CORE',
    isCompulsory: true,
    isIncludedInTotal: true,
    languages: ['en'],
    variants: ['CONNECT', 'CONNECT_PLUS'],
    notesAr: 'يشمل منهج Connect الأساسي ويدعم Connect Plus كمتطلب إضافي للمدارس الرسمية للغات.',
    notesEn: 'Includes Connect and supports Connect Plus as an additional requirement for official language schools.',
  },
  {
    subjectSlug: 'eg-mathematics',
    subjectType: 'CORE',
    isCompulsory: true,
    isIncludedInTotal: true,
    languages: ['ar', 'en', 'fr'],
    notesAr: 'متاح بلغة الدراسة العربية أو الإنجليزية أو الفرنسية حسب نوع المدرسة.',
    notesEn: 'Available in Arabic, English, or French language of instruction.',
  },
  {
    subjectSlug: 'eg-religious-ed',
    subjectType: 'RELIGIOUS',
    isCompulsory: true,
    isIncludedInTotal: false,
    isPassFail: true,
    isNonTotal: true,
    variants: ['ISLAMIC', 'CHRISTIAN'],
    notesAr: 'يدعم مساري التربية الدينية الإسلامية والمسيحية (نجاح ورسوب — لا يُضاف للمجموع).',
    notesEn: 'Supports separate Islamic and Christian curriculum variants (pass/fail, non-total).',
  },
  {
    subjectSlug: 'eg-pe-health',
    subjectType: 'ACTIVITY',
    isCompulsory: true,
    isIncludedInTotal: false,
    isPassFail: true,
    isNonTotal: true,
    isActivity: true,
  },
  {
    subjectSlug: 'eg-tokkatsu',
    subjectType: 'ACTIVITY',
    isCompulsory: true,
    isIncludedInTotal: false,
    isPassFail: false,
    isNonTotal: true,
    isActivity: true,
    notesAr: 'أنشطة التوكاتسو لبناء الشخصية والعمل الجماعي.',
    notesEn: 'Tokkatsu activities for character building and collaborative school life.',
  },
];

const PRIMARY_4_6_ITEMS: CurriculumItemSpec[] = [
  { subjectSlug: 'eg-arabic', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar'] },
  {
    subjectSlug: 'eg-english',
    subjectType: 'CORE',
    isCompulsory: true,
    isIncludedInTotal: true,
    languages: ['en'],
    variants: ['CONNECT', 'CONNECT_PLUS'],
    notesAr: 'يدعم منهج Connect ومنهج Connect Plus لمدارس اللغات الرسمية.',
    notesEn: 'Supports Connect and Connect Plus for applicable official language schools.',
  },
  {
    subjectSlug: 'eg-mathematics',
    subjectType: 'CORE',
    isCompulsory: true,
    isIncludedInTotal: true,
    languages: ['ar', 'en', 'fr'],
  },
  {
    subjectSlug: 'eg-science',
    subjectType: 'CORE',
    isCompulsory: true,
    isIncludedInTotal: true,
    languages: ['ar', 'en', 'fr'],
  },
  {
    subjectSlug: 'eg-social-studies',
    subjectType: 'CORE',
    isCompulsory: true,
    isIncludedInTotal: true,
    languages: ['ar'],
  },
  {
    subjectSlug: 'eg-religious-ed',
    subjectType: 'RELIGIOUS',
    isCompulsory: true,
    isIncludedInTotal: false,
    isPassFail: true,
    isNonTotal: true,
    variants: ['ISLAMIC', 'CHRISTIAN'],
  },
  {
    subjectSlug: 'eg-art-ed',
    subjectType: 'ADDITIONAL_SCHOOL',
    isCompulsory: true,
    isIncludedInTotal: false,
    isNonTotal: true,
    isActivity: true,
  },
  {
    subjectSlug: 'eg-ict-primary',
    subjectType: 'ADDITIONAL_SCHOOL',
    isCompulsory: true,
    isIncludedInTotal: true,
    languages: ['ar', 'en', 'fr'],
  },
  { subjectSlug: 'eg-agri-skills', subjectType: 'ACTIVITY', isCompulsory: false, isElective: true, isIncludedInTotal: false, isNonTotal: true, isActivity: true, electiveGroupCode: 'PRIMARY_SCHOOL_ACTIVITY' },
  { subjectSlug: 'eg-ind-skills', subjectType: 'ACTIVITY', isCompulsory: false, isElective: true, isIncludedInTotal: false, isNonTotal: true, isActivity: true, electiveGroupCode: 'PRIMARY_SCHOOL_ACTIVITY' },
  { subjectSlug: 'eg-family-mgmt', subjectType: 'ACTIVITY', isCompulsory: false, isElective: true, isIncludedInTotal: false, isNonTotal: true, isActivity: true, electiveGroupCode: 'PRIMARY_SCHOOL_ACTIVITY' },
  { subjectSlug: 'eg-edu-media', subjectType: 'ACTIVITY', isCompulsory: false, isElective: true, isIncludedInTotal: false, isNonTotal: true, isActivity: true, electiveGroupCode: 'PRIMARY_SCHOOL_ACTIVITY' },
  { subjectSlug: 'eg-drama-ed', subjectType: 'ACTIVITY', isCompulsory: false, isElective: true, isIncludedInTotal: false, isNonTotal: true, isActivity: true, electiveGroupCode: 'PRIMARY_SCHOOL_ACTIVITY' },
  { subjectSlug: 'eg-libraries', subjectType: 'ACTIVITY', isCompulsory: false, isElective: true, isIncludedInTotal: false, isNonTotal: true, isActivity: true, electiveGroupCode: 'PRIMARY_SCHOOL_ACTIVITY' },
  { subjectSlug: 'eg-music-ed', subjectType: 'ACTIVITY', isCompulsory: false, isElective: true, isIncludedInTotal: false, isNonTotal: true, isActivity: true, electiveGroupCode: 'PRIMARY_SCHOOL_ACTIVITY' },
  { subjectSlug: 'eg-pe-health', subjectType: 'ACTIVITY', isCompulsory: true, isIncludedInTotal: false, isPassFail: true, isNonTotal: true, isActivity: true },
];

const PREP_1_ITEMS: CurriculumItemSpec[] = [
  { subjectSlug: 'eg-arabic', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar'] },
  { subjectSlug: 'eg-english-first-foreign', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['en'] },
  { subjectSlug: 'eg-mathematics', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
  { subjectSlug: 'eg-science', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
  { subjectSlug: 'eg-social-studies', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar'] },
  {
    subjectSlug: 'eg-religious-ed-islamic-christian',
    subjectType: 'RELIGIOUS',
    isCompulsory: true,
    isIncludedInTotal: false,
    isPassFail: true,
    isNonTotal: true,
    variants: ['ISLAMIC', 'CHRISTIAN'],
  },
  {
    subjectSlug: 'eg-ict-prep',
    subjectType: 'NON_TOTAL',
    isCompulsory: true,
    isIncludedInTotal: false,
    isPassFail: true,
    isNonTotal: true,
    languages: ['ar', 'en', 'fr'],
  },
  {
    subjectSlug: 'eg-second-foreign-lang',
    subjectType: 'FOREIGN_LANGUAGE',
    isCompulsory: false,
    isElective: true,
    isIncludedInTotal: false,
    isPassFail: true,
    isNonTotal: true,
    variants: ['FRENCH', 'GERMAN', 'ITALIAN', 'SPANISH'],
    notesAr: 'تُدرّس حيثما تنطبق وفق منهج المدرسة المعتمدة للغة الثانية.',
    notesEn: 'Offered where applicable according to the student’s school curriculum.',
  },
  { subjectSlug: 'eg-ind-entrepreneurship', subjectType: 'ACTIVITY', isCompulsory: false, isElective: true, isIncludedInTotal: false, isNonTotal: true, isActivity: true, electiveGroupCode: 'PREP_1_ACTIVITY' },
  { subjectSlug: 'eg-libraries-research', subjectType: 'ACTIVITY', isCompulsory: false, isElective: true, isIncludedInTotal: false, isNonTotal: true, isActivity: true, electiveGroupCode: 'PREP_1_ACTIVITY' },
  { subjectSlug: 'eg-edu-media', subjectType: 'ACTIVITY', isCompulsory: false, isElective: true, isIncludedInTotal: false, isNonTotal: true, isActivity: true, electiveGroupCode: 'PREP_1_ACTIVITY' },
  { subjectSlug: 'eg-drama-ed', subjectType: 'ACTIVITY', isCompulsory: false, isElective: true, isIncludedInTotal: false, isNonTotal: true, isActivity: true, electiveGroupCode: 'PREP_1_ACTIVITY' },
];

const PREP_2_ITEMS: CurriculumItemSpec[] = [
  { subjectSlug: 'eg-arabic', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar'] },
  { subjectSlug: 'eg-english-first-foreign', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['en'] },
  { subjectSlug: 'eg-mathematics', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
  { subjectSlug: 'eg-science', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
  { subjectSlug: 'eg-social-studies', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar'] },
  {
    subjectSlug: 'eg-religious-ed-islamic-christian',
    subjectType: 'RELIGIOUS',
    isCompulsory: true,
    isIncludedInTotal: false,
    isPassFail: true,
    isNonTotal: true,
    variants: ['ISLAMIC', 'CHRISTIAN'],
  },
  {
    subjectSlug: 'eg-ict-prep',
    subjectType: 'NON_TOTAL',
    isCompulsory: true,
    isIncludedInTotal: false,
    isPassFail: true,
    isNonTotal: true,
    languages: ['ar', 'en', 'fr'],
  },
  {
    subjectSlug: 'eg-second-foreign-lang',
    subjectType: 'FOREIGN_LANGUAGE',
    isCompulsory: false,
    isElective: true,
    isIncludedInTotal: false,
    isPassFail: true,
    isNonTotal: true,
    variants: ['FRENCH', 'GERMAN', 'ITALIAN', 'SPANISH'],
    notesAr: 'اختيارية/حسب المدرسة وفق خيارات اللغات المعتمدة.',
    notesEn: 'Where applicable, including available school-approved language options.',
  },
  { subjectSlug: 'eg-agri-entrepreneurship', subjectType: 'ACTIVITY', isCompulsory: false, isElective: true, isIncludedInTotal: false, isNonTotal: true, isActivity: true, electiveGroupCode: 'PREP_2_ACTIVITY' },
  { subjectSlug: 'eg-ind-entrepreneurship', subjectType: 'ACTIVITY', isCompulsory: false, isElective: true, isIncludedInTotal: false, isNonTotal: true, isActivity: true, electiveGroupCode: 'PREP_2_ACTIVITY' },
  { subjectSlug: 'eg-libraries-research', subjectType: 'ACTIVITY', isCompulsory: false, isElective: true, isIncludedInTotal: false, isNonTotal: true, isActivity: true, electiveGroupCode: 'PREP_2_ACTIVITY' },
];

const PREP_3_ITEMS: CurriculumItemSpec[] = [
  { subjectSlug: 'eg-arabic', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar'] },
  { subjectSlug: 'eg-english-first-foreign', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['en'] },
  { subjectSlug: 'eg-mathematics', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
  { subjectSlug: 'eg-science', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
  { subjectSlug: 'eg-social-studies', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar'] },
  {
    subjectSlug: 'eg-religious-ed-islamic-christian',
    subjectType: 'RELIGIOUS',
    isCompulsory: true,
    isIncludedInTotal: false,
    isPassFail: true,
    isNonTotal: true,
    variants: ['ISLAMIC', 'CHRISTIAN'],
  },
  {
    subjectSlug: 'eg-ict-prep',
    subjectType: 'NON_TOTAL',
    isCompulsory: true,
    isIncludedInTotal: false,
    isPassFail: true,
    isNonTotal: true,
    languages: ['ar', 'en', 'fr'],
  },
  { subjectSlug: 'eg-edu-media', subjectType: 'ACTIVITY', isCompulsory: false, isElective: true, isIncludedInTotal: false, isNonTotal: true, isActivity: true, electiveGroupCode: 'PREP_3_ACTIVITY' },
  { subjectSlug: 'eg-drama-ed', subjectType: 'ACTIVITY', isCompulsory: false, isElective: true, isIncludedInTotal: false, isNonTotal: true, isActivity: true, electiveGroupCode: 'PREP_3_ACTIVITY' },
];

const GEN_SEC_1_ACTIVITIES: string[] = [
  'eg-art-ed',
  'eg-music-ed',
  'eg-home-economics',
  'eg-scouts',
  'eg-theater-acting',
  'eg-journalism-broadcasting',
  'eg-community-service',
  'eg-creative-science-act',
  'eg-reading-libraries',
  'eg-industrial-tech',
  'eg-agri-tech',
  'eg-entrepreneurship-projects',
];

const GEN_SEC_2_ACTIVITIES: string[] = [
  'eg-art-ed',
  'eg-music-ed',
  'eg-home-economics',
  'eg-scouts',
  'eg-theater-acting',
  'eg-journalism-broadcasting',
  'eg-community-service',
  'eg-creative-science-act',
  'eg-reading-libraries',
  'eg-agri-tech',
  'eg-entrepreneurship-projects',
];

export async function ensureEgyptianCurriculumSeeded(): Promise<void> {
  const existingYears = await db
    .select({ id: academicYears.id })
    .from(academicYears)
    .where(eq(academicYears.code, '2026/2027'))
    .limit(1);
  if (existingYears.length > 0) return;

  // 1. Ensure primary/preparatory/secondary stages exist cleanly
  const existingStages = await db.select().from(educationalStages);
  const stageMap = new Map(existingStages.map((s) => [s.slug, s.id]));

  for (const st of [
    { slug: 'primary', nameAr: 'المرحلة الابتدائية', nameEn: 'Primary Education', sortOrder: 1 },
    { slug: 'preparatory', nameAr: 'المرحلة الإعدادية / المتوسطة', nameEn: 'Preparatory Education', sortOrder: 2 },
    { slug: 'secondary', nameAr: 'المرحلة الثانوية', nameEn: 'Secondary Education', sortOrder: 3 },
  ]) {
    if (!stageMap.has(st.slug)) {
      const [ins] = await db.insert(educationalStages).values(st).returning();
      stageMap.set(st.slug, ins.id);
    }
  }

  const primaryStageId = stageMap.get('primary')!;
  const prepStageId = stageMap.get('preparatory')!;
  const secondaryStageId = stageMap.get('secondary')!;

  // 2. Ensure fields exist
  const existingFields = await db.select().from(fields);
  const fieldMap = new Map(existingFields.map((f) => [f.slug, f.id]));
  for (const f of GENERAL_EDUCATION_FIELDS) {
    if (!fieldMap.has(f.slug)) {
      const [ins] = await db.insert(fields).values(f).returning();
      fieldMap.set(f.slug, ins.id);
    }
  }

  // 3. Ensure Master Subjects exist
  const existingSubjects = await db.select().from(subjects);
  const subjectMap = new Map(existingSubjects.map((s) => [s.slug, s.id]));
  for (const subj of MASTER_SUBJECTS) {
    if (!subjectMap.has(subj.slug)) {
      const fId = fieldMap.get(subj.fieldSlug) ?? Array.from(fieldMap.values())[0];
      const [ins] = await db
        .insert(subjects)
        .values({
          slug: subj.slug,
          fieldId: fId,
          stageId: primaryStageId,
          nameAr: subj.nameAr,
          nameEn: subj.nameEn,
          isActive: true,
        })
        .returning();
      subjectMap.set(subj.slug, ins.id);
    }
  }

  // 4. Educational Systems (Egyptian General Education only)
  const systemSeeds = [
    {
      stageId: primaryStageId,
      code: 'PRIMARY_GENERAL',
      nameAr: 'التعليم الابتدائي العام',
      nameEn: 'Primary General Education',
      descriptionAr: 'الصفوف من الأول إلى السادس الابتدائي وفق المنهج المصري العام',
      descriptionEn: 'Grades 1 to 6 under the Egyptian General Primary curriculum',
      sortOrder: 1,
    },
    {
      stageId: prepStageId,
      code: 'PREPARATORY_GENERAL',
      nameAr: 'التعليم الإعدادي العام',
      nameEn: 'Preparatory General Education',
      descriptionAr: 'الصفوف الأول والثاني والثالث الإعدادي',
      descriptionEn: 'Grades 1 to 3 Preparatory Education',
      sortOrder: 2,
    },
    {
      stageId: secondaryStageId,
      code: 'GENERAL_SECONDARY',
      nameAr: 'الثانوية العامة',
      nameEn: 'General Secondary Education',
      descriptionAr: 'نظام الثانوية العامة المصرية بشعبه العلمية والأدبية',
      descriptionEn: 'Egyptian General Secondary system with Scientific and Literary divisions',
      sortOrder: 3,
    },
    {
      stageId: secondaryStageId,
      code: 'EGYPTIAN_BACCALAUREATE',
      nameAr: 'البكالوريا المصرية',
      nameEn: 'Egyptian Baccalaureate',
      descriptionAr: 'نظام البكالوريا المصرية بالمرحلة التمهيدية ومسارات التخصص الأربعة',
      descriptionEn: 'Egyptian Baccalaureate system with introductory grade and four specialized pathways',
      sortOrder: 4,
    },
  ];
  const insertedSystems = await db.insert(educationalSystems).values(systemSeeds).returning();
  const sysMap = new Map(insertedSystems.map((s) => [s.code, s.id]));

  const primarySysId = sysMap.get('PRIMARY_GENERAL')!;
  const prepSysId = sysMap.get('PREPARATORY_GENERAL')!;
  const genSecSysId = sysMap.get('GENERAL_SECONDARY')!;
  const baccSysId = sysMap.get('EGYPTIAN_BACCALAUREATE')!;

  // 5. Educational Grades
  const gradeSeeds = [
    { stageId: primaryStageId, systemId: primarySysId, gradeNumber: 1, slug: 'primary-1', nameAr: 'الصف الأول الابتدائي', nameEn: 'Grade 1 Primary', sortOrder: 1 },
    { stageId: primaryStageId, systemId: primarySysId, gradeNumber: 2, slug: 'primary-2', nameAr: 'الصف الثاني الابتدائي', nameEn: 'Grade 2 Primary', sortOrder: 2 },
    { stageId: primaryStageId, systemId: primarySysId, gradeNumber: 3, slug: 'primary-3', nameAr: 'الصف الثالث الابتدائي', nameEn: 'Grade 3 Primary', sortOrder: 3 },
    { stageId: primaryStageId, systemId: primarySysId, gradeNumber: 4, slug: 'primary-4', nameAr: 'الصف الرابع الابتدائي', nameEn: 'Grade 4 Primary', sortOrder: 4 },
    { stageId: primaryStageId, systemId: primarySysId, gradeNumber: 5, slug: 'primary-5', nameAr: 'الصف الخامس الابتدائي', nameEn: 'Grade 5 Primary', sortOrder: 5 },
    { stageId: primaryStageId, systemId: primarySysId, gradeNumber: 6, slug: 'primary-6', nameAr: 'الصف السادس الابتدائي', nameEn: 'Grade 6 Primary', sortOrder: 6 },
    { stageId: prepStageId, systemId: prepSysId, gradeNumber: 1, slug: 'prep-1', nameAr: 'الصف الأول الإعدادي', nameEn: 'Grade 1 Preparatory', sortOrder: 7 },
    { stageId: prepStageId, systemId: prepSysId, gradeNumber: 2, slug: 'prep-2', nameAr: 'الصف الثاني الإعدادي', nameEn: 'Grade 2 Preparatory', sortOrder: 8 },
    { stageId: prepStageId, systemId: prepSysId, gradeNumber: 3, slug: 'prep-3', nameAr: 'الصف الثالث الإعدادي', nameEn: 'Grade 3 Preparatory', sortOrder: 9 },
    { stageId: secondaryStageId, systemId: genSecSysId, gradeNumber: 1, slug: 'gen-sec-1', nameAr: 'الصف الأول الثانوي', nameEn: 'Grade 1 General Secondary', sortOrder: 10 },
    { stageId: secondaryStageId, systemId: genSecSysId, gradeNumber: 2, slug: 'gen-sec-2', nameAr: 'الصف الثاني الثانوي', nameEn: 'Grade 2 General Secondary', sortOrder: 11 },
    { stageId: secondaryStageId, systemId: genSecSysId, gradeNumber: 3, slug: 'gen-sec-3', nameAr: 'الصف الثالث الثانوي', nameEn: 'Grade 3 General Secondary', sortOrder: 12 },
    { stageId: secondaryStageId, systemId: baccSysId, gradeNumber: 1, slug: 'bacc-1', nameAr: 'الصف الأول الثانوي (المرحلة التمهيدية)', nameEn: 'Grade 1 Baccalaureate (Introductory Stage)', sortOrder: 13 },
    { stageId: secondaryStageId, systemId: baccSysId, gradeNumber: 2, slug: 'bacc-2', nameAr: 'الصف الثاني الثانوي (البكالوريا المصرية)', nameEn: 'Grade 2 Baccalaureate', sortOrder: 14 },
    { stageId: secondaryStageId, systemId: baccSysId, gradeNumber: 3, slug: 'bacc-3', nameAr: 'الصف الثالث الثانوي (البكالوريا المصرية)', nameEn: 'Grade 3 Baccalaureate', sortOrder: 15 },
  ];
  const insertedGrades = await db.insert(educationalGrades).values(gradeSeeds).returning();
  const gradeMap = new Map(insertedGrades.map((g) => [g.slug, g]));

  // 6. General Secondary Divisions
  const divisionSeeds = [
    { systemId: genSecSysId, gradeId: gradeMap.get('gen-sec-2')!.id, code: 'GEN_SEC_2_SCIENTIFIC', nameAr: 'الشعبة العلمية', nameEn: 'Scientific Division', sortOrder: 1 },
    { systemId: genSecSysId, gradeId: gradeMap.get('gen-sec-2')!.id, code: 'GEN_SEC_2_LITERARY', nameAr: 'الشعبة الأدبية', nameEn: 'Literary Division', sortOrder: 2 },
    { systemId: genSecSysId, gradeId: gradeMap.get('gen-sec-3')!.id, code: 'GEN_SEC_3_SCI_BIO', nameAr: 'علمي علوم', nameEn: 'Scientific Sciences', sortOrder: 3 },
    { systemId: genSecSysId, gradeId: gradeMap.get('gen-sec-3')!.id, code: 'GEN_SEC_3_SCI_MATH', nameAr: 'علمي رياضة', nameEn: 'Scientific Mathematics', sortOrder: 4 },
    { systemId: genSecSysId, gradeId: gradeMap.get('gen-sec-3')!.id, code: 'GEN_SEC_3_LITERARY', nameAr: 'أدبي', nameEn: 'Literary', sortOrder: 5 },
  ];
  const insertedDivisions = await db.insert(secondaryDivisions).values(divisionSeeds).returning();
  const divMap = new Map(insertedDivisions.map((d) => [d.code, d]));

  // 7. Egyptian Baccalaureate Pathways (Grades 2 & 3 only)
  const pathwaySeeds = [
    { systemId: baccSysId, gradeId: gradeMap.get('bacc-2')!.id, code: 'BACC_2_MED', nameAr: 'الطب وعلوم الحياة', nameEn: 'Medicine & Life Sciences', sortOrder: 1 },
    { systemId: baccSysId, gradeId: gradeMap.get('bacc-2')!.id, code: 'BACC_2_ENG', nameAr: 'الهندسة وعلوم الحاسب', nameEn: 'Engineering & Computer Science', sortOrder: 2 },
    { systemId: baccSysId, gradeId: gradeMap.get('bacc-2')!.id, code: 'BACC_2_BUS', nameAr: 'الأعمال', nameEn: 'Business', sortOrder: 3 },
    { systemId: baccSysId, gradeId: gradeMap.get('bacc-2')!.id, code: 'BACC_2_ARTS', nameAr: 'الآداب والفنون', nameEn: 'Arts & Humanities', sortOrder: 4 },
    { systemId: baccSysId, gradeId: gradeMap.get('bacc-3')!.id, code: 'BACC_3_MED', nameAr: 'الطب وعلوم الحياة', nameEn: 'Medicine & Life Sciences', sortOrder: 1 },
    { systemId: baccSysId, gradeId: gradeMap.get('bacc-3')!.id, code: 'BACC_3_ENG', nameAr: 'الهندسة وعلوم الحاسب', nameEn: 'Engineering & Computer Science', sortOrder: 2 },
    { systemId: baccSysId, gradeId: gradeMap.get('bacc-3')!.id, code: 'BACC_3_BUS', nameAr: 'الأعمال', nameEn: 'Business', sortOrder: 3 },
    { systemId: baccSysId, gradeId: gradeMap.get('bacc-3')!.id, code: 'BACC_3_ARTS', nameAr: 'الآداب والفنون', nameEn: 'Arts & Humanities', sortOrder: 4 },
  ];
  const insertedPathways = await db.insert(baccalaureatePathways).values(pathwaySeeds).returning();
  const pathMap = new Map(insertedPathways.map((p) => [p.code, p]));

  // 8. Academic Year 2026/2027 & Initial Curriculum Version
  const [year2026] = await db
    .insert(academicYears)
    .values({
      code: '2026/2027',
      nameAr: 'العام الدراسي 2026/2027',
      nameEn: 'Academic Year 2026/2027',
      startDate: '2026-09-01',
      endDate: '2027-06-30',
      isCurrent: true,
      isActive: true,
    })
    .returning();

  const [versionV1] = await db
    .insert(curriculumVersions)
    .values({
      academicYearId: year2026.id,
      versionCode: 'EG-2026-2027-V1',
      nameAr: 'منهج التعليم المصري العام 2026/2027 (الإصدار الرسمي الأول)',
      nameEn: 'Egyptian General Education Curriculum 2026/2027 (v1)',
      description: 'النسخة المرجعية الكاملة لمناهج التعليم العام المصري (الابتدائي، الإعدادي، الثانوية العامة، والبكالوريا المصرية).',
      isActive: true,
      isPublished: true,
    })
    .returning();

  // Helper to collect gradeSubjects & curriculumSubjects cleanly
  const gradeSubjectKeySet = new Set<string>();
  const gradeSubjectIdByKey = new Map<string, number>();

  async function ensureGradeSubject(gradeId: number, subjectId: number): Promise<number> {
    const key = `${gradeId}:${subjectId}`;
    if (gradeSubjectKeySet.has(key)) {
      return gradeSubjectIdByKey.get(key)!;
    }
    const [gs] = await db
      .insert(gradeSubjects)
      .values({ gradeId, subjectId, isActive: true })
      .returning();
    gradeSubjectKeySet.add(key);
    gradeSubjectIdByKey.set(key, gs.id);
    return gs.id;
  }

  const curriculumRowsToInsert: Array<typeof curriculumSubjects.$inferInsert> = [];

  async function pushCurriculumItems(
    gradeSlug: string,
    items: CurriculumItemSpec[],
    divisionCode?: string,
    pathwayCode?: string
  ) {
    const grade = gradeMap.get(gradeSlug)!;
    const divisionId = divisionCode ? divMap.get(divisionCode)!.id : null;
    const pathwayId = pathwayCode ? pathMap.get(pathwayCode)!.id : null;

    let order = 1;
    for (const item of items) {
      const subjectId = subjectMap.get(item.subjectSlug);
      if (!subjectId) {
        throw new Error(`Missing master subject slug: ${item.subjectSlug}`);
      }
      const gsId = await ensureGradeSubject(grade.id, subjectId);
      const langs = item.languages ?? ['ar'];
      curriculumRowsToInsert.push({
        curriculumVersionId: versionV1.id,
        academicYearId: year2026.id,
        stageId: grade.stageId,
        systemId: grade.systemId,
        gradeId: grade.id,
        divisionId,
        pathwayId,
        gradeSubjectId: gsId,
        subjectId,
        subjectType: item.subjectType,
        isCompulsory: item.isCompulsory ?? true,
        isElective: item.isElective ?? false,
        isSpecialization: item.isSpecialization ?? false,
        isIncludedInTotal: item.isIncludedInTotal ?? true,
        isPassFail: item.isPassFail ?? false,
        isNonTotal: item.isNonTotal ?? !(item.isIncludedInTotal ?? true),
        isActivity: item.isActivity ?? false,
        passThresholdPercent: item.passThresholdPercent ?? null,
        electiveGroupCode: item.electiveGroupCode ?? null,
        defaultLanguageOfInstruction: langs[0] || 'ar',
        languagesOfInstructionJson: langs,
        curriculumVariantsJson: item.variants ?? [],
        notesAr: item.notesAr ?? null,
        notesEn: item.notesEn ?? null,
        isAvailableForTeacherAssignment: item.isAvailableForTeacherAssignment ?? true,
        isActive: true,
        sortOrder: order++,
      });
    }
  }

  // Primary 1..3
  await pushCurriculumItems('primary-1', PRIMARY_1_3_ITEMS);
  await pushCurriculumItems('primary-2', PRIMARY_1_3_ITEMS);
  await pushCurriculumItems('primary-3', PRIMARY_1_3_ITEMS);

  // Primary 4..6
  await pushCurriculumItems('primary-4', PRIMARY_4_6_ITEMS);
  await pushCurriculumItems('primary-5', PRIMARY_4_6_ITEMS);
  await pushCurriculumItems('primary-6', PRIMARY_4_6_ITEMS);

  // Preparatory 1..3
  await pushCurriculumItems('prep-1', PREP_1_ITEMS);
  await pushCurriculumItems('prep-2', PREP_2_ITEMS);
  await pushCurriculumItems('prep-3', PREP_3_ITEMS);

  // General Secondary Grade 1
  await pushCurriculumItems('gen-sec-1', [
    { subjectSlug: 'eg-arabic', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar'] },
    { subjectSlug: 'eg-first-foreign-lang', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['en', 'fr', 'de'] },
    { subjectSlug: 'eg-history', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar'] },
    { subjectSlug: 'eg-mathematics', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
    { subjectSlug: 'eg-integrated-science', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
    { subjectSlug: 'eg-philosophy-logic', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar'] },
    { subjectSlug: 'eg-religious-ed', subjectType: 'RELIGIOUS', isCompulsory: true, isIncludedInTotal: false, isPassFail: true, isNonTotal: true, variants: ['ISLAMIC', 'CHRISTIAN'] },
    { subjectSlug: 'eg-second-foreign-lang', subjectType: 'FOREIGN_LANGUAGE', isCompulsory: true, isIncludedInTotal: false, isPassFail: true, isNonTotal: true, variants: ['FRENCH', 'GERMAN', 'ITALIAN', 'SPANISH', 'CHINESE'] },
    { subjectSlug: 'eg-pe-sport', subjectType: 'NON_TOTAL', isCompulsory: true, isIncludedInTotal: false, isPassFail: true, isNonTotal: true, isActivity: true },
    { subjectSlug: 'eg-programming-ai', subjectType: 'NON_TOTAL', isCompulsory: true, isIncludedInTotal: false, isPassFail: true, isNonTotal: true, languages: ['ar', 'en'] },
    ...GEN_SEC_1_ACTIVITIES.map(
      (slug): CurriculumItemSpec => ({
        subjectSlug: slug,
        subjectType: 'ACTIVITY',
        isCompulsory: false,
        isElective: true,
        isIncludedInTotal: false,
        isPassFail: true,
        isNonTotal: true,
        isActivity: true,
        electiveGroupCode: 'GEN_SEC_1_ACTIVITY',
        notesAr: 'يختار الطالب نشاطاً تربوياً أو مهنياً واحداً وفق اللوائح المعتمدة.',
        notesEn: 'Student selects one educational/professional activity per official regulations.',
      })
    ),
  ]);

  // General Secondary Grade 2 — Scientific Division
  await pushCurriculumItems(
    'gen-sec-2',
    [
      { subjectSlug: 'eg-arabic', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar'] },
      { subjectSlug: 'eg-first-foreign-lang', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['en', 'fr', 'de'] },
      { subjectSlug: 'eg-mathematics', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
      { subjectSlug: 'eg-history', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar'] },
      { subjectSlug: 'eg-chemistry', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
      { subjectSlug: 'eg-physics', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
      { subjectSlug: 'eg-religious-ed', subjectType: 'RELIGIOUS', isCompulsory: true, isIncludedInTotal: false, isPassFail: true, isNonTotal: true, variants: ['ISLAMIC', 'CHRISTIAN'] },
      { subjectSlug: 'eg-second-foreign-lang', subjectType: 'FOREIGN_LANGUAGE', isCompulsory: true, isIncludedInTotal: false, isPassFail: true, isNonTotal: true, variants: ['FRENCH', 'GERMAN', 'ITALIAN', 'SPANISH'] },
      { subjectSlug: 'eg-pe-sport', subjectType: 'NON_TOTAL', isCompulsory: true, isIncludedInTotal: false, isPassFail: true, isNonTotal: true, isActivity: true },
      { subjectSlug: 'eg-national-education', subjectType: 'NON_TOTAL', isCompulsory: true, isIncludedInTotal: false, isPassFail: true, isNonTotal: true },
      ...GEN_SEC_2_ACTIVITIES.map(
        (slug): CurriculumItemSpec => ({
          subjectSlug: slug,
          subjectType: 'ACTIVITY',
          isCompulsory: false,
          isElective: true,
          isIncludedInTotal: false,
          isPassFail: true,
          isNonTotal: true,
          isActivity: true,
          electiveGroupCode: 'GEN_SEC_2_SCI_ACTIVITY',
        })
      ),
    ],
    'GEN_SEC_2_SCIENTIFIC'
  );

  // General Secondary Grade 2 — Literary Division
  await pushCurriculumItems(
    'gen-sec-2',
    [
      { subjectSlug: 'eg-arabic', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar'] },
      { subjectSlug: 'eg-first-foreign-lang', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['en', 'fr', 'de'] },
      { subjectSlug: 'eg-history', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar'] },
      { subjectSlug: 'eg-geography', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar'] },
      { subjectSlug: 'eg-psychology-sociology', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar'] },
      { subjectSlug: 'eg-mathematics', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
      { subjectSlug: 'eg-religious-ed', subjectType: 'RELIGIOUS', isCompulsory: true, isIncludedInTotal: false, isPassFail: true, isNonTotal: true, variants: ['ISLAMIC', 'CHRISTIAN'] },
      { subjectSlug: 'eg-second-foreign-lang', subjectType: 'FOREIGN_LANGUAGE', isCompulsory: true, isIncludedInTotal: false, isPassFail: true, isNonTotal: true, variants: ['FRENCH', 'GERMAN', 'ITALIAN', 'SPANISH'] },
      { subjectSlug: 'eg-pe-sport', subjectType: 'NON_TOTAL', isCompulsory: true, isIncludedInTotal: false, isPassFail: true, isNonTotal: true, isActivity: true },
      { subjectSlug: 'eg-national-education', subjectType: 'NON_TOTAL', isCompulsory: true, isIncludedInTotal: false, isPassFail: true, isNonTotal: true },
      ...GEN_SEC_2_ACTIVITIES.map(
        (slug): CurriculumItemSpec => ({
          subjectSlug: slug,
          subjectType: 'ACTIVITY',
          isCompulsory: false,
          isElective: true,
          isIncludedInTotal: false,
          isPassFail: true,
          isNonTotal: true,
          isActivity: true,
          electiveGroupCode: 'GEN_SEC_2_LIT_ACTIVITY',
        })
      ),
    ],
    'GEN_SEC_2_LITERARY'
  );

  // General Secondary Grade 3 — 3 Separate Divisions
  const GEN_SEC_3_NON_TOTAL: CurriculumItemSpec[] = [
    { subjectSlug: 'eg-religious-ed', subjectType: 'RELIGIOUS', isCompulsory: true, isIncludedInTotal: false, isPassFail: true, isNonTotal: true, variants: ['ISLAMIC', 'CHRISTIAN'] },
    { subjectSlug: 'eg-second-foreign-lang', subjectType: 'FOREIGN_LANGUAGE', isCompulsory: true, isIncludedInTotal: false, isPassFail: true, isNonTotal: true, variants: ['FRENCH', 'GERMAN', 'ITALIAN', 'SPANISH'] },
    { subjectSlug: 'eg-national-education', subjectType: 'NON_TOTAL', isCompulsory: true, isIncludedInTotal: false, isPassFail: true, isNonTotal: true },
  ];

  await pushCurriculumItems(
    'gen-sec-3',
    [
      { subjectSlug: 'eg-arabic', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar'] },
      { subjectSlug: 'eg-first-foreign-lang', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['en', 'fr', 'de'] },
      { subjectSlug: 'eg-biology', subjectType: 'SPECIALIZATION', isCompulsory: true, isSpecialization: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
      { subjectSlug: 'eg-chemistry', subjectType: 'SPECIALIZATION', isCompulsory: true, isSpecialization: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
      { subjectSlug: 'eg-physics', subjectType: 'SPECIALIZATION', isCompulsory: true, isSpecialization: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
      ...GEN_SEC_3_NON_TOTAL,
    ],
    'GEN_SEC_3_SCI_BIO'
  );

  await pushCurriculumItems(
    'gen-sec-3',
    [
      { subjectSlug: 'eg-arabic', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar'] },
      { subjectSlug: 'eg-first-foreign-lang', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['en', 'fr', 'de'] },
      { subjectSlug: 'eg-mathematics', subjectType: 'SPECIALIZATION', isCompulsory: true, isSpecialization: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
      { subjectSlug: 'eg-chemistry', subjectType: 'SPECIALIZATION', isCompulsory: true, isSpecialization: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
      { subjectSlug: 'eg-physics', subjectType: 'SPECIALIZATION', isCompulsory: true, isSpecialization: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
      ...GEN_SEC_3_NON_TOTAL,
    ],
    'GEN_SEC_3_SCI_MATH'
  );

  await pushCurriculumItems(
    'gen-sec-3',
    [
      { subjectSlug: 'eg-arabic', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar'] },
      { subjectSlug: 'eg-first-foreign-lang', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['en', 'fr', 'de'] },
      { subjectSlug: 'eg-history', subjectType: 'SPECIALIZATION', isCompulsory: true, isSpecialization: true, isIncludedInTotal: true, languages: ['ar'] },
      { subjectSlug: 'eg-geography', subjectType: 'SPECIALIZATION', isCompulsory: true, isSpecialization: true, isIncludedInTotal: true, languages: ['ar'] },
      { subjectSlug: 'eg-statistics', subjectType: 'SPECIALIZATION', isCompulsory: true, isSpecialization: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
      ...GEN_SEC_3_NON_TOTAL,
    ],
    'GEN_SEC_3_LITERARY'
  );

  // Egyptian Baccalaureate — Grade 1 (Introductory Stage)
  await pushCurriculumItems('bacc-1', [
    { subjectSlug: 'eg-arabic', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar'] },
    { subjectSlug: 'eg-first-foreign-lang', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['en', 'fr', 'de'] },
    { subjectSlug: 'eg-egyptian-history', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar'] },
    { subjectSlug: 'eg-mathematics', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
    { subjectSlug: 'eg-integrated-science', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
    { subjectSlug: 'eg-philosophy-logic', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar'] },
    { subjectSlug: 'eg-religious-ed', subjectType: 'RELIGIOUS', isCompulsory: true, isIncludedInTotal: false, isPassFail: true, isNonTotal: true, variants: ['ISLAMIC', 'CHRISTIAN'] },
    { subjectSlug: 'eg-second-foreign-lang', subjectType: 'FOREIGN_LANGUAGE', isCompulsory: true, isIncludedInTotal: false, isPassFail: true, isNonTotal: true, variants: ['FRENCH', 'GERMAN', 'ITALIAN', 'SPANISH'] },
    { subjectSlug: 'eg-programming-cs-ai', subjectType: 'NON_TOTAL', isCompulsory: true, isIncludedInTotal: false, isPassFail: true, isNonTotal: true, languages: ['ar', 'en'] },
    { subjectSlug: 'eg-pe-sport', subjectType: 'NON_TOTAL', isCompulsory: true, isIncludedInTotal: false, isPassFail: true, isNonTotal: true, isActivity: true },
    {
      subjectSlug: 'eg-bacc-selected-activity',
      subjectType: 'ACTIVITY',
      isCompulsory: true,
      isElective: true,
      isIncludedInTotal: false,
      isPassFail: true,
      isNonTotal: true,
      isActivity: true,
      notesAr: 'النشاط التربوي أو المهني المختار وفق لائحة البكالوريا المصرية.',
      notesEn: 'Selected educational or professional activity per Egyptian Baccalaureate regulations.',
    },
  ]);

  // Egyptian Baccalaureate — Grade 2 (4 Pathways)
  const BACC_2_COMMON: CurriculumItemSpec[] = [
    { subjectSlug: 'eg-arabic', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar'] },
    { subjectSlug: 'eg-first-foreign-lang', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['en', 'fr', 'de'] },
    { subjectSlug: 'eg-egyptian-history', subjectType: 'CORE', isCompulsory: true, isIncludedInTotal: true, languages: ['ar'] },
  ];
  const BACC_2_ADDITIONAL: CurriculumItemSpec[] = [
    { subjectSlug: 'eg-financial-culture', subjectType: 'NON_TOTAL', isCompulsory: true, isIncludedInTotal: false, isPassFail: true, isNonTotal: true, languages: ['ar', 'en'] },
    { subjectSlug: 'eg-pe-activity', subjectType: 'ACTIVITY', isCompulsory: true, isIncludedInTotal: false, isPassFail: true, isNonTotal: true, isActivity: true },
  ];

  await pushCurriculumItems(
    'bacc-2',
    [
      ...BACC_2_COMMON,
      { subjectSlug: 'eg-mathematics', subjectType: 'ELECTIVE', isCompulsory: false, isElective: true, isSpecialization: true, isIncludedInTotal: true, electiveGroupCode: 'BACC2_MED_ELECTIVE', languages: ['ar', 'en', 'fr'], notesAr: 'مادة تخصص اختيارية: يختار الطالب واحدة فقط (الرياضيات أو الفيزياء).', notesEn: 'Pathway elective: student selects ONE (Mathematics or Physics).' },
      { subjectSlug: 'eg-physics', subjectType: 'ELECTIVE', isCompulsory: false, isElective: true, isSpecialization: true, isIncludedInTotal: true, electiveGroupCode: 'BACC2_MED_ELECTIVE', languages: ['ar', 'en', 'fr'], notesAr: 'مادة تخصص اختيارية: يختار الطالب واحدة فقط (الرياضيات أو الفيزياء).', notesEn: 'Pathway elective: student selects ONE (Mathematics or Physics).' },
      ...BACC_2_ADDITIONAL,
    ],
    undefined,
    'BACC_2_MED'
  );

  await pushCurriculumItems(
    'bacc-2',
    [
      ...BACC_2_COMMON,
      { subjectSlug: 'eg-chemistry', subjectType: 'ELECTIVE', isCompulsory: false, isElective: true, isSpecialization: true, isIncludedInTotal: true, electiveGroupCode: 'BACC2_ENG_ELECTIVE', languages: ['ar', 'en', 'fr'], notesAr: 'مادة تخصص اختيارية: يختار الطالب واحدة فقط (الكيمياء أو البرمجة والذكاء الاصطناعي).', notesEn: 'Pathway elective: student selects ONE (Chemistry or Programming & AI).' },
      { subjectSlug: 'eg-programming-ai', subjectType: 'ELECTIVE', isCompulsory: false, isElective: true, isSpecialization: true, isIncludedInTotal: true, electiveGroupCode: 'BACC2_ENG_ELECTIVE', languages: ['ar', 'en'], notesAr: 'مادة تخصص اختيارية: يختار الطالب واحدة فقط (الكيمياء أو البرمجة والذكاء الاصطناعي).', notesEn: 'Pathway elective: student selects ONE (Chemistry or Programming & AI).' },
      ...BACC_2_ADDITIONAL,
    ],
    undefined,
    'BACC_2_ENG'
  );

  await pushCurriculumItems(
    'bacc-2',
    [
      ...BACC_2_COMMON,
      { subjectSlug: 'eg-accounting', subjectType: 'ELECTIVE', isCompulsory: false, isElective: true, isSpecialization: true, isIncludedInTotal: true, electiveGroupCode: 'BACC2_BUS_ELECTIVE', languages: ['ar', 'en'], notesAr: 'مادة تخصص اختيارية: يختار الطالب واحدة فقط (المحاسبة أو إدارة الأعمال).', notesEn: 'Pathway elective: student selects ONE (Accounting or Business Administration).' },
      { subjectSlug: 'eg-business-admin', subjectType: 'ELECTIVE', isCompulsory: false, isElective: true, isSpecialization: true, isIncludedInTotal: true, electiveGroupCode: 'BACC2_BUS_ELECTIVE', languages: ['ar', 'en'], notesAr: 'مادة تخصص اختيارية: يختار الطالب واحدة فقط (المحاسبة أو إدارة الأعمال).', notesEn: 'Pathway elective: student selects ONE (Accounting or Business Administration).' },
      ...BACC_2_ADDITIONAL,
    ],
    undefined,
    'BACC_2_BUS'
  );

  await pushCurriculumItems(
    'bacc-2',
    [
      ...BACC_2_COMMON,
      { subjectSlug: 'eg-psychology', subjectType: 'ELECTIVE', isCompulsory: false, isElective: true, isSpecialization: true, isIncludedInTotal: true, electiveGroupCode: 'BACC2_ARTS_ELECTIVE', languages: ['ar'], notesAr: 'مادة تخصص اختيارية: يختار الطالب واحدة فقط (علم النفس أو اللغة الأجنبية الثانية).', notesEn: 'Pathway elective: student selects ONE (Psychology or Second Foreign Language).' },
      { subjectSlug: 'eg-second-foreign-lang', subjectType: 'ELECTIVE', isCompulsory: false, isElective: true, isSpecialization: true, isIncludedInTotal: true, electiveGroupCode: 'BACC2_ARTS_ELECTIVE', variants: ['FRENCH', 'GERMAN', 'ITALIAN', 'SPANISH'], notesAr: 'مادة تخصص اختيارية: يختار الطالب واحدة فقط (علم النفس أو اللغة الأجنبية الثانية).', notesEn: 'Pathway elective: student selects ONE (Psychology or Second Foreign Language).' },
      ...BACC_2_ADDITIONAL,
    ],
    undefined,
    'BACC_2_ARTS'
  );

  // Egyptian Baccalaureate — Grade 3 (4 Pathways)
  const BACC_3_COMMON: CurriculumItemSpec[] = [
    {
      subjectSlug: 'eg-religious-ed',
      subjectType: 'RELIGIOUS',
      isCompulsory: true,
      isIncludedInTotal: false,
      isPassFail: true,
      isNonTotal: true,
      passThresholdPercent: 70,
      variants: ['ISLAMIC', 'CHRISTIAN'],
      notesAr: 'مادة أساسية لا تُضاف للمجموع ويُشترط الحصول على 70% على الأقل للنجاح وفق اللائحة.',
      notesEn: 'Compulsory non-total subject; requires at least 70% to pass under applicable regulations.',
    },
    {
      subjectSlug: 'eg-pe-activity',
      subjectType: 'ACTIVITY',
      isCompulsory: true,
      isIncludedInTotal: false,
      isPassFail: true,
      isNonTotal: true,
      isActivity: true,
    },
  ];

  await pushCurriculumItems(
    'bacc-3',
    [
      { subjectSlug: 'eg-biology-adv', subjectType: 'SPECIALIZATION', isCompulsory: true, isSpecialization: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
      { subjectSlug: 'eg-chemistry-adv', subjectType: 'SPECIALIZATION', isCompulsory: true, isSpecialization: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
      ...BACC_3_COMMON,
    ],
    undefined,
    'BACC_3_MED'
  );

  await pushCurriculumItems(
    'bacc-3',
    [
      { subjectSlug: 'eg-mathematics-adv', subjectType: 'SPECIALIZATION', isCompulsory: true, isSpecialization: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
      { subjectSlug: 'eg-physics-adv', subjectType: 'SPECIALIZATION', isCompulsory: true, isSpecialization: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
      ...BACC_3_COMMON,
    ],
    undefined,
    'BACC_3_ENG'
  );

  await pushCurriculumItems(
    'bacc-3',
    [
      { subjectSlug: 'eg-economics-adv', subjectType: 'SPECIALIZATION', isCompulsory: true, isSpecialization: true, isIncludedInTotal: true, languages: ['ar', 'en'] },
      { subjectSlug: 'eg-mathematics', subjectType: 'SPECIALIZATION', isCompulsory: true, isSpecialization: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
      ...BACC_3_COMMON,
    ],
    undefined,
    'BACC_3_BUS'
  );

  await pushCurriculumItems(
    'bacc-3',
    [
      { subjectSlug: 'eg-geography-adv', subjectType: 'SPECIALIZATION', isCompulsory: true, isSpecialization: true, isIncludedInTotal: true, languages: ['ar'] },
      { subjectSlug: 'eg-statistics', subjectType: 'SPECIALIZATION', isCompulsory: true, isSpecialization: true, isIncludedInTotal: true, languages: ['ar', 'en', 'fr'] },
      ...BACC_3_COMMON,
    ],
    undefined,
    'BACC_3_ARTS'
  );

  const insertedCurriculumSubjects = await db
    .insert(curriculumSubjects)
    .values(curriculumRowsToInsert)
    .returning();

  // 9. Seed Egyptian General Education Demo Teachers + Multiple Assignments per Subject
  const [teacherRole] = await db
    .select()
    .from(roles)
    .where(eq(roles.code, 'TEACHER'))
    .limit(1);

  const existingUsers = await db.select().from(users);
  const userByEmail = new Map(existingUsers.map((u) => [u.email, u.id]));

  const k12DemoTeachers = [
    {
      email: 'ahmed.math@demo.jusoor.edu',
      fullName: 'أ. أحمد عبد الرحمن',
      headline: 'معلم أول رياضيات — الابتدائي والإعدادي والثانوي (عربي ولغات)',
      bio: 'خبرة 11 عاماً في تدريس مناهج الرياضيات المصرية للمرحلة الابتدائية والإعدادية وتبسيط المسائل الحسابية والهندسية.',
      qualifications: 'بكالوريوس تربية رياضيات — جامعة القاهرة',
      yearsExperience: 11,
      hourlyRate: '22.00',
      ratingAvg: '4.92',
      reviewsCount: 41,
    },
    {
      email: 'salma.science@demo.jusoor.edu',
      fullName: 'أ. سلمى محمود',
      headline: 'معلمة علوم وأحياء وعلوم متكاملة — عام ولغات',
      bio: 'متخصصة في تدريس العلوم للمراحل الابتدائية والإعدادية والأحياء للمرحلة الثانوية والبكالوريا المصرية بأسلوب تفاعلي.',
      qualifications: 'ماجستير المناهج وطرق تدريس العلوم — جامعة عين شمس',
      yearsExperience: 9,
      hourlyRate: '25.00',
      ratingAvg: '4.88',
      reviewsCount: 29,
    },
    {
      email: 'yasser.arabic@demo.jusoor.edu',
      fullName: 'أ. ياسر مصطفى',
      headline: 'معلم لغة عربية وبلاغة وإحصاء — المنهج المصري',
      bio: 'تدريس اللغة العربية لجميع الصفوف والرياضيات التأسيسية للابتدائي والقدرات اللغوية للثانوية العامة.',
      qualifications: 'ليسانس دار العلوم — دبلوم تربوي',
      yearsExperience: 14,
      hourlyRate: '20.00',
      ratingAvg: '4.85',
      reviewsCount: 36,
    },
  ];

  for (const dt of k12DemoTeachers) {
    if (!userByEmail.has(dt.email)) {
      const [createdUser] = await db
        .insert(users)
        .values({
          email: dt.email,
          fullName: dt.fullName,
          emailVerified: true,
          accountStatus: 'ACTIVE',
          isDemo: true,
        })
        .returning();
      userByEmail.set(dt.email, createdUser.id);
      if (teacherRole) {
        await db.insert(userRoles).values({
          userId: createdUser.id,
          roleId: teacherRole.id,
        });
      }
      await db.insert(providerProfiles).values({
        userId: createdUser.id,
        providerType: 'TEACHER',
        headline: dt.headline,
        bio: dt.bio,
        qualifications: dt.qualifications,
        yearsExperience: dt.yearsExperience,
        hourlyRate: dt.hourlyRate,
        verificationStatus: 'VERIFIED',
        ratingAvg: dt.ratingAvg,
        reviewsCount: dt.reviewsCount,
      });
    }
  }

  const tariqId = userByEmail.get('tariq.teacher@demo.jusoor.edu');
  const laylaId = userByEmail.get('layla.mentor@demo.jusoor.edu'); // Note: has 0 published courses -> verifies no-course discovery!
  const omarId = userByEmail.get('omar.expert@demo.jusoor.edu');
  const ahmedId = userByEmail.get('ahmed.math@demo.jusoor.edu')!;
  const salmaId = userByEmail.get('salma.science@demo.jusoor.edu')!;
  const yasserId = userByEmail.get('yasser.arabic@demo.jusoor.edu')!;

  const findCurrSubj = (
    gradeSlug: string,
    subjectSlug: string,
    divCode?: string,
    pathCode?: string
  ) => {
    const gId = gradeMap.get(gradeSlug)!.id;
    const sId = subjectMap.get(subjectSlug)!;
    const dId = divCode ? divMap.get(divCode)!.id : null;
    const pId = pathCode ? pathMap.get(pathCode)!.id : null;
    return insertedCurriculumSubjects.find(
      (cs) =>
        cs.gradeId === gId &&
        cs.subjectId === sId &&
        cs.divisionId === dId &&
        cs.pathwayId === pId
    );
  };

  const assignmentsToSeed: Array<{
    teacherUserId: number;
    cs: typeof curriculumSubjects.$inferSelect | undefined;
    languages: string[];
    hourlyRate: string;
    supportsOnline: boolean;
    supportsInPerson: boolean;
    notes?: string;
  }> = [
    // Multiple teachers on Fourth Primary Mathematics (demonstrates prompt example + no-course teacher)
    { teacherUserId: ahmedId, cs: findCurrSubj('primary-4', 'eg-mathematics'), languages: ['ar', 'en'], hourlyRate: '22.00', supportsOnline: true, supportsInPerson: true, notes: 'تأسيس الرياضيات والكسور للصف الرابع (عربي ولغات)' },
    { teacherUserId: yasserId, cs: findCurrSubj('primary-4', 'eg-mathematics'), languages: ['ar'], hourlyRate: '18.00', supportsOnline: true, supportsInPerson: false, notes: 'تبسيط مسائل الرياضيات والعمليات الحسابية' },
    { teacherUserId: salmaId, cs: findCurrSubj('primary-4', 'eg-mathematics'), languages: ['en', 'ar'], hourlyRate: '24.00', supportsOnline: true, supportsInPerson: false, notes: 'تدريس Math لغات للصف الرابع الابتدائي' },
    ...(laylaId ? [{ teacherUserId: laylaId, cs: findCurrSubj('primary-4', 'eg-mathematics'), languages: ['ar', 'en'], hourlyRate: '30.00', supportsOnline: true, supportsInPerson: false, notes: 'جلسات إرشاد وتدريب عملي في الرياضيات التأسيسية' }] : []),

    // Fifth Primary Math & Science (one teacher teaches multiple grades/subjects)
    { teacherUserId: ahmedId, cs: findCurrSubj('primary-5', 'eg-mathematics'), languages: ['ar', 'en'], hourlyRate: '22.00', supportsOnline: true, supportsInPerson: true },
    { teacherUserId: salmaId, cs: findCurrSubj('primary-5', 'eg-science'), languages: ['ar', 'en'], hourlyRate: '25.00', supportsOnline: true, supportsInPerson: false },
    { teacherUserId: yasserId, cs: findCurrSubj('primary-4', 'eg-arabic'), languages: ['ar'], hourlyRate: '20.00', supportsOnline: true, supportsInPerson: true },

    // Preparatory Grade 3 Science & Math
    { teacherUserId: salmaId, cs: findCurrSubj('prep-3', 'eg-science'), languages: ['ar', 'en'], hourlyRate: '26.00', supportsOnline: true, supportsInPerson: false },
    { teacherUserId: ahmedId, cs: findCurrSubj('prep-3', 'eg-mathematics'), languages: ['ar', 'en'], hourlyRate: '25.00', supportsOnline: true, supportsInPerson: true },
    { teacherUserId: yasserId, cs: findCurrSubj('prep-3', 'eg-arabic'), languages: ['ar'], hourlyRate: '22.00', supportsOnline: true, supportsInPerson: false },

    // General Secondary Grade 2 Scientific Physics & Grade 3 Scientific Sciences Biology
    { teacherUserId: salmaId, cs: findCurrSubj('gen-sec-2', 'eg-physics', 'GEN_SEC_2_SCIENTIFIC'), languages: ['ar', 'en'], hourlyRate: '30.00', supportsOnline: true, supportsInPerson: false },
    { teacherUserId: salmaId, cs: findCurrSubj('gen-sec-3', 'eg-biology', 'GEN_SEC_3_SCI_BIO'), languages: ['ar', 'en'], hourlyRate: '35.00', supportsOnline: true, supportsInPerson: false },
    { teacherUserId: ahmedId, cs: findCurrSubj('gen-sec-3', 'eg-mathematics', 'GEN_SEC_3_SCI_MATH'), languages: ['ar', 'en'], hourlyRate: '32.00', supportsOnline: true, supportsInPerson: true },

    // Baccalaureate Grade 2 Engineering Programming & AI + Grade 3 Business Advanced Economics
    ...(tariqId ? [
      { teacherUserId: tariqId, cs: findCurrSubj('gen-sec-1', 'eg-programming-ai'), languages: ['ar', 'en'], hourlyRate: '35.00', supportsOnline: true, supportsInPerson: false },
      { teacherUserId: tariqId, cs: findCurrSubj('bacc-2', 'eg-programming-ai', undefined, 'BACC_2_ENG'), languages: ['ar', 'en'], hourlyRate: '38.00', supportsOnline: true, supportsInPerson: false },
    ] : []),
    ...(omarId ? [
      { teacherUserId: omarId, cs: findCurrSubj('bacc-2', 'eg-programming-ai', undefined, 'BACC_2_ENG'), languages: ['ar', 'en'], hourlyRate: '45.00', supportsOnline: true, supportsInPerson: true },
      { teacherUserId: omarId, cs: findCurrSubj('bacc-3', 'eg-economics-adv', undefined, 'BACC_3_BUS'), languages: ['ar', 'en'], hourlyRate: '45.00', supportsOnline: true, supportsInPerson: false },
    ] : []),
    ...(laylaId ? [
      { teacherUserId: laylaId, cs: findCurrSubj('bacc-3', 'eg-economics-adv', undefined, 'BACC_3_BUS'), languages: ['ar', 'en'], hourlyRate: '40.00', supportsOnline: true, supportsInPerson: false },
    ] : []),
  ];

  const validAssignmentRows = assignmentsToSeed
    .filter((a) => Boolean(a.cs))
    .map((a) => ({
      teacherUserId: a.teacherUserId,
      curriculumSubjectId: a.cs!.id,
      subjectId: a.cs!.subjectId,
      gradeId: a.cs!.gradeId,
      systemId: a.cs!.systemId,
      divisionId: a.cs!.divisionId,
      pathwayId: a.cs!.pathwayId,
      languagesOfferedJson: a.languages,
      hourlyRate: a.hourlyRate,
      currency: 'USD',
      supportsOnline: a.supportsOnline,
      supportsInPerson: a.supportsInPerson,
      notes: a.notes ?? null,
      isActive: true,
    }));

  if (validAssignmentRows.length > 0) {
    await db
      .insert(teacherTeachingAssignments)
      .values(validAssignmentRows)
      .onConflictDoNothing();
  }

  // 10. Seed sample curriculum-linked Individual & Group Teaching Sessions
  const daysFromNow = (days: number, hourUtc: number, minuteUtc = 0) => {
    const d = new Date(Date.now() + days * 86_400_000);
    d.setUTCHours(hourUtc, minuteUtc, 0, 0);
    return d;
  };

  const p4Math = findCurrSubj('primary-4', 'eg-mathematics');
  const p3Sci = findCurrSubj('prep-3', 'eg-science');
  const bacc2Ai = findCurrSubj('bacc-2', 'eg-programming-ai', undefined, 'BACC_2_ENG');

  const k12Sessions: Array<typeof teachingSessions.$inferInsert> = [];
  if (p4Math) {
    k12Sessions.push(
      {
        teacherUserId: ahmedId,
        subjectId: p4Math.subjectId,
        curriculumSubjectId: p4Math.id,
        gradeId: p4Math.gradeId,
        stageId: p4Math.stageId,
        sessionType: 'ONE_TO_ONE',
        title: 'حصة فردية: مراجعة الكسور والأعداد العشرية — الصف الرابع الابتدائي',
        description: 'شرح تفاعلي فردي لمفاهيم الرياضيات في المنهج المصري 2026/2027 مع حل تدريبات.',
        startTime: daysFromNow(5, 15, 0),
        endTime: daysFromNow(5, 16, 0),
        durationMinutes: 60,
        capacity: 1,
        minStudents: null,
        price: '22.00',
        deliveryMode: 'ONLINE',
        meetingUrl: 'https://meet.jusoor.example/p4-math-1on1',
        registrationDeadline: daysFromNow(4, 22, 0),
        status: 'OPEN',
        isDemo: true,
      },
      {
        teacherUserId: ahmedId,
        subjectId: p4Math.subjectId,
        curriculumSubjectId: p4Math.id,
        gradeId: p4Math.gradeId,
        stageId: p4Math.stageId,
        sessionType: 'GROUP',
        title: 'مجموعة تأسيس الرياضيات — الصف الرابع الابتدائي (عربي ولغات)',
        description: 'مجموعة صغيرة لحل نماذج الوزارة وتثبيت المهارات الحسابية الأساسية.',
        startTime: daysFromNow(7, 16, 0),
        endTime: daysFromNow(7, 17, 30),
        durationMinutes: 90,
        capacity: 12,
        minStudents: 3,
        price: '12.00',
        deliveryMode: 'ONLINE',
        meetingUrl: 'https://meet.jusoor.example/p4-math-group',
        registrationDeadline: daysFromNow(6, 22, 0),
        status: 'OPEN',
        isDemo: true,
      }
    );
  }
  if (p3Sci) {
    k12Sessions.push({
      teacherUserId: salmaId,
      subjectId: p3Sci.subjectId,
      curriculumSubjectId: p3Sci.id,
      gradeId: p3Sci.gradeId,
      stageId: p3Sci.stageId,
      sessionType: 'GROUP',
      title: 'مراجعة العلوم الشاملة — الشهادة الإعدادية (الصف الثالث الإعدادي)',
      description: 'تجارب تفاعلية وحل أسئلة الامتحانات في الكيمياء والوراثة والفيزياء.',
      startTime: daysFromNow(8, 17, 0),
      endTime: daysFromNow(8, 18, 30),
      durationMinutes: 90,
      capacity: 15,
      minStudents: 4,
      price: '14.00',
      deliveryMode: 'ONLINE',
      meetingUrl: 'https://meet.jusoor.example/prep3-science-group',
      registrationDeadline: daysFromNow(7, 22, 0),
      status: 'OPEN',
      isDemo: true,
    });
  }
  if (bacc2Ai && tariqId) {
    k12Sessions.push({
      teacherUserId: tariqId,
      subjectId: bacc2Ai.subjectId,
      curriculumSubjectId: bacc2Ai.id,
      gradeId: bacc2Ai.gradeId,
      stageId: bacc2Ai.stageId,
      sessionType: 'ONE_TO_ONE',
      title: 'حصة فردية: البرمجة والذكاء الاصطناعي — مسار الهندسة (البكالوريا المصرية)',
      description: 'بناء الخوارزميات ونماذج الذكاء الاصطناعي التمهيدية لطلاب الصف الثاني بالبكالوريا.',
      startTime: daysFromNow(10, 18, 0),
      endTime: daysFromNow(10, 19, 0),
      durationMinutes: 60,
      capacity: 1,
      minStudents: null,
      price: '38.00',
      deliveryMode: 'ONLINE',
      meetingUrl: 'https://meet.jusoor.example/bacc2-ai-1on1',
      registrationDeadline: daysFromNow(9, 22, 0),
      status: 'OPEN',
      isDemo: true,
    });
  }

  if (k12Sessions.length > 0) {
    await db.insert(teachingSessions).values(k12Sessions);
  }
}
