import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppLayout } from "@/components/AppLayout";
import { Gem, Users, ShoppingCart, DollarSign } from "lucide-react";

type DrillDown = "styles" | "clients" | "orders" | "collected" | null;

export default function Dashboard() {
  const navigate = useNavigate();
  const [drill, setDrill] = useState<DrillDown>(null);

  const { data: styleCount } = useQuery({
    queryKey: ["styles-count"],
    queryFn: async () => {
      const { count } = await supabase.from("styles").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: clientCount } = useQuery({
    queryKey: ["clients-count"],
    queryFn: async () => {
      const { count } = await supabase.from("clients").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: orderStats } = useQuery({
    queryKey: ["order-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("status, total_amount");
      const total = data?.length ?? 0;
      const totalRevenue = data?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) ?? 0;
      return { total, totalRevenue };
    },
  });

  const { data: paymentTotal } = useQuery({
    queryKey: ["payment-total"],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("amount");
      return data?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;
    },
  });

  const stats = [
    { label: "Total Styles", value: styleCount ?? 0, icon: Gem, color: "text-accent", drill: "styles" as const },
    { label: "Clients", value: clientCount ?? 0, icon: Users, color: "text-primary", drill: "clients" as const },
    { label: "Active Orders", value: orderStats?.total ?? 0, icon: ShoppingCart, color: "text-accent", drill: "orders" as const },
    { label: "Collected", value: `$${(paymentTotal ?? 0).toLocaleString()}`, icon: DollarSign, color: "text-green-600", drill: "collected" as const },
  ];

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your wholesale business</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card
              key={stat.label}
              className="border-border cursor-pointer hover:border-accent transition-colors"
              onClick={() => setDrill(stat.drill)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="font-display">Recent Orders</CardTitle></CardHeader>
            <CardContent><RecentOrders /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="font-display">Pending Confirmations</CardTitle></CardHeader>
            <CardContent><PendingOrders /></CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={drill !== null} onOpenChange={() => setDrill(null)}>
        <DialogContent className="max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {drill === "styles" && "All Styles"}
              {drill === "clients" && "All Clients"}
              {drill === "orders" && "All Orders"}
              {drill === "collected" && "Payment Collections"}
            </DialogTitle>
          </DialogHeader>
          {drill === "styles" && <StylesList />}
          {drill === "clients" && <ClientsList />}
          {drill === "orders" && <OrdersList navigate={navigate} />}
          {drill === "collected" && <PaymentsList />}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function StylesList() {
  const { data } = useQuery({
    queryKey: ["drill-styles"],
    queryFn: async () => {
      const { data } = await supabase.from("styles").select("style_code, name, wholesale_price, is_active").order("style_code");
      return data ?? [];
    },
  });
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Price</TableHead></TableRow></TableHeader>
      <TableBody>
        {data?.map((s) => (
          <TableRow key={s.style_code}>
            <TableCell className="font-mono text-accent">{s.style_code}</TableCell>
            <TableCell>{s.name}</TableCell>
            <TableCell className="text-right">${s.wholesale_price ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ClientsList() {
  const { data } = useQuery({
    queryKey: ["drill-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("company_name, contact_name, phone, email").order("company_name");
      return data ?? [];
    },
  });
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Company</TableHead><TableHead>Contact</TableHead><TableHead>Phone</TableHead></TableRow></TableHeader>
      <TableBody>
        {data?.map((c) => (
          <TableRow key={c.company_name}>
            <TableCell className="font-medium">{c.company_name}</TableCell>
            <TableCell>{c.contact_name || "—"}</TableCell>
            <TableCell>{c.phone || "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function OrdersList({ navigate }: { navigate: (path: string) => void }) {
  const { data } = useQuery({
    queryKey: ["drill-orders"],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("id, order_number, status, total_amount, clients(company_name)").order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Order #</TableHead><TableHead>Client</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
      <TableBody>
        {data?.map((o) => (
          <TableRow key={o.id} className="cursor-pointer hover:bg-accent/5" onClick={() => navigate(`/orders/${o.id}`)}>
            <TableCell className="font-mono text-accent">{o.order_number}</TableCell>
            <TableCell>{o.clients?.company_name}</TableCell>
            <TableCell className="capitalize">{o.status.replace(/_/g, " ")}</TableCell>
            <TableCell className="text-right font-medium">${Number(o.total_amount).toLocaleString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PaymentsList() {
  const { data } = useQuery({
    queryKey: ["drill-payments"],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("amount, payment_date, payment_method, clients(company_name), orders(order_number)").order("payment_date", { ascending: false });
      return data ?? [];
    },
  });
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Client</TableHead><TableHead>Order</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
      <TableBody>
        {data?.map((p, i) => (
          <TableRow key={i}>
            <TableCell>{p.payment_date}</TableCell>
            <TableCell>{p.clients?.company_name}</TableCell>
            <TableCell className="font-mono">{p.orders?.order_number}</TableCell>
            <TableCell className="text-right font-medium">${Number(p.amount).toLocaleString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RecentOrders() {
  const { data: orders } = useQuery({
    queryKey: ["recent-orders"],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*, clients(company_name)").order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });
  if (!orders?.length) return <p className="text-muted-foreground text-sm">No orders yet</p>;
  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <div key={order.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
          <div>
            <p className="font-medium text-foreground">{order.order_number}</p>
            <p className="text-sm text-muted-foreground">{order.clients?.company_name}</p>
          </div>
          <span className="text-sm font-medium capitalize px-2 py-1 rounded bg-secondary text-secondary-foreground">{order.status.replace(/_/g, " ")}</span>
        </div>
      ))}
    </div>
  );
}

function PendingOrders() {
  const { data: orders } = useQuery({
    queryKey: ["pending-orders"],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*, clients(company_name)").in("status", ["draft", "pending_confirmation"]).order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });
  if (!orders?.length) return <p className="text-muted-foreground text-sm">No pending orders</p>;
  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <div key={order.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
          <div>
            <p className="font-medium text-foreground">{order.order_number}</p>
            <p className="text-sm text-muted-foreground">{order.clients?.company_name}</p>
          </div>
          <span className="text-sm text-accent font-medium">${Number(order.total_amount).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
