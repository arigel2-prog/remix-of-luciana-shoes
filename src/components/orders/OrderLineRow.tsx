import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StyleCombobox } from "@/components/orders/StyleCombobox";
import { Trash2 } from "lucide-react";

export const SIZES = ["39", "40", "41", "42", "43", "44", "45", "46"];

export interface OrderLineData {
  style_id: string;
  leather: string;
  lining: string;
  sole: string;
  comments: string;
  sizes: Record<string, number>;
}

interface Style {
  id: string;
  style_code: string;
  name: string;
  last_number: string | null;
  leather_description: string | null;
  sole_type: string | null;
  wholesale_price: number | null;
}

interface OrderLineRowProps {
  line: OrderLineData;
  index: number;
  styles: Style[];
  canRemove: boolean;
  onUpdate: (index: number, field: string, value: any) => void;
  onUpdateSize: (index: number, size: string, qty: number) => void;
  onRemove: (index: number) => void;
}

export function OrderLineRow({ line, index, styles, canRemove, onUpdate, onUpdateSize, onRemove }: OrderLineRowProps) {
  const selectedStyle = styles.find((s) => s.id === line.style_id);
  const lineTotal = Object.values(line.sizes).reduce((sum, q) => sum + q, 0);

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      {/* Row 1: Style selector + auto-filled fields */}
      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-12 sm:col-span-3">
          <label className="text-xs font-medium text-muted-foreground">Style</label>
          <StyleCombobox
            styles={styles}
            value={line.style_id}
            onSelect={(val) => onUpdate(index, "style_id", val)}
          />
        </div>
        <div className="col-span-4 sm:col-span-1">
          <label className="text-xs font-medium text-muted-foreground">Last</label>
          <div className="h-9 px-2 flex items-center text-sm bg-secondary rounded-md text-foreground truncate">
            {selectedStyle?.last_number || "—"}
          </div>
        </div>
        <div className="col-span-8 sm:col-span-3">
          <label className="text-xs font-medium text-muted-foreground">Leather</label>
          <Input
            value={line.leather}
            onChange={(e) => onUpdate(index, "leather", e.target.value)}
            className="text-sm h-9"
            placeholder="Boxcalf Negro"
          />
        </div>
        <div className="col-span-6 sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Lining</label>
          <Input
            value={line.lining}
            onChange={(e) => onUpdate(index, "lining", e.target.value)}
            className="text-sm h-9"
            placeholder="Ternera Negro"
          />
        </div>
        <div className="col-span-6 sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Sole</label>
          <Input
            value={line.sole}
            onChange={(e) => onUpdate(index, "sole", e.target.value)}
            className="text-sm h-9"
            placeholder="Thin"
          />
        </div>
        <div className="col-span-12 sm:col-span-1 flex items-end justify-end">
          {canRemove && (
            <Button variant="ghost" size="icon" onClick={() => onRemove(index)} className="text-destructive h-9 w-9">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Row 2: Size grid + comments */}
      <div className="flex flex-wrap items-end gap-2">
        {SIZES.map((size) => (
          <div key={size} className="w-14">
            <label className="text-[10px] text-center block text-muted-foreground font-medium">{size}</label>
            <Input
              type="number"
              min={0}
              value={line.sizes[size] || ""}
              onChange={(e) => onUpdateSize(index, size, Number(e.target.value) || 0)}
              className="text-sm h-8 text-center px-1"
              placeholder="0"
            />
          </div>
        ))}
        <div className="w-14">
          <label className="text-[10px] text-center block text-accent font-bold">Total</label>
          <div className="h-8 flex items-center justify-center text-sm font-bold text-accent bg-accent/10 rounded-md">
            {lineTotal}
          </div>
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="text-[10px] text-muted-foreground font-medium">Comments</label>
          <Input
            value={line.comments}
            onChange={(e) => onUpdate(index, "comments", e.target.value)}
            className="text-sm h-8"
            placeholder="Notes..."
          />
        </div>
      </div>
    </div>
  );
}
