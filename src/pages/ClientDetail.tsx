import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Save, Pencil, X, ShoppingBag, DollarSign } from "lucide-react";
import { format } from "date-fns";

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: orders } = useQuery({
    queryKey: ["client-orders", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(quantity)")
        .eq("client_id", id!)
        .order("order_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: payments } = useQuery({
    queryKey: ["client-payments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("client_id", id!)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const updateClient = useMutation({
    mutationFn: async (updates: Record<string, string | null>) => {
      const { error } = await supabase.from("clients").update(updates).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client", id] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setEditing(false);
      toast.success("Client updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const startEditing = () => {
    if (!client) return;
    setForm({
      company_name: client.company_name || "",
      customer_number: (client as any).customer_number || "",
      contact_name: client.contact_name || "",
      email: client.email || "",
      phone: client.phone || "",
      address: client.address || "",
      city: client.city || "",
      state: client.state || "",
      zip_code: client.zip_code || "",
      notes: client.notes || "",
    });
    setEditing(true);
  };

  const handleSave = () => {
    updateClient.mutate({
      company_name: form.company_name,
      customer_number: form.customer_number || null,
      contact_name: form.contact_name || null,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      zip_code: form.zip_code || null,
      notes: form.notes || null,
    });
  };

  const totalOrdered = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
  const totalPaid = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const totalPairs = orders?.reduce((sum, o) => sum + (o.order_items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0), 0) || 0;

  const statusColor = (s: string) => {
    switch (s) {
      case "confirmed": return "bg-emerald-500/10 text-emerald-600 border-emerald-200";
      case "draft": return "bg-muted text-muted-foreground border-border";
      case "shipped": return "bg-blue-500/10 text-blue-600 border-blue-200";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  if (isLoading) return <AppLayout><div className="text-center py-12 text-muted-foreground">Loading...</div></AppLayout>;
  if (!client) return <AppLayout><div className="text-center py-12 text-muted-foreground">Client not found</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/clients")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">{client.company_name}</h1>
              {(client as any).customer_number && (
                <Badge variant="outline" className="text-accent border-accent font-mono text-sm">
                  #{(client as any).customer_number}
                </Badge>
              )}
            </div>
            {client.contact_name && <p className="text-muted-foreground mt-1">{client.contact_name}</p>}
          </div>
          {!editing ? (
            <Button onClick={startEditing} variant="outline" className="gap-2">
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button onClick={handleSave} className="gap-2 bg-accent text-accent-foreground hover:bg-gold-dark" disabled={updateClient.isPending}>
                <Save className="h-4 w-4" /> Save
              </Button>
              <Button onClick={() => setEditing(false)} variant="ghost" size="icon">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Orders</p>
              <p className="text-2xl font-bold text-foreground mt-1">{orders?.length || 0}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Pairs</p>
              <p className="text-2xl font-bold text-foreground mt-1">{totalPairs}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Ordered</p>
              <p className="text-2xl font-bold text-accent mt-1">${totalOrdered.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Paid</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">${totalPaid.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Client Info */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-display text-lg">Client Information</CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label>Company Name *</Label>
                    <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Customer #</Label>
                    <Input value={form.customer_number} onChange={(e) => setForm({ ...form, customer_number: e.target.value })} placeholder="e.g. 1001" />
                  </div>
                  <div>
                    <Label>Contact Name</Label>
                    <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Email</Label>
                    <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Address</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>City</Label>
                    <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  </div>
                  <div>
                    <Label>State</Label>
                    <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                  </div>
                  <div>
                    <Label>Zip</Label>
                    <Input value={form.zip_code} onChange={(e) => setForm({ ...form, zip_code: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Notes / Memo</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Internal notes about this client..." rows={4} />
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                  <div><span className="text-muted-foreground">Customer #:</span> <span className="text-foreground font-medium">{(client as any).customer_number || "—"}</span></div>
                  <div><span className="text-muted-foreground">Contact:</span> <span className="text-foreground">{client.contact_name || "—"}</span></div>
                  <div><span className="text-muted-foreground">Email:</span> <span className="text-foreground">{client.email || "—"}</span></div>
                  <div><span className="text-muted-foreground">Phone:</span> <span className="text-foreground">{client.phone || "—"}</span></div>
                  <div className="sm:col-span-2"><span className="text-muted-foreground">Address:</span> <span className="text-foreground">{[client.address, client.city, client.state, client.zip_code].filter(Boolean).join(", ") || "—"}</span></div>
                </div>
                {client.notes && (
                  <div className="mt-4 p-3 rounded-md bg-secondary border border-border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                    <p className="text-foreground whitespace-pre-wrap">{client.notes}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order History */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-accent" /> Order History
            </CardTitle>
            <Link to={`/orders/new?client=${id}`}>
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-gold-dark">New Order</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {!orders?.length ? (
              <p className="text-center py-8 text-muted-foreground">No orders yet</p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary">
                      <TableHead>Order #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="hidden sm:table-cell">Season</TableHead>
                      <TableHead>Pairs</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => {
                      const pairs = order.order_items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0;
                      return (
                        <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/orders/${order.id}`)}>
                          <TableCell className="font-medium text-foreground">{order.order_number}</TableCell>
                          <TableCell className="text-muted-foreground">{format(new Date(order.order_date), "MMM d, yyyy")}</TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">{order.season || "—"}</TableCell>
                          <TableCell className="text-foreground">{pairs}</TableCell>
                          <TableCell className="text-accent font-medium">${(order.total_amount || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusColor(order.status)}>{order.status}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment History */}
        {payments && payments.length > 0 && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600" /> Payment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary">
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className="hidden sm:table-cell">Method</TableHead>
                      <TableHead className="hidden sm:table-cell">Reference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-foreground">{format(new Date(p.payment_date), "MMM d, yyyy")}</TableCell>
                        <TableCell className="text-emerald-600 font-medium">${p.amount.toLocaleString()}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">{p.payment_method || "—"}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">{p.reference_number || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
