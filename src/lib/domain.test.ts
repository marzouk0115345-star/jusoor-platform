import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransitionTaskStatus,
  calculateCompletionPercent,
  calculateCommissionAndNet,
  gradeQuizAttempt,
  hasAnyRole,
  hasCenterPermission,
  classifyLearnerNeed,
  doTimeRangesOverlap,
  calculateDurationMinutes,
  computeSessionAvailability,
  validateSessionSchedule,
  canCancelSessionEnrollment,
  canEditTeachingSession,
  validateCurriculumContextCombination,
  canAssignTeacherToCurriculumSubject,
  filterAndSortDiscoveredTeachers,
} from './domain.ts';

test('task lifecycle transitions enforce valid state machine', () => {
  assert.equal(canTransitionTaskStatus('OPEN', 'OFFERS_RECEIVED'), true);
  assert.equal(canTransitionTaskStatus('OFFERS_RECEIVED', 'OFFER_ACCEPTED'), true);
  assert.equal(canTransitionTaskStatus('OFFER_ACCEPTED', 'IN_PROGRESS'), true);
  assert.equal(canTransitionTaskStatus('IN_PROGRESS', 'DELIVERED'), true);
  assert.equal(canTransitionTaskStatus('DELIVERED', 'COMPLETED'), true);
  assert.equal(canTransitionTaskStatus('COMPLETED', 'OPEN'), false);
  assert.equal(canTransitionTaskStatus('OPEN', 'COMPLETED'), false);
});

test('course completion percentage clamps and handles empty lessons', () => {
  assert.equal(calculateCompletionPercent(0, 0), 0);
  assert.equal(calculateCompletionPercent(2, 4), 50);
  assert.equal(calculateCompletionPercent(5, 4), 100);
});

test('commission and net payout math preserves 2-decimal precision', () => {
  const res = calculateCommissionAndNet(120, 10);
  assert.deepEqual(res, { gross: 120, commission: 12, net: 108 });
});

test('quiz grading evaluates objective questions accurately', () => {
  const result = gradeQuizAttempt(
    [
      { id: 1, points: 50, correctAnswerId: 10 },
      { id: 2, points: 50, correctAnswerId: 22 },
    ],
    [
      { questionId: 1, selectedAnswerId: 10 },
      { questionId: 2, selectedAnswerId: 21 },
    ],
    70
  );
  assert.equal(result.score, 50);
  assert.equal(result.maxScore, 100);
  assert.equal(result.percentage, 50);
  assert.equal(result.passed, false);
});

test('RBAC and center staff permissions enforce access boundaries', () => {
  assert.equal(hasAnyRole(['STUDENT'], ['ADMIN']), false);
  assert.equal(hasAnyRole(['STUDENT', 'TEACHER'], ['TEACHER']), true);
  assert.equal(hasCenterPermission('STAFF', ['VIEW_COURSES'], 'MANAGE_STAFF'), false);
  assert.equal(hasCenterPermission('OWNER', [], 'MANAGE_STAFF'), true);
});

test('learner gap analyzer prioritizes mentorship for practical project blockers', () => {
  const diag = classifyLearnerNeed(
    'أعرف HTML و CSS و JavaScript لكن لا أستطيع العمل على مشاريع شركات حقيقية'
  );
  assert.equal(diag.recommendedSolutionType, 'MENTORSHIP');
});

test('session time overlap and duration calculations work accurately', () => {
  assert.equal(
    doTimeRangesOverlap(
      '2027-01-10T10:00:00Z',
      '2027-01-10T11:00:00Z',
      '2027-01-10T10:30:00Z',
      '2027-01-10T11:30:00Z'
    ),
    true
  );
  // Adjacent slots (end === next start) do not overlap
  assert.equal(
    doTimeRangesOverlap(
      '2027-01-10T10:00:00Z',
      '2027-01-10T11:00:00Z',
      '2027-01-10T11:00:00Z',
      '2027-01-10T12:00:00Z'
    ),
    false
  );
  assert.equal(
    calculateDurationMinutes('2027-01-10T10:00:00Z', '2027-01-10T11:30:00Z'),
    90
  );
});

