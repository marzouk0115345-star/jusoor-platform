import { Router } from 'express';
import { z } from 'zod';
import { eq, and, desc, asc, or } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  users,
  providerProfiles,
  availability,
  bookings,
  sessions,
  payments,
  earnings,
  notifications,
  platformSettings,
} from '../../db/schema.ts';
import {
  requireAuth,
  optionalAuth,
  requireRole,
  type AuthRequest,
} from '../auth.ts';
import { calculateCommissionAndNet } from '../../lib/domain.ts';

const router = Router();

router.get('/providers', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const typeFilter =
      typeof req.query.type === 'string' ? req.query.type : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    const rows = await db
      .select({
        userId: users.id,
        fullName: users.fullName,
        email: users.email,
        providerType: providerProfiles.providerType,
        headline: providerProfiles.headline,
        bio: providerProfiles.bio,
        qualifications: providerProfiles.qualifications,
        yearsExperience: providerProfiles.yearsExperience,
        hourlyRate: providerProfiles.hourlyRate,
        currency: providerProfiles.currency,
        verificationStatus: providerProfiles.verificationStatus,
        ratingAvg: providerProfiles.ratingAvg,
        reviewsCount: providerProfiles.reviewsCount,
        isAcceptingTasks: providerProfiles.isAcceptingTasks,
        isAcceptingBookings: providerProfiles.isAcceptingBookings,
      })
      .from(providerProfiles)
      .innerJoin(users, eq(providerProfiles.userId, users.id))
      .where(eq(users.accountStatus, 'ACTIVE'))
      .orderBy(desc(providerProfiles.ratingAvg));

    const filtered = rows.filter((p) => {
      if (typeFilter && p.providerType !== typeFilter) return false;
      if (
        q &&
        !p.fullName.toLowerCase().includes(q) &&
        !p.headline.toLowerCase().includes(q) &&
        !p.bio.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    const enriched = await Promise.all(
      filtered.map(async (p) => {
        const slots = await db
          .select()
          .from(availability)
          .where(
            and(
              eq(availability.providerUserId, p.userId),
              eq(availability.isBooked, false)
            )
          )
          .orderBy(asc(availability.slotDate), asc(availability.startTime));
        return { ...p, availableSlots: slots };
      })
    );

    res.json({ providers: enriched });
  } catch (error) {
    console.error('Providers list error:', error);
    res.status(500).json({ error: 'تعذر جلب قائمة المدرّبين والخبراء.' });
  }
});

router.get('/availability/mine', requireAuth, async (req: AuthRequest, res) => {
  try {
    const slots = await db
      .select()
      .from(availability)
      .where(eq(availability.providerUserId, req.authUser!.id))
      .orderBy(asc(availability.slotDate), asc(availability.startTime));
    res.json({ slots });
  } catch (error) {
    console.error('My availability error:', error);
    res.status(500).json({ error: 'تعذر جلب أوقات التفرغ.' });
  }
});

router.post(
  '/availability',
  requireAuth,
  requireRole('TEACHER', 'MENTOR', 'EXPERT', 'ADMIN'),
  async (req: AuthRequest, res) => {
    try {
      const schema = z.object({
        dayOfWeek: z.string().min(2),
        slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ YYYY-MM-DD مطلوبة'),
        startTime: z.string().regex(/^\d{2}:\d{2}$/, 'صيغة الوقت HH:mm مطلوبة'),
        endTime: z.string().regex(/^\d{2}:\d{2}$/, 'صيغة الوقت HH:mm مطلوبة'),
        serviceType: z
          .enum(['PRIVATE_LESSON', 'MENTORSHIP', 'CONSULTATION'])
          .default('MENTORSHIP'),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || 'بيانات الموعد غير صالحة.',
        });
      }

      const d = parsed.data;
      const [created] = await db
        .insert(availability)
        .values({
          providerUserId: req.authUser!.id,
          dayOfWeek: d.dayOfWeek,
          slotDate: d.slotDate,
          startTime: d.startTime,
          endTime: d.endTime,
          serviceType: d.serviceType,
          isBooked: false,
        })
        .returning();

      res.status(201).json({ slot: created });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.includes('availability_provider_slot_uq')
      ) {
        return res
          .status(409)
          .json({ error: 'هذا الموعد مضاف مسبقاً في جدول تفرغك.' });
      }
      console.error('Create availability error:', error);
      res.status(500).json({ error: 'تعذر إضافة وقت التفرغ.' });
    }
  }
);

