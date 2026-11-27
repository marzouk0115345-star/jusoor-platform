import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  detectImageFormatFromBytes,
  MAX_COURSE_IMAGE_BYTES,
  validateCourseImageMeta,
} from '../lib/domain.ts';

export type UploadCategory = 'courses' | 'centers';

const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');
const SAFE_FILENAME_PATTERN = /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/;

export function getCategoryDir(category: UploadCategory): string {
  return path.resolve(UPLOADS_ROOT, category);
}

export async function ensureUploadDir(category: UploadCategory): Promise<string> {
  const dir = getCategoryDir(category);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function resolveSafeUploadPath(
  category: UploadCategory,
  filename: string
): string | null {
  if (!SAFE_FILENAME_PATTERN.test(filename)) {
    return null;
  }
  const baseDir = getCategoryDir(category);
  const resolved = path.resolve(baseDir, filename);
  if (!resolved.startsWith(baseDir + path.sep)) {
    return null;
  }
  return resolved;
}

export async function saveValidatedImageUpload(params: {
  category: UploadCategory;
  centerId?: number | null;
  userId?: number | null;
  mimeType: string;
  fileName?: string;
  buffer: Buffer;
}): Promise<{
  ok: true;
  filename: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
} | {
  ok: false;
  status: number;
  error: string;
}> {
  if (!Buffer.isBuffer(params.buffer) || params.buffer.length === 0) {
    return {
      ok: false,
      status: 400,
      error: 'لم يتم استلام ملف الصورة أو أن الملف فارغ.',
    };
  }

  if (params.buffer.length > MAX_COURSE_IMAGE_BYTES) {
    return {
      ok: false,
      status: 413,
      error: 'حجم الصورة يتجاوز الحد الأقصى المسموح به (5 ميجابايت).',
    };
  }

  const metaCheck = validateCourseImageMeta({
    mimeType: params.mimeType,
    sizeBytes: params.buffer.length,
    fileName: params.fileName,
  });
  if (!metaCheck.valid) {
    return {
      ok: false,
      status: 400,
      error: metaCheck.error || 'ملف الصورة غير صالح.',
    };
  }

  const detectedExt = detectImageFormatFromBytes(params.buffer);
  if (!detectedExt) {
    return {
      ok: false,
      status: 400,
      error: 'محتوى الملف لا يطابق صورة صالحة بصيغة JPEG أو PNG أو WebP.',
    };
  }

  const prefix = params.category === 'courses' ? 'course' : 'center';
  const ownerTag =
    params.centerId !== undefined && params.centerId !== null
      ? `c${params.centerId}`
      : params.userId !== undefined && params.userId !== null
      ? `u${params.userId}`
      : 'p0';
  const filename = `${prefix}-${ownerTag}-${crypto.randomUUID()}.${detectedExt}`;
  const dir = await ensureUploadDir(params.category);
  const fullPath = path.resolve(dir, filename);
  if (!fullPath.startsWith(dir + path.sep)) {
    return { ok: false, status: 400, error: 'مسار الحفظ غير صالح.' };
  }

  await fs.writeFile(fullPath, params.buffer);

  const canonicalMime =
    detectedExt === 'jpg'
      ? 'image/jpeg'
      : detectedExt === 'png'
      ? 'image/png'
      : 'image/webp';

  return {
    ok: true,
    filename,
    url: `/uploads/${params.category}/${filename}`,
    mimeType: canonicalMime,
    sizeBytes: params.buffer.length,
  };
}

export async function deleteUploadedImageByUrl(url?: string | null): Promise<void> {
  if (!url) return;
  const coursePrefix = '/uploads/courses/';
  const centerPrefix = '/uploads/centers/';

  let category: UploadCategory | null = null;
  let filename = '';

  if (url.startsWith(coursePrefix)) {
    category = 'courses';
    filename = url.slice(coursePrefix.length);
  } else if (url.startsWith(centerPrefix)) {
    category = 'centers';
    filename = url.slice(centerPrefix.length);
  } else {
    return; // Never touch seeded or external assets
  }

  const resolved = resolveSafeUploadPath(category, filename);
  if (!resolved) return;

  try {
    await fs.unlink(resolved);
  } catch {
    // Ignore ENOENT if file already removed
  }
}

export function isAllowedStoredImageUrl(
  url?: string | null,
  expectedCategory?: UploadCategory
): boolean {
  if (!url) return true;
  if (url.startsWith('data:')) return false;
  if (url.startsWith('/src/assets/images/')) return true;
  if (url.startsWith('/uploads/courses/')) {
    if (expectedCategory && expectedCategory !== 'courses') return false;
    const filename = url.slice('/uploads/courses/'.length);
    return SAFE_FILENAME_PATTERN.test(filename);
  }
  if (url.startsWith('/uploads/centers/')) {
    if (expectedCategory && expectedCategory !== 'centers') return false;
    const filename = url.slice('/uploads/centers/'.length);
    return SAFE_FILENAME_PATTERN.test(filename);
  }
  return false;
}
