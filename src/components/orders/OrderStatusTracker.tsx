import { Check } from "lucide-react";

const STEPS = [
  { key: "draft", label: "Draft" },
  { key: "confirmed", label: "Confirmed" },
  { key: "submitted_to_factory", label: "Sent to Factory" },
  { key: "in_production", label: "In Production" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
] as const;

interface OrderStatusTrackerProps {
  status: string;
}

export function OrderStatusTracker({ status }: OrderStatusTrackerProps) {
  const cancelled = status === "cancelled";
  const currentIdx = STEPS.findIndex((s) => s.key === status);
  const activeIdx = currentIdx === -1 ? 0 : currentIdx;

  if (cancelled) {
    return (
      <div className="flex items-center justify-center py-4">
        <span className="px-4 py-2 rounded-full bg-destructive/10 text-destructive font-medium text-sm">
          Order Cancelled
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center w-full py-2 overflow-x-auto">
      {STEPS.map((step, i) => {
        const completed = i < activeIdx;
        const active = i === activeIdx;

        return (
          <div key={step.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                  completed
                    ? "bg-accent text-accent-foreground"
                    : active
                    ? "bg-accent text-accent-foreground ring-2 ring-accent/30 ring-offset-2 ring-offset-background"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {completed ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`text-[10px] text-center leading-tight whitespace-nowrap ${
                  completed || active ? "text-foreground font-medium" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-1 min-w-4 ${
                  i < activeIdx ? "bg-accent" : "bg-muted"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
