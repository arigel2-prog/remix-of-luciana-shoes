import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Search, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Clients() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients", search],
    queryFn: async () => {
      let query = supabase.from("clients").select("*").order("company_name");
      if (search) {
        query = query.or(`company_name.ilike.%${search}%,contact_name.ilike.%${search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const addClient = useMutation({
    mutationFn: async (formData: FormData) => {
      const client = {
        company_name: formData.get("company_name") as string,
        contact_name: formData.get("contact_name") as string,
        email: formData.get("email") as string,
        phone: formData.get("phone") as string,
        address: formData.get("address") as string,
        city: formData.get("city") as string,
        state: formData.get("state") as string,
        zip_code: formData.get("zip_code") as string,
      };
      const { error } = await supabase.from("clients").insert(client);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setDialogOpen(false);
      toast.success("Client added successfully");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Clients</h1>
            <p className="text-muted-foreground mt-1">Your store buyers</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-gold-dark">
                <Plus className="h-4 w-4 mr-2" /> Add Client
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Add New Client</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addClient.mutate(new FormData(e.currentTarget));
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="company_name">Company Name *</Label>
                    <Input id="company_name" name="company_name" required />
                  </div>
                  <div>
                    <Label htmlFor="contact_name">Contact Name</Label>
                    <Input id="contact_name" name="contact_name" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" name="phone" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" name="address" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input id="city" name="city" />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input id="state" name="state" />
                  </div>
                  <div>
                    <Label htmlFor="zip_code">Zip</Label>
                    <Input id="zip_code" name="zip_code" />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={addClient.isPending}>
                  {addClient.isPending ? "Adding..." : "Add Client"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search clients..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading clients...</div>
        ) : !clients?.length ? (
          <div className="text-center py-20">
            <Users className="h-16 w-16 mx-auto text-accent/40 mb-4" />
            <h3 className="font-display text-xl text-foreground mb-2">No clients yet</h3>
            <p className="text-muted-foreground">Add your store buyers to start taking orders</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                 <TableRow className="bg-secondary">
                  <TableHead>Customer #</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead className="hidden lg:table-cell">City</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium text-foreground">{client.company_name}</TableCell>
                    <TableCell className="text-muted-foreground">{client.contact_name}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{client.email}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{client.phone}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {[client.city, client.state].filter(Boolean).join(", ")}
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
