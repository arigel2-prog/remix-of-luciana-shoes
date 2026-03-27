import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, XCircle, AlertTriangle, Plus, Trash2, ClipboardCheck } from "lucide-react";

interface FactoryLineItem {
  factoryName: string;
  factoryDescription: string;
  size: string;
  color: string;
  quantity: number;
}

interface ComparisonResult {
  styleCode: string;
  factoryName: string;
  size: string;
  color: string;
  orderedQty: number;
  factoryQty: number;
  status: "match" | "mismatch" | "missing_factory" | "extra_factory";
}

export default function FactoryCrossCheck() {
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [factoryItems, setFactoryItems] = useState<FactoryLineItem[]>([]);
  const [results, setResults] = useState<ComparisonResult[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: orders } = useQuery({
    queryKey: ["orders-for-crosscheck"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, clients(company_name), season, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: orderItems } = useQuery({
    queryKey: ["order-items-crosscheck", selectedOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*, styles(style_code, name, factory_name, factory_description)")
        .eq("order_id", selectedOrderId);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrderId,
  });

  const addFactoryItem = () => {
    setFactoryItems([...factoryItems, { factoryName: "", factoryDescription: "", size: "", color: "", quantity: 0 }]);
  };

  const updateFactoryItem = (index: number, field: keyof FactoryLineItem, value: string | number) => {
    const updated = [...factoryItems];
    updated[index] = { ...updated[index], [field]: value };
    setFactoryItems(updated);
  };

  const removeFactoryItem = (index: number) => {
    setFactoryItems(factoryItems.filter((_, i) => i !== index));
  };

  const runComparison = () => {
    if (!orderItems || orderItems.length === 0) {
      toast.error("No order items to compare");
      return;
    }
    if (factoryItems.length === 0) {
      toast.error("Add factory proforma items first");
      return;
    }

    const compResults: ComparisonResult[] = [];

    // Check each order item against factory items
    orderItems.forEach((oi) => {
      const fName = oi.styles?.factory_name || oi.styles?.style_code || "";
      const matchingFactory = factoryItems.find(
        (fi) => fi.factoryName.toLowerCase().trim() === fName.toLowerCase().trim()
          && (!fi.size || !oi.size || fi.size.toLowerCase().trim() === oi.size.toLowerCase().trim())
          && (!fi.color || !oi.color || fi.color.toLowerCase().trim() === oi.color.toLowerCase().trim())
      );

      if (!matchingFactory) {
        compResults.push({
          styleCode: oi.styles?.style_code || "",
          factoryName: fName,
          size: oi.size || "",
          color: oi.color || "",
          orderedQty: oi.quantity,
          factoryQty: 0,
          status: "missing_factory",
        });
      } else {
        compResults.push({
          styleCode: oi.styles?.style_code || "",
          factoryName: fName,
          size: oi.size || "",
          color: oi.color || "",
          orderedQty: oi.quantity,
          factoryQty: matchingFactory.quantity,
          status: oi.quantity === matchingFactory.quantity ? "match" : "mismatch",
        });
      }
    });

    // Check for extra factory items not in order
    factoryItems.forEach((fi) => {
      const found = orderItems.some(
        (oi) => (oi.styles?.factory_name || oi.styles?.style_code || "").toLowerCase().trim() === fi.factoryName.toLowerCase().trim()
      );
      if (!found) {
        compResults.push({
          styleCode: "—",
          factoryName: fi.factoryName,
          size: fi.size,
          color: fi.color,
          orderedQty: 0,
          factoryQty: fi.quantity,
          status: "extra_factory",
        });
      }
    });

    setResults(compResults);
    toast.success("Cross-check complete!");
  };

  const statusBadge = (status: ComparisonResult["status"]) => {
    switch (status) {
      case "match":
        return <Badge className="bg-green-600 text-white"><CheckCircle className="h-3 w-3 mr-1" /> Match</Badge>;
      case "mismatch":
        return <Badge className="bg-amber-500 text-white"><AlertTriangle className="h-3 w-3 mr-1" /> Qty Mismatch</Badge>;
      case "missing_factory":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Missing from Factory</Badge>;
      case "extra_factory":
        return <Badge className="bg-blue-600 text-white"><AlertTriangle className="h-3 w-3 mr-1" /> Extra in Factory</Badge>;
    }
  };

  const matchCount = results?.filter((r) => r.status === "match").length || 0;
  const issueCount = results ? results.length - matchCount : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Factory Cross-Check</h1>
          <p className="text-muted-foreground mt-1">Compare factory proforma invoices against your original orders</p>
        </div>

        {/* Select Order */}
        <Card>
          <CardHeader><CardTitle className="font-display text-lg">1. Select Order</CardTitle></CardHeader>
          <CardContent>
            <Select value={selectedOrderId} onValueChange={(v) => { setSelectedOrderId(v); setResults(null); }}>
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Choose an order to verify..." />
              </SelectTrigger>
              <SelectContent>
                {orders?.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.order_number} — {o.clients?.company_name} {o.season ? `(${o.season})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {orderItems && orderItems.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-2">Your order has {orderItems.length} line items:</p>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary">
                      <TableHead>Factory Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-foreground">{item.styles?.factory_name || item.styles?.style_code}</TableCell>
                        <TableCell className="text-muted-foreground">{item.styles?.factory_description || item.styles?.name}</TableCell>
                        <TableCell className="text-muted-foreground">{item.size || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{item.color || "—"}</TableCell>
                        <TableCell className="text-right font-bold text-foreground">{item.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Factory Proforma Entry */}
        {selectedOrderId && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-display text-lg">2. Enter Factory Proforma Items</CardTitle>
                <Button variant="outline" size="sm" onClick={addFactoryItem}>
                  <Plus className="h-4 w-4 mr-1" /> Add Line
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {factoryItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardCheck className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p>Add the items from the factory's proforma invoice to compare</p>
                  <Button variant="outline" className="mt-3" onClick={addFactoryItem}>
                    <Plus className="h-4 w-4 mr-1" /> Add First Item
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {factoryItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_1fr_80px_100px_80px_40px] gap-2 items-end">
                      <div>
                        {idx === 0 && <Label className="text-xs">Factory Name</Label>}
                        <Input
                          value={item.factoryName}
                          onChange={(e) => updateFactoryItem(idx, "factoryName", e.target.value)}
                          placeholder="e.g. Belga"
                        />
                      </div>
                      <div>
                        {idx === 0 && <Label className="text-xs">Description</Label>}
                        <Input
                          value={item.factoryDescription}
                          onChange={(e) => updateFactoryItem(idx, "factoryDescription", e.target.value)}
                          placeholder="Description"
                        />
                      </div>
                      <div>
                        {idx === 0 && <Label className="text-xs">Size</Label>}
                        <Input
                          value={item.size}
                          onChange={(e) => updateFactoryItem(idx, "size", e.target.value)}
                          placeholder="Size"
                        />
                      </div>
                      <div>
                        {idx === 0 && <Label className="text-xs">Color</Label>}
                        <Input
                          value={item.color}
                          onChange={(e) => updateFactoryItem(idx, "color", e.target.value)}
                          placeholder="Color"
                        />
                      </div>
                      <div>
                        {idx === 0 && <Label className="text-xs">Qty</Label>}
                        <Input
                          type="number"
                          value={item.quantity || ""}
                          onChange={(e) => updateFactoryItem(idx, "quantity", Number(e.target.value))}
                          placeholder="0"
                        />
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeFactoryItem(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {factoryItems.length > 0 && (
                <Button
                  onClick={runComparison}
                  className="mt-6 w-full bg-primary text-primary-foreground"
                >
                  <ClipboardCheck className="h-4 w-4 mr-2" /> Run Cross-Check
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {results && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-display text-lg">3. Cross-Check Results</CardTitle>
                <div className="flex gap-2">
                  <Badge className="bg-green-600 text-white">{matchCount} Matched</Badge>
                  {issueCount > 0 && <Badge variant="destructive">{issueCount} Issues</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {issueCount === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-16 w-16 mx-auto text-green-600 mb-3" />
                  <h3 className="font-display text-xl text-foreground mb-1">All Items Match!</h3>
                  <p className="text-muted-foreground">The factory proforma matches your original order perfectly.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary">
                      <TableHead>Style Code</TableHead>
                      <TableHead>Factory Name</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead className="text-right">Ordered</TableHead>
                      <TableHead className="text-right">Factory</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r, idx) => (
                      <TableRow key={idx} className={r.status !== "match" ? "bg-destructive/5" : ""}>
                        <TableCell className="font-mono text-accent font-medium">{r.styleCode}</TableCell>
                        <TableCell className="text-foreground">{r.factoryName}</TableCell>
                        <TableCell className="text-muted-foreground">{r.size || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{r.color || "—"}</TableCell>
                        <TableCell className="text-right font-bold text-foreground">{r.orderedQty}</TableCell>
                        <TableCell className={`text-right font-bold ${r.factoryQty !== r.orderedQty ? "text-destructive" : "text-foreground"}`}>
                          {r.factoryQty}
                        </TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
