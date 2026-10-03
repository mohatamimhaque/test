import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import React, { useState, useEffect } from 'react';

/**
 * Cloudflare R2 configuration.
 *
 * These values are read from Vite env vars ONLY. They are intentionally not
 * hardcoded: this module is bundled into the public browser bundle, so any
 * literal secret committed here would be publicly readable by anyone who loads
 * the site. Set the values in `.env` (local) and in the Vercel project
 * environment variables (production):
 *
 *   VITE_R2_ENDPOINT
 *   VITE_R2_ACCESS_KEY_ID
 *   VITE_R2_SECRET_ACCESS_KEY
 *   VITE_R2_BUCKET_NAME
 *
 * Until they are provided the app degrades gracefully to the generated SVG
 * avatars instead of failing.
 */
const R2_ENDPOINT = import.meta.env.VITE_R2_ENDPOINT || '';
const R2_ACCESS_KEY_ID = import.meta.env.VITE_R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = import.meta.env.VITE_R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = import.meta.env.VITE_R2_BUCKET_NAME || 'cse-alumni';

/** True only when all four R2 values are present. */
export const isR2Configured = Boolean(
  R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME
);

const s3Client = isR2Configured
  ? new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    })
  : null;

export const DEFAULT_AVATAR_MALE = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%231e293b"/><stop offset="100%" stop-color="%230f172a"/></linearGradient></defs><rect width="200" height="200" fill="url(%23g)"/><circle cx="100" cy="72" r="36" fill="%2338bdf8"/><path d="M40 180 c0-36 25-54 60-54 s60 18 60 54 z" fill="%2338bdf8"/></svg>`;

export const DEFAULT_AVATAR_FEMALE = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23be123c"/><stop offset="100%" stop-color="%23881337"/></linearGradient></defs><rect width="200" height="200" fill="url(%23g)"/><circle cx="100" cy="70" r="34" fill="%23fecdd3"/><path d="M40 180 c0-35 25-52 60-52 s60 17 60 52 z" fill="%23fecdd3"/><path d="M64 64 c-6 26 8 40 36 40 s42-14 36-40 c-10-18-62-18-72 0 z" fill="%23fda4af"/></svg>`;

export const DEFAULT_AVATAR = DEFAULT_AVATAR_MALE;

export function getDefaultAvatar(gender?: string, name?: string): string {
  const g = String(gender || '').toLowerCase();
  const n = String(name || '').toLowerCase();
  if (
    g.includes('female') || 
    g === 'f' || 
    g === 'woman' || 
    n.includes('mrs') || 
    n.includes('ms') || 
    n.includes('begum') || 
    n.includes('sultana') || 
    n.includes('fatema') || 
    n.includes('nusrat') || 
    n.includes('tanjim') || 
    n.includes('samia') || 
    n.includes('farzana') ||
    n.includes('sharmin') ||
    n.includes('tasnim')
  ) {
    return DEFAULT_AVATAR_FEMALE;
  }
  return DEFAULT_AVATAR_MALE;
}

// In-memory cache for presigned URLs to avoid redundant signing overhead
const presignedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Generates a presigned Cloudflare R2 GetObject URL (cached for 12 hours)
 */
export async function getPresignedPhotoUrl(photoKeyOrUrl?: string): Promise<string> {
  if (!photoKeyOrUrl || photoKeyOrUrl.trim() === '') {
    return DEFAULT_AVATAR;
  }

  if (photoKeyOrUrl.startsWith('data:')) {
    return photoKeyOrUrl;
  }

  // Extract clean key e.g. photos/p006_x104.png
  let cleanKey = photoKeyOrUrl;
  if (photoKeyOrUrl.startsWith('http://') || photoKeyOrUrl.startsWith('https://')) {
    cleanKey = photoKeyOrUrl.replace(/^https?:\/\/[^\/]+\//, '').replace(/^\//, '');
  }

  const now = Date.now();
  const cached = presignedUrlCache.get(cleanKey);
  if (cached && cached.expiresAt > now + 60000) {
    return cached.url;
  }

  try {
    if (!s3Client) {
      // No R2 credentials configured — fall back to the generated avatar
      // rather than throwing on every card.
      return DEFAULT_AVATAR;
    }

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: cleanKey,
    });

    // 24 hours expiry
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 86400 });
    presignedUrlCache.set(cleanKey, {
      url: presignedUrl,
      expiresAt: now + 80000 * 1000,
    });
    return presignedUrl;
  } catch (err) {
    console.error('Failed to generate presigned R2 URL:', err);
    return DEFAULT_AVATAR;
  }
}

/**
 * Synchronous photo URL generator fallback
 */
export function getPhotoUrlSync(photoKeyOrUrl?: string): string {
  if (!photoKeyOrUrl || photoKeyOrUrl.trim() === '') return DEFAULT_AVATAR;
  if (photoKeyOrUrl.startsWith('data:')) return photoKeyOrUrl;

  let cleanKey = photoKeyOrUrl;
  if (photoKeyOrUrl.startsWith('http://') || photoKeyOrUrl.startsWith('https://')) {
    cleanKey = photoKeyOrUrl.replace(/^https?:\/\/[^\/]+\//, '').replace(/^\//, '');
  }

  const cached = presignedUrlCache.get(cleanKey);
  if (cached) return cached.url;

  // Background trigger (no-op when R2 is not configured).
  if (isR2Configured) {
    getPresignedPhotoUrl(cleanKey).catch(() => {});
  }
  return DEFAULT_AVATAR;
}

export function getPhotoUrl(photoKeyOrUrl?: string): string {
  return getPhotoUrlSync(photoKeyOrUrl);
}

/**
 * React Hook for seamless, optimized image URL resolution with presigning
 */
export function usePhotoUrl(photoKeyOrUrl?: string): { url: string; loading: boolean } {
  const [url, setUrl] = useState<string>(() => getPhotoUrlSync(photoKeyOrUrl));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    if (!photoKeyOrUrl || photoKeyOrUrl.trim() === '') {
      setUrl(DEFAULT_AVATAR);
      setLoading(false);
      return;
    }

    if (photoKeyOrUrl.startsWith('data:')) {
      setUrl(photoKeyOrUrl);
      setLoading(false);
      return;
    }

    getPresignedPhotoUrl(photoKeyOrUrl).then(resolved => {
      if (isMounted) {
        setUrl(resolved);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [photoKeyOrUrl]);

  return { url, loading };
}

/**
 * Validates uploaded photo file size (<5MB) and mime type
 */
export function validatePhotoFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid image format. Please upload JPG, PNG, or WEBP.' };
  }

  const maxSizeInBytes = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSizeInBytes) {
    return { valid: false, error: 'File size exceeds 5MB limit.' };
  }

  return { valid: true };
}

/**
 * Encodes image file for permanent storage
 */
export async function processPhotoUpload(file: File): Promise<{ photo_key: string; photo_url: string }> {
  const validation = validatePhotoFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const photo_key = `photos/${timestamp}_${sanitizedName}`;
      resolve({
        photo_key,
        photo_url: result,
      });
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
