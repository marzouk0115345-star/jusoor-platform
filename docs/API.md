# جسور | JUSOOR — توثيق واجهات برمجة التطبيقات (REST API)

تعمل جميع نقاط النهاية تحت البادئة `/api`، وتُعيد بيانات JSON مع رموز حالة HTTP قياسية (`200`, `201`, `400`, `401`, `403`, `404`, `409`, `503`).

- **المصادقة**: عبر ترويسة `Authorization: Bearer <token>` (تُصدر عبر `scrypt` + HMAC-SHA256 أو عبر التحقق من Firebase ID Token).
- **الحماية**: يتم التحقق من الهوية (`requireAuth`) والأدوار (`requireRole`) وملكية المورد على الخادم في كل طلب محمي.

---

## 1. الصحة والتصنيفات العامة
| الطريقة | المسار | الوصف | الصلاحية |
| --- | --- | --- | --- |
| `GET` | `/api/health` | فحص جاهزية الخادم | عام |
| `GET` | `/api/taxonomy` | جلب المراحل التعليمية، المجالات، المواد، المهارات، تصنيفات المهام، والأدوار | عام |

---

## 2. المصادقة والملف الشخصي
| الطريقة | المسار | الوصف | الصلاحية |
| --- | --- | --- | --- |
| `GET` | `/api/auth/demo-accounts` | قائمة حسابات العرض التجريبية (`isDemo = true`) | عام |
| `POST` | `/api/auth/demo-login` | تسجيل دخول سريع لحساب عرض تجريبي حصراً | عام |
| `POST` | `/api/auth/register` | إنشاء حساب حقيقي جديد مع تجزئة كلمة المرور (`scrypt`) وتعيين الدور | عام |
| `POST` | `/api/auth/login` | تسجيل الدخول بالبريد وكلمة المرور | عام |
| `POST` | `/api/auth/google` | التحقق من Firebase Google ID Token وإنشاء/تسجيل المستخدم | عام |
| `POST` | `/api/auth/forgot-password` | طلب رمز استعادة كلمة المرور | عام |
| `POST` | `/api/auth/reset-password` | إعادة تعيين كلمة المرور بالرمز المؤقت | عام |
| `GET` | `/api/auth/me` | بيانات المستخدم الحالي والأدوار وعدد الإشعارات | مصادق |
| `PATCH` | `/api/profile` | تحديث الاسم والمرحلة والنبذة والأجر الساعي | مصادق |

---

## 3. الدورات، الدروس، الاختبارات، التكليفات، ومجموعات الدراسة
| الطريقة | المسار | الوصف | الصلاحية |
| --- | --- | --- | --- |
| `GET` | `/api/courses` | تصفح وتصفية الدورات (`q`, `fieldId`, `stageId`, `level`, `priceType`, `mine`) | عام / مصادق |
| `GET` | `/api/courses/:id` | تفاصيل الدورة؛ محتوى الدروس غير المجانية محجوب عن غير المشتركين | عام / مصادق |
| `POST` | `/api/courses` | إنشاء دورة جديدة مع الدروس | `TEACHER`, `MENTOR`, `EXPERT`, `CENTER_OWNER`, `CENTER_STAFF`, `ADMIN` |
| `PATCH` | `/api/courses/:id` | تعديل الدورة (المالك أو `ADMIN`) | مالك الدورة / `ADMIN` |
| `POST` | `/api/courses/:id/enroll` | التسجيل في الدورة وإنشاء سجل التقدم والدفع (`SANDBOX_PENDING` أو `GATEWAY_LIVE`) | مصادق |
| `POST` | `/api/courses/:id/lessons/:lessonId/complete` | إتمام درس وتحديث نسبة الإنجاز وإصدار الشهادة تلقائياً عند `100%` | مشترك بالدورة |
| `POST` | `/api/quizzes/:quizId/attempt` | إرسال إجابات الاختبار وتصحيحها على الخادم | مشترك بالدورة |
| `POST` | `/api/assignments/:assignmentId/submit` | تسليم حل التكليف | مشترك بالدورة |
| `POST` | `/api/courses/:id/reviews` | إضافة تقييم للدورة | مشترك بالدورة |
| `GET` | `/api/study-groups` | عرض مجموعات الدراسة | عام |
| `POST` | `/api/study-groups` | إنشاء مجموعة دراسة مرتبطة بدورة | مصادق |
| `POST` | `/api/study-groups/:id/join` | الانضمام إلى مجموعة دراسة | مصادق |

