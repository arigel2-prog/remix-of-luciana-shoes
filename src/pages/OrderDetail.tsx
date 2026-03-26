import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();

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
        .select("*, styles(style_code, name, factory_name, factory_description)")
        .eq("order_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (!order) return <AppLayout><div className="text-center py-12 text-muted-foreground">Loading order...</div></AppLayout>;

  const handlePrint = () => window.print();

  return (
    <AppLayout>
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Order {order.order_number}</h1>
            <p className="text-muted-foreground mt-1 capitalize">{order.status.replace(/_/g, " ")}</p>
          </div>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" /> Print Confirmation
          </Button>
        </div>

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

        {items && items.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="font-display">Factory Order (Overseas)</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary">
                    <TableHead>Factory Name</TableHead>
                    <TableHead>Factory Description</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium text-foreground">{item.styles?.factory_name || item.styles?.style_code}</TableCell>
                      <TableCell className="text-muted-foreground">{item.styles?.factory_description || item.styles?.name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.size || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{item.color || "—"}</TableCell>
                      <TableCell className="text-right text-foreground">{item.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
