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
import { Plus, Trash2 } from "lucide-react";

interface OrderLine {
  style_id: string;
  size: string;
  color: string;
  quantity: number;
  unit_price: number;
}

export default function NewOrder() {
  const navigate = useNavigate();
  const [clientId, setClientId] = useState("");
  const [season, setSeason] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([{ style_id: "", size: "", color: "", quantity: 1, unit_price: 0 }]);

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
      const { data } = await supabase.from("styles").select("id, style_code, name, wholesale_price").eq("is_active", true).order("style_code");
      return data ?? [];
    },
  });

  const createOrder = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Please select a client");
      if (!lines.some((l) => l.style_id)) throw new Error("Please add at least one item");

      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
      const totalAmount = lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);

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

      const items = lines
        .filter((l) => l.style_id)
        .map((l) => ({
          order_id: order.id,
          style_id: l.style_id,
          size: l.size || null,
          color: l.color || null,
          quantity: l.quantity,
          unit_price: l.unit_price,
        }));

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

  const addLine = () => setLines([...lines, { style_id: "", size: "", color: "", quantity: 1, unit_price: 0 }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof OrderLine, value: string | number) => {
    const updated = [...lines];
    (updated[i] as any)[field] = value;
    if (field === "style_id") {
      const style = styles?.find((s) => s.id === value);
      if (style) updated[i].unit_price = Number(style.wholesale_price) || 0;
    }
    setLines(updated);
  };

  const total = lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);

  return (
    <AppLayout>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">New Order</h1>
          <p className="text-muted-foreground mt-1">Create a new client order</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="e.g. Spring 2026" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Order notes..." />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Order Items</CardTitle>
            <Button variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4 mr-1" /> Add Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg bg-secondary/50">
                <div className="col-span-12 sm:col-span-4">
                  <Label className="text-xs">Style</Label>
                  <Select value={line.style_id} onValueChange={(val) => updateLine(i, "style_id", val)}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Select style" />
                    </SelectTrigger>
                    <SelectContent>
                      {styles?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.style_code} - {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Label className="text-xs">Size</Label>
                  <Input value={line.size} onChange={(e) => updateLine(i, "size", e.target.value)} className="text-sm" />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Label className="text-xs">Color</Label>
                  <Input value={line.color} onChange={(e) => updateLine(i, "color", e.target.value)} className="text-sm" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label className="text-xs">Qty</Label>
                  <Input type="number" min={1} value={line.quantity} onChange={(e) => updateLine(i, "quantity", Number(e.target.value))} className="text-sm" />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Label className="text-xs">Price</Label>
                  <Input type="number" step="0.01" value={line.unit_price} onChange={(e) => updateLine(i, "unit_price", Number(e.target.value))} className="text-sm" />
                </div>
                <div className="col-span-2 sm:col-span-1 flex justify-end">
                  {lines.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeLine(i)} className="text-destructive h-9 w-9">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            <div className="flex justify-between items-center pt-4 border-t border-border">
              <span className="font-display text-lg text-foreground">Total:</span>
              <span className="font-display text-2xl font-bold text-foreground">${total.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => navigate("/orders")}>Cancel</Button>
          <Button
            onClick={() => createOrder.mutate()}
            disabled={createOrder.isPending}
            className="bg-accent text-accent-foreground hover:bg-gold-dark"
          >
            {createOrder.isPending ? "Creating..." : "Create Order"}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
