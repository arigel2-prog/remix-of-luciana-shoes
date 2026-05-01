import { forwardRef, useMemo } from "react";
import { SIZES } from "@/components/orders/OrderLineRow";

interface OrderItem {
  id: string;
  quantity: number;
  color: string | null;
  size: string | null;
  styles: {
    style_code: string;
    name: string;
    factory_name: string | null;
    factory_description: string | null;
    last_number: string | null;
    leather_description: string | null;
    sole_type: string | null;
  } | null;
}

interface OrderData {
  order_number: string;
  order_date: string;
  season: string | null;
  clients?: {
    company_name: string;
    customer_number: string | null;
  } | null;
}

interface Props {
  order: OrderData;
  items: OrderItem[];
}

interface GroupedLine {
  styleCode: string;
  lastNumber: string;
  leather: string;
  sole: string;
  color: string;
  sizes: Record<string, number>;
  total: number;
}

const FactoryOrderPDF = forwardRef<HTMLDivElement, Props>(({ order, items }, ref) => {
  const grouped = useMemo(() => {
    const map = new Map<string, GroupedLine>();
    items.forEach((item) => {
      const key = `${item.styles?.style_code || "?"}_${item.color || ""}`;
      if (!map.has(key)) {
        map.set(key, {
          styleCode: item.styles?.style_code || "—",
          lastNumber: item.styles?.last_number || "—",
          leather: item.styles?.leather_description || "—",
          sole: item.styles?.sole_type || "—",
          color: item.color || "—",
          sizes: {},
          total: 0,
        });
      }
      const line = map.get(key)!;
      const size = item.size || "?";
      line.sizes[size] = (line.sizes[size] || 0) + item.quantity;
      line.total += item.quantity;
    });
    return Array.from(map.values());
  }, [items]);

  const grandTotal = grouped.reduce((s, l) => s + l.total, 0);

  return (
    <div ref={ref} className="bg-white text-black p-6 max-w-[1100px] mx-auto" style={{ fontFamily: "'Raleway', Arial, sans-serif", fontSize: "11px" }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-5 pb-4" style={{ borderBottom: "3px solid #C9A84C" }}>
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "'Cinzel', Georgia, serif", color: "#1a1a1a", letterSpacing: "0.15em" }}>LUCIANA</h1>
          <p className="text-[10px] tracking-[0.3em] uppercase mt-1" style={{ color: "#C9A84C" }}>Factory Purchase Order</p>
        </div>
        <div className="text-right text-[11px]">
          <p className="font-bold text-lg" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: "#C9A84C" }}>PO-{order.order_number}</p>
          <p className="text-gray-600">{new Date(order.order_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
          {order.season && <p className="text-gray-600">Season: {order.season}</p>}
        </div>
      </div>

      {/* Customer Info */}
      <div className="mb-4 flex gap-8 text-[11px]">
        <div>
          <p className="text-[10px] tracking-[0.2em] uppercase font-bold mb-1" style={{ color: "#C9A84C" }}>Customer #</p>
          <p className="font-bold text-sm">{order.clients?.customer_number || "—"}</p>
        </div>
      </div>

      {/* Table */}
      <table className="w-full border-collapse mb-4" style={{ fontSize: "10px" }}>
        <thead>
          <tr style={{ backgroundColor: "#1a1a1a", color: "#C9A84C" }}>
            <th className="text-left p-1.5 border" style={{ borderColor: "#333" }}>#</th>
            <th className="text-left p-1.5 border" style={{ borderColor: "#333" }}>Style</th>
            <th className="text-left p-1.5 border" style={{ borderColor: "#333" }}>Last</th>
            <th className="text-left p-1.5 border" style={{ borderColor: "#333" }}>Leather</th>
            <th className="text-left p-1.5 border" style={{ borderColor: "#333" }}>Sole</th>
            {SIZES.map((s) => (
              <th key={s} className="text-center p-1.5 border w-10" style={{ borderColor: "#333" }}>{s}</th>
            ))}
            <th className="text-center p-1.5 border font-bold" style={{ borderColor: "#333", backgroundColor: "#C9A84C", color: "#1a1a1a" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {grouped.map((line, idx) => (
            <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-[#faf9f6]"}>
              <td className="p-1.5 border border-gray-200 text-gray-400">{idx + 1}</td>
              <td className="p-1.5 border border-gray-200 font-bold">{line.styleCode}</td>
              <td className="p-1.5 border border-gray-200">{line.lastNumber}</td>
              <td className="p-1.5 border border-gray-200">{line.leather}</td>
              <td className="p-1.5 border border-gray-200">{line.sole}</td>
              {SIZES.map((s) => (
                <td key={s} className="p-1.5 border border-gray-200 text-center font-medium">
                  {line.sizes[s] || ""}
                </td>
              ))}
              <td className="p-1.5 border border-gray-200 text-center font-bold" style={{ backgroundColor: "rgba(201,168,76,0.08)" }}>{line.total}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ backgroundColor: "#1a1a1a", color: "#C9A84C" }}>
            <td colSpan={5} className="p-1.5 border text-right uppercase tracking-wider font-bold" style={{ borderColor: "#333" }}>Grand Total</td>
            {SIZES.map((s) => {
              const colTotal = grouped.reduce((sum, l) => sum + (l.sizes[s] || 0), 0);
              return <td key={s} className="p-1.5 border text-center" style={{ borderColor: "#333" }}>{colTotal || ""}</td>;
            })}
            <td className="p-1.5 border text-center text-lg font-bold" style={{ borderColor: "#333", backgroundColor: "#C9A84C", color: "#1a1a1a" }}>{grandTotal}</td>
          </tr>
        </tfoot>
      </table>

      {/* Notes */}
      <div className="border rounded p-3 mb-4" style={{ borderColor: "#C9A84C" }}>
        <h4 className="text-[10px] uppercase tracking-[0.2em] mb-1 font-bold" style={{ color: "#C9A84C" }}>Special Instructions</h4>
        <div className="h-16"></div>
      </div>

      {/* Footer */}
      <div className="text-center text-[10px] text-gray-400 border-t pt-3">
        <p className="font-bold" style={{ color: "#C9A84C", fontFamily: "'Cinzel', Georgia, serif", letterSpacing: "0.15em" }}>LUCIANA — Factory Order</p>
      </div>
    </div>
  );
});

FactoryOrderPDF.displayName = "FactoryOrderPDF";
export default FactoryOrderPDF;
