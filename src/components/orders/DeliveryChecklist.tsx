import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, Flag } from "lucide-react";
import { toast } from "sonner";

type Item = {
  id: string;
  size: string | null;
  color: string | null;
  quantity: number;
  styles?: { style_code?: string; name?: string } | null;
};

type IssueType = "missing" | "wrong" | "damaged" | "extra";

export function DeliveryChecklist({ orderId, items }: { orderId: string; items: Item[] }) {
  const qc = useQueryClient();
  const [issueFor, setIssueFor] = useState<Item | null>(null);
  const [issueType, setIssueType] = useState<IssueType>("missing");
  const [issueNotes, setIssueNotes] = useState("");

  const { data: checks } = useQuery({
    queryKey: ["order-item-checks", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_item_checks")
        .select("*")
        .eq("order_id", orderId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: issues } = useQuery({
    queryKey: ["delivery-issues", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_issues")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const checkMap = new Map((checks ?? []).map((c: any) => [c.order_item_id, c]));
  const openIssuesByItem = new Map<string, number>();
  (issues ?? []).forEach((i: any) => {
    if (i.status === "open" && i.order_item_id) {
      openIssuesByItem.set(i.order_item_id, (openIssuesByItem.get(i.order_item_id) ?? 0) + 1);
    }
  });

  const toggleCheck = useMutation({
    mutationFn: async ({ item, verified }: { item: Item; verified: boolean }) => {
      const existing = checkMap.get(item.id);
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id ?? null;
      if (existing) {
        const { error } = await supabase
          .from("order_item_checks")
          .update({ verified, checked_at: verified ? new Date().toISOString() : null, checked_by: verified ? uid : null })
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("order_item_checks").insert({
          order_id: orderId,
          order_item_id: item.id,
          verified,
          checked_at: verified ? new Date().toISOString() : null,
          checked_by: verified ? uid : null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order-item-checks", orderId] }),
    onError: (e: any) => toast.error(e.message ?? "Failed to update"),
  });

  const submitIssue = useMutation({
    mutationFn: async () => {
      if (!issueFor) return;
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("delivery_issues").insert({
        order_id: orderId,
        order_item_id: issueFor.id,
        issue_type: issueType,
        notes: issueNotes || null,
        created_by: userRes?.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Issue flagged");
      qc.invalidateQueries({ queryKey: ["delivery-issues", orderId] });
      qc.invalidateQueries({ queryKey: ["delivery-issues-open"] });
      setIssueFor(null);
      setIssueNotes("");
      setIssueType("missing");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const resolveIssue = useMutation({
    mutationFn: async (issueId: string) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("delivery_issues")
        .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: userRes?.user?.id ?? null })
        .eq("id", issueId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Issue resolved");
      qc.invalidateQueries({ queryKey: ["delivery-issues", orderId] });
      qc.invalidateQueries({ queryKey: ["delivery-issues-open"] });
    },
  });

  const verifiedCount = (checks ?? []).filter((c: any) => c.verified).length;
  const openIssueCount = (issues ?? []).filter((i: any) => i.status === "open").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display flex items-center justify-between">
          <span>Delivery Verification</span>
          <span className="text-sm font-sans font-normal text-muted-foreground">
            {verifiedCount}/{items.length} verified
            {openIssueCount > 0 && (
              <span className="ml-3 text-red-400">{openIssueCount} open issue{openIssueCount > 1 ? "s" : ""}</span>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground mb-3">
          Check off each line as the customer confirms receipt. Flag anything wrong — it will appear on the Urgent To-Dos dashboard.
        </p>
        {items.map((item) => {
          const check = checkMap.get(item.id) as any;
          const verified = !!check?.verified;
          const openCount = openIssuesByItem.get(item.id) ?? 0;
          return (
            <div
              key={item.id}
              className={`flex items-center gap-3 p-3 rounded border ${
                verified ? "border-emerald-500/30 bg-emerald-500/5" : openCount > 0 ? "border-red-500/30 bg-red-500/5" : "border-border"
              }`}
            >
              <Checkbox
                checked={verified}
                onCheckedChange={(v) => toggleCheck.mutate({ item, verified: !!v })}
              />
              <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <span className="font-mono text-accent truncate">{item.styles?.style_code}</span>
                <span className="text-foreground truncate">{item.styles?.name}</span>
                <span className="text-muted-foreground">Size {item.size || "—"} · {item.color || "—"}</span>
                <span className="text-muted-foreground">Qty {item.quantity}</span>
              </div>
              {openCount > 0 && (
                <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                  {openCount} issue
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIssueFor(item);
                  setIssueType("missing");
                  setIssueNotes("");
                }}
              >
                <Flag className="h-3.5 w-3.5 mr-1" /> Flag
              </Button>
            </div>
          );
        })}

        {(issues ?? []).length > 0 && (
          <div className="pt-4 mt-4 border-t border-border space-y-2">
            <h4 className="text-sm font-sans uppercase tracking-wider text-muted-foreground">Reported Issues</h4>
            {(issues ?? []).map((iss: any) => (
              <div key={iss.id} className="flex items-start gap-3 p-3 rounded border border-border">
                {iss.status === "open" ? (
                  <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5" />
                )}
                <div className="flex-1 text-sm">
                  <div className="flex items-center gap-2">
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
                  </div>
                  {iss.notes && <p className="text-muted-foreground mt-1">{iss.notes}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {new Date(iss.created_at).toLocaleString()}
                  </p>
                </div>
                {iss.status === "open" && (
                  <Button size="sm" variant="outline" onClick={() => resolveIssue.mutate(iss.id)}>
                    Resolve
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!issueFor} onOpenChange={(o) => !o && setIssueFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Flag delivery issue</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {issueFor?.styles?.style_code} — {issueFor?.styles?.name} · Size {issueFor?.size || "—"} · Qty {issueFor?.quantity}
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Issue type</label>
              <Select value={issueType} onValueChange={(v) => setIssueType(v as IssueType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="missing">Missing</SelectItem>
                  <SelectItem value="wrong">Wrong item / size</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="extra">Extra (received more than ordered)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Notes (optional)</label>
              <Textarea
                value={issueNotes}
                onChange={(e) => setIssueNotes(e.target.value)}
                placeholder="What went wrong? Where might the missing/wrong cargo be?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueFor(null)}>Cancel</Button>
            <Button
              onClick={() => submitIssue.mutate()}
              disabled={submitIssue.isPending}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {submitIssue.isPending ? "Saving..." : "Flag issue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
