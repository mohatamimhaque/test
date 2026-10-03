import React, { useState, useEffect } from 'react';

/**
 * Cloudflare R2 photo delivery.
 *
 * Photos live in a private R2 bucket and are served through short-lived
 * presigned URLs.
 *
 * SECURITY: the signing credential is NOT in this bundle.
 * It used to be read from VITE_R2_SECRET_ACCESS_KEY, but Vite inlines every
 * VITE_-prefixed variable into the public JavaScript, which handed the full
 * bucket credential to anyone who loaded the site. Signing now happens in the
 * serverless function at `/api/photo-url`, which reads server-only env vars.
 *
 * Server-side env vars required (no VITE_ prefix):
 *   R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *
 * The bucket itself stays private; this only mints URLs for keys the visitor
 * could already read from the public member records.
 *
 * If the endpoint is unavailable the app degrades to the generated SVG
 * avatars rather than showing broken images.
 */

/** Server endpoint that signs a photo key into a temporary URL. */
const PRESIGN_ENDPOINT = '/api/photo-url';

/**
 * Derives the R2 object key from whatever a member record holds.
 *
 * Accepts a bare key ("photos/p001_x33.jpeg") or a full URL and returns the
 * key, which mirrors `toObjectKey()` in the API function.
 */
export function toPhotoKey(photoKeyOrUrl?: string | null): string {
  let key = String(photoKeyOrUrl || '').trim();
  if (!key || key.startsWith('data:')) return '';

  key = key.replace(/^https?:\/\/[^/]+\//, '').replace(/^\/+/, '');

  // Only ever sign objects under the photos prefix, and never a traversal path.
  if (key.includes('..') || key.includes('\\')) return '';
  if (!key.startsWith('photos/')) return '';

  return key;
}

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

// In-memory cache for presigned URLs to avoid redundant signing overhead.
// Bounded so a long session browsing the whole directory cannot grow it
// without limit; the oldest entry is evicted first.
const PRESIGNED_CACHE_LIMIT = 1200;
const presignedUrlCache = new Map<string, { url: string; expiresAt: number }>();

function cachePresignedUrl(key: string, value: { url: string; expiresAt: number }): void {
  // Re-insert so Map iteration order stays oldest-first.
  presignedUrlCache.delete(key);
  presignedUrlCache.set(key, value);
  while (presignedUrlCache.size > PRESIGNED_CACHE_LIMIT) {
    const oldest = presignedUrlCache.keys().next();
    if (oldest.done) break;
    presignedUrlCache.delete(oldest.value);
  }
}

/**
 * Reads a JSON body without throwing on HTML.
 *
 * Under `vite preview` (and any host with an SPA rewrite) an unknown path like
 * /api/photo-url returns index.html with a 200, so a plain response.json()
 * rejects with a SyntaxError. One per member card, so it floods the console
 * and hides real errors. Returning null keeps the fallback avatar path quiet.
 */
async function parseJsonSafely(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const type = response.headers.get('content-type') || '';
    if (!type.includes('application/json')) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Asks the serverless function for a presigned URL for this photo.
 *
 * Cached in memory so browsing the directory does not issue one request per
 * photo per render. Falls back to the generated avatar when the endpoint is
 * missing or errors, which is what happens under `vite preview` (no /api).
 */
export async function getPresignedPhotoUrl(photoKeyOrUrl?: string): Promise<string> {
  if (!photoKeyOrUrl || photoKeyOrUrl.trim() === '') {
    return DEFAULT_AVATAR;
  }

  if (photoKeyOrUrl.startsWith('data:')) {
    return photoKeyOrUrl;
  }

  const cleanKey = toPhotoKey(photoKeyOrUrl);
  if (!cleanKey) return DEFAULT_AVATAR;

  const now = Date.now();
  const cached = presignedUrlCache.get(cleanKey);
  if (cached && cached.expiresAt > now + 60000) {
    return cached.url;
  }

  try {
    const response = await fetch(`${PRESIGN_ENDPOINT}?key=${encodeURIComponent(cleanKey)}`);
    if (!response.ok) {
      // 503 means the server has no storage credentials, 400 a bad key.
      // Neither is worth retrying on every card.
      console.warn(`Photo signing unavailable (${response.status}) for ${cleanKey}`);
      return DEFAULT_AVATAR;
    }

    const data = await parseJsonSafely(response);
    if (!data) return DEFAULT_AVATAR;

    const url = typeof data?.url === 'string' ? data.url : '';
    if (!url) return DEFAULT_AVATAR;

    const ttl = Number(data.expiresIn) || 86400;
    cachePresignedUrl(cleanKey, {
      url,
      // Refresh a minute before expiry so a cached URL is never handed out
      // moments before it stops working.
      expiresAt: now + (ttl - 60) * 1000,
    });
    return url;
  } catch (err) {
    console.error('Failed to fetch presigned photo URL:', err);
    return DEFAULT_AVATAR;
  }
}

/**
 * Synchronous accessor: returns a cached URL immediately, otherwise the
 * fallback avatar and kicks off a background fetch for the real one.
 */
export function getPhotoUrlSync(photoKeyOrUrl?: string): string {
  if (!photoKeyOrUrl || photoKeyOrUrl.trim() === '') return DEFAULT_AVATAR;
  if (photoKeyOrUrl.startsWith('data:')) return photoKeyOrUrl;

  const cleanKey = toPhotoKey(photoKeyOrUrl);
  if (!cleanKey) return DEFAULT_AVATAR;

  const cached = presignedUrlCache.get(cleanKey);
  // Honour the expiry here too: returning an expired URL would render as a
  // broken image rather than triggering a re-sign.
  if (cached && cached.expiresAt > Date.now() + 60000) return cached.url;
  if (cached) presignedUrlCache.delete(cleanKey);

  // Background fetch; the component re-renders when it resolves.
  getPresignedPhotoUrl(cleanKey).catch(() => {});
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
 * Uploads a member photo and returns the R2 object key.
 *
 * The file goes to the server, which writes it to the bucket and returns a
 * short key. Nothing large is kept in the member record: the previous approach
 * stored a base64 data URL, which for a 5 MB photo was ~6.7 MB of localStorage
 * and silently failed the write.
 *
 * Returns `photo_url: ''` because the display URL is always derived from the
 * key at render time — see `toPhotoKey`.
 */
export async function processPhotoUpload(file: File): Promise<{ photo_key: string; photo_url: string }> {
  const validation = validatePhotoFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : '');
    };
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });

  if (!base64) throw new Error('Could not read the selected file.');

  // Reuse the caller's Supabase access token so the server can verify that
  // this is an administrator.
  let authHeader: Record<string, string> = {};
  try {
    const { supabase } = await import('./supabase');
    if (supabase) {
      const result = await supabase.auth.getSession();
      const token = result?.data?.session?.access_token;
      if (token) authHeader = { Authorization: `Bearer ${token}` };
    }
  } catch {
    // No session available; the server will reject the upload with 403.
  }

  const response = await fetch('/api/photo-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({ fileName: file.name, contentType: file.type, dataBase64: base64 }),
  });

  if (!response.ok) {
    let message = `Upload failed (${response.status})`;
    const body = await parseJsonSafely(response);
    if (body?.error) message = String(body.error);
    throw new Error(message);
  }

  const data = await parseJsonSafely(response);
  if (!data?.photo_key) throw new Error('The server did not return a photo key.');

  return { photo_key: String(data.photo_key), photo_url: '' };
}