---

## 4. سوق المهام التعليمية (Core Marketplace Workflow)
| الطريقة | المسار | الوصف | الصلاحية |
| --- | --- | --- | --- |
| `GET` | `/api/tasks` | استعراض المهام مع البحث والتصفية (`q`, `status`, `fieldId`, `categoryId`, `mine`) | عام / مصادق |
| `GET` | `/api/tasks/:id` | تفاصيل المهمة، العروض المقدمة، المرفقات، المخرجات، وسجل التغييرات | عام / مصادق |
| `POST` | `/api/tasks` | نشر مهمة تعليمية جديدة بالحالة `OPEN` | مصادق |
| `POST` | `/api/tasks/:id/offers` | تقديم عرض على مهمة مفتوحة (يرفض العرض المكرر بـ `409`) | `TEACHER`, `MENTOR`, `EXPERT`, `ADMIN` |
| `POST` | `/api/tasks/:id/accept-offer/:offerId` | قبول عرض واحد بشكل ذري، رفض المنافسين، تسجيل الدفع والعمولة، وفتح محادثة مباشرة | صاحب المهمة فقط |
| `POST` | `/api/tasks/:id/status` | نقل الحالة (`IN_PROGRESS`, `DELIVERED`, `COMPLETED`, `CANCELLED`, `DISPUTED`) مع التحقق من الصلاحية والانتقالات | صاحب المهمة / المعلّم المعيّن / `ADMIN` |
| `POST` | `/api/tasks/:id/review` | تقييم المعلّم بعد اكتمال المهمة | صاحب المهمة فقط |

---

## 5. مقدّمو الخدمة والحجوزات والتفرغ
| الطريقة | المسار | الوصف | الصلاحية |
| --- | --- | --- | --- |
| `GET` | `/api/providers` | دليل المعلّمين والمرشدين والخبراء مع مواعيدهم المتاحة | عام |
| `GET` | `/api/availability/mine` | جلب جدول تفرغ مقدّم الخدمة | مصادق |
| `POST` | `/api/availability` | إضافة موعد تفرغ جديد | `TEACHER`, `MENTOR`, `EXPERT`, `ADMIN` |
| `GET` | `/api/bookings` | قائمة حجوزات الطالب أو مقدّم الخدمة مع بيانات الجلسة | مصادق |
| `POST` | `/api/bookings` | حجز موعد متاح بقفل ذري يمنع الحجز المزدوج (`409` عند التعارض) | مصادق |
| `PATCH` | `/api/bookings/:id/status` | تأكيد أو إعادة جدولة أو إلغاء أو إتمام الحجز | أطراف الحجز / `ADMIN` |

---

