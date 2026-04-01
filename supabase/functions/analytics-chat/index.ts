import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Query database for context
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const [ordersRes, clientsRes, stylesRes, itemsRes, paymentsRes, expensesRes] = await Promise.all([
      sb.from("orders").select("id, order_number, client_id, order_date, status, season, total_amount"),
      sb.from("clients").select("id, company_name, customer_number, contact_name, email, city, state"),
      sb.from("styles").select("id, style_code, name, wholesale_price, retail_price, category, season, is_active"),
      sb.from("order_items").select("id, order_id, style_id, quantity, unit_price, total_price, size, color"),
      sb.from("payments").select("id, order_id, client_id, amount, payment_date, payment_method"),
      sb.from("expenses").select("id, description, category, amount, expense_date, season, vendor"),
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("analytics-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
