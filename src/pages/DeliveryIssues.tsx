import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Filter = "open" | "resolved" | "all";

export default function DeliveryIssues() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("open");

  const { data: issues } = useQuery({
    queryKey: ["delivery-issues-list", filter],
    queryFn: async () => {
      let q = supabase
        .from("delivery_issues")
        .select("*, orders(order_number, clients(company_name)), order_items(size, color, quantity, styles(style_code, name))")
        .order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("delivery_issues")
        .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: userRes?.user?.id ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resolved");
      qc.invalidateQueries({ queryKey: ["delivery-issues-list"] });
      qc.invalidateQueries({ queryKey: ["delivery-issues-open"] });
    },
  });

  const reopen = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("delivery_issues")
        .update({ status: "open", resolved_at: null, resolved_by: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery-issues-list"] });
      qc.invalidateQueries({ queryKey: ["delivery-issues-open"] });
    },
  });

  return (
    <AppLayout>
      <div className="max-w-5xl space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Delivery Issues</h1>
          <p className="text-muted-foreground mt-1">Urgent to-dos from customer delivery discrepancies</p>
        </div>

        <div className="flex gap-2">
          {(["open", "resolved", "all"] as Filter[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className={filter === f ? "bg-accent text-accent-foreground hover:bg-accent/90 capitalize" : "capitalize"}
            >
              {f}
            </Button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">
              {issues?.length ?? 0} {filter === "all" ? "total" : filter} issue{(issues?.length ?? 0) !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(issues ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {filter === "open" ? "No open issues — all deliveries verified." : "Nothing here."}
              </p>
            )}
            {(issues ?? []).map((iss: any) => (
              <div key={iss.id} className="flex items-start gap-3 p-4 rounded border border-border">
                {iss.status === "open" ? (
                  <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5" />
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="uppercase text-xs tracking-wider font-medium text-foreground">{iss.issue_type}</span>
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        iss.status === "open"
                          ? "bg-red-500/15 text-red-400 border-red-500/20"
                          : "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                      }`}
                    >
                      {iss.status}
                    </span>
                    <Link
                      to={`/orders/${iss.order_id}`}
                      className="text-xs text-primary hover:text-gold-light flex items-center gap-1"
                    >
                      Order {iss.orders?.order_number}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="text-sm text-foreground">
                    {iss.orders?.clients?.company_name}
                  </div>
                  {iss.order_items && (
                    <div className="text-sm text-muted-foreground">
                      {iss.order_items.styles?.style_code} — {iss.order_items.styles?.name} · Size {iss.order_items.size || "—"} · Qty {iss.order_items.quantity}
                    </div>
                  )}
                  {iss.notes && <p className="text-sm text-muted-foreground italic">"{iss.notes}"</p>}
                  <p className="text-[11px] text-muted-foreground">
                    Reported {new Date(iss.created_at).toLocaleString()}
                    {iss.resolved_at && ` · Resolved ${new Date(iss.resolved_at).toLocaleString()}`}
                  </p>
                </div>
                {iss.status === "open" ? (
                  <Button size="sm" variant="outline" onClick={() => resolve.mutate(iss.id)}>
                    Mark resolved
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => reopen.mutate(iss.id)}>
                    Reopen
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
