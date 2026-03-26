import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppLayout } from "@/components/AppLayout";
import { Gem, Users, ShoppingCart, DollarSign } from "lucide-react";

export default function Dashboard() {
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
      const pending = data?.filter((o) => ["draft", "pending_confirmation"].includes(o.status)).length ?? 0;
      const totalRevenue = data?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) ?? 0;
      return { total, pending, totalRevenue };
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
    { label: "Total Styles", value: styleCount ?? 0, icon: Gem, color: "text-accent" },
    { label: "Clients", value: clientCount ?? 0, icon: Users, color: "text-navy-light" },
    { label: "Active Orders", value: orderStats?.total ?? 0, icon: ShoppingCart, color: "text-primary" },
    { label: "Collected", value: `$${(paymentTotal ?? 0).toLocaleString()}`, icon: DollarSign, color: "text-green-600" },
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
            <Card key={stat.label} className="border-border">
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
            <CardHeader>
              <CardTitle className="font-display">Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <RecentOrders />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Pending Confirmations</CardTitle>
            </CardHeader>
            <CardContent>
              <PendingOrders />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

function RecentOrders() {
  const { data: orders } = useQuery({
    queryKey: ["recent-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, clients(company_name)")
        .order("created_at", { ascending: false })
        .limit(5);
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
          <span className="text-sm font-medium capitalize px-2 py-1 rounded bg-secondary text-secondary-foreground">
            {order.status.replace(/_/g, " ")}
          </span>
        </div>
      ))}
    </div>
  );
}

function PendingOrders() {
  const { data: orders } = useQuery({
    queryKey: ["pending-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, clients(company_name)")
        .in("status", ["draft", "pending_confirmation"])
        .order("created_at", { ascending: false })
        .limit(5);
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
