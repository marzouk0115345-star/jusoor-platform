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

import {
  normalizeDeliveryMode,
  isOfflineDeliveryMode,
  formatOfflineAddress,
  formatCurrencyPrice,
  computeIndividualSlotStatus,
} from './domain.ts';

test('individual slot status, offline address formatting, currency formatting, and OFFLINE normalization work cleanly', () => {
  assert.equal(normalizeDeliveryMode('OFFLINE'), 'IN_PERSON');
  assert.equal(normalizeDeliveryMode('IN_PERSON'), 'IN_PERSON');
  assert.equal(normalizeDeliveryMode('ONLINE'), 'ONLINE');
  assert.equal(isOfflineDeliveryMode('OFFLINE'), true);
  assert.equal(isOfflineDeliveryMode('IN_PERSON'), true);
  assert.equal(isOfflineDeliveryMode('ONLINE'), false);

  assert.equal(formatCurrencyPrice(180, 'EGP', 'ar'), '180 ج.م');
  assert.equal(formatCurrencyPrice(180, 'EGP', 'en'), '180 EGP');
  assert.equal(formatCurrencyPrice(0, 'EGP', 'ar'), 'مجانية');
  assert.equal(formatCurrencyPrice(25, 'USD', 'ar'), '$25');

  const addr = formatOfflineAddress({
    buildingOrCenterName: 'سنتر المعرفة التعليمي',
    streetName: 'شارع مصطفى النحاس',
    district: 'مدينة نصر',
    city: 'القاهرة',
    governorate: 'القاهرة',
    locationNotes: 'موقع عرض تجريبي',
  });
  assert.ok(addr.includes('سنتر المعرفة التعليمي'));
  assert.ok(addr.includes('مدينة نصر'));
  assert.ok(addr.includes('القاهرة'));

  assert.equal(
    computeIndividualSlotStatus({
      sessionType: 'ONE_TO_ONE',
      status: 'OPEN',
      acceptedCount: 0,
      pendingCount: 0,
      startTime: '2027-06-01T15:00:00Z',
      now: '2027-05-01T10:00:00Z',
    }),
    'AVAILABLE'
  );
  assert.equal(
    computeIndividualSlotStatus({
      sessionType: 'ONE_TO_ONE',
      status: 'OPEN',
      acceptedCount: 0,
      pendingCount: 1,
      startTime: '2027-06-01T15:00:00Z',
      now: '2027-05-01T10:00:00Z',
    }),
    'PENDING'
  );
  assert.equal(
    computeIndividualSlotStatus({
      sessionType: 'ONE_TO_ONE',
      status: 'FULL',
      acceptedCount: 1,
      pendingCount: 0,
      startTime: '2027-06-01T15:00:00Z',
      now: '2027-05-01T10:00:00Z',
    }),
    'BOOKED'
  );
  assert.equal(
    computeIndividualSlotStatus({
      sessionType: 'ONE_TO_ONE',
      status: 'CANCELLED',
      acceptedCount: 0,
      pendingCount: 0,
      startTime: '2027-06-01T15:00:00Z',
      now: '2027-05-01T10:00:00Z',
    }),
    'UNAVAILABLE'
  );
  assert.equal(
    computeIndividualSlotStatus({
      sessionType: 'GROUP',
      status: 'OPEN',
      acceptedCount: 0,
      pendingCount: 0,
      startTime: '2027-06-01T15:00:00Z',
      now: '2027-05-01T10:00:00Z',
    }),
    null
  );
});

import {
  isValidCalendarDate,
  validateTaskDeadline,
  validateAvailabilitySlot,
  mapBookingStatusToSessionStatus,
  classifyRecordOrigin,
} from './domain.ts';