## 5.ب نظام الجلسات الفردية والجماعية (Individual & Group Lesson Booking)
| الطريقة | المسار | الوصف | الصلاحية |
| --- | --- | --- | --- |
| `GET` | `/api/teaching-sessions` | استعراض الجلسات الفردية (`ONE_TO_ONE`) والجماعية (`GROUP`) مع تصفية اختيارية عبر `curriculumSubjectId` و`gradeId` و`subjectId` و`teacherId` و`sessionType` و`status`، وحجب `meetingUrl`/العنوان التفصيلي إلا للمدرّب أو الطالب المقبول أو المدير | عام / مصادق |
| `GET` | `/api/teaching-sessions/mine` | جلب جلسات المدرّب وجدول تفرغه الأسبوعي | `TEACHER`, `MENTOR`, `EXPERT`, `ADMIN` |
| `GET` | `/api/teaching-sessions/teacher/requests` | قائمة طلبات الحجز/التسجيل الواردة للمدرّب مع تصفية حسب النوع والحالة والمادة والتاريخ وبيانات الطالب العامة المصرح بها | `TEACHER`, `MENTOR`, `EXPERT`, `ADMIN` |
| `GET` | `/api/teaching-sessions/:id` | تفاصيل جلسة محددة مع قائمة المسجلين لصاحب الجلسة | عام / مصادق |
| `POST` | `/api/teaching-sessions` | إنشاء موعد فردي (`capacity = 1`) أو جلسة جماعية مع دعم الربط المباشر بالمادة المنهجية (`curriculumSubjectId`) والصف (`gradeId`) ومنع تداخل المواعيد | `TEACHER`, `MENTOR`, `EXPERT`, `ADMIN` |
| `PATCH` | `/api/teaching-sessions/:id` | تعديل بيانات الجلسة وفق قيود السعة والحالة ومنع التعارض الزمني والربط المنهجي | مالك الجلسة / `ADMIN` |
| `POST` | `/api/teaching-sessions/:id/cancel` | إلغاء الجلسة وإلغاء الطلبات النشطة وإشعار الطلاب | مالك الجلسة / `ADMIN` |
| `POST` | `/api/teaching-sessions/:id/complete` | تحديد الجلسة كمكتملة | مالك الجلسة / `ADMIN` |
| `GET` | `/api/teaching-sessions/:id/students` | قائمة الطلاب المقبولين في الجلسة (بيانات عامة مصرح بها فقط) | مالك الجلسة / `ADMIN` |
| `POST` | `/api/teaching-sessions/:id/enroll` | تقديم طلب حجز/انضمام (`PENDING`) مع منع التكرار والحجز الذاتي والتحقق الذري من فتح التسجيل | مصادق |
| `GET` | `/api/session-enrollments/mine` | طلبات وحجوزات الطالب في الجلسات الفردية والجماعية | مصادق |
| `POST` | `/api/session-enrollments/:enrollmentId/accept` | قبول الطلب بقفل صف الجلسة (`FOR UPDATE`)؛ يغلق الجلسة الفردية ويرفض المنافسين، ويحدّث سعة الجماعية تلقائياً إلى `FULL` عند الامتلاء | مالك الجلسة / `ADMIN` |
| `POST` | `/api/session-enrollments/:enrollmentId/reject` | رفض طلب معلق أو إلغاء قبول وإعادة فتح السعة (`FULL -> OPEN`) عند اللزوم | مالك الجلسة / `ADMIN` |
| `POST` | `/api/session-enrollments/:enrollmentId/cancel` | إلغاء الطالب لطلبه أو حجزه وإعادة فتح السعة (`FULL -> OPEN`) مع إشعار المدرّب | صاحب الطلب / `ADMIN` |
| `GET` | `/api/teacher-availability/mine` | جلب جدول التفرغ الأسبوعي المتكرر للمدرّب | `TEACHER`, `MENTOR`, `EXPERT`, `ADMIN` |
| `PUT` | `/api/teacher-availability` | حفظ/تحديث جدول التفرغ الأسبوعي مع منع تداخل الفترات في نفس اليوم | `TEACHER`, `MENTOR`, `EXPERT`, `ADMIN` |

---

## 6. المراكز التعليمية والمدرّبون والتطوير المهني
| الطريقة | المسار | الوصف | الصلاحية |
| --- | --- | --- | --- |
| `GET` | `/api/centers` | استعراض المراكز التعليمية المعتمدة ودوراتها وطاقمها مع المسميات الوظيفية (`jobTitle`) | عام / مصادق |
| `POST` | `/api/centers` | إنشاء مركز تعليمي جديد | `CENTER_OWNER`, `ADMIN` |
| `POST` | `/api/centers/:id/members` | إضافة عضو/مدرّب للمركز مع إلزامية المسمى الوظيفي (`jobTitle`) والصلاحيات | مالك المركز / مدير مفوّض / `ADMIN` |
| `PATCH` | `/api/centers/:id/members/:memberId` | تعديل المسمى الوظيفي (`jobTitle`) أو الدور لعضو في المركز | مالك المركز / مدير مفوّض / `ADMIN` |
| `GET` | `/api/instructors/:instructorId` | الملف العام للمدرّب (السيرة الذاتية `bio`، المسمى الوظيفي، الانتماءات، المواد والصفوف المنهجية `teachingAssignments`، الجلسات المتاحة، والدورات المنشورة فقط `PUBLISHED`) | عام |
| `PUT` | `/api/instructors/me/bio` | تحديث النبذة التعريفية (`bio`) للمدرّب الحالي | مدرّب / مقدم خدمة |
| `PATCH` | `/api/instructors/:instructorId/bio` | تحديث النبذة التعريفية للمدرّب (يرفض تعديل ملف مدرّب آخر بـ `403`) | صاحب الملف فقط |
| `GET` | `/api/prof-dev/me` | جلب السيرة الذاتية، معرض الأعمال، المهارات، الشهادات، وجواز المهارات | مصادق |
| `PUT` | `/api/prof-dev/cv` | إنشاء أو تحديث السيرة الذاتية | مصادق |
| `POST` | `/api/prof-dev/portfolio` | إضافة مشروع لمعرض الأعمال | مصادق |
| `DELETE` | `/api/prof-dev/portfolio/:id` | حذف مشروع من معرض الأعمال (للمالك فقط) | مالك العمل |
| `POST` | `/api/prof-dev/skills` | إضافة أو تحديث مهارة ومستواها | مصادق |

