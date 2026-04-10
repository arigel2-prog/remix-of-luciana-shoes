import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, ShoppingCart, FileText } from "lucide-react";
import { useState } from "react";

const STATUS_OPTIONS = [
  "draft",
  "pending_confirmation",
  "confirmed",
  "submitted_to_factory",
  "in_production",
  "shipped",
  "delivered",
  "cancelled",
] as const;

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_confirmation: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  submitted_to_factory: "bg-blue-100 text-blue-800",
  in_production: "bg-purple-100 text-purple-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function Orders() {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", filterStatus],
    queryFn: async () => {
      let query = supabase.from("orders").select("*, clients(company_name)").order("created_at", { ascending: false });
      if (filterStatus !== "all") query = query.eq("status", filterStatus);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Status updated");
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Orders</h1>
            <p className="text-muted-foreground mt-1">Manage client orders</p>
          </div>
          <div className="flex gap-3">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-gold-dark">
              <Link to="/orders/new">
                <Plus className="h-4 w-4 mr-2" /> New Order
              </Link>
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading orders...</div>
        ) : !orders?.length ? (
          <div className="text-center py-20">
            <ShoppingCart className="h-16 w-16 mx-auto text-accent/40 mb-4" />
            <h3 className="font-display text-xl text-foreground mb-2">No orders yet</h3>
            <p className="text-muted-foreground mb-4">Create your first order</p>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-gold-dark">
              <Link to="/orders/new">
                <Plus className="h-4 w-4 mr-2" /> New Order
              </Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary">
                  <TableHead>Order #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/orders/${order.id}`)}>
                    <TableCell className="font-mono font-medium text-foreground">{order.order_number}</TableCell>
                    <TableCell className="text-foreground">{order.clients?.company_name}</TableCell>
                    <TableCell className="text-muted-foreground">{order.order_date}</TableCell>
                    <TableCell className="font-medium text-foreground">${Number(order.total_amount).toLocaleString()}</TableCell>
                    <TableCell>
                      <Select
                        value={order.status}
                        onValueChange={(val) => updateStatus.mutate({ id: order.id, status: val })}
                      >
                        <SelectTrigger className={`w-44 text-xs h-8 ${statusColors[order.status] || ""}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s} className="capitalize text-xs">
                              {s.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/orders/${order.id}`}>
                          <FileText className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
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
