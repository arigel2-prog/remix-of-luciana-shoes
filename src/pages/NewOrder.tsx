import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { OrderLineRow, OrderLineData, SIZES } from "@/components/orders/OrderLineRow";

const emptyLine = (): OrderLineData => ({
  style_id: "",
  leather: "",
  lining: "",
  sole: "",
  comments: "",
  sizes: {},
});

export default function NewOrder() {
  const navigate = useNavigate();
  const [clientId, setClientId] = useState("");
  const [season, setSeason] = useState("SS 2026");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<OrderLineData[]>([emptyLine()]);

  const { data: clients } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, company_name").order("company_name");
      return data ?? [];
    },
  });

  const { data: styles } = useQuery({
    queryKey: ["styles-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("styles")
        .select("id, style_code, name, wholesale_price, last_number, leather_description, sole_type")
        .eq("is_active", true)
        .order("style_code");
      return data ?? [];
    },
  });

  const updateLine = (i: number, field: string, value: any) => {
    const updated = [...lines];
    (updated[i] as any)[field] = value;
    // Auto-fill leather/sole from style defaults
    if (field === "style_id") {
      const style = styles?.find((s) => s.id === value);
      if (style) {
        if (style.leather_description && !updated[i].leather) updated[i].leather = style.leather_description;
        if (style.sole_type && !updated[i].sole) updated[i].sole = style.sole_type;
      }
    }
    setLines(updated);
  };

  const updateSize = (i: number, size: string, qty: number) => {
    const updated = [...lines];
    updated[i].sizes = { ...updated[i].sizes, [size]: qty };
    setLines(updated);
  };

  const addLine = () => setLines([...lines, emptyLine()]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));

  const totalPairs = lines.reduce((sum, l) => sum + Object.values(l.sizes).reduce((s, q) => s + q, 0), 0);
  const unitPrice = 130;
  const totalAmount = totalPairs * unitPrice;

  const createOrder = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Please select a client");
      const validLines = lines.filter((l) => l.style_id && Object.values(l.sizes).some((q) => q > 0));
      if (!validLines.length) throw new Error("Please add at least one style with sizes");

      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          order_number: orderNumber,
          client_id: clientId,
          season,
          notes,
          total_amount: totalAmount,
          status: "draft",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create one order_item per style+size combination
      const items = validLines.flatMap((l) =>
        Object.entries(l.sizes)
          .filter(([_, qty]) => qty > 0)
          .map(([size, qty]) => ({
            order_id: order.id,
            style_id: l.style_id,
            size,
            color: [l.leather, l.lining, l.sole, l.comments].filter(Boolean).join(" | "),
            quantity: qty,
            unit_price: unitPrice,
          }))
      );

      if (items.length) {
        const { error: itemsError } = await supabase.from("order_items").insert(items);
        if (itemsError) throw itemsError;
      }

      return order;
    },
    onSuccess: (order) => {
      toast.success("Order created successfully");
      navigate(`/orders/${order.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AppLayout>
      <div className="max-w-6xl space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">New Order</h1>
          <p className="text-muted-foreground mt-1">Enter customer order with size breakdown</p>
        </div>

        {/* Order Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Client *</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Season</Label>
                <Input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="e.g. SS 2026" />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Order notes..." className="h-9 min-h-[36px]" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Lines */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="font-display">Order Lines</CardTitle>
            <Button variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4 mr-1" /> Add Style
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {lines.map((line, i) => (
              <OrderLineRow
                key={i}
                line={line}
                index={i}
                styles={styles ?? []}
                canRemove={lines.length > 1}
                onUpdate={updateLine}
                onUpdateSize={updateSize}
                onRemove={removeLine}
              />
            ))}

            {/* Summary */}
            <div className="flex justify-between items-center pt-4 border-t border-border">
              <div className="space-x-6">
                <span className="text-sm text-muted-foreground">
                  Total Pairs: <span className="font-bold text-foreground text-lg">{totalPairs}</span>
                </span>
              </div>
              <span className="font-display text-2xl font-bold text-foreground">
                ${totalAmount.toLocaleString()}.00
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => navigate("/orders")}>Cancel</Button>
          <Button
            onClick={() => createOrder.mutate()}
            disabled={createOrder.isPending}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {createOrder.isPending ? "Creating..." : "Create Order"}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