---

## 6.ب المراحل التعليمية والمناهج المصرية وتعيينات المعلّمين (2026/2027)
| الطريقة | المسار | الوصف | الصلاحية |
| --- | --- | --- | --- |
| `GET` | `/api/curriculum/overview` | جلب شجرة التعليم العام المصري (السنوات الدراسية، النسخ، المراحل الثلاث، الأنظمة الأربعة، الصفوف، الشعب، ومسارات البكالوريا) | عام |
| `GET` | `/api/curriculum/academic-years` | السنوات الدراسية المفعّلة | عام |
| `GET` | `/api/curriculum/stages` | مراحل التعليم العام (الابتدائية، الإعدادية، الثانوية) | عام |
| `GET` | `/api/curriculum/systems` | الأنظمة التعليمية (`PRIMARY_GENERAL`, `PREPARATORY_GENERAL`, `GENERAL_SECONDARY`, `EGYPTIAN_BACCALAUREATE`) | عام |
| `GET` | `/api/curriculum/grades` | الصفوف الدراسية مع تصفية بـ `systemId` أو `stageId` | عام |
| `GET` | `/api/curriculum/divisions` | شعب الثانوية العامة مع تصفية بـ `gradeId` أو `systemId` | عام |
| `GET` | `/api/curriculum/pathways` | مسارات البكالوريا المصرية مع تصفية بـ `gradeId` أو `systemId` | عام |
| `GET` | `/api/curriculum/subjects` | مواد الصف/الشعبة/المسار (`gradeId`, `divisionId`, `pathwayId`, `category`, `q`, `versionId`) مع التحقق الصارم من توافق التركيبة (`400` للتركيبات غير الصالحة) وإرجاع عدد المعلّمين والجلسات | عام |
| `GET` | `/api/curriculum/subjects/:curriculumSubjectId/teachers` | المعلّمون المعيّنون للمادة المنهجية (يدعم M:N والمعلّمين بدون دورات منشورة) مع تصفية `q`, `deliveryMode`, `language`, `religiousVariant`, `hasSessions`, `sort`, `page`, `limit` وجلساتهم المتاحة | عام / مصادق |
| `GET` | `/api/teaching-assignments/mine` | جلب تعيينات المعلّم للمواد والصفوف المنهجية | `TEACHER`, `MENTOR`, `EXPERT`, `ADMIN` |
| `POST` | `/api/teaching-assignments/mine` | إضافة/تحديث تعيين معلّم لمادة وصف منهجي (`curriculumSubjectId`, `languagesOffered`, `religiousVariant`, `hourlyRate`, `supportsOnline`, `supportsInPerson`) | `TEACHER`, `MENTOR`, `EXPERT`, `ADMIN` |
| `PATCH` | `/api/teaching-assignments/mine/:id` | تعديل بيانات تعيين يملكه المعلّم | مالك التعيين / `ADMIN` |
| `DELETE` | `/api/teaching-assignments/mine/:id` | حذف تعيين يملكه المعلّم | مالك التعيين / `ADMIN` |

---

