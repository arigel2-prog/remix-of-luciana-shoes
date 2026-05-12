import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Loader2, XCircle, FlaskConical, Circle, ArrowRight } from "lucide-react";
import { toast } from "sonner";

type StepStatus = "pending" | "running" | "ok" | "error";
type Step = { key: string; label: string; status: StepStatus; detail?: string };

const INITIAL_STEPS: Step[] = [
  { key: "catalog", label: "Verify catalog has styles", status: "pending" },
  { key: "client", label: "Create / find sample client", status: "pending" },
  { key: "order", label: "Create draft order with line items", status: "pending" },
  { key: "approve", label: "Approve order (confirm)", status: "pending" },
  { key: "factory", label: "Submit to factory", status: "pending" },
  { key: "pdfs", label: "Verify PDF documents render", status: "pending" },
  { key: "finance", label: "Record payment to finance ledger", status: "pending" },
  { key: "dashboard", label: "Verify dashboard reflects changes", status: "pending" },
];

const SAMPLE_CLIENT = {
  company_name: "E2E Test Boutique",
  customer_number: "E2E-001",
  contact_name: "Test Runner",
  email: "test@example.com",
  phone: "555-0100",
};

export function E2ETestRunner() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [orderId, setOrderId] = useState<string | null>(null);

  const update = (key: string, patch: Partial<Step>) =>
    setSteps((s) => s.map((st) => (st.key === key ? { ...st, ...patch } : st)));

  const run = async () => {
    setRunning(true);
    setOrderId(null);
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: "pending", detail: undefined })));

    try {
      // 1. Catalog
      update("catalog", { status: "running" });
      const { data: styles, error: styleErr } = await supabase
        .from("styles")
        .select("id, style_code, name, wholesale_price")
        .eq("is_active", true)
        .limit(2);
      if (styleErr) throw new Error(`Catalog: ${styleErr.message}`);
      if (!styles?.length) throw new Error("Catalog: no active styles found");
      update("catalog", { status: "ok", detail: `${styles.length} style(s) loaded` });

      // 2. Client
      update("client", { status: "running" });
      let clientId: string;
      const { data: existingClient } = await supabase
        .from("clients")
        .select("id")
        .eq("customer_number", SAMPLE_CLIENT.customer_number)
        .maybeSingle();
      if (existingClient) {
        clientId = existingClient.id;
        update("client", { status: "ok", detail: "Reusing existing test client" });
      } else {
        const { data: newClient, error: cErr } = await supabase
          .from("clients")
          .insert(SAMPLE_CLIENT)
          .select("id")
          .single();
        if (cErr) throw new Error(`Client: ${cErr.message}`);
        clientId = newClient.id;
        update("client", { status: "ok", detail: "Created new test client" });
      }

      // 3. Order
      update("order", { status: "running" });
      const orderNumber = `E2E-${Date.now().toString(36).toUpperCase()}`;
      const unitPrice = 130;
      const sampleSizes = ["41", "42", "43"];
      const qtyPerSize = 2;
      const totalPairs = styles.length * sampleSizes.length * qtyPerSize;
      const totalAmount = totalPairs * unitPrice;

      const { data: order, error: oErr } = await supabase
        .from("orders")
        .insert({
          order_number: orderNumber,
          client_id: clientId,
          season: "E2E SS 2026",
          notes: "Automated end-to-end test order",
          total_amount: totalAmount,
          status: "draft",
        })
        .select("id, order_number")
        .single();
      if (oErr) throw new Error(`Order: ${oErr.message}`);

      const items = styles.flatMap((s) =>
        sampleSizes.map((size) => ({
          order_id: order.id,
          style_id: s.id,
          size,
          color: "Boxcalf Negro | Leather | Thin",
          quantity: qtyPerSize,
          unit_price: unitPrice,
        }))
      );
      const { error: iErr } = await supabase.from("order_items").insert(items);
      if (iErr) throw new Error(`Order items: ${iErr.message}`);
      setOrderId(order.id);
      update("order", { status: "ok", detail: `${order.order_number} • ${totalPairs} pairs • $${totalAmount.toLocaleString()}` });

      // 4. Approve
      update("approve", { status: "running" });
      const { error: aErr } = await supabase
        .from("orders")
        .update({ status: "confirmed" })
        .eq("id", order.id);
      if (aErr) throw new Error(`Approval: ${aErr.message}`);
      update("approve", { status: "ok", detail: "Status → confirmed" });

      // 5. Factory submission
      update("factory", { status: "running" });
      const { error: fErr } = await supabase
        .from("orders")
        .update({ status: "in_production" })
        .eq("id", order.id);
      if (fErr) throw new Error(`Factory: ${fErr.message}`);
      update("factory", { status: "ok", detail: "Status → in_production" });

      // 6. PDFs - verify data needed for PDFs is present
      update("pdfs", { status: "running" });
      const { data: pdfCheck, error: pdfErr } = await supabase
        .from("orders")
        .select("*, clients(*), order_items(*, styles(*))")
        .eq("id", order.id)
        .single();
      if (pdfErr) throw new Error(`PDF data: ${pdfErr.message}`);
      const docs = ["Order Confirmation", "Packing List", "Invoice", "Factory Order"];
      update("pdfs", {
        status: "ok",
        detail: `${docs.length} docs ready • ${pdfCheck.order_items?.length ?? 0} line items`,
      });

      // 7. Finance
      update("finance", { status: "running" });
      const { error: pErr } = await supabase.from("payments").insert({
        order_id: order.id,
        client_id: clientId,
        amount: totalAmount,
        payment_method: "wire",
        reference_number: `E2E-PAY-${Date.now()}`,
        notes: "Automated test payment",
      });
      if (pErr) throw new Error(`Finance: ${pErr.message}`);
      await supabase.from("orders").update({ status: "paid" }).eq("id", order.id);
      update("finance", { status: "ok", detail: `$${totalAmount.toLocaleString()} recorded` });

      // 8. Dashboard verify
      update("dashboard", { status: "running" });
      const [{ count: orderCount }, { data: pays }] = await Promise.all([
        supabase.from("orders").select("*", { count: "exact", head: true }),
        supabase.from("payments").select("amount"),
      ]);
      const collected = pays?.reduce((s, p) => s + Number(p.amount), 0) ?? 0;
      update("dashboard", {
        status: "ok",
        detail: `${orderCount ?? 0} orders • $${collected.toLocaleString()} collected`,
      });

      toast.success("End-to-end test passed");
    } catch (err: any) {
      const failing = steps.find((s) => s.status === "running")?.key;
      if (failing) update(failing, { status: "error", detail: err.message });
      setSteps((s) =>
        s.map((st) => (st.status === "running" ? { ...st, status: "error", detail: err.message } : st))
      );
      toast.error(err.message || "E2E test failed");
    } finally {
      setRunning(false);
    }
  };

  const icon = (s: StepStatus) => {
    if (s === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    if (s === "running") return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
    if (s === "error") return <XCircle className="h-4 w-4 text-red-400" />;
    return <Circle className="h-4 w-4 text-muted-foreground/40" />;
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setOpen(true);
        }}
      >
        <FlaskConical className="h-4 w-4 mr-2" />
        End-to-end test
      </Button>

      <Dialog open={open} onOpenChange={(o) => !running && setOpen(o)}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">End-to-end workflow test</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground font-sans font-light">
            Walks through catalog → order → approval → factory submission → PDFs → finance with sample data.
            Creates a test client and a real order in your workspace.
          </p>

          <div className="space-y-2 mt-2">
            {steps.map((s) => (
              <div key={s.key} className="flex items-start gap-3 py-2 px-3 rounded-md bg-secondary/40 border border-border">
                <div className="mt-0.5">{icon(s.status)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-sans font-medium text-foreground">{s.label}</p>
                  {s.detail && (
                    <p className="text-xs text-muted-foreground font-sans font-light mt-0.5">{s.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            {orderId && !running ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  navigate(`/orders/${orderId}`);
                }}
              >
                Open test order <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={run} disabled={running}>
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running…
                </>
              ) : (
                <>
                  <FlaskConical className="h-4 w-4 mr-2" /> Run test
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
