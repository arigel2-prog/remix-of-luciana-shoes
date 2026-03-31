import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { DollarSign, Plus, TrendingUp, TrendingDown, FileText, Receipt, Trash2 } from "lucide-react";
import { format } from "date-fns";

const EXPENSE_CATEGORIES = [
  "Cost of Goods (Factory)",
  "Shipping & Freight",
  "Customs & Duties",
  "Samples",
  "Travel & Shows",
  "Marketing",
  "Insurance",
  "Office & Admin",
  "Commissions",
  "Other",
];

const SEASONS = ["SS 2025", "FW 2025", "SS 2026", "FW 2026", "SS 2027"];

export default function Finance() {
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<string>("all");
  const queryClient = useQueryClient();

  // ── Queries ──
  const { data: orders } = useQuery({
    queryKey: ["finance-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, total_amount, status, season, client_id, clients(company_name)")
        .not("status", "eq", "cancelled");
      return data ?? [];
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["finance-payments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*, clients(company_name), orders(order_number, season)")
        .order("payment_date", { ascending: false });
      return data ?? [];
    },
  });

  const { data: expenses } = useQuery({
    queryKey: ["finance-expenses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false });
      return data ?? [];
    },
  });

  const addExpense = useMutation({
    mutationFn: async (formData: FormData) => {
      const { error } = await supabase.from("expenses").insert({
        description: formData.get("description") as string,
        category: formData.get("category") as string,
        amount: Number(formData.get("amount")),
        expense_date: formData.get("expense_date") as string,
        season: formData.get("season") as string || null,
        vendor: formData.get("vendor") as string || null,
        reference_number: formData.get("reference_number") as string || null,
        notes: formData.get("notes") as string || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-expenses"] });
      setExpenseDialogOpen(false);
      toast.success("Expense recorded");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-expenses"] });
      toast.success("Expense deleted");
    },
  });

  // ── Filtered data ──
  const filteredOrders = selectedSeason === "all" ? orders : orders?.filter(o => o.season === selectedSeason);
  const filteredPayments = selectedSeason === "all" ? payments : payments?.filter(p => p.orders?.season === selectedSeason);
  const filteredExpenses = selectedSeason === "all" ? expenses : expenses?.filter(e => e.season === selectedSeason);

  // ── Calculations ──
  const totalRevenue = filteredOrders?.reduce((s, o) => s + Number(o.total_amount || 0), 0) ?? 0;
  const totalCollected = filteredPayments?.reduce((s, p) => s + Number(p.amount), 0) ?? 0;
  const totalExpenses = filteredExpenses?.reduce((s, e) => s + Number(e.amount), 0) ?? 0;
  const netProfit = totalRevenue - totalExpenses;
  const outstanding = totalRevenue - totalCollected;

  // Group expenses by category
  const expensesByCategory = filteredExpenses?.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
    return acc;
  }, {} as Record<string, number>) ?? {};

  // AR by client
  const arByClient = (() => {
    const clientTotals: Record<string, { name: string; billed: number; paid: number }> = {};
    filteredOrders?.forEach(o => {
      const cid = o.client_id;
      if (!clientTotals[cid]) clientTotals[cid] = { name: o.clients?.company_name || "Unknown", billed: 0, paid: 0 };
      clientTotals[cid].billed += Number(o.total_amount || 0);
    });
    filteredPayments?.forEach(p => {
      const cid = p.client_id;
      if (!clientTotals[cid]) clientTotals[cid] = { name: p.clients?.company_name || "Unknown", billed: 0, paid: 0 };
      clientTotals[cid].paid += Number(p.amount);
    });
    return Object.entries(clientTotals)
      .map(([id, v]) => ({ id, ...v, balance: v.billed - v.paid }))
      .sort((a, b) => b.balance - a.balance);
  })();

  const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Finance</h1>
            <p className="text-muted-foreground mt-1">P&L, balance sheet, AR & cost tracking</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedSeason} onValueChange={setSelectedSeason}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Seasons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Seasons</SelectItem>
                {SEASONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Revenue</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-foreground">{fmt(totalRevenue)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Expenses</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-destructive">{fmt(totalExpenses)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Net Profit</CardTitle></CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                {fmt(netProfit)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Outstanding AR</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-accent">{fmt(outstanding)}</p></CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pnl" className="space-y-4">
          <TabsList className="bg-secondary">
            <TabsTrigger value="pnl" className="gap-1.5"><TrendingUp className="h-4 w-4" /> P&L</TabsTrigger>
            <TabsTrigger value="balance" className="gap-1.5"><FileText className="h-4 w-4" /> Balance Sheet</TabsTrigger>
            <TabsTrigger value="ar" className="gap-1.5"><Receipt className="h-4 w-4" /> AR Report</TabsTrigger>
            <TabsTrigger value="costs" className="gap-1.5"><TrendingDown className="h-4 w-4" /> Cost Tracking</TabsTrigger>
          </TabsList>

          {/* ── P&L ── */}
          <TabsContent value="pnl">
            <Card>
              <CardHeader><CardTitle className="font-display">Profit & Loss Statement</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary">
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="font-semibold bg-green-50/50 dark:bg-green-950/20">
                      <TableCell className="text-foreground">Total Revenue (Orders)</TableCell>
                      <TableCell className="text-right text-green-600">{fmt(totalRevenue)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={2} className="text-xs uppercase tracking-wider text-muted-foreground font-semibold pt-4">Expenses</TableCell>
                    </TableRow>
                    {Object.entries(expensesByCategory).map(([cat, amt]) => (
                      <TableRow key={cat}>
                        <TableCell className="pl-6 text-muted-foreground">{cat}</TableCell>
                        <TableCell className="text-right text-destructive">({fmt(amt)})</TableCell>
                      </TableRow>
                    ))}
                    {Object.keys(expensesByCategory).length === 0 && (
                      <TableRow>
                        <TableCell className="pl-6 text-muted-foreground italic" colSpan={2}>No expenses recorded</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="font-bold text-base">
                      <TableCell>Total Expenses</TableCell>
                      <TableCell className="text-right text-destructive">({fmt(totalExpenses)})</TableCell>
                    </TableRow>
                    <TableRow className={`font-bold text-lg ${netProfit >= 0 ? "" : ""}`}>
                      <TableCell className="text-foreground">Net Profit / (Loss)</TableCell>
                      <TableCell className={`text-right ${netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                        {netProfit >= 0 ? fmt(netProfit) : `(${fmt(Math.abs(netProfit))})`}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground">Profit Margin</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {totalRevenue > 0 ? `${((netProfit / totalRevenue) * 100).toFixed(1)}%` : "—"}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Balance Sheet ── */}
          <TabsContent value="balance">
            <Card>
              <CardHeader><CardTitle className="font-display">Balance Sheet</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary">
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell colSpan={2} className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Assets</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6 text-foreground">Cash Collected</TableCell>
                      <TableCell className="text-right text-green-600">{fmt(totalCollected)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6 text-foreground">Accounts Receivable</TableCell>
                      <TableCell className="text-right text-accent">{fmt(outstanding)}</TableCell>
                    </TableRow>
                    <TableRow className="font-semibold border-t-2">
                      <TableCell className="text-foreground">Total Assets</TableCell>
                      <TableCell className="text-right text-foreground">{fmt(totalCollected + outstanding)}</TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell colSpan={2} className="text-xs uppercase tracking-wider text-muted-foreground font-semibold pt-6">Liabilities & Equity</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6 text-foreground">Total Expenses Incurred</TableCell>
                      <TableCell className="text-right text-destructive">({fmt(totalExpenses)})</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6 text-foreground">Retained Earnings (Net Profit)</TableCell>
                      <TableCell className={`text-right ${netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                        {fmt(netProfit)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="font-semibold border-t-2">
                      <TableCell className="text-foreground">Total Liabilities & Equity</TableCell>
                      <TableCell className="text-right text-foreground">{fmt(totalExpenses + netProfit)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── AR Report ── */}
          <TabsContent value="ar">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display">Accounts Receivable</CardTitle>
                  <p className="text-sm text-muted-foreground">Total Outstanding: <span className="font-bold text-accent">{fmt(outstanding)}</span></p>
                </div>
              </CardHeader>
              <CardContent>
                {arByClient.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No outstanding receivables</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary">
                        <TableHead>Client</TableHead>
                        <TableHead className="text-right">Billed</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Balance Due</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {arByClient.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{fmt(c.billed)}</TableCell>
                          <TableCell className="text-right text-green-600">{fmt(c.paid)}</TableCell>
                          <TableCell className={`text-right font-bold ${c.balance > 0 ? "text-destructive" : "text-green-600"}`}>
                            {fmt(c.balance)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="font-bold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{fmt(arByClient.reduce((s, c) => s + c.billed, 0))}</TableCell>
                        <TableCell className="text-right text-green-600">{fmt(arByClient.reduce((s, c) => s + c.paid, 0))}</TableCell>
                        <TableCell className="text-right text-destructive">{fmt(arByClient.reduce((s, c) => s + c.balance, 0))}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Cost Tracking ── */}
          <TabsContent value="costs">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display">Cost Tracking</CardTitle>
                  <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                        <Plus className="h-4 w-4 mr-2" /> Add Expense
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle className="font-display">Record Expense</DialogTitle></DialogHeader>
                      <form onSubmit={(e) => { e.preventDefault(); addExpense.mutate(new FormData(e.currentTarget)); }} className="space-y-4">
                        <div>
                          <Label>Description *</Label>
                          <Input name="description" required placeholder="e.g. Factory invoice #1234" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Category *</Label>
                            <Select name="category" required defaultValue="Cost of Goods (Factory)">
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Amount *</Label>
                            <Input name="amount" type="number" step="0.01" required placeholder="0.00" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Date *</Label>
                            <Input name="expense_date" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
                          </div>
                          <div>
                            <Label>Season</Label>
                            <Select name="season">
                              <SelectTrigger><SelectValue placeholder="Select season" /></SelectTrigger>
                              <SelectContent>
                                {SEASONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Vendor</Label>
                            <Input name="vendor" placeholder="e.g. Factory name" />
                          </div>
                          <div>
                            <Label>Reference #</Label>
                            <Input name="reference_number" placeholder="Invoice #" />
                          </div>
                        </div>
                        <div>
                          <Label>Notes</Label>
                          <Input name="notes" placeholder="Additional details" />
                        </div>
                        <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={addExpense.isPending}>
                          {addExpense.isPending ? "Recording..." : "Record Expense"}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {/* Category Summary */}
                {Object.keys(expensesByCategory).length > 0 && (
                  <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                      <div key={cat} className="rounded-lg border border-border p-3">
                        <p className="text-xs text-muted-foreground truncate">{cat}</p>
                        <p className="text-lg font-bold text-foreground">{fmt(amt)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Expense Table */}
                {!filteredExpenses?.length ? (
                  <div className="text-center py-12">
                    <DollarSign className="h-12 w-12 mx-auto text-accent/30 mb-3" />
                    <p className="text-muted-foreground">No expenses recorded yet</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-secondary">
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Season</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredExpenses.map(e => (
                          <TableRow key={e.id}>
                            <TableCell className="text-muted-foreground whitespace-nowrap">{e.expense_date}</TableCell>
                            <TableCell className="font-medium text-foreground">{e.description}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{e.category}</TableCell>
                            <TableCell className="text-muted-foreground">{e.vendor || "—"}</TableCell>
                            <TableCell className="text-muted-foreground">{e.season || "—"}</TableCell>
                            <TableCell className="text-right font-bold text-destructive">{fmt(Number(e.amount))}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteExpense.mutate(e.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow className="font-bold">
                          <TableCell colSpan={5}>Total</TableCell>
                          <TableCell className="text-right text-destructive">{fmt(totalExpenses)}</TableCell>
                          <TableCell />
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