test('session availability & capacity transitions handle ONE_TO_ONE and GROUP sessions', () => {
  const oneToOneOpen = computeSessionAvailability({
    sessionType: 'ONE_TO_ONE',
    capacity: 1,
    acceptedCount: 0,
    status: 'OPEN',
    startTime: '2027-05-01T15:00:00Z',
    now: '2027-04-01T12:00:00Z',
  });
  assert.equal(oneToOneOpen.remainingSeats, 1);
  assert.equal(oneToOneOpen.isRegistrationOpen, true);
  assert.equal(oneToOneOpen.nextStatus, 'OPEN');

  const oneToOneFilled = computeSessionAvailability({
    sessionType: 'ONE_TO_ONE',
    capacity: 1,
    acceptedCount: 1,
    status: 'OPEN',
    startTime: '2027-05-01T15:00:00Z',
    now: '2027-04-01T12:00:00Z',
  });
  assert.equal(oneToOneFilled.remainingSeats, 0);
  assert.equal(oneToOneFilled.isFull, true);
  assert.equal(oneToOneFilled.nextStatus, 'FULL');

  const groupReopened = computeSessionAvailability({
    sessionType: 'GROUP',
    capacity: 5,
    acceptedCount: 4,
    status: 'FULL',
    startTime: '2027-05-01T15:00:00Z',
    registrationDeadline: '2027-04-30T23:59:00Z',
    now: '2027-04-01T12:00:00Z',
  });
  assert.equal(groupReopened.remainingSeats, 1);
  assert.equal(groupReopened.nextStatus, 'OPEN');
  assert.equal(groupReopened.isRegistrationOpen, true);

  const pastDeadline = computeSessionAvailability({
    sessionType: 'GROUP',
    capacity: 5,
    acceptedCount: 2,
    status: 'OPEN',
    startTime: '2027-05-01T15:00:00Z',
    registrationDeadline: '2027-04-10T00:00:00Z',
    now: '2027-04-12T00:00:00Z',
  });
  assert.equal(pastDeadline.isRegistrationOpen, false);
});

test('session schedule validation, editing rules, and cancellation rules enforce business logic', () => {
  const errInPersonNoLocation = validateSessionSchedule({
    sessionType: 'GROUP',
    startTime: '2027-05-01T15:00:00Z',
    endTime: '2027-05-01T16:30:00Z',
    capacity: 10,
    minStudents: 3,
    deliveryMode: 'IN_PERSON',
    location: '',
    price: 25,
    now: '2027-04-01T12:00:00Z',
  });
  assert.ok(errInPersonNoLocation !== null);

  const validGroup = validateSessionSchedule({
    sessionType: 'GROUP',
    startTime: '2027-05-01T15:00:00Z',
    endTime: '2027-05-01T16:30:00Z',
    capacity: 10,
    minStudents: 3,
    registrationDeadline: '2027-04-30T15:00:00Z',
    deliveryMode: 'ONLINE',
    meetingUrl: 'https://meet.example/room',
    price: 25,
    now: '2027-04-01T12:00:00Z',
  });
  assert.equal(validGroup, null);

  assert.equal(
    canEditTeachingSession({
      currentStatus: 'OPEN',
      acceptedCount: 4,
      activeRequestsCount: 5,
      nextCapacity: 3,
      currentSessionType: 'GROUP',
    }).allowed,
    false
  );

  assert.equal(
    canCancelSessionEnrollment({
      enrollmentStatus: 'ACCEPTED',
      sessionStatus: 'FULL',
      startTime: '2027-05-01T15:00:00Z',
      now: '2027-04-01T12:00:00Z',
    }).allowed,
    true
  );

  assert.equal(
    canCancelSessionEnrollment({
      enrollmentStatus: 'ACCEPTED',
      sessionStatus: 'OPEN',
      startTime: '2027-04-01T10:00:00Z',
      now: '2027-04-01T12:00:00Z',
    }).allowed,
    false
  );
});

