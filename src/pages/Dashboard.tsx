import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AppLayout } from "@/components/AppLayout";
import { Gem, Users, ShoppingCart, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";

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
    { label: "Total Styles", value: styleCount ?? 0, icon: Gem, delta: "+4 this season", positive: true, drill: "styles" as const },
    { label: "Active Clients", value: clientCount ?? 0, icon: Users, delta: "+2 new", positive: true, drill: "clients" as const },
    { label: "Active Orders", value: orderStats?.total ?? 0, icon: ShoppingCart, delta: "3 pending", positive: true, drill: "orders" as const },
    { label: "Collected", value: `$${(paymentTotal ?? 0).toLocaleString()}`, icon: DollarSign, delta: `of $${(orderStats?.totalRevenue ?? 0).toLocaleString()} total`, positive: true, drill: "collected" as const },
  ];

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card
              key={stat.label}
              className="group relative overflow-hidden border-border bg-card cursor-pointer hover:border-primary/30 transition-all duration-300"
              onClick={() => setDrill(stat.drill)}
            >
              {/* Gold bottom line on hover */}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 gold-gradient opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-sans font-light uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <stat.icon className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="font-display text-4xl font-semibold text-foreground">{stat.value}</div>
                <div className={`flex items-center gap-1 mt-2 text-xs font-sans font-light ${stat.positive ? "text-emerald-400" : "text-red-400"}`}>
                  {stat.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {stat.delta}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display text-lg">Recent Orders</CardTitle>
              <button onClick={() => navigate("/orders")} className="text-xs font-sans text-primary hover:text-gold-light transition-colors">
                View all →
              </button>
            </CardHeader>
            <CardContent><RecentOrders /></CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display text-lg">Pending Confirmations</CardTitle>
              <button onClick={() => navigate("/orders")} className="text-xs font-sans text-primary hover:text-gold-light transition-colors">
                View all →
              </button>
            </CardHeader>
            <CardContent><PendingOrders /></CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={drill !== null} onOpenChange={() => setDrill(null)}>
        <DialogContent className="max-w-[700px] max-h-[80vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    paid: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    confirmed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    shipped: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    pending_confirmation: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    draft: "bg-muted text-muted-foreground border-border",
    overdue: "bg-red-500/15 text-red-400 border-red-500/20",
    cancelled: "bg-red-500/15 text-red-400 border-red-500/20",
  };
  const cls = styles[status] || styles.draft;
  return (
    <span className={`text-[10px] font-sans font-medium uppercase tracking-wider px-2.5 py-1 rounded-full border ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
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
          <TableRow key={s.style_code} className="hover:bg-primary/5">
            <TableCell className="font-mono text-primary">{s.style_code}</TableCell>
            <TableCell className="font-sans font-light">{s.name}</TableCell>
            <TableCell className="text-right font-sans">${s.wholesale_price ?? "—"}</TableCell>
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
          <TableRow key={c.company_name} className="hover:bg-primary/5">
            <TableCell className="font-sans font-medium">{c.company_name}</TableCell>
            <TableCell className="font-sans font-light">{c.contact_name || "—"}</TableCell>
            <TableCell className="font-sans font-light">{c.phone || "—"}</TableCell>
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
          <TableRow key={o.id} className="cursor-pointer hover:bg-primary/5" onClick={() => navigate(`/orders/${o.id}`)}>
            <TableCell className="font-mono text-primary">{o.order_number}</TableCell>
            <TableCell className="font-sans font-light">{o.clients?.company_name}</TableCell>
            <TableCell><StatusBadge status={o.status} /></TableCell>
            <TableCell className="text-right font-sans font-medium">${Number(o.total_amount).toLocaleString()}</TableCell>
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
          <TableRow key={i} className="hover:bg-primary/5">
            <TableCell className="font-sans font-light">{p.payment_date}</TableCell>
            <TableCell className="font-sans font-light">{p.clients?.company_name}</TableCell>
            <TableCell className="font-mono text-primary">{p.orders?.order_number}</TableCell>
            <TableCell className="text-right font-sans font-medium">${Number(p.amount).toLocaleString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RecentOrders() {
  const navigate = useNavigate();
  const { data: orders } = useQuery({
    queryKey: ["recent-orders"],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*, clients(company_name)").order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });
  if (!orders?.length) return <p className="text-muted-foreground text-sm font-sans font-light">No orders yet</p>;
  return (
    <div className="space-y-1">
      {orders.map((order) => (
        <div
          key={order.id}
          className="flex justify-between items-center py-3 px-3 -mx-3 rounded-lg hover:bg-primary/5 cursor-pointer transition-colors"
          onClick={() => navigate(`/orders/${order.id}`)}
        >
          <div>
            <p className="font-sans font-medium text-sm text-foreground">{order.order_number}</p>
            <p className="text-xs text-muted-foreground font-sans font-light">{order.clients?.company_name}</p>
          </div>
          <StatusBadge status={order.status} />
        </div>
      ))}
    </div>
  );
}

function PendingOrders() {
  const navigate = useNavigate();
  const { data: orders } = useQuery({
    queryKey: ["pending-orders"],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*, clients(company_name)").in("status", ["draft", "pending_confirmation"]).order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });
  if (!orders?.length) return <p className="text-muted-foreground text-sm font-sans font-light">No pending orders</p>;
  return (
    <div className="space-y-1">
      {orders.map((order) => (
        <div
          key={order.id}
          className="flex justify-between items-center py-3 px-3 -mx-3 rounded-lg hover:bg-primary/5 cursor-pointer transition-colors"
          onClick={() => navigate(`/orders/${order.id}`)}
        >
          <div>
            <p className="font-sans font-medium text-sm text-foreground">{order.order_number}</p>
            <p className="text-xs text-muted-foreground font-sans font-light">{order.clients?.company_name}</p>
          </div>
          <span className="text-sm text-primary font-sans font-medium">${Number(order.total_amount).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