test('date, task deadline, availability slot, and session horizon validations reject 2099 and past/invalid dates', () => {
  assert.equal(isValidCalendarDate('2026-12-15'), true);
  assert.equal(isValidCalendarDate('2026-02-30'), false);
  assert.equal(isValidCalendarDate('2026-13-01'), false);
  assert.equal(isValidCalendarDate('30-12-2026'), false);

  const now = '2026-11-26T10:00:00Z';
  assert.equal(validateTaskDeadline('2026-12-20', now), null);
  assert.ok(validateTaskDeadline('2026-11-25', now) !== null);
  assert.ok(validateTaskDeadline('2099-12-30', now) !== null);
  assert.ok(validateTaskDeadline('2026-02-29', now) !== null);

  assert.equal(validateAvailabilitySlot('2026-12-10', '14:00', '15:00', now), null);
  assert.ok(validateAvailabilitySlot('2026-12-10', '15:00', '14:00', now) !== null);
  assert.ok(validateAvailabilitySlot('2026-11-26', '09:00', '10:00', now) !== null);
  assert.ok(validateAvailabilitySlot('2099-12-15', '14:00', '15:00', now) !== null);

  const tooFarSessionErr = validateSessionSchedule({
    sessionType: 'ONE_TO_ONE',
    startTime: '2099-12-15T14:00:00Z',
    endTime: '2099-12-15T15:00:00Z',
    capacity: 1,
    deliveryMode: 'ONLINE',
    price: 30,
    now,
  });
  assert.ok(tooFarSessionErr !== null);

  assert.equal(mapBookingStatusToSessionStatus('COMPLETED'), 'COMPLETED');
  assert.equal(mapBookingStatusToSessionStatus('CANCELLED'), 'CANCELLED');
  assert.equal(mapBookingStatusToSessionStatus('CONFIRMED'), 'SCHEDULED');
  assert.equal(mapBookingStatusToSessionStatus('PENDING'), 'SCHEDULED');

  assert.equal(classifyRecordOrigin('qa.student.123@jusoor.test', false), 'QA_TEST');
  assert.equal(classifyRecordOrigin('tariq.teacher@demo.jusoor.edu', true), 'DEMO');
  assert.equal(classifyRecordOrigin('marzouk@example.com', false), 'REAL');
});

import {
  validateCourseImageMeta,
  detectImageFormatFromBytes,
  canManageCenterResource,
  canCourseAcceptNewEnrollment,
  MAX_COURSE_IMAGE_BYTES,
} from './domain.ts';

test('course image validation enforces allowed types, size limits, and magic bytes', () => {
  assert.equal(
    validateCourseImageMeta({
      mimeType: 'image/png',
      sizeBytes: 1024 * 500,
      fileName: 'cover.png',
    }).valid,
    true
  );
  assert.equal(
    validateCourseImageMeta({
      mimeType: 'image/jpeg',
      sizeBytes: 1024 * 800,
      fileName: 'cover.jpg',
    }).valid,
    true
  );
  assert.equal(
    validateCourseImageMeta({
      mimeType: 'image/webp',
      sizeBytes: 1024 * 300,
      fileName: 'cover.webp',
    }).valid,
    true
  );
  assert.equal(
    validateCourseImageMeta({
      mimeType: 'image/svg+xml',
      sizeBytes: 1024,
      fileName: 'cover.svg',
    }).valid,
    false
  );
  assert.equal(
    validateCourseImageMeta({
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      fileName: 'doc.pdf',
    }).valid,
    false
  );
  assert.equal(
    validateCourseImageMeta({
      mimeType: 'image/png',
      sizeBytes: MAX_COURSE_IMAGE_BYTES + 1,
      fileName: 'huge.png',
    }).valid,
    false
  );

  const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(detectImageFormatFromBytes(jpegBytes), 'jpg');

  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  assert.equal(detectImageFormatFromBytes(pngBytes), 'png');

  const webpBytes = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
  ]);
  assert.equal(detectImageFormatFromBytes(webpBytes), 'webp');

  const fakePng = new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(detectImageFormatFromBytes(fakePng), null);
});

test('center resource permissions isolate inactive memberships and non-owners', () => {
  assert.equal(
    canManageCenterResource({
      isAdmin: false,
      ownerUserId: 10,
      callerUserId: 10,
      membership: null,
      requiredPermission: 'MANAGE_SETTINGS',
    }),
    true
  );

  assert.equal(
    canManageCenterResource({
      isAdmin: false,
      ownerUserId: 10,
      callerUserId: 20,
      membership: {
        memberRole: 'STAFF',
        status: 'ACTIVE',
        permissionsJson: ['MANAGE_COURSES'],
      },
      requiredPermission: 'MANAGE_COURSES',
    }),
    true
  );

  assert.equal(
    canManageCenterResource({
      isAdmin: false,
      ownerUserId: 10,
      callerUserId: 20,
      membership: {
        memberRole: 'STAFF',
        status: 'INACTIVE',
        permissionsJson: ['MANAGE_COURSES'],
      },
      requiredPermission: 'MANAGE_COURSES',
    }),
    false
  );

  assert.equal(
    canManageCenterResource({
      isAdmin: false,
      ownerUserId: 10,
      callerUserId: 99,
      membership: null,
      requiredPermission: 'MANAGE_COURSES',
    }),
    false
  );
});

