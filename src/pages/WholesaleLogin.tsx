import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function WholesaleLogin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    navigate("/wholesale");
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;
    const company = form.get("company") as string;
    const contact = form.get("contact") as string;
    const phone = form.get("phone") as string;

    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) {
      toast.error(authError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      const { error: profileError } = await supabase.from("wholesale_customers").insert({
        user_id: authData.user.id,
        company_name: company,
        contact_name: contact,
        email,
        phone: phone || null,
      });
      if (profileError) {
        toast.error(profileError.message);
        setLoading(false);
        return;
      }
    }

    toast.success("Registration submitted! Please check your email to verify, then wait for approval.");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border py-6 px-8">
        <div className="max-w-md mx-auto text-center">
          <h1 className="font-display text-3xl font-semibold text-foreground tracking-wide">LUCIANA</h1>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="h-px w-8 bg-accent/60" />
            <p className="text-[10px] text-accent tracking-[0.3em] uppercase font-medium">Wholesale Portal</p>
            <span className="h-px w-8 bg-accent/60" />
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="font-display text-xl text-center">Wholesale Access</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" name="email" type="email" required />
                  </div>
                  <div>
                    <Label htmlFor="login-password">Password</Label>
                    <Input id="login-password" name="password" type="password" required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Sign In
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="reg-company">Company Name *</Label>
                    <Input id="reg-company" name="company" required placeholder="Your store name" />
                  </div>
                  <div>
                    <Label htmlFor="reg-contact">Contact Name</Label>
                    <Input id="reg-contact" name="contact" placeholder="Your name" />
                  </div>
                  <div>
                    <Label htmlFor="reg-email">Email *</Label>
                    <Input id="reg-email" name="email" type="email" required />
                  </div>
                  <div>
                    <Label htmlFor="reg-phone">Phone</Label>
                    <Input id="reg-phone" name="phone" placeholder="(555) 555-5555" />
                  </div>
                  <div>
                    <Label htmlFor="reg-password">Password *</Label>
                    <Input id="reg-password" name="password" type="password" required minLength={6} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Request Access
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Your account will need to be approved before you can access the portal.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}