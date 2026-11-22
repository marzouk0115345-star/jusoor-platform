# جسور | JUSOOR — منصة التعليم والتطوير المهني

> **جسور تربطك بالتعلّم والفرص** · *From Knowledge to Opportunities*

منصة تعليمية وتطوير مهني متكاملة (Full-Stack) تربط المتعلّمين بالمعلّمين، والمرشدين، والخبراء، والمراكز التعليمية عبر الدورات التطبيقية، وسوق المهام التعليمية، وحجوزات الإرشاد والاستشارات، وبناء الملف المهني والسيرة الذاتية، والتشخيص الذكي للاحتياج الفعلي.

---

## المعمارية والتقنيات

- **الواجهة الأمامية**: React 19 + TypeScript + Vite + Tailwind CSS v4 + React Router (RTL عربي أصيل مع خطوط `Cairo`, `IBM Plex Sans Arabic`, `IBM Plex Mono`).
- **الخادم الخلفي**: Express.js (`server.ts`) مع مصادقة هجينة (`scrypt` + HMAC-SHA256 Bearer Tokens + التحقق من Firebase Google Sign-In).
- **قاعدة البيانات**: Cloud SQL (PostgreSQL) عبر Drizzle ORM (`src/db/schema.ts` — 53 جدولاً مطبّعاً).
  - **ملاحظة حول MySQL**: توفّر بيئة Cloud SQL في هذه المنصة محرك PostgreSQL المدار تلقائياً، لذا يعمل التطبيق حياً على PostgreSQL عبر Drizzle ORM مع توفير ملف DDL مرجعي مطابق بالكامل لـ MySQL 8.0+ في `docs/mysql_reference_schema.sql`.
- **الذكاء الاصطناعي**: طبقة تكامل `@google/genai` على الخادم (`src/server/ai.ts`) باستخدام `gemini-4-hydrogen` لتحليل فجوات المتعلّمين وتقديم خرائط تعلّم مرتبطة بدورات ومقدّمي خدمة فعليين.

---

## الوحدات والوثائق

- **مخطط قاعدة البيانات (53 جدولاً)**: `docs/ERD.md`
- **مرجع MySQL DDL**: `docs/mysql_reference_schema.sql`
- **توثيق REST API**: `docs/API.md`

---

## التشغيل والإعداد المحلي

### 1. متطلبات البيئة
انسخ ملف `.env.example` إلى `.env` واضبط المتغيرات اللازمة:
- `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD` (تُحقن تلقائياً في بيئة Cloud SQL المُدارة).
- `SESSION_SECRET`: مفتاح عشوائي طويل لتوقيع رموز الجلسة.
- `GEMINI_API_KEY`: لتفعيل المستشار الذكي الحقيقي عبر Gemini API.
- `PAYMENT_PROVIDER_KEY`: لتفعيل بوابة الدفع الحية (يعمل النظام بوضع `SANDBOX_PENDING` حتى إضافته).

### 2. تثبيت الاعتمادات وبناء الجداول وتعبئة البيانات الأولية
```bash
npm install
npx drizzle-kit push --config=src/db/drizzle.config.ts
npx tsx src/server/seed.ts
```

### 3. التشغيل للتطوير والإنتاج
```bash
# وضع التطوير (Express + Vite على المنفذ 3000)
npm run dev

# بناء الإنتاج والتشغيل
npm run build
npm start
```

### 4. الاختبارات وفحص الجودة
```bash
# فحص الأنواع (TypeScript)
npm run lint

# اختبارات منطق النطاق الصافي (state machine, commission math, quiz grading, RBAC)
npm test

# اختبارات التكامل الكاملة مع قاعدة البيانات والخادم الحي (أثناء تشغيل الخادم على 3000)
npx tsx --test src/server/api.integration.test.ts
```

---

## حسابات العرض التجريبية (Demo Personas)

تتوفر حسابات عرض تجريبية موسومة بـ `isDemo: true` في نافذة تسجيل الدخول للتجربة السريعة عبر كل الأدوار (`STUDENT`, `TEACHER`, `MENTOR`, `EXPERT`, `CENTER_OWNER`, `CENTER_STAFF`, `ADMIN`) دون المساس بأمان الحسابات الحقيقية.

---

## الاعتمادات والخدمات الخارجية المتبقية للإطلاق الفعلي

1. **مفتاح بوابة الدفع (`PAYMENT_PROVIDER_KEY` / Stripe / HyperPay / Moyasar)**: لإتمام التحصيل المالي الفعلي وإطلاق المدفوعات بدلاً من وضع `SANDBOX_PENDING`.
2. **خدمة إرسال البريد الإلكتروني (SMTP / Resend / SendGrid)**: لإرسال روابط تأكيد البريد الإلكتروني وإعادة تعيين كلمة المرور فعلياً للمستخدمين الجدد.
3. **مفتاح `GEMINI_API_KEY` الإنتاجي** (إن لم يكن محقوناً في بيئة الاستضافة): لتشغيل تشخيص المستشار الذكي في الإنتاج.
4. **خدمة تخزين ملفات سحابية (Cloud Storage / S3)** ومكالمات فيديو حية (WebRTC / LiveKit / Zoom SDK): لرفع المرفقات الكبيرة واستضافة غرف الجلسات المباشرة.