router.get('/bookings', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.authUser!.id;
    const rows = await db
      .select()
      .from(bookings)
      .where(
        or(eq(bookings.studentUserId, uid), eq(bookings.providerUserId, uid))
      )
      .orderBy(desc(bookings.createdAt));

    const enriched = await Promise.all(
      rows.map(async (b) => {
        const [[student], [provider], [sess]] = await Promise.all([
          db
            .select({ id: users.id, fullName: users.fullName })
            .from(users)
            .where(eq(users.id, b.studentUserId))
            .limit(1),
          db
            .select({ id: users.id, fullName: users.fullName })
            .from(users)
            .where(eq(users.id, b.providerUserId))
            .limit(1),
          db
            .select()
            .from(sessions)
            .where(eq(sessions.bookingId, b.id))
            .limit(1),
        ]);
        return {
          ...b,
          studentName: student?.fullName || 'طالب',
          providerName: provider?.fullName || 'مقدّم خدمة',
          session: sess || null,
        };
      })
    );

    res.json({ bookings: enriched });
  } catch (error) {
    console.error('List bookings error:', error);
    res.status(500).json({ error: 'تعذر جلب الحجوزات.' });
  }
});

router.post('/bookings', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      availabilityId: z.number().int().positive(),
      topic: z.string().min(4, 'موضوع الجلسة مطلوب'),
      notes: z.string().max(1000).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'بيانات الحجز غير مكتملة.',
      });
    }

    const { availabilityId, topic, notes } = parsed.data;

    const [commissionSetting] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, 'commission_rate_percent'))
      .limit(1);
    const commissionRate = commissionSetting
      ? Number(commissionSetting.value)
      : 10;

    const bookingResult = await db.transaction(async (tx) => {
      // Atomic slot lock to prevent double booking
      const claimedSlots = await tx
        .update(availability)
        .set({ isBooked: true })
        .where(
          and(eq(availability.id, availabilityId), eq(availability.isBooked, false))
        )
        .returning();

      if (claimedSlots.length === 0) {
        throw new Error('SLOT_UNAVAILABLE');
      }
      const slot = claimedSlots[0];
      if (slot.providerUserId === req.authUser!.id) {
        throw new Error('CANNOT_BOOK_SELF');
      }

      const [pp] = await tx
        .select()
        .from(providerProfiles)
        .where(eq(providerProfiles.userId, slot.providerUserId))
        .limit(1);

      const priceNum = pp ? Number(pp.hourlyRate) : 30;
      const { gross, commission, net } = calculateCommissionAndNet(
        priceNum,
        commissionRate
      );

      const [newBooking] = await tx
        .insert(bookings)
        .values({
          studentUserId: req.authUser!.id,
          providerUserId: slot.providerUserId,
          availabilityId: slot.id,
          serviceType: slot.serviceType,
          topic: topic.trim(),
          notes: notes?.trim() || null,
          scheduledStart: `${slot.slotDate} ${slot.startTime}`,
          scheduledEnd: `${slot.slotDate} ${slot.endTime}`,
          price: gross.toFixed(2),
          status: 'PENDING',
          isDemo: false,
        })
        .returning();

      const [sess] = await tx
        .insert(sessions)
        .values({
          bookingId: newBooking.id,
          meetingLink: `https://meet.jusoor.example/room-${newBooking.id}`,
          status: 'SCHEDULED',
        })
        .returning();

      const [pay] = await tx
        .insert(payments)
        .values({
          payerUserId: req.authUser!.id,
          payeeUserId: slot.providerUserId,
          entityType: 'BOOKING',
          entityId: newBooking.id,
          amount: gross.toFixed(2),
          commissionAmount: commission.toFixed(2),
          netAmount: net.toFixed(2),
          paymentMode: process.env.PAYMENT_PROVIDER_KEY
            ? 'GATEWAY_LIVE'
            : 'SANDBOX_PENDING',
          status: process.env.PAYMENT_PROVIDER_KEY
            ? 'PENDING'
            : 'PENDING_SETUP',
          paymentReference: `JSR-BKG-${Date.now()}-${newBooking.id}`,
        })
        .returning();

      await tx.insert(earnings).values({
        providerUserId: slot.providerUserId,
        paymentId: pay.id,
        grossAmount: gross.toFixed(2),
        commissionAmount: commission.toFixed(2),
        netAmount: net.toFixed(2),
        status: 'PENDING',
      });

      await tx.insert(notifications).values({
        userId: slot.providerUserId,
        type: 'BOOKING',
        title: 'طلب حجز جلسة جديد',
        body: `حجز ${req.authUser!.fullName} جلسة (${slot.serviceType}) بتاريخ ${slot.slotDate} الساعة ${slot.startTime}.`,
        linkUrl: '/bookings',
      });

      return { booking: newBooking, session: sess };
    });

    res.status(201).json(bookingResult);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'SLOT_UNAVAILABLE') {
      return res
        .status(409)
        .json({ error: 'عذراً، هذا الموعد غير متاح أو تم حجزه للتو.' });
    }
    if (error instanceof Error && error.message === 'CANNOT_BOOK_SELF') {
      return res.status(400).json({ error: 'لا يمكنك حجز موعد مع نفسك.' });
    }
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'تعذر إتمام الحجز.' });
  }
});

