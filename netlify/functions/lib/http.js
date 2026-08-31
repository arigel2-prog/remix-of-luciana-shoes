// Shared request/response plumbing for the functions.

import { AccessError } from './acl.js';

export const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

/**
 * Wraps a handler so thrown AccessErrors become their status code and
 * everything else becomes a 500 — without leaking internals to the browser.
 */
export function handler(fn) {
  return async (request, context) => {
    try {
      return await fn(request, context);
    } catch (error) {
      if (error instanceof AccessError) {
        return json({ error: { message: error.message } }, error.status);
      }

      // Real faults are worth seeing in the function log, but the caller only
      // gets the generic message.
      console.error('Unhandled error:', error);
      return json({ error: { message: 'Internal error' } }, 500);
    }
  };
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new AccessError(400, 'Expected a JSON body');
  }
}
