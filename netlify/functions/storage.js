// /api/storage/:bucket/* — replaces the Supabase `style-images` bucket with
// Netlify Blobs.
//
// POST uploads (admin only, since only admins could write to the bucket).
// GET serves the file publicly, matching the old bucket's public-read policy —
// image_url values are rendered straight into <img src>, including for
// wholesale users who are not signed in as admins.

import { getStore } from '@netlify/blobs';
import { AccessError } from './lib/acl.js';
import { requireUser } from './lib/auth.js';
import { handler, json } from './lib/http.js';

// One bucket today. Named explicitly so a typo in a path cannot address
// arbitrary stores.
const BUCKETS = new Set(['style-images']);

const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

function parsePath(request) {
  const { pathname } = new URL(request.url);
  const [, , , bucket, ...rest] = pathname.split('/'); // ['', 'api', 'storage', bucket, ...key]
  const key = rest.join('/');

  if (!BUCKETS.has(bucket)) throw new AccessError(404, 'Unknown bucket');
  // Keys are generated as `<style id>.<ext>`; anything with traversal in it
  // is a caller doing something it should not.
  if (!key || key.includes('..')) throw new AccessError(400, 'Invalid object key');

  return { bucket, key };
}

export default handler(async (request) => {
  const { bucket, key } = parsePath(request);
  const store = getStore(bucket);

  if (request.method === 'GET') {
    const blob = await store.getWithMetadata(key, { type: 'arrayBuffer' });
    if (!blob) return json({ error: { message: 'Not found' } }, 404);

    return new Response(blob.data, {
      headers: {
        'content-type': blob.metadata?.contentType || 'application/octet-stream',
        // Uploads are cache-busted with ?t=<timestamp>, so this is safe.
        'cache-control': 'public, max-age=31536000, immutable',
      },
    });
  }

  if (request.method === 'POST' || request.method === 'PUT') {
    const user = await requireUser(request);
    if (!user.roles.includes('admin')) throw new AccessError(403, 'Admins only');

    const contentType = request.headers.get('content-type') || 'application/octet-stream';
    if (!ALLOWED_TYPES.has(contentType.split(';')[0].trim())) {
      throw new AccessError(400, `Unsupported image type: ${contentType}`);
    }

    const body = await request.arrayBuffer();
    if (body.byteLength > MAX_BYTES) throw new AccessError(413, 'Image is larger than 10MB');
    if (body.byteLength === 0) throw new AccessError(400, 'Empty upload');

    await store.set(key, body, { metadata: { contentType } });

    return json({ data: { path: key } });
  }

  if (request.method === 'DELETE') {
    const user = await requireUser(request);
    if (!user.roles.includes('admin')) throw new AccessError(403, 'Admins only');

    await store.delete(key);
    return json({ data: { path: key } });
  }

  return json({ error: { message: 'Unsupported method' } }, 405);
});

export const config = { path: '/api/storage/:bucket/*' };
