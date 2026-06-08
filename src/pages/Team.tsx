import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, Trash2, Mail } from "lucide-react";

type Invitation = {
  id: string;
  email: string;
  role: "admin" | "wholesale";
  token: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
};

export default function Team() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "wholesale">("admin");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("admin_invitations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setInvitations((data ?? []) as Invitation[]);
  };

  useEffect(() => {
    load();
  }, []);

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("admin_invitations").insert({
      email: email.trim().toLowerCase(),
      role,
      invited_by: user?.id,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Invitation created");
      setEmail("");
      load();
    }
  };

  const inviteUrl = (token: string) =>
    `${window.location.origin}/accept-invite?token=${token}`;

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(inviteUrl(token));
    toast.success("Invite link copied");
  };

  const sendEmail = (inv: Invitation) => {
    const subject = encodeURIComponent("You're invited to Luciana Shoes");
    const body = encodeURIComponent(
      `You've been invited as ${inv.role}.\n\nAccept your invitation:\n${inviteUrl(inv.token)}\n\nLink expires ${new Date(inv.expires_at).toLocaleDateString()}.`
    );
    window.location.href = `mailto:${inv.email}?subject=${subject}&body=${body}`;
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from("admin_invitations").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Invitation revoked");
      load();
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
      <h1 className="text-3xl font-serif">Team Management</h1>

      <Card className="p-6">
        <h2 className="text-xl mb-4">Invite a team member</h2>
        <form onSubmit={createInvite} className="grid gap-4 md:grid-cols-[1fr_180px_auto]">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              required
            />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "wholesale")}>
              <SelectTrigger id="role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="wholesale">Wholesale</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={loading}>Create invite</Button>
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl mb-4">Invitations</h2>
        {invitations.length === 0 ? (
          <p className="text-muted-foreground">No invitations yet.</p>
        ) : (
          <div className="space-y-2">
            {invitations.map((inv) => {
              const expired = new Date(inv.expires_at) < new Date();
              const status = inv.accepted_at
                ? "Accepted"
                : expired
                ? "Expired"
                : "Pending";
              return (
                <div
                  key={inv.id}
                  className="flex items-center justify-between border rounded-md p-3 gap-3 flex-wrap"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{inv.email}</div>
                    <div className="text-sm text-muted-foreground">
                      {inv.role} · {status} · expires {new Date(inv.expires_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!inv.accepted_at && !expired && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => copyLink(inv.token)}>
                          <Copy className="h-4 w-4 mr-1" /> Link
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => sendEmail(inv)}>
                          <Mail className="h-4 w-4 mr-1" /> Email
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => revoke(inv.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
