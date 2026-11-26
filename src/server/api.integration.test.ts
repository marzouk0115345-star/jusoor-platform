import test from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:3000/api';

async function api(
  path: string,
  opts: { method?: string; token?: string; body?: unknown } = {}
) {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test('JUSOOR end-to-end API & RBAC integration suite', async () => {
  const suffix = Date.now();
  const studentEmail = `qa.student.${suffix}@jusoor.test`;
  const teacherEmail = `qa.teacher.${suffix}@jusoor.test`;
  const password = 'JusoorTestPassword123!';

  // 1. Health & taxonomy
  const health = await api('/health');
  assert.equal(health.status, 200);
  assert.equal(health.data.ok, true);

  const taxonomy = await api('/taxonomy');
  assert.equal(taxonomy.status, 200);
  assert.ok(taxonomy.data.fields.length >= 10);
  assert.ok(taxonomy.data.stages.length >= 7);
  assert.ok(taxonomy.data.taskCategories.length >= 1);

  const firstFieldId: number = taxonomy.data.fields[0].id;
  const firstStageId: number = taxonomy.data.stages[0].id;
  const firstCategoryId: number = taxonomy.data.taskCategories[0].id;

  // 2. Unauthenticated & invalid credentials checks
  const unauthMe = await api('/auth/me');
  assert.equal(unauthMe.status, 401);

  const badLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: 'nonexistent@jusoor.test', password: 'wrong' },
  });
  assert.equal(badLogin.status, 401);

  // 3. Register Student & Teacher
  const regStudent = await api('/auth/register', {
    method: 'POST',
    body: {
      email: studentEmail,
      password,
      fullName: 'طالب اختبار تكاملي',
      primaryRole: 'STUDENT',
      stageId: firstStageId,
    },
  });
  assert.equal(regStudent.status, 201);
  const studentToken: string = regStudent.data.token;
  assert.ok(studentToken);

  const loginStudent = await api('/auth/login', {
    method: 'POST',
    body: { email: studentEmail, password },
  });
  assert.equal(loginStudent.status, 200);

  const regTeacher = await api('/auth/register', {
    method: 'POST',
    body: {
      email: teacherEmail,
      password,
      fullName: 'معلّم اختبار تكاملي',
      primaryRole: 'TEACHER',
      headline: 'مدرّس اختبار جودة',
    },
  });
  assert.equal(regTeacher.status, 201);
  const teacherToken: string = regTeacher.data.token;

  // 4. RBAC check: student blocked from admin endpoint (403), demo admin allowed (200)
  const forbiddenAdmin = await api('/admin/overview', { token: studentToken });
  assert.equal(forbiddenAdmin.status, 403);

  const demoAccounts = await api('/auth/demo-accounts');
  assert.equal(demoAccounts.status, 200);
  const adminDemo = demoAccounts.data.demoAccounts.find((a: { roles: string[] }) =>
    a.roles.includes('ADMIN')
  );
  assert.ok(adminDemo, 'Admin demo account should exist');

  const adminLogin = await api('/auth/demo-login', {
    method: 'POST',
    body: { email: adminDemo.email },
  });
  assert.equal(adminLogin.status, 200);
  const adminToken: string = adminLogin.data.token;

  const adminOverview = await api('/admin/overview', { token: adminToken });
  assert.equal(adminOverview.status, 200);
  assert.ok(adminOverview.data.stats.usersCount >= 7);

  // 5. Course listing, lesson gating, enrollment & progress
  const coursesList = await api('/courses');
  assert.equal(coursesList.status, 200);
  assert.ok(coursesList.data.courses.length >= 1);
  const targetCourse =
    coursesList.data.courses.find(
      (c: { isDemo?: boolean; lessonsCount: number }) =>
        c.isDemo && c.lessonsCount >= 2
    ) || coursesList.data.courses[0];
  const targetCourseId: number = targetCourse.id;

  const gatedDetail = await api(`/courses/${targetCourseId}`, {
    token: studentToken,
  });
  assert.equal(gatedDetail.status, 200);
  const lockedLessons = gatedDetail.data.lessons.filter(
    (l: { unlocked: boolean }) => !l.unlocked
  );
  assert.ok(lockedLessons.length >= 1, 'Non-enrolled student should see locked lessons');

  const enrollRes = await api(`/courses/${targetCourseId}/enroll`, {
    method: 'POST',
    token: studentToken,
  });
  assert.equal(enrollRes.status, 201);

  const unlockedDetail = await api(`/courses/${targetCourseId}`, {
    token: studentToken,
  });
  assert.equal(unlockedDetail.status, 200);
  assert.ok(unlockedDetail.data.lessons.every((l: { unlocked: boolean }) => l.unlocked));

  const firstLessonId = unlockedDetail.data.lessons[0].id;
  const completeLessonRes = await api(
    `/courses/${targetCourseId}/lessons/${firstLessonId}/complete`,
    { method: 'POST', token: studentToken }
  );
  assert.equal(completeLessonRes.status, 200);
  assert.ok(completeLessonRes.data.progress.completionPercent > 0);

  if (unlockedDetail.data.quizzes.length > 0) {
    const qz = unlockedDetail.data.quizzes[0];
    const answers = qz.questions.map(
      (q: { id: number; answers: Array<{ id: number }> }) => ({
        questionId: q.id,
        selectedAnswerId: q.answers[0].id,
      })
    );
    const quizRes = await api(`/quizzes/${qz.id}/attempt`, {
      method: 'POST',
      token: studentToken,
      body: { answers },
    });
    assert.equal(quizRes.status, 201);
    assert.equal(typeof quizRes.data.attempt.score, 'number');
  }

  // 6. Educational Tasks Marketplace full lifecycle + atomic double-accept guard
  const createTaskRes = await api('/tasks', {
    method: 'POST',
    token: studentToken,
    body: {
      title: `مهمة اختبار متكاملة ${suffix}`,
      description: 'أحتاج مساعدة عملية في مراجعة مشروع برمجي وتنظيم قواعد البيانات.',
      categoryId: firstCategoryId,
      fieldId: firstFieldId,
      stageId: firstStageId,
      requiredSkills: 'TypeScript, PostgreSQL',
      budget: 55,
      expectedDuration: '3 أيام',
      preferredMethod: 'ONLINE',
      deadline: '2099-12-30',
    },
  });
  assert.equal(createTaskRes.status, 201);
  const taskId: number = createTaskRes.data.task.id;

  const submitOfferRes = await api(`/tasks/${taskId}/offers`, {
    method: 'POST',
    token: teacherToken,
    body: {
      proposal: 'سأقوم بمراجعة المشروع معك خطوة بخطوة وتوضيح تحسينات البنية والأداء.',
      proposedPrice: 50,
      expectedDuration: 'يومان',
      deliveryMethod: 'ONLINE',
    },
  });
  assert.equal(submitOfferRes.status, 201);
  const offerId: number = submitOfferRes.data.offer.id;

  // Duplicate offer by same teacher should be rejected (409)
  const dupOfferRes = await api(`/tasks/${taskId}/offers`, {
    method: 'POST',
    token: teacherToken,
    body: {
      proposal: 'عرض مكرر لا ينبغي قبوله من النظام مطلقاً.',
      proposedPrice: 45,
      expectedDuration: 'يوم',
      deliveryMethod: 'ONLINE',
    },
  });
  assert.equal(dupOfferRes.status, 409);

  // Student accepts offer -> OFFER_ACCEPTED
  const acceptRes = await api(`/tasks/${taskId}/accept-offer/${offerId}`, {
    method: 'POST',
    token: studentToken,
  });
  assert.equal(acceptRes.status, 200);
  assert.equal(acceptRes.data.task.status, 'OFFER_ACCEPTED');

  // Second accept attempt must be blocked (409)
  const secondAcceptRes = await api(`/tasks/${taskId}/accept-offer/${offerId}`, {
    method: 'POST',
    token: studentToken,
  });
  assert.equal(secondAcceptRes.status, 409);

  // Teacher moves task IN_PROGRESS -> DELIVERED
  const inProgressRes = await api(`/tasks/${taskId}/status`, {
    method: 'POST',
    token: teacherToken,
    body: { toStatus: 'IN_PROGRESS', note: 'بدء العمل' },
  });
  assert.equal(inProgressRes.status, 200);

  const deliveredRes = await api(`/tasks/${taskId}/status`, {
    method: 'POST',
    token: teacherToken,
    body: {
      toStatus: 'DELIVERED',
      deliverableSummary: 'تم تسليم خطة التحسين الكاملة ومراجعة الكود.',
      deliverableUrl: 'https://example.com/deliverable',
    },
  });
  assert.equal(deliveredRes.status, 200);

  // Student completes & reviews
  const completedRes = await api(`/tasks/${taskId}/status`, {
    method: 'POST',
    token: studentToken,
    body: { toStatus: 'COMPLETED' },
  });
  assert.equal(completedRes.status, 200);

  const reviewRes = await api(`/tasks/${taskId}/review`, {
    method: 'POST',
    token: studentToken,
    body: { rating: 5, comment: 'تجربة تعليمية ممتازة وتوجيه عملي دقيق.' },
  });
  assert.equal(reviewRes.status, 201);

  // 7. Booking atomic double-booking prevention & cancel
  const slotRes = await api('/availability', {
    method: 'POST',
    token: teacherToken,
    body: {
      dayOfWeek: 'الاثنين',
      slotDate: '2099-12-15',
      startTime: '14:00',
      endTime: '15:00',
      serviceType: 'MENTORSHIP',
    },
  });
  assert.equal(slotRes.status, 201);
  const slotId: number = slotRes.data.slot.id;

  const bookRes = await api('/bookings', {
    method: 'POST',
    token: studentToken,
    body: { availabilityId: slotId, topic: 'مراجعة مشروع التخرج' },
  });
  assert.equal(bookRes.status, 201);
  const bookingId: number = bookRes.data.booking.id;

  const doubleBookRes = await api('/bookings', {
    method: 'POST',
    token: studentToken,
    body: { availabilityId: slotId, topic: 'محاولة حجز مكرر' },
  });
  assert.equal(doubleBookRes.status, 409);

  const cancelBookRes = await api(`/bookings/${bookingId}/status`, {
    method: 'PATCH',
    token: studentToken,
    body: { status: 'CANCELLED', cancellationReason: 'تغيير الموعد' },
  });
  assert.equal(cancelBookRes.status, 200);
  assert.equal(cancelBookRes.data.booking.status, 'CANCELLED');

  // 8. Messaging privacy boundary (non-member receives 403)
  const studentConvs = await api('/conversations', { token: studentToken });
  assert.equal(studentConvs.status, 200);
  assert.ok(studentConvs.data.conversations.length >= 1);
  const convId: number = studentConvs.data.conversations[0].id;

  const outsiderAccess = await api(`/conversations/${convId}/messages`, {
    token: adminToken,
  });
  assert.equal(outsiderAccess.status, 403);

  const memberMsg = await api(`/conversations/${convId}/messages`, {
    method: 'POST',
    token: studentToken,
    body: { body: 'شكراً لك على الشرح الواضح!' },
  });
  assert.equal(memberMsg.status, 201);

  // 9. AI Assistant honest configuration check
  const aiStatus = await api('/assistant/status');
  assert.equal(aiStatus.status, 200);
  if (!aiStatus.data.configured) {
    const aiRes = await api('/assistant/analyze', {
      method: 'POST',
      token: studentToken,
      body: {
        goal: 'أعرف HTML و CSS و JavaScript ولا أستطيع العمل على مشاريع شركة حقيقية',
      },
    });
    assert.equal(aiRes.status, 503);
    assert.equal(aiRes.data.code, 'AI_PROVIDER_NOT_CONFIGURED');
  }

  // 10. Scenario 1 & 4: Center Staff Job Title / Specialization & Cross-Center Authorization
  const ownerAEmail = `qa.ownerA.${suffix}@jusoor.test`;
  const ownerBEmail = `qa.ownerB.${suffix}@jusoor.test`;
  const teacherBEmail = `qa.teacherB.${suffix}@jusoor.test`;

  const regOwnerA = await api('/auth/register', {
    method: 'POST',
    body: {
      email: ownerAEmail,
      password,
      fullName: 'صاحب مركز أ',
      primaryRole: 'CENTER_OWNER',
    },
  });
  assert.equal(regOwnerA.status, 201);
  const ownerAToken: string = regOwnerA.data.token;

  const regOwnerB = await api('/auth/register', {
    method: 'POST',
    body: {
      email: ownerBEmail,
      password,
      fullName: 'صاحب مركز ب',
      primaryRole: 'CENTER_OWNER',
    },
  });
  assert.equal(regOwnerB.status, 201);
  const ownerBToken: string = regOwnerB.data.token;

  const regTeacherB = await api('/auth/register', {
    method: 'POST',
    body: {
      email: teacherBEmail,
      password,
      fullName: 'مدرّب ب اختباري',
      primaryRole: 'TEACHER',
      headline: 'مدرّس فيزياء',
    },
  });
  assert.equal(regTeacherB.status, 201);
  const teacherBToken: string = regTeacherB.data.token;
  const teacherAId: number = regTeacher.data.user.id;
  const teacherBId: number = regTeacherB.data.user.id;

  const createCenterA = await api('/centers', {
    method: 'POST',
    token: ownerAToken,
    body: {
      name: `أكاديمية التميز ${suffix}`,
      description: 'مركز تعليمي متخصص في الرياضيات والبرمجة والمهارات التطبيقية.',
      city: 'الرياض',
      country: 'السعودية',
    },
  });
  assert.equal(createCenterA.status, 201);
  const centerAId: number = createCenterA.data.center.id;

  const createCenterB = await api('/centers', {
    method: 'POST',
    token: ownerBToken,
    body: {
      name: `معهد الابتكار ${suffix}`,
      description: 'معهد تدريبي مستقل لاختبار حدود الصلاحيات بين المراكز.',
      city: 'دبي',
      country: 'الإمارات',
    },
  });
  assert.equal(createCenterB.status, 201);
  const centerBId: number = createCenterB.data.center.id;

  // Missing/short jobTitle must fail validation (400)
  const missingJobTitleRes = await api(`/centers/${centerAId}/members`, {
    method: 'POST',
    token: ownerAToken,
    body: {
      email: teacherEmail,
      memberRole: 'INSTRUCTOR',
      jobTitle: ' ',
      permissions: ['MANAGE_COURSES'],
    },
  });
  assert.equal(missingJobTitleRes.status, 400);

  // Add Teacher A to Center A with custom job title "Mathematics Teacher"
  const addMemberARes = await api(`/centers/${centerAId}/members`, {
    method: 'POST',
    token: ownerAToken,
    body: {
      email: teacherEmail,
      memberRole: 'INSTRUCTOR',
      jobTitle: 'Mathematics Teacher',
      permissions: ['MANAGE_COURSES'],
    },
  });
  assert.equal(addMemberARes.status, 201);
  const memberAId: number = addMemberARes.data.member.id;
  assert.equal(addMemberARes.data.member.jobTitle, 'Mathematics Teacher');
  assert.equal(addMemberARes.data.member.memberRole, 'INSTRUCTOR');

  // Add same Teacher A to Center B with a DIFFERENT job title to verify per-center membership scoping
  const addMemberToBRes = await api(`/centers/${centerBId}/members`, {
    method: 'POST',
    token: ownerBToken,
    body: {
      email: teacherEmail,
      memberRole: 'STAFF',
      jobTitle: 'Academic Coordinator',
      permissions: ['VIEW_ENROLLMENTS'],
    },
  });
  assert.equal(addMemberToBRes.status, 201);
  assert.equal(addMemberToBRes.data.member.jobTitle, 'Academic Coordinator');

  // Edit Member A's job title in Center A -> "Senior Mathematics Teacher"
  const editMemberARes = await api(`/centers/${centerAId}/members/${memberAId}`, {
    method: 'PATCH',
    token: ownerAToken,
    body: {
      jobTitle: 'Senior Mathematics Teacher',
      memberRole: 'INSTRUCTOR',
    },
  });
  assert.equal(editMemberARes.status, 200);
  assert.equal(editMemberARes.data.member.jobTitle, 'Senior Mathematics Teacher');

  // Security: Owner B cannot add/edit members of Center A (403), nor pass Center A's memberId to Center B (404)
  const crossAddForbidden = await api(`/centers/${centerAId}/members`, {
    method: 'POST',
    token: ownerBToken,
    body: {
      email: teacherBEmail,
      memberRole: 'INSTRUCTOR',
      jobTitle: 'Unauthorized Teacher',
    },
  });
  assert.equal(crossAddForbidden.status, 403);

  const crossEditForbidden = await api(
    `/centers/${centerAId}/members/${memberAId}`,
    {
      method: 'PATCH',
      token: ownerBToken,
      body: { jobTitle: 'Hacked Title' },
    }
  );
  assert.equal(crossEditForbidden.status, 403);

  const crossCenterMemberMismatch = await api(
    `/centers/${centerBId}/members/${memberAId}`,
    {
      method: 'PATCH',
      token: ownerBToken,
      body: { jobTitle: 'Mismatch Test' },
    }
  );
  assert.equal(crossCenterMemberMismatch.status, 404);

  // Public centers list hides member email for unauthenticated callers and preserves distinct jobTitles
  const publicCentersRes = await api('/centers');
  assert.equal(publicCentersRes.status, 200);
  const centerARec = publicCentersRes.data.centers.find(
    (c: { id: number }) => c.id === centerAId
  );
  const centerBRec = publicCentersRes.data.centers.find(
    (c: { id: number }) => c.id === centerBId
  );
  assert.ok(centerARec && centerBRec);
  const memberAInCenterA = centerARec.members.find(
    (m: { userId: number }) => m.userId === teacherAId
  );
  const memberAInCenterB = centerBRec.members.find(
    (m: { userId: number }) => m.userId === teacherAId
  );
  assert.equal(memberAInCenterA.jobTitle, 'Senior Mathematics Teacher');
  assert.equal(memberAInCenterB.jobTitle, 'Academic Coordinator');
  assert.equal(memberAInCenterA.email, undefined);

  // 11. Scenario 2: Instructor edits own "About Me" bio & Security check against editing another's bio
  const updatedBioText =
    'خبرة 10 سنوات في تدريس الرياضيات التطبيقية وبناء المناهج التفاعلية لطلاب الجامعات.';
  const updateBioRes = await api('/instructors/me/bio', {
    method: 'PUT',
    token: teacherToken,
    body: {
      bio: updatedBioText,
      headline: 'محاضر رياضيات تطبيقية',
      qualifications: 'ماجستير الرياضيات التطبيقية',
      yearsExperience: 10,
    },
  });
  assert.equal(updateBioRes.status, 200);
  assert.equal(updateBioRes.data.profile.bio, updatedBioText);

  // Security: Teacher B cannot update Teacher A's bio (403)
  const forbiddenBioPatch = await api(`/instructors/${teacherAId}/bio`, {
    method: 'PATCH',
    token: teacherBToken,
    body: { bio: 'محاولة تعديل غير مصرح بها' },
  });
  assert.equal(forbiddenBioPatch.status, 403);

  // Verify persistence in GET /api/auth/me
  const teacherMeRes = await api('/auth/me', { token: teacherToken });
  assert.equal(teacherMeRes.status, 200);
  assert.equal(teacherMeRes.data.providerProfile.bio, updatedBioText);
  assert.equal(teacherMeRes.data.centerMemberships.length, 2);

  // 12. Scenario 3: Public Instructor Profile shows published courses ONLY (excludes DRAFT & other instructors)
  const pubCourseTitle = `دورة الرياضيات المنشورة ${suffix}`;
  const draftCourseTitle = `دورة مسودة سرية ${suffix}`;
  const otherInstructorCourseTitle = `دورة مدرّب آخر ${suffix}`;

  const createPubCourse = await api('/courses', {
    method: 'POST',
    token: teacherToken,
    body: {
      title: pubCourseTitle,
      subtitle: 'شرح عملي لمفاهيم الجبر الخطي والتفاضل',
      description: 'دورة تطبيقية كاملة موجهة لطلبة الهندسة والعلوم.',
      fieldId: firstFieldId,
      level: 'INTERMEDIATE',
      price: 35,
      status: 'PUBLISHED',
      lessons: [
        {
          title: 'المصفوفات والمتجهات',
          content: 'محتوى الدرس الأول حول أساسيات الجبر الخطي.',
          durationMinutes: 30,
          isFreePreview: true,
        },
      ],
    },
  });
  assert.equal(createPubCourse.status, 201);

  const createDraftCourse = await api('/courses', {
    method: 'POST',
    token: teacherToken,
    body: {
      title: draftCourseTitle,
      subtitle: 'دورة قيد الإعداد لا يجب أن تظهر للعامة',
      description: 'مسودة غير منشورة لاختبار العزل على صفحة المدرّب العامة.',
      fieldId: firstFieldId,
      level: 'BEGINNER',
      price: 20,
      status: 'DRAFT',
      lessons: [
        {
          title: 'درس تمهيدي مسودة',
          content: 'محتوى مسودة غير منشورة.',
          durationMinutes: 15,
          isFreePreview: false,
        },
      ],
    },
  });
  assert.equal(createDraftCourse.status, 201);

  const createOtherCourse = await api('/courses', {
    method: 'POST',
    token: teacherBToken,
    body: {
      title: otherInstructorCourseTitle,
      subtitle: 'دورة تابعة للمدرّب ب فقط',
      description: 'محتوى خاص بمدرّب آخر لا يظهر في ملف المدرّب أ.',
      fieldId: firstFieldId,
      level: 'BEGINNER',
      price: 15,
      status: 'PUBLISHED',
      lessons: [
        {
          title: 'مقدمة في الفيزياء',
          content: 'محتوى فيزياء تمهيدي.',
          durationMinutes: 20,
          isFreePreview: true,
        },
      ],
    },
  });
  assert.equal(createOtherCourse.status, 201);

  const publicProfileRes = await api(`/instructors/${teacherAId}`);
  assert.equal(publicProfileRes.status, 200);
  const pubInstr = publicProfileRes.data.instructor;
  const pubCourses = publicProfileRes.data.courses;

  assert.equal(pubInstr.id, teacherAId);
  assert.equal(pubInstr.bio, updatedBioText);
  assert.equal(pubInstr.jobTitle, 'Senior Mathematics Teacher');
  assert.equal(pubInstr.email, undefined);
  assert.equal(pubInstr.passwordHash, undefined);
  assert.ok(
    pubInstr.centerAffiliations.some(
      (a: { centerId: number; jobTitle: string }) =>
        a.centerId === centerAId && a.jobTitle === 'Senior Mathematics Teacher'
    )
  );
  assert.ok(
    pubCourses.some((c: { title: string }) => c.title === pubCourseTitle),
    'Published course by instructor A should appear'
  );
  assert.equal(
    pubCourses.some((c: { title: string }) => c.title === draftCourseTitle),
    false,
    'DRAFT course must NOT appear on public instructor profile'
  );
  assert.equal(
    pubCourses.some((c: { title: string }) => c.title === otherInstructorCourseTitle),
    false,
    'Other instructor courses must NOT appear'
  );

  const regTeacherC = await api('/auth/register', {
    method: 'POST',
    body: {
      email: `qa.teacherC.${suffix}@jusoor.test`,
      password,
      fullName: 'مدرّب بلا دورات',
      primaryRole: 'TEACHER',
    },
  });
  assert.equal(regTeacherC.status, 201);
  const emptyProfileRes = await api(`/instructors/${regTeacherC.data.user.id}`);
  assert.equal(emptyProfileRes.status, 200);
  assert.equal(emptyProfileRes.data.courses.length, 0);

  // ============================================================================
  // 13. INDIVIDUAL & GROUP LESSON BOOKING SYSTEM SUITE
  // ============================================================================
  const firstSubjectId: number = taxonomy.data.subjects[0].id;
  const futureDate = (daysAhead: number, hour: number) =>
    new Date(Date.now() + daysAhead * 86_400_000 + hour * 3_600_000).toISOString();

  // Register 6 test students for capacity = 5 + overflow test
  const studentTokens: string[] = [studentToken];
  for (let i = 2; i <= 6; i++) {
    const r = await api('/auth/register', {
      method: 'POST',
      body: {
        email: `qa.lesson.student${i}.${suffix}@jusoor.test`,
        password,
        fullName: `طالب جلسات ${i}`,
        primaryRole: 'STUDENT',
        stageId: firstStageId,
      },
    });
    assert.equal(r.status, 201);
    studentTokens.push(r.data.token);
  }

  // A. Weekly availability CRUD + overlap rejection
  const badAvail = await api('/teacher-availability', {
    method: 'PUT',
    token: teacherToken,
    body: {
      slots: [
        { dayOfWeek: 1, startTime: '14:00', endTime: '16:00', isActive: true },
        { dayOfWeek: 1, startTime: '15:00', endTime: '17:00', isActive: true },
      ],
    },
  });
  assert.equal(badAvail.status, 400);

  const okAvail = await api('/teacher-availability', {
    method: 'PUT',
    token: teacherToken,
    body: {
      slots: [
        { dayOfWeek: 1, startTime: '14:00', endTime: '18:00', isActive: true },
      ],
    },
  });
  assert.equal(okAvail.status, 200);
  assert.equal(okAvail.data.slots.length, 1);

  // B. Create ONE_TO_ONE slot
  const slot1Start = futureDate(12, 10);
  const slot1End = futureDate(12, 11);
  const createOneToOne = await api('/teaching-sessions', {
    method: 'POST',
    token: teacherToken,
    body: {
      sessionType: 'ONE_TO_ONE',
      title: `جلسة فردية اختبار ${suffix}`,
      description: 'مراجعة فردية مركزة في React.',
      subjectId: firstSubjectId,
      stageId: firstStageId,
      startTime: slot1Start,
      endTime: slot1End,
      price: 40,
      deliveryMode: 'ONLINE',
      meetingUrl: 'https://meet.jusoor.example/qa-1on1',
    },
  });
  assert.equal(createOneToOne.status, 201);
  const oneToOneId: number = createOneToOne.data.session.id;
  assert.equal(createOneToOne.data.session.capacity, 1);
  assert.equal(createOneToOne.data.session.status, 'OPEN');

  // Overlapping session for same teacher must be rejected (409)
  const overlapRes = await api('/teaching-sessions', {
    method: 'POST',
    token: teacherToken,
    body: {
      sessionType: 'ONE_TO_ONE',
      title: `جلسة متداخلة ${suffix}`,
      startTime: futureDate(12, 10.5),
      endTime: futureDate(12, 11.5),
      price: 30,
      deliveryMode: 'ONLINE',
    },
  });
  assert.equal(overlapRes.status, 409);

  // Public viewer must NOT see private meetingUrl before acceptance
  const anonList = await api(`/teaching-sessions?teacherId=${teacherAId}`);
  assert.equal(anonList.status, 200);
  const anonSlot = anonList.data.sessions.find(
    (s: { id: number }) => s.id === oneToOneId
  );
  assert.ok(anonSlot);
  assert.equal(anonSlot.meetingUrl, null);

  // Teacher cannot book their own session (400)
  const selfEnroll = await api(`/teaching-sessions/${oneToOneId}/enroll`, {
    method: 'POST',
    token: teacherToken,
    body: { notes: 'محاولة حجز ذاتي' },
  });
  assert.equal(selfEnroll.status, 400);

  // Two students request the same ONE_TO_ONE slot
  const req1 = await api(`/teaching-sessions/${oneToOneId}/enroll`, {
    method: 'POST',
    token: studentTokens[0],
    body: { notes: 'الطالب الأول يرغب بالانضمام' },
  });
  assert.equal(req1.status, 201);
  const req1Id: number = req1.data.enrollment.id;

  // Duplicate request by same student must fail (409)
  const dupReq1 = await api(`/teaching-sessions/${oneToOneId}/enroll`, {
    method: 'POST',
    token: studentTokens[0],
    body: { notes: 'طلب مكرر' },
  });
  assert.equal(dupReq1.status, 409);

  const req2 = await api(`/teaching-sessions/${oneToOneId}/enroll`, {
    method: 'POST',
    token: studentTokens[1],
    body: { notes: 'الطالب الثاني ينافس على الموعد' },
  });
  assert.equal(req2.status, 201);
  const req2Id: number = req2.data.enrollment.id;

  // Authorization check: Teacher B cannot accept Teacher A's request (403)
  const forbiddenAccept = await api(`/session-enrollments/${req1Id}/accept`, {
    method: 'POST',
    token: teacherBToken,
  });
  assert.equal(forbiddenAccept.status, 403);

  // Teacher A accepts Student 1 -> slot becomes FULL, competing request auto-rejected
  const accept1 = await api(`/session-enrollments/${req1Id}/accept`, {
    method: 'POST',
    token: teacherToken,
  });
  assert.equal(accept1.status, 200);
  assert.equal(accept1.data.sessionStatus, 'FULL');
  assert.equal(accept1.data.remainingSeats, 0);

  // Trying to accept Student 2 must fail (409)
  const accept2 = await api(`/session-enrollments/${req2Id}/accept`, {
    method: 'POST',
    token: teacherToken,
  });
  assert.equal(accept2.status, 409);

  // Accepted student NOW sees meetingUrl; competing student sees REJECTED & no meetingUrl
  const s1Detail = await api(`/teaching-sessions/${oneToOneId}`, {
    token: studentTokens[0],
  });
  assert.equal(s1Detail.status, 200);
  assert.equal(
    s1Detail.data.session.meetingUrl,
    'https://meet.jusoor.example/qa-1on1'
  );
  const s2Detail = await api(`/teaching-sessions/${oneToOneId}`, {
    token: studentTokens[1],
  });
  assert.equal(s2Detail.status, 200);
  assert.equal(s2Detail.data.session.meetingUrl, null);
  assert.equal(s2Detail.data.session.myEnrollment.status, 'REJECTED');

  // C. Group Session with capacity = 5
  const createGroup = await api('/teaching-sessions', {
    method: 'POST',
    token: teacherToken,
    body: {
      sessionType: 'GROUP',
      title: `ورشة جماعية اختبار ${suffix}`,
      description: 'ورشة تطبيقية لخمسة طلاب.',
      subjectId: firstSubjectId,
      stageId: firstStageId,
      startTime: futureDate(15, 14),
      endTime: futureDate(15, 16),
      capacity: 5,
      minStudents: 2,
      price: 20,
      deliveryMode: 'ONLINE',
      meetingUrl: 'https://meet.jusoor.example/qa-group',
      registrationDeadline: futureDate(14, 23),
    },
  });
  assert.equal(createGroup.status, 201);
  const groupId: number = createGroup.data.session.id;

  // All 6 students submit enrollment requests while OPEN
  const groupEnrollmentIds: number[] = [];
  for (let i = 0; i < 6; i++) {
    const gr = await api(`/teaching-sessions/${groupId}/enroll`, {
      method: 'POST',
      token: studentTokens[i],
      body: { notes: `طلب مجموعة ${i + 1}` },
    });
    assert.equal(gr.status, 201);
    groupEnrollmentIds.push(gr.data.enrollment.id);
  }

  // Teacher requests endpoint should NOT expose student private email
  const teacherReqs = await api(
    `/teaching-sessions/teacher/requests?sessionType=GROUP&status=PENDING`,
    { token: teacherToken }
  );
  assert.equal(teacherReqs.status, 200);
  assert.ok(teacherReqs.data.requests.length >= 6);
  assert.equal(teacherReqs.data.requests[0].student.email, undefined);

  // Accept first 5 students -> capacity reached -> status FULL
  for (let i = 0; i < 5; i++) {
    const acc = await api(
      `/session-enrollments/${groupEnrollmentIds[i]}/accept`,
      { method: 'POST', token: teacherToken }
    );
    assert.equal(acc.status, 200);
    if (i < 4) {
      assert.equal(acc.data.sessionStatus, 'OPEN');
    } else {
      assert.equal(acc.data.sessionStatus, 'FULL');
      assert.equal(acc.data.remainingSeats, 0);
    }
  }

  // 6th accept attempt must fail (409)
  const acc6 = await api(
    `/session-enrollments/${groupEnrollmentIds[5]}/accept`,
    { method: 'POST', token: teacherToken }
  );
  assert.equal(acc6.status, 409);

  // Rejecting student 6 (PENDING) succeeds
  const rej6 = await api(
    `/session-enrollments/${groupEnrollmentIds[5]}/reject`,
    { method: 'POST', token: teacherToken }
  );
  assert.equal(rej6.status, 200);
  assert.equal(rej6.data.enrollment.status, 'REJECTED');

  // Student 2 cannot cancel Student 1's enrollment (403)
  const forbiddenCancel = await api(
    `/session-enrollments/${groupEnrollmentIds[0]}/cancel`,
    { method: 'POST', token: studentTokens[1] }
  );
  assert.equal(forbiddenCancel.status, 403);

  // Student 1 cancels accepted enrollment -> session reopens FULL -> OPEN, remainingSeats = 1
  const student1Cancel = await api(
    `/session-enrollments/${groupEnrollmentIds[0]}/cancel`,
    { method: 'POST', token: studentTokens[0], body: { reason: 'تعارض وقت' } }
  );
  assert.equal(student1Cancel.status, 200);
  assert.equal(student1Cancel.data.enrollment.status, 'CANCELLED');
  assert.equal(student1Cancel.data.sessionStatus, 'OPEN');

  const reopenedGroupDetail = await api(`/teaching-sessions/${groupId}`, {
    token: teacherToken,
  });
  assert.equal(reopenedGroupDetail.status, 200);
  assert.equal(reopenedGroupDetail.data.session.status, 'OPEN');
  assert.equal(reopenedGroupDetail.data.session.acceptedCount, 4);
  assert.equal(reopenedGroupDetail.data.session.remainingSeats, 1);

  // Teacher edits capacity from 5 to 3 when 4 are accepted -> blocked (400)
  const badCapEdit = await api(`/teaching-sessions/${groupId}`, {
    method: 'PATCH',
    token: teacherToken,
    body: { capacity: 3 },
  });
  assert.equal(badCapEdit.status, 400);

  // Teacher cancels the group session -> notifies accepted students
  const cancelGroup = await api(`/teaching-sessions/${groupId}/cancel`, {
    method: 'POST',
    token: teacherToken,
  });
  assert.equal(cancelGroup.status, 200);
  assert.equal(cancelGroup.data.session.status, 'CANCELLED');

  // Student 2 checks notifications -> received acceptance + session cancellation
  const s2Notifs = await api('/notifications', { token: studentTokens[1] });
  assert.equal(s2Notifs.status, 200);
  assert.ok(
    s2Notifs.data.notifications.some(
      (n: { title: string }) => n.title.includes('إلغاء جلسة')
    )
  );

  // ============================================================================
  // 14. EGYPTIAN EDUCATIONAL STAGES, CURRICULUM (2026/2027), M:N TEACHERS & ADMIN
  // ============================================================================
  const currOverview = await api('/curriculum/overview');
  assert.equal(currOverview.status, 200);
  assert.equal(currOverview.data.systems.length, 4);
  assert.equal(currOverview.data.grades.length, 15);
  assert.equal(currOverview.data.divisions.length, 5);
  assert.equal(currOverview.data.pathways.length, 8);
  assert.equal(currOverview.data.activeAcademicYear?.code, '2026/2027');
  assert.equal(currOverview.data.activeVersion?.versionCode, 'EG-2026-2027-V1');

  // Verify Egyptian General Education ONLY (no Al-Azhar / Technical / International)
  const systemCodes: string[] = currOverview.data.systems.map(
    (s: { code: string }) => s.code
  );
  assert.deepEqual(systemCodes.sort(), [
    'EGYPTIAN_BACCALAUREATE',
    'GENERAL_SECONDARY',
    'PREPARATORY_GENERAL',
    'PRIMARY_GENERAL',
  ]);

  const findGrade = (slug: string) =>
    currOverview.data.grades.find((g: { slug: string }) => g.slug === slug);
  const findDiv = (code: string) =>
    currOverview.data.divisions.find((d: { code: string }) => d.code === code);
  const findPath = (code: string) =>
    currOverview.data.pathways.find((p: { code: string }) => p.code === code);

  // Verify grade-by-grade counts & strict branch separation
  const p1Res = await api(`/curriculum/subjects?gradeId=${findGrade('primary-1').id}`);
  assert.equal(p1Res.status, 200);
  assert.equal(p1Res.data.subjects.length, 6);

  const p4Res = await api(`/curriculum/subjects?gradeId=${findGrade('primary-4').id}`);
  assert.equal(p4Res.status, 200);
  assert.equal(p4Res.data.subjects.length, 16);

  const prep1Res = await api(`/curriculum/subjects?gradeId=${findGrade('prep-1').id}`);
  assert.equal(prep1Res.status, 200);
  assert.equal(prep1Res.data.subjects.length, 12);

  const prep2Res = await api(`/curriculum/subjects?gradeId=${findGrade('prep-2').id}`);
  assert.equal(prep2Res.status, 200);
  assert.equal(prep2Res.data.subjects.length, 11);

  const prep3Res = await api(`/curriculum/subjects?gradeId=${findGrade('prep-3').id}`);
  assert.equal(prep3Res.status, 200);
  assert.equal(prep3Res.data.subjects.length, 9);

  const gs1Res = await api(`/curriculum/subjects?gradeId=${findGrade('gen-sec-1').id}`);
  assert.equal(gs1Res.status, 200);
  assert.equal(gs1Res.data.subjects.length, 22);

  const gs2SciRes = await api(
    `/curriculum/subjects?gradeId=${findGrade('gen-sec-2').id}&divisionId=${
      findDiv('GEN_SEC_2_SCIENTIFIC').id
    }`
  );
  assert.equal(gs2SciRes.status, 200);
  assert.equal(gs2SciRes.data.subjects.length, 21);
  assert.ok(
    gs2SciRes.data.subjects.some((s: { subjectSlug: string }) => s.subjectSlug === 'eg-physics')
  );

  const gs2LitRes = await api(
    `/curriculum/subjects?gradeId=${findGrade('gen-sec-2').id}&divisionId=${
      findDiv('GEN_SEC_2_LITERARY').id
    }`
  );
  assert.equal(gs2LitRes.status, 200);
  assert.equal(gs2LitRes.data.subjects.length, 21);
  assert.equal(
    gs2LitRes.data.subjects.some((s: { subjectSlug: string }) => s.subjectSlug === 'eg-physics'),
    false
  );

  const gs3BioRes = await api(
    `/curriculum/subjects?gradeId=${findGrade('gen-sec-3').id}&divisionId=${
      findDiv('GEN_SEC_3_SCI_BIO').id
    }`
  );
  assert.equal(gs3BioRes.status, 200);
  assert.equal(gs3BioRes.data.subjects.length, 8);
  assert.ok(
    gs3BioRes.data.subjects.some((s: { subjectSlug: string }) => s.subjectSlug === 'eg-biology')
  );

  const gs3MathRes = await api(
    `/curriculum/subjects?gradeId=${findGrade('gen-sec-3').id}&divisionId=${
      findDiv('GEN_SEC_3_SCI_MATH').id
    }`
  );
  assert.equal(gs3MathRes.status, 200);
  assert.equal(gs3MathRes.data.subjects.length, 8);
  assert.equal(
    gs3MathRes.data.subjects.some((s: { subjectSlug: string }) => s.subjectSlug === 'eg-biology'),
    false
  );

  const gs3LitRes = await api(
    `/curriculum/subjects?gradeId=${findGrade('gen-sec-3').id}&divisionId=${
      findDiv('GEN_SEC_3_LITERARY').id
    }`
  );
  assert.equal(gs3LitRes.status, 200);
  assert.equal(gs3LitRes.data.subjects.length, 8);

  const bacc1Res = await api(`/curriculum/subjects?gradeId=${findGrade('bacc-1').id}`);
  assert.equal(bacc1Res.status, 200);
  assert.equal(bacc1Res.data.subjects.length, 11);

  const bacc2MedRes = await api(
    `/curriculum/subjects?gradeId=${findGrade('bacc-2').id}&pathwayId=${
      findPath('BACC_2_MED').id
    }`
  );
  assert.equal(bacc2MedRes.status, 200);
  assert.equal(bacc2MedRes.data.subjects.length, 7);

  const bacc3EngRes = await api(
    `/curriculum/subjects?gradeId=${findGrade('bacc-3').id}&pathwayId=${
      findPath('BACC_3_ENG').id
    }`
  );
  assert.equal(bacc3EngRes.status, 200);
  assert.equal(bacc3EngRes.data.subjects.length, 4);
  const bacc3Religion = bacc3EngRes.data.subjects.find(
    (s: { subjectSlug: string }) => s.subjectSlug === 'eg-religious-ed'
  );
  assert.equal(bacc3Religion?.passThresholdPercent, 70);

  // Invalid combinations must return 400
  const invalidCombo1 = await api(
    `/curriculum/subjects?gradeId=${findGrade('gen-sec-2').id}&pathwayId=${
      findPath('BACC_2_MED').id
    }`
  );
  assert.equal(invalidCombo1.status, 400);

  const invalidCombo2 = await api(
    `/curriculum/subjects?gradeId=${findGrade('gen-sec-1').id}&divisionId=${
      findDiv('GEN_SEC_2_SCIENTIFIC').id
    }`
  );
  assert.equal(invalidCombo2.status, 400);

  const invalidCombo3 = await api(
    `/curriculum/subjects?gradeId=${findGrade('bacc-2').id}&divisionId=${
      findDiv('GEN_SEC_2_SCIENTIFIC').id
    }`
  );
  assert.equal(invalidCombo3.status, 400);

  // M:N Teacher Discovery (Multiple teachers on Primary 4 Math + no-course teacher visibility)
  const p4MathCs = p4Res.data.subjects.find(
    (s: { subjectSlug: string }) => s.subjectSlug === 'eg-mathematics'
  );
  assert.ok(p4MathCs);

  const p4MathTeachers = await api(
    `/curriculum/subjects/${p4MathCs.id}/teachers`
  );
  assert.equal(p4MathTeachers.status, 200);
  assert.ok(p4MathTeachers.data.teachers.length >= 4);
  const zeroCourseTeacher = p4MathTeachers.data.teachers.find(
    (t: { publishedCoursesCount: number }) => t.publishedCoursesCount === 0
  );
  assert.ok(zeroCourseTeacher, 'Teacher with 0 published courses must be discoverable');
  assert.equal(zeroCourseTeacher.email, undefined);
  assert.equal(zeroCourseTeacher.passwordHash, undefined);

  // Instructor profile for no-course teacher includes teachingAssignments
  const zeroCourseProfile = await api(`/instructors/${zeroCourseTeacher.teacherId}`);
  assert.equal(zeroCourseProfile.status, 200);
  assert.equal(zeroCourseProfile.data.courses.length, 0);
  assert.ok(zeroCourseProfile.data.instructor.teachingAssignments.length >= 1);

  // Teacher C (0 courses) self-assigns to Primary 4 Math, creates a curriculum-linked session & discovers cleanly
  const assignTeacherC = await api('/teaching-assignments/mine', {
    method: 'POST',
    token: regTeacherC.data.token,
    body: {
      curriculumSubjectId: p4MathCs.id,
      languagesOffered: ['ar', 'en'],
      hourlyRate: 28,
      supportsOnline: true,
      supportsInPerson: false,
      notes: 'شرح مبسط لرياضيات الصف الرابع',
    },
  });
  assert.equal(assignTeacherC.status, 201);
  const teacherCAssignId: number = assignTeacherC.data.assignment.id;

  const patchAssignC = await api(`/teaching-assignments/mine/${teacherCAssignId}`, {
    method: 'PATCH',
    token: regTeacherC.data.token,
    body: { hourlyRate: 29 },
  });
  assert.equal(patchAssignC.status, 200);

  const currSessionCreate = await api('/teaching-sessions', {
    method: 'POST',
    token: regTeacherC.data.token,
    body: {
      sessionType: 'ONE_TO_ONE',
      title: `حصة منهجية الصف الرابع ${suffix}`,
      description: 'مراجعة دروس الكسور بالمنهج المصري 2026/2027.',
      curriculumSubjectId: p4MathCs.id,
      startTime: futureDate(18, 12),
      endTime: futureDate(18, 13),
      price: 29,
      deliveryMode: 'ONLINE',
      meetingUrl: 'https://meet.jusoor.example/qa-curr-1on1',
    },
  });
  assert.equal(currSessionCreate.status, 201);
  assert.equal(currSessionCreate.data.session.curriculumSubjectId, p4MathCs.id);
  assert.equal(currSessionCreate.data.session.gradeId, findGrade('primary-4').id);

  const filterCurrSessions = await api(
    `/teaching-sessions?curriculumSubjectId=${p4MathCs.id}&gradeId=${
      findGrade('primary-4').id
    }&teacherId=${regTeacherC.data.user.id}`
  );
  assert.equal(filterCurrSessions.status, 200);
  assert.ok(
    filterCurrSessions.data.sessions.some(
      (s: { id: number }) => s.id === currSessionCreate.data.session.id
    )
  );

  // Teacher C appears in discovery with 1 open individual session & 0 published courses
  const updatedDiscovery = await api(
    `/curriculum/subjects/${p4MathCs.id}/teachers?hasSessions=true`
  );
  assert.equal(updatedDiscovery.status, 200);
  const foundTeacherC = updatedDiscovery.data.teachers.find(
    (t: { teacherId: number }) => t.teacherId === regTeacherC.data.user.id
  );
  assert.ok(foundTeacherC);
  assert.equal(foundTeacherC.publishedCoursesCount, 0);
  assert.equal(foundTeacherC.individualSessionsCount, 1);

  // Clean up Teacher C assignment via self-service DELETE
  const deleteAssignC = await api(`/teaching-assignments/mine/${teacherCAssignId}`, {
    method: 'DELETE',
    token: regTeacherC.data.token,
  });
  assert.equal(deleteAssignC.status, 200);

  // Admin RBAC & Transactional Version Copy
  const studentAdminCurr = await api('/admin/curriculum/all', { token: studentToken });
  assert.equal(studentAdminCurr.status, 403);

  const teacherAdminCurr = await api('/admin/curriculum/all', { token: teacherToken });
  assert.equal(teacherAdminCurr.status, 403);

  const adminCurrAll = await api('/admin/curriculum/all', { token: adminToken });
  assert.equal(adminCurrAll.status, 200);
  assert.ok(adminCurrAll.data.curriculumSubjects.length >= 180);

  const testYearCode = `QA-${suffix}`;
  const createTestYear = await api('/admin/curriculum/academic-years', {
    method: 'POST',
    token: adminToken,
    body: {
      code: testYearCode,
      nameAr: `سنة اختبارية ${suffix}`,
      nameEn: `QA Year ${suffix}`,
      isCurrent: false,
      isActive: false,
    },
  });
  assert.equal(createTestYear.status, 201);

  const sourceVersionId = currOverview.data.activeVersion.id;
  const copyVersionRes = await api(
    `/admin/curriculum/versions/${sourceVersionId}/copy`,
    {
      method: 'POST',
      token: adminToken,
      body: {
        academicYearId: createTestYear.data.academicYear.id,
        versionCode: `QA-V-${suffix}`,
        nameAr: `نسخة اختبارية ${suffix}`,
        nameEn: `QA Version ${suffix}`,
        activate: false,
      },
    }
  );
  assert.equal(copyVersionRes.status, 201);
  assert.ok(copyVersionRes.data.copiedCount >= 180);

  // =========================================================================
  // 15. Stage-Specific Teacher Coverage (All 9 Discovery Contexts + Isolation)
  // =========================================================================
  const fetchTeachersForContext = async (
    gradeSlug: string,
    subjectSlug: string,
    opts?: { divisionCode?: string; pathwayCode?: string }
  ) => {
    const grade = findGrade(gradeSlug);
    const qs = new URLSearchParams({ gradeId: String(grade.id) });
    if (opts?.divisionCode) qs.set('divisionId', String(findDiv(opts.divisionCode).id));
    if (opts?.pathwayCode) qs.set('pathwayId', String(findPath(opts.pathwayCode).id));
    const subRes = await api(`/curriculum/subjects?${qs.toString()}`);
    assert.equal(subRes.status, 200);
    const cs = subRes.data.subjects.find(
      (s: { subjectSlug: string }) => s.subjectSlug === subjectSlug
    );
    assert.ok(cs, `Missing curriculum subject ${subjectSlug} in ${gradeSlug}`);
    const tRes = await api(`/curriculum/subjects/${cs.id}/teachers?limit=20`);
    assert.equal(tRes.status, 200);
    return tRes.data.teachers as Array<{
      teacherId: number;
      fullName: string;
      publishedCoursesCount: number;
      verificationStatus: string;
    }>;
  };

  // All 9 required student discovery queries must have >= 3 distinct active teachers
  const prim4Eng = await fetchTeachersForContext('primary-4', 'eg-english');
  const prim5Math = await fetchTeachersForContext('primary-5', 'eg-mathematics');
  const prep2Eng = await fetchTeachersForContext('prep-2', 'eg-english-first-foreign');
  const prep3Sci = await fetchTeachersForContext('prep-3', 'eg-science');
  const sec1IntSci = await fetchTeachersForContext('gen-sec-1', 'eg-integrated-science');
  const sec2SciPhys = await fetchTeachersForContext('gen-sec-2', 'eg-physics', {
    divisionCode: 'GEN_SEC_2_SCIENTIFIC',
  });
  const sec3LitGeo = await fetchTeachersForContext('gen-sec-3', 'eg-geography', {
    divisionCode: 'GEN_SEC_3_LITERARY',
  });
  const bacc2EngAi = await fetchTeachersForContext('bacc-2', 'eg-programming-ai', {
    pathwayCode: 'BACC_2_ENG',
  });
  const bacc3MedBio = await fetchTeachersForContext('bacc-3', 'eg-biology-adv', {
    pathwayCode: 'BACC_3_MED',
  });

  for (const [label, list] of [
    ['Primary G4 English', prim4Eng],
    ['Primary G5 Math', prim5Math],
    ['Prep G2 English', prep2Eng],
    ['Prep G3 Science', prep3Sci],
    ['Gen Sec G1 Integrated Science', sec1IntSci],
    ['Gen Sec G2 Scientific Physics', sec2SciPhys],
    ['Gen Sec G3 Literary Geography', sec3LitGeo],
    ['Bacc G2 Eng Programming & AI', bacc2EngAi],
    ['Bacc G3 Med Adv Biology', bacc3MedBio],
  ] as const) {
    assert.ok(
      list.length >= 3,
      `${label} must have >= 3 teachers, got ${list.length}`
    );
  }

  // Strict stage isolation checks: no overlap across stages/systems
  const idsOf = (list: Array<{ teacherId: number }>) =>
    new Set(list.map((t) => t.teacherId));

  const primEngIds = idsOf(prim4Eng);
  const prepEngIds = idsOf(prep2Eng);
  for (const id of primEngIds) {
    assert.ok(!prepEngIds.has(id), 'Primary English teacher must not appear in Prep English');
  }

  const sec1Eng = await fetchTeachersForContext('gen-sec-1', 'eg-first-foreign-lang');
  const bacc1Eng = await fetchTeachersForContext('bacc-1', 'eg-first-foreign-lang');
  const sec1EngIds = idsOf(sec1Eng);
  const bacc1EngIds = idsOf(bacc1Eng);
  for (const id of sec1EngIds) {
    assert.ok(!prepEngIds.has(id), 'Secondary English teacher must not appear in Prep');
    assert.ok(!bacc1EngIds.has(id), 'Gen Sec English teacher must not appear in Baccalaureate');
  }

  // Zero-course discoverability & honest PENDING status on newly seeded stage teacher
  const noCourseStageTeacher = prep2Eng.find((t) => t.publishedCoursesCount === 0);
  assert.ok(noCourseStageTeacher, 'Prep G2 English must include a 0-course teacher');
  assert.equal(noCourseStageTeacher.verificationStatus, 'PENDING');

  // =========================================================================
  // 16. Teacher Sessions System, Demo Seeding (7+7+7), SQL Filters & 1:1 Flow
  // =========================================================================
  const seededP4MathTeacher = p4MathTeachers.data.teachers.find(
    (t: {
      onlineGroupSessionsCount?: number;
      onlineIndividualSlotsCount?: number;
      offlineGroupSessionsCount?: number;
      sessions?: unknown[];
    }) =>
      (t.onlineGroupSessionsCount ?? 0) >= 7 &&
      (t.onlineIndividualSlotsCount ?? 0) >= 7 &&
      (t.offlineGroupSessionsCount ?? 0) >= 7
  );
  assert.ok(
    seededP4MathTeacher,
    'Primary 4 Math must include a seeded stage teacher with 7 online group + 7 online 1:1 + 7 offline group sessions'
  );

  // Inspect all sessions of that seeded teacher for Primary 4 Math via paginated SQL API
  const seededTeacherSessions = await api(
    `/teaching-sessions?teacherId=${seededP4MathTeacher.teacherId}&curriculumSubjectId=${p4MathCs.id}&limit=50`
  );
  assert.equal(seededTeacherSessions.status, 200);
  assert.ok(seededTeacherSessions.data.total >= 21);
  const seededOnlineGroup = seededTeacherSessions.data.sessions.filter(
    (s: { sessionType: string; deliveryMode: string }) =>
      s.sessionType === 'GROUP' && s.deliveryMode === 'ONLINE'
  );
  const seededOnlineOneToOne = seededTeacherSessions.data.sessions.filter(
    (s: { sessionType: string; deliveryMode: string }) =>
      s.sessionType === 'ONE_TO_ONE' && s.deliveryMode === 'ONLINE'
  );
  const seededOfflineGroup = seededTeacherSessions.data.sessions.filter(
    (s: { sessionType: string; deliveryMode: string }) =>
      s.sessionType === 'GROUP' && s.deliveryMode === 'IN_PERSON'
  );
  assert.ok(seededOnlineGroup.length >= 7);
  assert.ok(seededOnlineOneToOne.length >= 7);
  assert.ok(seededOfflineGroup.length >= 7);

  for (const offSess of seededOfflineGroup) {
    assert.ok(
      typeof offSess.location === 'string' && offSess.location.trim().length > 10,
      'Offline session must publicly display complete physical address'
    );
    assert.ok(offSess.governorate, 'Offline session must include governorate');
    assert.ok(offSess.city, 'Offline session must include city');
    assert.equal(offSess.isDemoLocation, true);
    assert.equal(offSess.currency, 'EGP');
    assert.equal(offSess.meetingUrl, null);
  }

  // Test SQL filters & pagination (deliveryMode=OFFLINE alias, gradeId, minPrice/maxPrice, page & limit)
  const p4GradeId = findGrade('primary-4').id;
  const offlineFilterPage1 = await api(
    `/teaching-sessions?gradeId=${p4GradeId}&deliveryMode=OFFLINE&sessionType=GROUP&minPrice=50&maxPrice=500&page=1&limit=5`
  );
  assert.equal(offlineFilterPage1.status, 200);
  assert.ok(offlineFilterPage1.data.total >= 7);
  assert.ok(offlineFilterPage1.data.totalPages >= 2);
  assert.equal(offlineFilterPage1.data.sessions.length, 5);
  assert.ok(
    offlineFilterPage1.data.sessions.every(
      (s: {
        deliveryMode: string;
        sessionType: string;
        gradeId: number;
        price: number;
        location: string | null;
      }) =>
        s.deliveryMode === 'IN_PERSON' &&
        s.sessionType === 'GROUP' &&
        s.gradeId === p4GradeId &&
        Number(s.price) >= 50 &&
        Number(s.price) <= 500 &&
        Boolean(s.location && s.location.length > 5)
    )
  );

  const offlineFilterPage2 = await api(
    `/teaching-sessions?gradeId=${p4GradeId}&deliveryMode=OFFLINE&sessionType=GROUP&minPrice=50&maxPrice=500&page=2&limit=5`
  );
  assert.equal(offlineFilterPage2.status, 200);
  assert.ok(offlineFilterPage2.data.sessions.length >= 1);
  assert.notEqual(
    offlineFilterPage1.data.sessions[0].id,
    offlineFilterPage2.data.sessions[0].id
  );

  // Division/Pathway SQL filter check (Gen Sec 2 Scientific Physics)
  const sec2SciDiv = findDiv('GEN_SEC_2_SCIENTIFIC');
  const sec2SciSessions = await api(
    `/teaching-sessions?gradeId=${findGrade('gen-sec-2').id}&divisionId=${sec2SciDiv.id}&limit=10`
  );
  assert.equal(sec2SciSessions.status, 200);
  assert.ok(sec2SciSessions.data.total >= 21);
  assert.ok(
    sec2SciSessions.data.sessions.every(
      (s: { divisionId: number }) => s.divisionId === sec2SciDiv.id
    )
  );

  // E2E QA Teacher (Teacher C) + Offline Group & 1:1 Online Request -> Teacher Requests -> Accept -> Dashboard "جلساتي"
  const qaTeacherCOnlineRes = await api('/teaching-sessions', {
    method: 'POST',
    token: regTeacherC.data.token,
    body: {
      sessionType: 'ONE_TO_ONE',
      title: `حصة فردية أونلاين اختبارية ${suffix}`,
      description: 'مراجعة فردية أونلاين للوحدة الثانية.',
      curriculumSubjectId: p4MathCs.id,
      startTime: futureDate(21, 16),
      endTime: futureDate(21, 17),
      price: 165,
      currency: 'EGP',
      deliveryMode: 'ONLINE',
      meetingUrl: 'https://meet.jusoor.example/qa-1on1-flow',
    },
  });
  assert.equal(qaTeacherCOnlineRes.status, 201);
  const qa1on1Id: number = qaTeacherCOnlineRes.data.session.id;

  const qaTeacherCOfflineRes = await api('/teaching-sessions', {
    method: 'POST',
    token: regTeacherC.data.token,
    body: {
      sessionType: 'GROUP',
      title: `مجموعة حضورية اختبارية ${suffix}`,
      description: 'مراجعة شاملة في السنتر.',
      curriculumSubjectId: p4MathCs.id,
      startTime: futureDate(22, 17),
      endTime: futureDate(22, 19),
      capacity: 12,
      minStudents: 2,
      price: 110,
      currency: 'EGP',
      deliveryMode: 'OFFLINE',
      governorate: 'القاهرة',
      city: 'مدينة نصر',
      district: 'المنطقة السادسة',
      streetName: 'شارع عباس العقاد',
      buildingOrCenterName: 'مركز النور التعليمي (قاعة اختبارية)',
      locationNotes: 'الدور الثالث - قاعة 2',
      isDemoLocation: true,
    },
  });
  assert.equal(qaTeacherCOfflineRes.status, 201);
  const qaOfflineId: number = qaTeacherCOfflineRes.data.session.id;
  assert.equal(qaTeacherCOfflineRes.data.session.deliveryMode, 'IN_PERSON');
  assert.ok(
    qaTeacherCOfflineRes.data.session.location.includes('القاهرة') &&
      qaTeacherCOfflineRes.data.session.location.includes('شارع عباس العقاد')
  );

  // Student submits a 1:1 request AND an offline group request
  const stu1on1Req = await api(`/teaching-sessions/${qa1on1Id}/enroll`, {
    method: 'POST',
    token: studentToken,
    body: { notes: 'أرغب في مراجعة القسمة المطولة' },
  });
  assert.equal(stu1on1Req.status, 201);
  const stu1on1EnrId: number = stu1on1Req.data.enrollment.id;

  const stuOfflineReq = await api(`/teaching-sessions/${qaOfflineId}/enroll`, {
    method: 'POST',
    token: studentToken,
    body: { notes: 'حجز مقعد في المجموعة الحضورية' },
  });
  assert.equal(stuOfflineReq.status, 201);

  // Slot status should reflect PENDING while awaiting decision
  const pendingCheck = await api(`/teaching-sessions/${qa1on1Id}`, {
    token: studentToken,
  });
  assert.equal(pendingCheck.status, 200);
  assert.equal(pendingCheck.data.session.slotStatus, 'PENDING');
  assert.equal(pendingCheck.data.session.meetingUrl, null);

  // Student dashboard ("جلساتي") shows both pending items, full offline physical address, EGP currency, and null meetingUrl
  const stuDashBefore = await api('/dashboard', { token: studentToken });
  assert.equal(stuDashBefore.status, 200);
  const dash1on1Before = stuDashBefore.data.lessonEnrollments.find(
    (e: { sessionId: number }) => e.sessionId === qa1on1Id
  );
  const dashOfflineBefore = stuDashBefore.data.lessonEnrollments.find(
    (e: { sessionId: number }) => e.sessionId === qaOfflineId
  );
  assert.ok(dash1on1Before, '1:1 request must appear in student dashboard');
  assert.equal(dash1on1Before.enrollmentStatus, 'PENDING');
  assert.equal(dash1on1Before.currency, 'EGP');
  assert.equal(dash1on1Before.meetingUrl, null);
  assert.ok(dashOfflineBefore, 'Offline group request must appear in student dashboard');
  assert.ok(
    dashOfflineBefore.location.includes('شارع عباس العقاد'),
    'Offline address must remain visible even while enrollment is PENDING'
  );

  // Teacher C sees the 1:1 request in "طلبات الجلسات الفردية" with subject, grade, price, and notes
  const teacherCRequests = await api(
    '/teaching-sessions/teacher/requests?sessionType=ONE_TO_ONE&status=PENDING',
    { token: regTeacherC.data.token }
  );
  assert.equal(teacherCRequests.status, 200);
  const foundReq = teacherCRequests.data.requests.find(
    (r: { id: number }) => r.id === stu1on1EnrId
  );
  assert.ok(foundReq);
  assert.equal(Number(foundReq.price), 165);
  assert.equal(foundReq.currency, 'EGP');
  assert.ok(foundReq.subjectNameAr);
  assert.ok(foundReq.gradeNameAr);

  // Teacher C checks /teaching-sessions/mine with category counts & view filtering
  const teacherCMine = await api('/teaching-sessions/mine?view=offline_group', {
    token: regTeacherC.data.token,
  });
  assert.equal(teacherCMine.status, 200);
  assert.ok(teacherCMine.data.counts.onlineOneToOne >= 2);
  assert.ok(teacherCMine.data.counts.offlineGroup >= 1);
  assert.ok(
    teacherCMine.data.sessions.some((s: { id: number }) => s.id === qaOfflineId)
  );

  // Teacher C accepts the 1:1 request -> slot becomes FULL / BOOKED & student sees meetingUrl
  const accept1on1Res = await api(`/session-enrollments/${stu1on1EnrId}/accept`, {
    method: 'POST',
    token: regTeacherC.data.token,
  });
  assert.equal(accept1on1Res.status, 200);
  assert.equal(accept1on1Res.data.sessionStatus, 'FULL');

  // Second student attempting to book the already-booked 1:1 slot must be rejected (409)
  const lateStudentBooking = await api(`/teaching-sessions/${qa1on1Id}/enroll`, {
    method: 'POST',
    token: studentTokens[0],
    body: { notes: 'محاولة متأخرة' },
  });
  assert.equal(lateStudentBooking.status, 409);

  const stuDashAfter = await api('/dashboard', { token: studentToken });
  assert.equal(stuDashAfter.status, 200);
  const dash1on1After = stuDashAfter.data.lessonEnrollments.find(
    (e: { sessionId: number }) => e.sessionId === qa1on1Id
  );
  assert.equal(dash1on1After.enrollmentStatus, 'ACCEPTED');
  assert.equal(
    dash1on1After.meetingUrl,
    'https://meet.jusoor.example/qa-1on1-flow'
  );
});



