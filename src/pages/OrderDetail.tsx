import { useRef, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Printer, FileText, Package, Factory, Receipt, Pencil, Trash2, Plus, Save, X, Copy, Mail } from "lucide-react";
import { toast } from "sonner";
import OrderConfirmationPDF from "@/components/documents/OrderConfirmationPDF";
import PackingListPDF from "@/components/documents/PackingListPDF";
import InvoicePDF from "@/components/documents/InvoicePDF";
import FactoryOrderPDF from "@/components/documents/FactoryOrderPDF";
import { OrderLineRow, OrderLineData, SIZES } from "@/components/orders/OrderLineRow";
import { OrderStatusTracker } from "@/components/orders/OrderStatusTracker";

type DocType = "confirmation" | "packing" | "invoice" | "factory" | null;

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeDoc, setActiveDoc] = useState<DocType>(null);
  const [editing, setEditing] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Edit state
  const [editSeason, setEditSeason] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editLines, setEditLines] = useState<OrderLineData[]>([]);

  const { data: order } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, clients(*)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: items } = useQuery({
    queryKey: ["order-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*, styles(style_code, name, factory_name, factory_description, last_number, leather_description, sole_type)")
        .eq("order_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: payments } = useQuery({
    queryKey: ["order-payments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("amount, payment_date, payment_method")
        .eq("order_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
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

  // Build edit lines from existing items
  const buildLinesFromItems = useMemo(() => {
    if (!items) return [];
    const grouped = new Map<string, OrderLineData>();
    for (const item of items) {
      const key = `${item.style_id}__${item.color || ""}`;
      if (!grouped.has(key)) {
        const parts = (item.color || "").split(" | ");
        grouped.set(key, {
          style_id: item.style_id,
          leather: parts[0] || "",
          lining: parts[1] || "",
          sole: parts[2] || "",
          comments: parts[3] || "",
          sizes: {},
        });
      }
      const line = grouped.get(key)!;
      if (item.size) {
        line.sizes[item.size] = (line.sizes[item.size] || 0) + item.quantity;
      }
    }
    return Array.from(grouped.values());
  }, [items]);

  const startEditing = () => {
    if (!order) return;
    setEditSeason(order.season || "");
    setEditNotes(order.notes || "");
    setEditStatus(order.status);
    setEditLines(buildLinesFromItems.length > 0 ? buildLinesFromItems : [{ style_id: "", leather: "", lining: "", sole: "", comments: "", sizes: {} }]);
    setEditing(true);
  };

  const updateLine = (i: number, field: string, value: any) => {
    const updated = [...editLines];
    (updated[i] as any)[field] = value;
    if (field === "style_id") {
      const style = styles?.find((s) => s.id === value);
      if (style) {
        if (style.leather_description && !updated[i].leather) updated[i].leather = style.leather_description;
        if (style.sole_type && !updated[i].sole) updated[i].sole = style.sole_type;
      }
    }
    setEditLines(updated);
  };

  const updateSize = (i: number, size: string, qty: number) => {
    const updated = [...editLines];
    updated[i].sizes = { ...updated[i].sizes, [size]: qty };
    setEditLines(updated);
  };

  const addLine = () => setEditLines([...editLines, { style_id: "", leather: "", lining: "", sole: "", comments: "", sizes: {} }]);
  const removeLine = (i: number) => setEditLines(editLines.filter((_, idx) => idx !== i));

  const editTotalPairs = editLines.reduce((sum, l) => sum + Object.values(l.sizes).reduce((s, q) => s + q, 0), 0);
  const unitPrice = 130;
  const editTotalAmount = editTotalPairs * unitPrice;

  const saveEdit = useMutation({
    mutationFn: async () => {
      const validLines = editLines.filter((l) => l.style_id && Object.values(l.sizes).some((q) => q > 0));
      if (!validLines.length) throw new Error("Please add at least one style with sizes");

      const { error: orderError } = await supabase
        .from("orders")
        .update({
          season: editSeason,
          notes: editNotes,
          status: editStatus,
          total_amount: editTotalAmount,
        })
        .eq("id", id!);
      if (orderError) throw orderError;

      const { error: deleteError } = await supabase.from("order_items").delete().eq("order_id", id!);
      if (deleteError) throw deleteError;

      const newItems = validLines.flatMap((l) =>
        Object.entries(l.sizes)
          .filter(([_, qty]) => qty > 0)
          .map(([size, qty]) => ({
            order_id: id!,
            style_id: l.style_id,
            size,
            color: [l.leather, l.lining, l.sole, l.comments].filter(Boolean).join(" | "),
            quantity: qty,
            unit_price: unitPrice,
          }))
      );

      if (newItems.length) {
        const { error: insertError } = await supabase.from("order_items").insert(newItems);
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      toast.success("Order updated successfully");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["order-items", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteOrder = useMutation({
    mutationFn: async () => {
      await supabase.from("order_items").delete().eq("order_id", id!);
      await supabase.from("payments").delete().eq("order_id", id!);
      const { error } = await supabase.from("orders").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Order deleted");
      navigate("/orders");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Duplicate order
  const duplicateOrder = useMutation({
    mutationFn: async () => {
      if (!order || !items) throw new Error("Order data not loaded");

      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
      const { data: newOrder, error: orderError } = await supabase
        .from("orders")
        .insert({
          order_number: orderNumber,
          client_id: order.client_id,
          season: order.season,
          notes: order.notes ? `(Copied from ${order.order_number}) ${order.notes}` : `Copied from ${order.order_number}`,
          total_amount: order.total_amount,
          status: "draft",
        })
        .select()
        .single();
      if (orderError) throw orderError;

      const newItems = items.map((item) => ({
        order_id: newOrder.id,
        style_id: item.style_id,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }));

      if (newItems.length) {
        const { error: itemsError } = await supabase.from("order_items").insert(newItems);
        if (itemsError) throw itemsError;
      }

      return newOrder;
    },
    onSuccess: (newOrder) => {
      toast.success("Order duplicated");
      navigate(`/orders/${newOrder.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Quick status update
  const quickStatusUpdate = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      toast.success("Status updated");
    },
  });

  // Send confirmation email via mailto (simple approach without email infra)
  const handleSendEmail = () => {
    if (!order?.clients?.email) {
      toast.error("Client has no email address on file");
      return;
    }
    const totalPairs = items?.reduce((sum, i) => sum + i.quantity, 0) || 0;
    const subject = encodeURIComponent(`Order Confirmation - ${order.order_number} | Luciana Shoes`);
    const body = encodeURIComponent(
      `Dear ${order.clients?.contact_name || order.clients?.company_name},\n\n` +
      `Thank you for your order! Please find your order details below:\n\n` +
      `Order #: ${order.order_number}\n` +
      `Season: ${order.season || "N/A"}\n` +
      `Total Pairs: ${totalPairs}\n` +
      `Total Amount: $${Number(order.total_amount).toLocaleString()}\n\n` +
      `Please review and confirm this order at your earliest convenience.\n\n` +
      `Best regards,\nLuciana Shoes`
    );
    window.open(`mailto:${order.clients.email}?subject=${subject}&body=${body}`, "_self");
    toast.success("Email client opened");
  };

  if (!order) return <AppLayout><div className="text-center py-12 text-muted-foreground">Loading order...</div></AppLayout>;

  const handlePrint = async () => {
    const content = printRef.current;
    if (!content) {
      toast.error("Document not ready");
      return;
    }
    const filename = `Luciana-${activeDoc}-${order.order_number}.pdf`;
    try {
      toast.loading("Generating PDF…", { id: "pdfgen" });
      const html2pdf = (await import("html2pdf.js")).default as any;
      await html2pdf()
        .set({
          margin: [8, 8, 8, 8],
          filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"] },
        })

        .from(content)
        .save();
      toast.success("PDF downloaded", { id: "pdfgen" });
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF", { id: "pdfgen" });
    }
  };



  const docButtons = [
    { type: "confirmation" as const, label: "Order Confirmation", icon: FileText },
    { type: "packing" as const, label: "Packing List", icon: Package },
    { type: "invoice" as const, label: "Invoice", icon: Receipt },
    { type: "factory" as const, label: "Factory Order", icon: Factory },
  ];

  const STATUS_STEPS = ["draft", "confirmed", "submitted_to_factory", "in_production", "shipped", "delivered"];
  const currentIdx = STATUS_STEPS.indexOf(order.status);
  const nextStatus = currentIdx >= 0 && currentIdx < STATUS_STEPS.length - 1 ? STATUS_STEPS[currentIdx + 1] : null;

  // ── EDIT MODE ──
  if (editing) {
    return (
      <AppLayout>
        <div className="max-w-6xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground">Edit Order {order.order_number}</h1>
              <p className="text-muted-foreground mt-1">Modify order details and line items</p>
            </div>
            <Button variant="ghost" onClick={() => setEditing(false)}><X className="h-4 w-4 mr-1" /> Cancel</Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Status</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="submitted_to_factory">Sent to Factory</SelectItem>
                      <SelectItem value="in_production">In Production</SelectItem>
                      <SelectItem value="shipped">Shipped</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Season</Label>
                  <Input value={editSeason} onChange={(e) => setEditSeason(e.target.value)} />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="h-9 min-h-[36px]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="font-display">Order Lines</CardTitle>
              <Button variant="outline" size="sm" onClick={addLine}><Plus className="h-4 w-4 mr-1" /> Add Style</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {editLines.map((line, i) => (
                <OrderLineRow
                  key={i}
                  line={line}
                  index={i}
                  styles={styles ?? []}
                  canRemove={editLines.length > 1}
                  onUpdate={updateLine}
                  onUpdateSize={updateSize}
                  onRemove={removeLine}
                />
              ))}
              <div className="flex justify-between items-center pt-4 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  Total Pairs: <span className="font-bold text-foreground text-lg">{editTotalPairs}</span>
                </span>
                <span className="font-display text-2xl font-bold text-foreground">
                  ${editTotalAmount.toLocaleString()}.00
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button onClick={() => saveEdit.mutate()} disabled={saveEdit.isPending} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Save className="h-4 w-4 mr-1" /> {saveEdit.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── VIEW MODE ──
  return (
    <AppLayout>
      <div className="max-w-4xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Order {order.order_number}</h1>
            <p className="text-muted-foreground mt-1">{order.clients?.company_name}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleSendEmail}>
              <Mail className="h-4 w-4 mr-1" /> Email Client
            </Button>
            <Button variant="outline" size="sm" onClick={() => duplicateOrder.mutate()} disabled={duplicateOrder.isPending}>
              <Copy className="h-4 w-4 mr-1" /> {duplicateOrder.isPending ? "Copying..." : "Duplicate"}
            </Button>
            <Button variant="outline" size="sm" onClick={startEditing}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-1" /> Delete</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Order {order.order_number}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this order, all its items, and any associated payments.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteOrder.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete Order
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Status Tracker */}
        <Card>
          <CardContent className="pt-6 pb-4">
            <OrderStatusTracker status={order.status} />
            {nextStatus && (
              <div className="flex justify-center mt-3">
                <Button
                  size="sm"
                  onClick={() => quickStatusUpdate.mutate(nextStatus)}
                  disabled={quickStatusUpdate.isPending}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  Mark as {nextStatus.replace(/_/g, " ")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Document Generation Buttons */}
        <Card>
          <CardHeader><CardTitle className="font-display text-lg">Generate Documents</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {docButtons.map((doc) => (
                <Button
                  key={doc.type}
                  variant="outline"
                  className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-accent/10 hover:border-accent"
                  onClick={() => setActiveDoc(doc.type)}
                >
                  <doc.icon className="h-6 w-6 text-accent" />
                  <span className="text-xs text-center">{doc.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Client & Order Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="font-display text-lg">Client Information</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Company:</span> <span className="text-foreground font-medium">{order.clients?.company_name}</span></p>
              <p><span className="text-muted-foreground">Contact:</span> <span className="text-foreground">{order.clients?.contact_name}</span></p>
              <p><span className="text-muted-foreground">Email:</span> <span className="text-foreground">{order.clients?.email}</span></p>
              <p><span className="text-muted-foreground">Phone:</span> <span className="text-foreground">{order.clients?.phone}</span></p>
              {order.clients?.address && (
                <p><span className="text-muted-foreground">Address:</span> <span className="text-foreground">
                  {[order.clients.address, order.clients.city, order.clients.state, order.clients.zip_code].filter(Boolean).join(", ")}
                </span></p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="font-display text-lg">Order Information</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Order Date:</span> <span className="text-foreground">{order.order_date}</span></p>
              <p><span className="text-muted-foreground">Season:</span> <span className="text-foreground">{order.season}</span></p>
              <p><span className="text-muted-foreground">Total:</span> <span className="text-foreground font-bold text-lg">${Number(order.total_amount).toLocaleString()}</span></p>
              {order.notes && <p><span className="text-muted-foreground">Notes:</span> <span className="text-foreground">{order.notes}</span></p>}
            </CardContent>
          </Card>
        </div>

        {/* Items Table */}
        <Card>
          <CardHeader><CardTitle className="font-display">Order Items</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary">
                  <TableHead>Style Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-accent font-medium">{item.styles?.style_code}</TableCell>
                    <TableCell className="text-foreground">{item.styles?.name}</TableCell>
                    <TableCell className="text-muted-foreground">{item.size || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{item.color || "—"}</TableCell>
                    <TableCell className="text-right text-foreground">{item.quantity}</TableCell>
                    <TableCell className="text-right text-foreground">${Number(item.unit_price).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium text-foreground">${Number(item.total_price).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Document Preview Dialog */}
        <Dialog open={activeDoc !== null} onOpenChange={() => setActiveDoc(null)}>
          <DialogContent className="max-w-[900px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display flex items-center justify-between">
                <span>
                  {activeDoc === "confirmation" && "Order Confirmation"}
                  {activeDoc === "packing" && "Packing List"}
                  {activeDoc === "invoice" && "Invoice"}
                  {activeDoc === "factory" && "Factory Order"}
                </span>
                <Button onClick={handlePrint} className="bg-accent text-accent-foreground hover:bg-accent/90">
                  <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
                </Button>
              </DialogTitle>
            </DialogHeader>
            <div ref={printRef}>
              {activeDoc === "confirmation" && items && (
                <OrderConfirmationPDF order={order} items={items} />
              )}
              {activeDoc === "packing" && items && (
                <PackingListPDF order={order} items={items} />
              )}
              {activeDoc === "invoice" && items && (
                <InvoicePDF order={order} items={items} payments={payments || []} />
              )}
              {activeDoc === "factory" && items && (
                <FactoryOrderPDF order={order} items={items} />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
