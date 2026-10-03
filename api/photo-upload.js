/**
 * Uploads a member photo to Cloudflare R2 and returns its object key.
 *
 * WHY THIS EXISTS
 * The browser used to read the uploaded file into a base64 data URL and store
 * that in the member record. Two problems:
 *   1. A single 5 MB photo became ~6.7 MB of base64 in localStorage, which
 *      alone can exceed the whole origin budget and silently drop the write.
 *   2. Nothing was ever written to the bucket, so "upload" only worked in the
 *      browser that uploaded it.
 *
 * This stores the real object server-side and returns just the key, so the
 * member record stays small and the photo is served through the same
 * presigned-URL path as every other image.
 *
 * Requires the same server-only env vars as /api/photo-url.
 *
 * Auth: this endpoint is ADMIN ONLY. It refuses anyone who is not listed as
 * an active administrator in `cse_archive_admin_users`, which is the only
 * server-side identity available to this project.
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { isActiveAdmin, sendError } from './_shared.js';

const R2_ENDPOINT = process.env.R2_ENDPOINT || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'cse-alumni';

const storageConfigured = Boolean(R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!storageConfigured) {
    return res.status(503).json({
      error: 'Storage is not configured',
      hint: 'Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME on the server.',
    });
  }

  if (!(await isActiveAdmin(req.headers?.authorization))) {
    return sendError(res, 403, 'Administrator access required');
  }

  const { fileName, contentType, dataBase64 } = req.body || {};

  if (!ALLOWED_TYPES.includes(String(contentType))) {
    return res.status(400).json({ error: 'Upload a JPG, PNG, WEBP or GIF image.' });
  }

  // Strip any data-URL prefix the client may have included.
  const base64 = String(dataBase64 || '').replace(/^data:[^;]+;base64,/, '');
  if (!base64) return res.status(400).json({ error: 'No image data received.' });

  let buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch {
    return res.status(400).json({ error: 'Image data could not be decoded.' });
  }

  if (buffer.length === 0) return res.status(400).json({ error: 'Image data was empty.' });
  if (buffer.length > MAX_BYTES) {
    return res.status(413).json({ error: 'Image is larger than 5 MB.' });
  }

  // Build the key ourselves: never trust a client-supplied path.
  const ext = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }[String(contentType)];
  const photoKey = `photos/${Date.now()}_${randomUUID()}.${ext}`;

  try {
    const client = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });

    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: photoKey,
        Body: buffer,
        ContentType: String(contentType),
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    return res.status(200).json({ photo_key: photoKey, photo_url: '', bytes: buffer.length });
  } catch (err) {
    console.error('Failed to upload photo:', err);
    return res.status(500).json({ error: 'Could not store the photo.' });
  }
}