router.patch('/bookings/:id/status', requireAuth, async (req: AuthRequest, res) => {
  try {
    const bookingId = Number(req.params.id);
    const schema = z.object({
      status: z.enum(['CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED']),
      cancellationReason: z.string().max(300).optional(),
      newAvailabilityId: z.number().int().positive().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'بيانات التحديث غير صالحة.' });
    }

    const [bookingRow] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);
    if (!bookingRow) {
      return res.status(404).json({ error: 'الحجز غير موجود.' });
    }

    const uid = req.authUser!.id;
    const isParticipant =
      bookingRow.studentUserId === uid ||
      bookingRow.providerUserId === uid ||
      req.authUser!.roles.includes('ADMIN');

    if (!isParticipant) {
      return res.status(403).json({ error: 'غير مصرح بإدارة هذا الحجز.' });
    }

    if (
      parsed.data.status === 'CONFIRMED' &&
      bookingRow.providerUserId !== uid &&
      !req.authUser!.roles.includes('ADMIN')
    ) {
      return res
        .status(403)
        .json({ error: 'فقط مقدّم الخدمة يمكنه تأكيد الحجز.' });
    }

    const updated = await db.transaction(async (tx) => {
      if (parsed.data.status === 'CANCELLED' && bookingRow.availabilityId) {
        await tx
          .update(availability)
          .set({ isBooked: false })
          .where(eq(availability.id, bookingRow.availabilityId));
      }

      let schedulePatch: Partial<typeof bookings.$inferInsert> = {};
      if (
        parsed.data.status === 'RESCHEDULED' &&
        parsed.data.newAvailabilityId
      ) {
        const claimed = await tx
          .update(availability)
          .set({ isBooked: true })
          .where(
            and(
              eq(availability.id, parsed.data.newAvailabilityId),
              eq(availability.isBooked, false),
              eq(availability.providerUserId, bookingRow.providerUserId)
            )
          )
          .returning();
        if (claimed.length === 0) {
          throw new Error('NEW_SLOT_UNAVAILABLE');
        }
        if (bookingRow.availabilityId) {
          await tx
            .update(availability)
            .set({ isBooked: false })
            .where(eq(availability.id, bookingRow.availabilityId));
        }
        schedulePatch = {
          availabilityId: claimed[0].id,
          scheduledStart: `${claimed[0].slotDate} ${claimed[0].startTime}`,
          scheduledEnd: `${claimed[0].slotDate} ${claimed[0].endTime}`,
        };
      }

      const [row] = await tx
        .update(bookings)
        .set({
          status: parsed.data.status,
          cancellationReason: parsed.data.cancellationReason || null,
          ...schedulePatch,
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, bookingId))
        .returning();

      return row;
    });

    res.json({ booking: updated });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'NEW_SLOT_UNAVAILABLE') {
      return res.status(409).json({ error: 'الموعد الجديد المختار غير متاح.' });
    }
    console.error('Update booking status error:', error);
    res.status(500).json({ error: 'تعذر تحديث حالة الحجز.' });
  }
});

export default router;
