import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { DollarSign, Plus } from "lucide-react";

export default function Collections() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: payments } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, orders(order_number), clients(company_name)")
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["orders-for-payment"],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("id, order_number, client_id, total_amount, clients(company_name)");
      return data ?? [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["collection-stats"],
    queryFn: async () => {
      const { data: orderData } = await supabase.from("orders").select("total_amount").not("status", "eq", "cancelled");
      const { data: paymentData } = await supabase.from("payments").select("amount");
      const totalBilled = orderData?.reduce((s, o) => s + Number(o.total_amount || 0), 0) ?? 0;
      const totalCollected = paymentData?.reduce((s, p) => s + Number(p.amount), 0) ?? 0;
      return { totalBilled, totalCollected, outstanding: totalBilled - totalCollected };
    },
  });

  const addPayment = useMutation({
    mutationFn: async (formData: FormData) => {
      const orderId = formData.get("order_id") as string;
      const order = orders?.find((o) => o.id === orderId);
      if (!order) throw new Error("Order not found");

      const { error } = await supabase.from("payments").insert({
        order_id: orderId,
        client_id: order.client_id,
        amount: Number(formData.get("amount")),
        payment_date: formData.get("payment_date") as string,
        payment_method: formData.get("payment_method") as string,
        reference_number: formData.get("reference_number") as string,
        notes: formData.get("notes") as string,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["collection-stats"] });
      setDialogOpen(false);
      toast.success("Payment recorded");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Collections</h1>
            <p className="text-muted-foreground mt-1">Track payments from clients</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-gold-dark">
                <Plus className="h-4 w-4 mr-2" /> Record Payment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Record Payment</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addPayment.mutate(new FormData(e.currentTarget));
                }}
                className="space-y-4"
              >
                <div>
                  <Label>Order *</Label>
                  <Select name="order_id" required>
                    <SelectTrigger><SelectValue placeholder="Select order" /></SelectTrigger>
                    <SelectContent>
                      {orders?.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.order_number} — {o.clients?.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amount">Amount *</Label>
                    <Input id="amount" name="amount" type="number" step="0.01" required />
                  </div>
                  <div>
                    <Label htmlFor="payment_date">Date *</Label>
                    <Input id="payment_date" name="payment_date" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="payment_method">Method</Label>
                    <Input id="payment_method" name="payment_method" placeholder="e.g. Wire, Check" />
                  </div>
                  <div>
                    <Label htmlFor="reference_number">Reference #</Label>
                    <Input id="reference_number" name="reference_number" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Input id="notes" name="notes" />
                </div>
                <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={addPayment.isPending}>
                  {addPayment.isPending ? "Recording..." : "Record Payment"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Billed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">${(stats?.totalBilled ?? 0).toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Collected</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">${(stats?.totalCollected ?? 0).toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">${(stats?.outstanding ?? 0).toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {!payments?.length ? (
          <div className="text-center py-20">
            <DollarSign className="h-16 w-16 mx-auto text-accent/40 mb-4" />
            <h3 className="font-display text-xl text-foreground mb-2">No payments recorded</h3>
            <p className="text-muted-foreground">Record your first payment to start tracking collections</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary">
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground">{p.payment_date}</TableCell>
                    <TableCell className="text-foreground font-medium">{p.clients?.company_name}</TableCell>
                    <TableCell className="font-mono text-sm text-foreground">{p.orders?.order_number}</TableCell>
                    <TableCell className="text-muted-foreground">{p.payment_method}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">${Number(p.amount).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