## 7. المحادثات، الإشعارات، المالية، البلاغات، والمستشار الذكي
| الطريقة | المسار | الوصف | الصلاحية |
| --- | --- | --- | --- |
| `GET` | `/api/dashboard` | إحصائيات وبيانات لوحة التحكم المخصصة حسب الدور | مصادق |
| `GET` | `/api/conversations` | محادثات المستخدم الحالي فقط | مصادق |
| `POST` | `/api/conversations` | بدء محادثة جديدة مع مستخدم آخر | مصادق |
| `GET` | `/api/conversations/:id/messages` | رسائل المحادثة (`403` لغير الأعضاء) | عضو المحادثة |
| `POST` | `/api/conversations/:id/messages` | إرسال رسالة (`403` لغير الأعضاء) | عضو المحادثة |
| `GET` | `/api/notifications` | قائمة الإشعارات | مصادق |
| `PATCH` | `/api/notifications/:id/read` | تعليم الإشعار كمقروء | مصادق |
| `GET` | `/api/payments/me` | سجل المدفوعات والأرباح الصافية وحالة بوابة الدفع | مصادق |
| `POST` | `/api/reports` | تقديم بلاغ على دورة أو مهمة أو مستخدم أو تقييم | مصادق |
| `GET` | `/api/assistant/status` | حالة جاهزية Gemini API على الخادم | عام |
| `GET` | `/api/assistant/roadmaps` | خرائط التعلّم والتوصيات المحفوظة للمستخدم | مصادق |
| `POST` | `/api/assistant/analyze` | تشخيص الفجوة واقتراح الحل الأنسب عبر `@google/genai` (أو `503` إن لم يُضبط `GEMINI_API_KEY`) | مصادق |

---

## 8. لوحة إدارة المنصة وإدارة المناهج (`ADMIN` فقط)
| الطريقة | المسار | الوصف |
| --- | --- | --- |
| `GET` | `/api/admin/overview` | مؤشرات المنصة وإعدادات العمولة |
| `GET` | `/api/admin/users` | قائمة المستخدمين وأدوارهم وحالاتهم |
| `PATCH` | `/api/admin/users/:id/status` | تفعيل أو إيقاف حساب مستخدم |
| `PATCH` | `/api/admin/users/:id/roles` | تعديل أدوار المستخدم |
| `GET` | `/api/admin/moderation` | مقدمو الخدمة والمراكز والبلاغات والمدفوعات |
| `PATCH` | `/api/admin/providers/:userId/verify` | توثيق أو رفض حساب مقدم خدمة |
| `PATCH` | `/api/admin/centers/:centerId/verify` | توثيق أو رفض مركز تعليمي |
| `PATCH` | `/api/admin/reports/:reportId` | معالجة أو إغلاق بلاغ |
| `POST` | `/api/admin/taxonomy/fields` | إضافة مجال تعليمي جديد ديناميكياً |
| `POST` | `/api/admin/taxonomy/stages` | إضافة مرحلة تعليمية جديدة ديناميكياً |
| `POST` | `/api/admin/taxonomy/subjects` | إضافة مادة تعليمية جديدة ديناميكياً |
| `POST` | `/api/admin/taxonomy/skills` | إضافة مهارة جديدة ديناميكياً |
| `PUT` | `/api/admin/settings` | تحديث إعدادات المنصة (مثل `commission_rate_percent`) |
| `GET` | `/api/admin/curriculum/all` | جلب الهيكل الكامل للمناهج والنسخ والسنوات والمواد المنهجية وتعيينات المعلّمين |
| `POST` / `PATCH` | `/api/admin/curriculum/academic-years` / `:id` | إنشاء أو تعديل السنة الدراسية وتفعيل السنة الحالية |
| `POST` / `PATCH` | `/api/admin/curriculum/versions` / `:id` | إنشاء أو تعديل وتفعيل/نشر نسخة المنهج |
| `POST` | `/api/admin/curriculum/versions/:id/copy` | استنساخ نسخة منهج كاملة بجميع موادها إلى سنة دراسية أخرى داخل معاملة ذرية |
| `POST` / `PATCH` | `/api/admin/curriculum/stages` / `systems` / `grades` / `divisions` / `pathways` | إدارة هرمية المراحل والأنظمة والصفوف والشعب والمسارات |
| `POST` / `PATCH` | `/api/admin/curriculum/subjects` / `:id` | إدارة المواد الرئيسية المرجعية |
| `POST` / `PATCH` / `DELETE` | `/api/admin/curriculum/curriculum-subjects` / `:id` | ربط المواد بالصفوف/الشعب/المسارات وضبط الإلزامية والمجموع ونسبة النجاح واللغات |
| `POST` / `PATCH` / `DELETE` | `/api/admin/curriculum/assignments` / `:id` | إدارة تعيينات المعلّمين على المواد المنهجية (M:N) وتفعيلها/تعطيلها |

