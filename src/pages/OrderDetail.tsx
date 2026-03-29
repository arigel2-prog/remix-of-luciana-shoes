import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, FileText, Package, Factory, Receipt } from "lucide-react";
import OrderConfirmationPDF from "@/components/documents/OrderConfirmationPDF";
import PackingListPDF from "@/components/documents/PackingListPDF";
import InvoicePDF from "@/components/documents/InvoicePDF";
import FactoryOrderPDF from "@/components/documents/FactoryOrderPDF";

type DocType = "confirmation" | "packing" | "invoice" | "factory" | null;

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [activeDoc, setActiveDoc] = useState<DocType>(null);
  const printRef = useRef<HTMLDivElement>(null);

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

  if (!order) return <AppLayout><div className="text-center py-12 text-muted-foreground">Loading order...</div></AppLayout>;

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Luciana - ${activeDoc}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; }
        table { border-collapse: collapse; width: 100%; }
        th, td { padding: 6px 8px; text-align: left; font-size: 12px; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
      </head><body>${content.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  const docButtons = [
    { type: "confirmation" as const, label: "Order Confirmation", icon: FileText },
    { type: "packing" as const, label: "Packing List", icon: Package },
    { type: "invoice" as const, label: "Invoice", icon: Receipt },
    { type: "factory" as const, label: "Factory Order", icon: Factory },
  ];

  return (
    <AppLayout>
      <div className="max-w-4xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Order {order.order_number}</h1>
            <p className="text-muted-foreground mt-1 capitalize">{order.status.replace(/_/g, " ")}</p>
          </div>
        </div>

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
