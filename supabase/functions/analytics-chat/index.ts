// AI Analytics assistant for the Luciana Shoes back-office.
//
// Calls the Anthropic Messages API directly (no Lovable AI gateway), and streams
// the reply back in OpenAI chat-completion chunk shape so the existing reader in
// src/pages/Analytics.tsx keeps working unchanged.
//
// Deploy with JWT verification OFF: this function does its own auth below,
// resolving the caller from the Authorization header and requiring the admin
// role. Supabase's built-in verify_jwt would reject the request before any of
// that runs.
//
// Required secret: ANTHROPIC_API_KEY
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.)

import Anthropic from "npm:@anthropic-ai/sdk@0.121.0";
import { createClient } from "npm:@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "claude-opus-5";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Msg = { role: "user" | "assistant"; content: string };

/**
 * The Messages API requires the conversation to start with a user turn and to
 * alternate. The chat UI can produce two assistant turns in a row (a partial
 * stream followed by an error bubble), so normalise before sending rather than
 * letting the API reject the whole request.
 */
function normaliseMessages(raw: unknown): Msg[] {
  if (!Array.isArray(raw)) return [];
  const cleaned: Msg[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const role = (m as Msg).role;
    const content = (m as Msg).content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string" || content.trim() === "") continue;
    cleaned.push({ role, content });
  }
  while (cleaned.length && cleaned[0].role !== "user") cleaned.shift();

  const merged: Msg[] = [];
  for (const m of cleaned) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content += "\n\n" + m.content;
    else merged.push({ ...m });
  }
  return merged;
}

/** One OpenAI-shaped SSE chunk, which is what the browser-side reader parses. */
function sseChunk(text: string) {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // The caller must be a signed-in user, so this must be their access token —
    // the anon/publishable key is not a user JWT and resolves to no user here.
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { data: roleRow } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden" }, 403);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY secret is not set");
      return json({ error: "AI is not configured. Set the ANTHROPIC_API_KEY secret." }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const messages = normaliseMessages(body?.messages);
    if (messages.length === 0) return json({ error: "messages array required" }, 400);

    // Ordering by id keeps the snapshot byte-identical between turns, so the
    // cached system prompt below actually gets a hit instead of silently missing.
    const [ordersRes, clientsRes, stylesRes, itemsRes, paymentsRes, expensesRes] =
      await Promise.all([
        sb.from("orders").select("id, order_number, client_id, order_date, status, season, total_amount").order("id"),
        sb.from("clients").select("id, company_name, customer_number, contact_name, email, city, state").order("id"),
        sb.from("styles").select("id, style_code, name, wholesale_price, retail_price, category, season, is_active").order("id"),
        sb.from("order_items").select("id, order_id, style_id, quantity, unit_price, total_price, size, color").order("id"),
        sb.from("payments").select("id, order_id, client_id, amount, payment_date, payment_method").order("id"),
        sb.from("expenses").select("id, description, category, amount, expense_date, season, vendor").order("id"),
      ]);

    const contextData = {
      orders: ordersRes.data || [],
      clients: clientsRes.data || [],
      styles: stylesRes.data || [],
      order_items: itemsRes.data || [],
      payments: paymentsRes.data || [],
      expenses: expensesRes.data || [],
    };

    const systemPrompt = `You are the AI analytics assistant for Luciana Shoes, a wholesale shoe business. You have access to the full business database.

Here is the current data snapshot:

**Clients (${contextData.clients.length}):**
${JSON.stringify(contextData.clients, null, 1)}

**Styles (${contextData.styles.length}):**
${JSON.stringify(contextData.styles, null, 1)}

**Orders (${contextData.orders.length}):**
${JSON.stringify(contextData.orders, null, 1)}

**Order Items (${contextData.order_items.length}):**
${JSON.stringify(contextData.order_items, null, 1)}

**Payments (${contextData.payments.length}):**
${JSON.stringify(contextData.payments, null, 1)}

**Expenses (${contextData.expenses.length}):**
${JSON.stringify(contextData.expenses, null, 1)}

When answering:
- Use markdown tables and formatting for readability
- Calculate totals, averages, and percentages when relevant
- Cross-reference data (e.g., match order_items.style_id to styles, order_items.order_id to orders, orders.client_id to clients)
- For "top sellers", aggregate order_items by style_id and sum quantities
- For financial analysis, compare revenue (payments) vs costs (expenses)
- For AR, compare order totals vs payments received per client
- Be specific with numbers, don't round unless asked
- If data is empty, say so clearly and suggest the user add data first`;

    const anthropic = new Anthropic({ apiKey });

    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      // The analytics questions involve real aggregation across tables, so let
      // the model reason before answering.
      thinking: { type: "adaptive" },
      system: [
        {
          type: "text",
          text: systemPrompt,
          // The snapshot is the bulk of the tokens and is stable across the turns
          // of one conversation, so cache it rather than re-reading it every turn.
          cache_control: { type: "ephemeral" },
        },
      ],
      messages,
    });

    const encoder = new TextEncoder();
    const sse = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(sseChunk(event.delta.text)));
            }
          }

          const final = await stream.finalMessage();
          if (final.stop_reason === "refusal") {
            controller.enqueue(
              encoder.encode(
                sseChunk("\n\n_The model declined to answer that request._"),
              ),
            );
          } else if (final.stop_reason === "max_tokens") {
            controller.enqueue(
              encoder.encode(
                sseChunk("\n\n_(Response truncated — ask for a narrower slice.)_"),
              ),
            );
          }
        } catch (e) {
          // The response has already started, so the HTTP status is committed.
          // Surface the failure in the stream instead of losing it.
          console.error("analytics-chat stream error:", e);
          const msg = e instanceof Anthropic.APIError && e.status === 429
            ? "Rate limited by the Anthropic API. Please try again in a moment."
            : e instanceof Error
            ? e.message
            : "AI service error";
          controller.enqueue(encoder.encode(sseChunk(`\n\n⚠️ ${msg}`)));
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
      cancel() {
        stream.abort();
      },
    });

    return new Response(sse, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("analytics-chat error:", e);
    if (e instanceof Anthropic.APIError) {
      if (e.status === 401) return json({ error: "Invalid ANTHROPIC_API_KEY." }, 500);
      if (e.status === 429) return json({ error: "Rate limit exceeded. Please try again in a moment." }, 429);
      return json({ error: `AI service error (${e.status}).` }, 502);
    }
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
