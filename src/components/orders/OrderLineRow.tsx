import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StyleCombobox } from "@/components/orders/StyleCombobox";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

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
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header - always visible */}
      <div className="flex items-center gap-2 p-3 bg-secondary/30 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <span className="text-xs font-bold text-muted-foreground w-6">#{index + 1}</span>
        <div className="flex-1 min-w-0">
          {selectedStyle ? (
            <span className="text-sm font-medium text-foreground truncate">
              <span className="font-mono text-accent">{selectedStyle.style_code}</span>
              <span className="text-muted-foreground ml-1.5 hidden sm:inline">— {selectedStyle.name}</span>
            </span>
          ) : (
            <span className="text-sm text-muted-foreground italic">Select a style...</span>
          )}
        </div>
        {lineTotal > 0 && (
          <span className="text-sm font-bold text-accent bg-accent/10 px-2 py-0.5 rounded">
            {lineTotal} prs
          </span>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        {canRemove && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={(e) => { e.stopPropagation(); onRemove(index); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {expanded && (
        <div className="p-3 space-y-3">
          {/* Style selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Style</label>
              <StyleCombobox
                styles={styles}
                value={line.style_id}
                onSelect={(val) => onUpdate(index, "style_id", val)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Last</label>
                <div className="h-9 px-2 flex items-center text-sm bg-secondary rounded-md text-foreground truncate">
                  {selectedStyle?.last_number || "—"}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Leather</label>
                <Input
                  value={line.leather}
                  onChange={(e) => onUpdate(index, "leather", e.target.value)}
                  className="text-sm h-9"
                  placeholder="Boxcalf"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Sole</label>
                <Input
                  value={line.sole}
                  onChange={(e) => onUpdate(index, "sole", e.target.value)}
                  className="text-sm h-9"
                  placeholder="Thin"
                />
              </div>
            </div>
          </div>

          {/* Size grid - responsive: 4 per row on mobile, all on desktop */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Sizes</label>
            <div className="grid grid-cols-5 sm:grid-cols-9 gap-1.5">
              {SIZES.map((size) => (
                <div key={size}>
                  <label className="text-[10px] text-center block text-muted-foreground font-medium">{size}</label>
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={line.sizes[size] || ""}
                    onChange={(e) => onUpdateSize(index, size, Number(e.target.value) || 0)}
                    className="text-sm h-8 text-center px-0.5"
                    placeholder="—"
                  />
                </div>
              ))}
              <div>
                <label className="text-[10px] text-center block text-accent font-bold">Total</label>
                <div className="h-8 flex items-center justify-center text-sm font-bold text-accent bg-accent/10 rounded-md">
                  {lineTotal}
                </div>
              </div>
            </div>
          </div>

          {/* Comments row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Lining</label>
              <Input
                value={line.lining}
                onChange={(e) => onUpdate(index, "lining", e.target.value)}
                className="text-sm h-8"
                placeholder="Ternera Negro"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Comments</label>
              <Input
                value={line.comments}
                onChange={(e) => onUpdate(index, "comments", e.target.value)}
                className="text-sm h-8"
                placeholder="Special instructions..."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