test('course enrollment availability enforces published status, enrollment status, and maxStudents capacity', () => {
  assert.equal(
    canCourseAcceptNewEnrollment({
      status: 'PUBLISHED',
      enrollmentStatus: 'OPEN',
      maxStudents: 25,
      activeEnrolledCount: 10,
    }).allowed,
    true
  );
  assert.equal(
    canCourseAcceptNewEnrollment({
      status: 'DRAFT',
      enrollmentStatus: 'OPEN',
      maxStudents: 25,
      activeEnrolledCount: 0,
    }).allowed,
    false
  );
  assert.equal(
    canCourseAcceptNewEnrollment({
      status: 'PUBLISHED',
      enrollmentStatus: 'PAUSED',
      maxStudents: 25,
      activeEnrolledCount: 10,
    }).allowed,
    false
  );
  assert.equal(
    canCourseAcceptNewEnrollment({
      status: 'PUBLISHED',
      enrollmentStatus: 'OPEN',
      maxStudents: 10,
      activeEnrolledCount: 10,
    }).allowed,
    false
  );
});

import {
  getCenterVerificationLabelAr,
  formatCenterFullAddress,
  validateCoordinates,
  parseCoordinatesFromMapsInput,
  buildGoogleMapsSearchUrl,
  isPublicCenterCourseVisible,
  isPublicCenterMemberVisible,
} from './domain.ts';

test('center verification Arabic labels, structured addresses, Google Maps URLs, and public visibility rules work accurately', () => {
  assert.equal(getCenterVerificationLabelAr('VERIFIED'), 'مركز موثوق');
  assert.equal(getCenterVerificationLabelAr('PENDING'), 'قيد المراجعة');
  assert.equal(getCenterVerificationLabelAr('REJECTED'), 'مرفوض التوثيق');
  assert.equal(getCenterVerificationLabelAr('UNVERIFIED'), 'غير موثّق');

  const fullAddress = formatCenterFullAddress({
    buildingDetails: 'برج النور - الدور الثالث',
    street: 'شارع عباس العقاد',
    address: 'مدينة نصر، شارع عباس العقاد',
    city: 'مدينة نصر',
    governorate: 'القاهرة',
    country: 'مصر',
  });
  assert.ok(fullAddress.includes('برج النور'));
  assert.ok(fullAddress.includes('شارع عباس العقاد'));
  assert.ok(fullAddress.includes('القاهرة'));

  const mapsByCoords = buildGoogleMapsSearchUrl({
    latitude: 30.060912,
    longitude: 31.339712,
    city: 'القاهرة',
    address: 'شارع عباس العقاد',
  });
  assert.equal(
    mapsByCoords,
    'https://www.google.com/maps/search/?api=1&query=30.060912,31.339712'
  );

  const mapsByAddress = buildGoogleMapsSearchUrl({
    latitude: null,
    longitude: null,
    governorate: 'القاهرة',
    city: 'مدينة نصر',
    street: 'شارع عباس العقاد',
    country: 'مصر',
  });
  assert.ok(mapsByAddress?.startsWith('https://www.google.com/maps/search/?api=1&query='));
  assert.ok(!mapsByAddress?.includes('30.06'));

  assert.equal(buildGoogleMapsSearchUrl({}), null);

  assert.equal(validateCoordinates(30.05, 31.23).valid, true);
  assert.equal(validateCoordinates(30.05, null).valid, false);
  assert.equal(validateCoordinates(95, 31.23).valid, false);
  assert.equal(validateCoordinates(30.05, 190).valid, false);

  assert.deepEqual(
    parseCoordinatesFromMapsInput('https://www.google.com/maps/@30.0444,31.2357,17z'),
    { latitude: 30.0444, longitude: 31.2357 }
  );
  assert.deepEqual(
    parseCoordinatesFromMapsInput('30.055, 31.333'),
    { latitude: 30.055, longitude: 31.333 }
  );
  assert.equal(parseCoordinatesFromMapsInput('https://example.com/no-coords'), null);

  assert.equal(isPublicCenterCourseVisible('PUBLISHED'), true);
  assert.equal(isPublicCenterCourseVisible('DRAFT'), false);
  assert.equal(isPublicCenterCourseVisible('PAUSED'), false);
  assert.equal(isPublicCenterCourseVisible('CLOSED'), false);
  assert.equal(isPublicCenterCourseVisible('ARCHIVED'), false);

  assert.equal(isPublicCenterMemberVisible('ACTIVE', 'ACTIVE'), true);
  assert.equal(isPublicCenterMemberVisible('INACTIVE', 'ACTIVE'), false);
  assert.equal(isPublicCenterMemberVisible('ACTIVE', 'SUSPENDED'), false);
});

