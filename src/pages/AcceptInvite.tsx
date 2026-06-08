import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

type InviteInfo =
  | { valid: true; email: string; role: "admin" | "wholesale" }
  | { valid: false; error: string };

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data, error } = await supabase.rpc("get_invitation_info", { _token: token });
      if (error) setInfo({ valid: false, error: error.message });
      else setInfo(data as unknown as InviteInfo);
    })();
  }, [token]);

  const accept = async () => {
    const { data, error } = await supabase.rpc("accept_admin_invitation", { _token: token });
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as { success: boolean; error?: string; role?: string };
    if (!result.success) {
      toast.error(result.error ?? "Could not accept invitation");
      return;
    }
    toast.success(`Welcome! Role: ${result.role}`);
    navigate(result.role === "admin" ? "/" : "/wholesale");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info || !info.valid) return;
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: info.email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/accept-invite?token=${token}` },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: info.email,
          password,
        });
        if (error) throw error;
      }
      await accept();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  // If already signed in with correct email, just accept
  useEffect(() => {
    if (!info || !info.valid) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email?.toLowerCase() === info.email.toLowerCase()) {
        await accept();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info]);

  if (!token) {
    return <div className="container mx-auto p-6">Missing invitation token.</div>;
  }
  if (!info) {
    return <div className="container mx-auto p-6">Loading…</div>;
  }
  if (!info.valid) {
    return (
      <div className="container mx-auto p-6 max-w-md">
        <Card className="p-6">
          <h1 className="text-xl mb-2">Invitation unavailable</h1>
          <p className="text-muted-foreground">{"error" in info ? info.error : "Unknown error"}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-md">
      <Card className="p-6 space-y-4">
        <h1 className="text-2xl font-serif">Accept invitation</h1>
        <p className="text-muted-foreground">
          You've been invited as <strong>{info.role}</strong>. Set up your account for{" "}
          <strong>{info.email}</strong>.
        </p>

        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "signup" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("signup")}
          >
            Create account
          </Button>
          <Button
            type="button"
            variant={mode === "signin" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("signin")}
          >
            Sign in
          </Button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Email</Label>
            <Input value={info.email} disabled />
          </div>
          <div>
            <Label htmlFor="pw">Password</Label>
            <Input
              id="pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {mode === "signup" ? "Create account & accept" : "Sign in & accept"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
