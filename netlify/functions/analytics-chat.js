// POST /api/analytics-chat — the AI Analytics tab.
//
// Ported from the Supabase edge function (Deno) to a Netlify Function. The
// Anthropic call is unchanged in substance: Claude Opus 5, streaming, adaptive
// thinking, with the data snapshot in a cacheable system prompt. What changed
// is where the data and the caller's identity come from — Turso and the
// sessions table rather than Postgres and Supabase Auth.
//
// The response is still OpenAI-shaped SSE because that is what the reader in
// src/pages/Analytics.tsx parses.

import Anthropic from '@anthropic-ai/sdk';
import { requireUser } from './lib/auth.js';
import { db, decodeRows } from './lib/db.js';
import { json } from './lib/http.js';

const MODEL = 'claude-opus-5';

/**
 * The Messages API requires the conversation to start with a user turn and to
 * alternate. The chat UI can produce two assistant turns in a row (a partial
 * stream followed by an error bubble), so normalise before sending rather than
 * letting the API reject the whole request.
 */
function normaliseMessages(raw) {
  if (!Array.isArray(raw)) return [];

  const cleaned = [];
  for (const message of raw) {
    if (!message || typeof message !== 'object') continue;
    const { role, content } = message;
    if (role !== 'user' && role !== 'assistant') continue;
    if (typeof content !== 'string' || content.trim() === '') continue;
    cleaned.push({ role, content });
  }
  while (cleaned.length && cleaned[0].role !== 'user') cleaned.shift();

  const merged = [];
  for (const message of cleaned) {
    const last = merged[merged.length - 1];
    if (last && last.role === message.role) last.content += '\n\n' + message.content;
    else merged.push({ ...message });
  }
  return merged;
}

/** One OpenAI-shaped SSE chunk, which is what the browser-side reader parses. */
const sseChunk = (text) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;

// Ordering by id keeps the snapshot byte-identical between turns of a
// conversation, which is what makes the cached system prompt actually hit.
const SNAPSHOT = {
  clients: 'id, company_name, contact_name, email, city, state',
  styles: 'id, style_code, name, wholesale_price, retail_price, category, season, is_active',
  orders: 'id, order_number, client_id, order_date, status, season, total_amount',
  order_items: 'id, order_id, style_id, quantity, unit_price, total_price, size, color',
  payments: 'id, order_id, client_id, amount, payment_date, payment_method',
  expenses: 'id, description, category, amount, expense_date, season, vendor',
};

async function loadSnapshot() {
  const entries = await Promise.all(
    Object.entries(SNAPSHOT).map(async ([table, columns]) => {
      const result = await db().execute(`SELECT ${columns} FROM "${table}" ORDER BY id`);
      return [table, await decodeRows(table, result.rows)];
    }),
  );

  return Object.fromEntries(entries);
}

function buildSystemPrompt(data) {
  const section = (label, rows) =>
    `**${label} (${rows.length}):**\n${JSON.stringify(rows, null, 1)}`;

  return `You are the AI analytics assistant for Luciana Shoes, a wholesale shoe business. You have access to the full business database.

Here is the current data snapshot:

${section('Clients', data.clients)}

${section('Styles', data.styles)}

${section('Orders', data.orders)}

${section('Order Items', data.order_items)}

${section('Payments', data.payments)}

${section('Expenses', data.expenses)}

When answering:
- Use markdown tables and formatting for readability
- Calculate totals, averages, and percentages when relevant
- Cross-reference data (e.g., match order_items.style_id to styles, order_items.order_id to orders, orders.client_id to clients)
- For "top sellers", aggregate order_items by style_id and sum quantities
- For financial analysis, compare revenue (payments) vs costs (expenses)
- For AR, compare order totals vs payments received per client
- Be specific with numbers, don't round unless asked
- If data is empty, say so clearly and suggest the user add data first`;
}

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Use POST' }, 405);

  try {
    const user = await requireUser(request).catch(() => null);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    if (!user.roles.includes('admin')) return json({ error: 'Forbidden' }, 403);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY is not set');
      return json({ error: 'AI is not configured. Set the ANTHROPIC_API_KEY variable.' }, 500);
    }

    const body = await request.json().catch(() => ({}));
    const messages = normaliseMessages(body?.messages);
    if (messages.length === 0) return json({ error: 'messages array required' }, 400);

    const anthropic = new Anthropic({ apiKey });

    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      // Questions about an order book are often multi-step aggregations; let
      // the model reason before answering.
      thinking: { type: 'adaptive' },
      system: [
        {
          type: 'text',
          text: buildSystemPrompt(await loadSnapshot()),
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
    });

    const encoder = new TextEncoder();
    const sse = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(sseChunk(event.delta.text)));
            }
          }

          const final = await stream.finalMessage();
          if (final.stop_reason === 'refusal') {
            controller.enqueue(
              encoder.encode(sseChunk('\n\n_The model declined to answer that request._')),
            );
          } else if (final.stop_reason === 'max_tokens') {
            controller.enqueue(
              encoder.encode(sseChunk('\n\n_(Response truncated — ask for a narrower slice.)_')),
            );
          }
        } catch (error) {
          // The response has already started, so the HTTP status is committed.
          // Surface the failure in the stream instead of losing it.
          console.error('analytics-chat stream error:', error);
          const message =
            error instanceof Anthropic.APIError && error.status === 429
              ? 'Rate limited by the Anthropic API. Please try again in a moment.'
              : error instanceof Error
                ? error.message
                : 'AI service error';
          controller.enqueue(encoder.encode(sseChunk(`\n\n⚠️ ${message}`)));
        } finally {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
      cancel() {
        stream.abort();
      },
    });

    return new Response(sse, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('analytics-chat error:', error);

    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) return json({ error: 'Invalid ANTHROPIC_API_KEY.' }, 500);
      if (error.status === 429) {
        return json({ error: 'Rate limit exceeded. Please try again in a moment.' }, 429);
      }
      return json({ error: `AI service error (${error.status}).` }, 502);
    }

    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
};

export const config = { path: '/api/analytics-chat' };
