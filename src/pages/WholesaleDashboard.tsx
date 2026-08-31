import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gem, ShoppingCart, DollarSign, Clock, LogOut } from "lucide-react";
import type { AuthUser as User } from "@/integrations/supabase/client";

export default function WholesaleDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) navigate("/wholesale/login");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) navigate("/wholesale/login");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const { data: wholesaleProfile } = useQuery({
    queryKey: ["wholesale-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wholesale_customers")
        .select("*, clients(*)")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const clientId = wholesaleProfile?.client_id;

  const { data: orders } = useQuery({
    queryKey: ["wholesale-orders", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, styles(style_code, name, image_url))")
        .eq("client_id", clientId!)
        .order("order_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  const { data: payments } = useQuery({
    queryKey: ["wholesale-payments", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("client_id", clientId!)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  const { data: styles } = useQuery({
    queryKey: ["wholesale-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("styles")
        .select("*")
        .eq("is_active", true)
        .order("style_code");
      if (error) throw error;
      return data;
    },
    enabled: wholesaleProfile?.is_approved,
  });

  const totalOrdered = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) ?? 0;
  const totalPaid = payments?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
  const balance = totalOrdered - totalPaid;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/wholesale/login");
  };

  if (!wholesaleProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!wholesaleProfile.is_approved) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <WholesaleHeader onLogout={handleLogout} company={wholesaleProfile.company_name} />
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-md text-center">
            <CardContent className="py-12 space-y-4">
              <Clock className="h-16 w-16 mx-auto text-accent/50" />
              <h2 className="font-display text-2xl font-bold text-foreground">Pending Approval</h2>
              <p className="text-muted-foreground">
                Your wholesale account is under review. You'll receive an email once approved.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <WholesaleHeader onLogout={handleLogout} company={wholesaleProfile.company_name} />

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <ShoppingCart className="h-10 w-10 text-accent" />
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold text-foreground">{orders?.length ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <DollarSign className="h-10 w-10 text-accent" />
              <div>
                <p className="text-sm text-muted-foreground">Total Ordered</p>
                <p className="text-2xl font-bold text-foreground">${totalOrdered.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <DollarSign className="h-10 w-10 text-destructive" />
              <div>
                <p className="text-sm text-muted-foreground">Balance Due</p>
                <p className="text-2xl font-bold text-foreground">${balance.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Catalog */}
        <section>
          <h2 className="font-display text-xl font-bold text-foreground mb-4">Our Collection</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {styles?.map((style) => (
              <Card key={style.id} className="overflow-hidden">
                <div className="aspect-square bg-secondary flex items-center justify-center overflow-hidden">
                  {style.image_url ? (
                    <img src={style.image_url} alt={style.style_code} className="w-full h-full object-contain p-2" />
                  ) : (
                    <Gem className="h-10 w-10 text-muted-foreground/30" />
                  )}
                </div>
                <CardContent className="p-3 text-center">
                  <p className="text-sm font-mono font-semibold text-accent">{style.style_code}</p>
                  {style.wholesale_price && (
                    <p className="text-sm text-muted-foreground mt-1">${style.wholesale_price}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Order History */}
        <section>
          <h2 className="font-display text-xl font-bold text-foreground mb-4">Order History</h2>
          {!orders?.length ? (
            <p className="text-muted-foreground">No orders yet.</p>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <Card key={order.id}>
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{order.order_number}</p>
                      <p className="text-sm text-muted-foreground">{new Date(order.order_date).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={order.status === "delivered" ? "default" : "secondary"}>
                        {order.status}
                      </Badge>
                      <p className="font-semibold text-foreground">${(order.total_amount || 0).toLocaleString()}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Payments */}
        {payments && payments.length > 0 && (
          <section>
            <h2 className="font-display text-xl font-bold text-foreground mb-4">Payment History</h2>
            <div className="space-y-3">
              {payments.map((payment) => (
                <Card key={payment.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{new Date(payment.payment_date).toLocaleDateString()}</p>
                      <p className="text-xs text-muted-foreground">{payment.payment_method}</p>
                    </div>
                    <p className="font-semibold text-foreground">${payment.amount.toLocaleString()}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function WholesaleHeader({ onLogout, company }: { onLogout: () => void; company: string }) {
  return (
    <header className="border-b border-border py-4 px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground tracking-wide">LUCIANA</h1>
          <div className="flex items-center gap-2">
            <span className="h-px w-6 bg-accent/60" />
            <p className="text-[10px] text-accent tracking-[0.3em] uppercase font-medium">Wholesale</p>
            <span className="h-px w-6 bg-accent/60" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground hidden sm:inline">{company}</span>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4 mr-1" /> Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
}