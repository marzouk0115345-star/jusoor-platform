import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { eq } from 'drizzle-orm';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };
import { db } from '../db/index.ts';
import { users, roles, userRoles } from '../db/schema.ts';
import type { RoleCode } from '../lib/domain.ts';

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

export const adminAuth = getAuth();

// Server-only signing secret with cryptographically random in-memory fallback
const EPHEMERAL_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');
function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  return envSecret && envSecret.length >= 16
    ? envSecret
    : EPHEMERAL_FALLBACK_SECRET;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  const originalBuf = Buffer.from(originalHex, 'hex');
  if (derivedBuf.length !== originalBuf.length) return false;
  return crypto.timingSafeEqual(derivedBuf, originalBuf);
}

export interface SessionPayload {
  userId: number;
  email: string;
  exp: number;
}

export function signSessionToken(userId: number, email: string): string {
  const payload: SessionPayload = {
    userId,
    email,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `jusoor.${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!token.startsWith('jusoor.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SessionPayload;
    if (!parsed.userId || !parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export interface AuthenticatedUser {
  id: number;
  uid: string | null;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  accountStatus: string;
  isDemo: boolean;
  roles: RoleCode[];
}

export interface AuthRequest extends Request {
  authUser?: AuthenticatedUser;
}

async function loadUserWithRolesById(
  userId: number
): Promise<AuthenticatedUser | null> {
  const [userRow] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!userRow || userRow.accountStatus === 'SUSPENDED') return null;

  const roleRows = await db
    .select({ code: roles.code })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userRow.id));

  return {
    id: userRow.id,
    uid: userRow.uid,
    email: userRow.email,
    fullName: userRow.fullName,
    avatarUrl: userRow.avatarUrl,
    accountStatus: userRow.accountStatus,
    isDemo: userRow.isDemo,
    roles: roleRows.map((r) => r.code as RoleCode),
  };
}

async function getOrCreateFirebaseUser(
  uid: string,
  email: string,
  fullName: string,
  avatarUrl?: string
): Promise<AuthenticatedUser | null> {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.uid, uid))
    .limit(1);

  let userId: number;
  if (existing.length > 0) {
    userId = existing[0].id;
  } else {
    const byEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (byEmail.length > 0) {
      await db
        .update(users)
        .set({ uid, emailVerified: true, updatedAt: new Date() })
        .where(eq(users.id, byEmail[0].id));
      userId = byEmail[0].id;
    } else {
      const [inserted] = await db
        .insert(users)
        .values({
          uid,
          email,
          fullName: fullName || email.split('@')[0],
          avatarUrl: avatarUrl || null,
          emailVerified: true,
          isDemo: false,
        })
        .onConflictDoUpdate({
          target: users.email,
          set: { uid, emailVerified: true },
        })
        .returning();
      userId = inserted.id;

      // Assign default STUDENT role (+ ADMIN if owner email)
      const [studentRole] = await db
        .select()
        .from(roles)
        .where(eq(roles.code, 'STUDENT'))
        .limit(1);
      if (studentRole) {
        await db
          .insert(userRoles)
          .values({ userId, roleId: studentRole.id })
          .onConflictDoNothing();
      }
      if (email.toLowerCase() === 'marzouk.0115345@gmail.com') {
        const [adminRole] = await db
          .select()
          .from(roles)
          .where(eq(roles.code, 'ADMIN'))
          .limit(1);
        if (adminRole) {
          await db
            .insert(userRoles)
            .values({ userId, roleId: adminRole.id })
            .onConflictDoNothing();
        }
      }
    }
  }

  return loadUserWithRolesById(userId);
}

async function resolveAuthHeader(
  authHeader?: string
): Promise<AuthenticatedUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const sessionPayload = verifySessionToken(token);
  if (sessionPayload) {
    return loadUserWithRolesById(sessionPayload.userId);
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return getOrCreateFirebaseUser(
      decoded.uid,
      decoded.email || `${decoded.uid}@firebase.local`,
      decoded.name || decoded.email?.split('@')[0] || 'مستخدم جسور',
      decoded.picture
    );
  } catch {
    return null;
  }
}

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    req.authUser = (await resolveAuthHeader(req.headers.authorization)) || undefined;
  } catch {
    req.authUser = undefined;
  }
  next();
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const user = await resolveAuthHeader(req.headers.authorization);
  if (!user) {
    return res.status(401).json({
      error: 'غير مصرح: يرجى تسجيل الدخول للوصول إلى هذا المورد.',
    });
  }
  req.authUser = user;
  next();
};

export const requireRole = (...allowed: RoleCode[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: 'غير مصرح: يرجى تسجيل الدخول.' });
    }
    const ok = allowed.some((r) => req.authUser!.roles.includes(r));
    if (!ok) {
      return res.status(403).json({
        error: 'ممنوع: لا تملك الصلاحية الكافية لتنفيذ هذا الإجراء.',
      });
    }
    next();
  };
};

export { loadUserWithRolesById };
