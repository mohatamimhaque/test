/**
 * Presigns a Cloudflare R2 photo URL on the server.
 *
 * WHY THIS EXISTS
 * The browser used to sign URLs itself using VITE_R2_SECRET_ACCESS_KEY. Vite
 * inlines every VITE_-prefixed variable into the public bundle, so that secret
 * was readable by anyone who loaded the site — it gave full bucket access to a
 * complete list of alumni photos. Signing here keeps the credential server-side.
 *
 * WHAT THIS DOES NOT CHANGE
 * The bucket stays private. Every object still requires a valid signature; this
 * endpoint only mints short-lived URLs for keys the caller already knows (the
 * member records are already public, so the keys are not secret).
 *
 * Deploys automatically on Vercel: the /api directory is detected, no config
 * needed. Required env vars (server-only, no VITE_ prefix):
 *
 *   R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2_ENDPOINT = process.env.R2_ENDPOINT || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'cse-alumni';

const configured = Boolean(R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);

/** Presigned URLs live 24 h; the client refreshes well before then. */
const EXPIRES_IN = 86400;

/**
 * Accepts either a bare object key ("photos/p001_x33.jpeg") or a full URL, and
 * returns the key. Mirrors the client-side derivation so both agree.
 */
function toObjectKey(input) {
  let key = String(input || '').trim();
  if (!key) return '';

  if (key.startsWith('data:')) return '';

  // Strip scheme + host if a full URL was passed.
  key = key.replace(/^https?:\/\/[^/]+\//, '').replace(/^\/+/, '');

  // Reject traversal attempts and anything outside the photos prefix.
  if (key.includes('..') || key.includes('\\')) return '';
  if (!key.startsWith('photos/')) return '';

  return key;
}

export default async function handler(req, res) {
  // Only GET is meaningful; disallow the rest so this cannot be used as a
  // generic open proxy.
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!configured) {
    return res.status(503).json({
      error: 'Storage is not configured',
      hint: 'Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME on the server.',
    });
  }

  const raw = req.method === 'GET' ? req.query?.key || req.query?.photo : req.body?.key || req.body?.photo;
  const key = toObjectKey(raw);

  if (!key) {
    return res.status(400).json({ error: 'A valid photos/ object key is required' });
  }

  try {
    const client = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }),
      { expiresIn: EXPIRES_IN }
    );

    // Allow shared caches to reuse the signature for a short window.
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json({ url, key, expiresIn: EXPIRES_IN });
  } catch (err) {
    console.error('Failed to presign photo URL:', err);
    return res.status(500).json({ error: 'Could not sign this photo URL' });
  }
}
