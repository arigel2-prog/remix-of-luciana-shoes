import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronsUpDown, Search } from "lucide-react";

interface Style {
  id: string;
  style_code: string;
  name: string;
  last_number: string | null;
  leather_description: string | null;
  sole_type: string | null;
  wholesale_price: number | null;
}

interface StyleComboboxProps {
  styles: Style[];
  value: string;
  onSelect: (styleId: string) => void;
}

export function StyleCombobox({ styles, value, onSelect }: StyleComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = styles.find((s) => s.id === value);

  const filtered = useMemo(() => {
    if (!search.trim()) return styles;
    const q = search.toLowerCase();
    return styles.filter(
      (s) =>
        s.style_code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.last_number?.toLowerCase().includes(q)
    );
  }, [styles, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-sm h-9 font-normal"
        >
          <span className="truncate">
            {selected ? `${selected.style_code} — ${selected.name}` : "Select style..."}
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[360px] p-0 z-50" align="start" sideOffset={4}>
        <div className="flex items-center border-b border-border px-3 py-2">
          <Search className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search style code or name..."
            className="border-0 h-8 p-0 focus-visible:ring-0 text-sm"
          />
        </div>
        <div className="max-h-[240px] overflow-y-auto">
          {styles.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3 text-center">Loading styles…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3 text-center">No styles match "{search}"</p>
          ) : (
            filtered.map((s) => (
              <button
                key={s.id}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent/10 flex justify-between items-center ${
                  s.id === value ? "bg-accent/10 font-medium" : ""
                }`}
                onClick={() => {
                  onSelect(s.id);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <div>
                  <span className="font-mono text-accent">{s.style_code}</span>
                  <span className="text-muted-foreground ml-2">{s.name}</span>
                </div>
                {s.last_number && (
                  <span className="text-xs text-muted-foreground">Last {s.last_number}</span>
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