import {
  resolveCourseFieldDisplay,
  validateManualCourseField,
  formatArabicLessonOrdinal,
  reorderCourseLessons,
  validateCourseLessonInput,
  validateCoursePublishReadiness,
} from './domain.ts';

test('manual course field display & validation preserve custom Arabic/English text without overwriting', () => {
  assert.equal(resolveCourseFieldDisplay('الأمن السيبراني', 'تكنولوجيا المعلومات'), 'الأمن السيبراني');
  assert.equal(resolveCourseFieldDisplay('  Cybersecurity  ', 'برمجة'), 'Cybersecurity');
  assert.equal(resolveCourseFieldDisplay(null, 'اللغة العربية'), 'اللغة العربية');
  assert.equal(resolveCourseFieldDisplay('', ''), 'عام');

  assert.equal(validateManualCourseField('').valid, false);
  assert.equal(validateManualCourseField('   ').valid, false);
  assert.equal(validateManualCourseField('أ').valid, false);
  assert.deepEqual(validateManualCourseField('  تطوير   الويب  '), {
    valid: true,
    value: 'تطوير الويب',
  });
  assert.deepEqual(validateManualCourseField('AI & Machine Learning'), {
    valid: true,
    value: 'AI & Machine Learning',
  });
});

test('Arabic lesson ordinals, lesson reordering, and course publish readiness work accurately', () => {
  assert.equal(formatArabicLessonOrdinal(0), 'الدرس الأول');
  assert.equal(formatArabicLessonOrdinal(1), 'الدرس الثاني');
  assert.equal(formatArabicLessonOrdinal(9), 'الدرس العاشر');
  assert.equal(formatArabicLessonOrdinal(10), 'الدرس 11');

  const reordered = reorderCourseLessons(
    [
      { title: 'A', sortOrder: 1 },
      { title: 'B', sortOrder: 2 },
      { title: 'C', sortOrder: 3 },
    ],
    2,
    0
  );
  assert.deepEqual(
    reordered.map((l) => [l.title, l.sortOrder]),
    [
      ['C', 1],
      ['A', 2],
      ['B', 3],
    ]
  );

  assert.equal(
    validateCourseLessonInput({ title: 'مقدمة', content: 'شرح تفصيلي للمفاهيم الأساسية', durationMinutes: 25 }, 0)
      .valid,
    true
  );
  assert.equal(
    validateCourseLessonInput({ title: 'مقدمة', content: 'قصير', durationMinutes: 25 }, 0).valid,
    false
  );

  const missingLessonsPublish = validateCoursePublishReadiness({
    title: 'أساسيات الأمن السيبراني',
    description: 'دورة متكاملة لفهم مفاهيم الحماية والاختبار الأخلاقي.',
    customFieldName: 'الأمن السيبراني',
    lessons: [],
    status: 'PUBLISHED',
  });
  assert.equal(missingLessonsPublish.valid, false);
  assert.ok(missingLessonsPublish.errors.lessons);

  const validPublish = validateCoursePublishReadiness({
    title: 'أساسيات الأمن السيبراني',
    description: 'دورة متكاملة لفهم مفاهيم الحماية والاختبار الأخلاقي.',
    customFieldName: 'الأمن السيبراني',
    lessons: [
      { title: 'مقدمة في أمن الشبكات', content: 'شرح مفصل للبروتوكولات وطرق الحماية.', durationMinutes: 20 },
    ],
    status: 'PUBLISHED',
  });
  assert.equal(validPublish.valid, true);
});