test('Egyptian curriculum context validation keeps General Secondary divisions and Baccalaureate pathways strictly separate', () => {
  assert.equal(
    validateCurriculumContextCombination({
      systemCode: 'PRIMARY_GENERAL',
      gradeNumber: 4,
    }).valid,
    true
  );

  assert.equal(
    validateCurriculumContextCombination({
      systemCode: 'PRIMARY_GENERAL',
      gradeNumber: 4,
      divisionId: 1,
    }).valid,
    false
  );

  assert.equal(
    validateCurriculumContextCombination({
      systemCode: 'GENERAL_SECONDARY',
      gradeNumber: 1,
      divisionId: 1,
    }).valid,
    false
  );

  assert.equal(
    validateCurriculumContextCombination({
      systemCode: 'GENERAL_SECONDARY',
      gradeNumber: 3,
      pathwayId: 2,
    }).valid,
    false
  );

  assert.equal(
    validateCurriculumContextCombination({
      systemCode: 'GENERAL_SECONDARY',
      gradeNumber: 3,
      divisionId: 4,
      divisionBelongsToGrade: true,
    }).valid,
    true
  );

  assert.equal(
    validateCurriculumContextCombination({
      systemCode: 'EGYPTIAN_BACCALAUREATE',
      gradeNumber: 1,
      pathwayId: 1,
    }).valid,
    false
  );

  assert.equal(
    validateCurriculumContextCombination({
      systemCode: 'EGYPTIAN_BACCALAUREATE',
      gradeNumber: 2,
      pathwayId: 3,
      pathwayBelongsToGrade: true,
    }).valid,
    true
  );
});

test('teacher assignment eligibility enforces active and assignable subject rules', () => {
  assert.equal(
    canAssignTeacherToCurriculumSubject({
      isActive: true,
      isAvailableForTeacherAssignment: true,
    }).allowed,
    true
  );
  assert.equal(
    canAssignTeacherToCurriculumSubject({
      isActive: false,
      isAvailableForTeacherAssignment: true,
    }).allowed,
    false
  );
  assert.equal(
    canAssignTeacherToCurriculumSubject({
      isActive: true,
      isAvailableForTeacherAssignment: false,
    }).allowed,
    false
  );
});

test('discovered teachers filtering and sorting supports teachers without courses and multiple filters', () => {
  const sample = [
    {
      teacherId: 1,
      fullName: 'أحمد علي',
      jobTitle: 'معلم رياضيات',
      bio: 'خبرة في المرحلة الابتدائية',
      ratingAvg: 4.9,
      reviewsCount: 15,
      yearsExperience: 9,
      effectivePrice: 40,
      publishedCoursesCount: 0, // discoverable even with 0 courses
      individualSessionsCount: 2,
      groupSessionsCount: 1,
      supportsOnline: true,
      supportsInPerson: false,
      languagesOffered: ['ar', 'en'],
    },
    {
      teacherId: 2,
      fullName: 'سلمى حسن',
      jobTitle: 'معلمة رياضيات لغات',
      bio: 'شرح مبسط باللغة الإنجليزية',
      ratingAvg: 4.7,
      reviewsCount: 8,
      yearsExperience: 5,
      effectivePrice: 25,
      publishedCoursesCount: 2,
      individualSessionsCount: 0,
      groupSessionsCount: 2,
      supportsOnline: true,
      supportsInPerson: true,
      languagesOffered: ['en'],
    },
  ];

  const byPrice = filterAndSortDiscoveredTeachers(sample, {
    language: 'en',
    sort: 'price_asc',
  });
  assert.equal(byPrice.length, 2);
  assert.equal(byPrice[0].teacherId, 2);

  const inPersonOnly = filterAndSortDiscoveredTeachers(sample, {
    deliveryMode: 'IN_PERSON',
  });
  assert.equal(inPersonOnly.length, 1);
  assert.equal(inPersonOnly[0].teacherId, 2);

  const noCourseTeacherStillReturned = filterAndSortDiscoveredTeachers(sample, {
    q: 'أحمد',
  });
  assert.equal(noCourseTeacherStillReturned.length, 1);
  assert.equal(noCourseTeacherStillReturned[0].publishedCoursesCount, 0);
});


