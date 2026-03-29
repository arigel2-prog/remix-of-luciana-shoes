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
    <div ref={ref} className="bg-white text-black p-6 max-w-[1100px] mx-auto" style={{ fontFamily: "Arial, sans-serif", fontSize: "11px" }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-4 border-b-2 border-[#1a365d] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a365d]" style={{ fontFamily: "Georgia, serif" }}>Luciana Shoes</h1>
          <p className="text-[10px] text-gray-500 tracking-widest uppercase mt-1">Factory Purchase Order</p>
        </div>
        <div className="text-right text-[11px]">
          <p className="font-bold text-[#1a365d]">PO-{order.order_number}</p>
          <p className="text-gray-600">{new Date(order.order_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
          {order.season && <p className="text-gray-600">Season: {order.season}</p>}
        </div>
      </div>

      {/* Table */}
      <table className="w-full border-collapse mb-4" style={{ fontSize: "10px" }}>
        <thead>
          <tr className="bg-[#1a365d] text-white">
            <th className="text-left p-1.5 border border-[#1a365d]">#</th>
            <th className="text-left p-1.5 border border-[#1a365d]">Style</th>
            <th className="text-left p-1.5 border border-[#1a365d]">Last</th>
            <th className="text-left p-1.5 border border-[#1a365d]">Leather</th>
            <th className="text-left p-1.5 border border-[#1a365d]">Sole</th>
            {SIZES.map((s) => (
              <th key={s} className="text-center p-1.5 border border-[#1a365d] w-10">{s}</th>
            ))}
            <th className="text-center p-1.5 border border-[#1a365d] font-bold bg-[#c9a84c] text-[#1a365d]">Total</th>
          </tr>
        </thead>
        <tbody>
          {grouped.map((line, idx) => (
            <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="p-1.5 border border-gray-300 text-gray-400">{idx + 1}</td>
              <td className="p-1.5 border border-gray-300 font-bold">{line.styleCode}</td>
              <td className="p-1.5 border border-gray-300">{line.lastNumber}</td>
              <td className="p-1.5 border border-gray-300">{line.leather}</td>
              <td className="p-1.5 border border-gray-300">{line.sole}</td>
              {SIZES.map((s) => (
                <td key={s} className="p-1.5 border border-gray-300 text-center font-medium">
                  {line.sizes[s] || ""}
                </td>
              ))}
              <td className="p-1.5 border border-gray-300 text-center font-bold bg-[#c9a84c]/10">{line.total}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-[#1a365d] text-white font-bold">
            <td colSpan={5} className="p-1.5 border border-[#1a365d] text-right uppercase tracking-wider">Grand Total</td>
            {SIZES.map((s) => {
              const colTotal = grouped.reduce((sum, l) => sum + (l.sizes[s] || 0), 0);
              return <td key={s} className="p-1.5 border border-[#1a365d] text-center">{colTotal || ""}</td>;
            })}
            <td className="p-1.5 border border-[#1a365d] text-center text-lg">{grandTotal}</td>
          </tr>
        </tfoot>
      </table>

      {/* Notes */}
      <div className="border border-gray-300 rounded p-3 mb-4">
        <h4 className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-bold">Special Instructions</h4>
        <div className="h-16"></div>
      </div>

      {/* Footer */}
      <div className="text-center text-[10px] text-gray-400 border-t pt-3">
        <p className="font-bold text-[#c9a84c]">Luciana Shoes — Factory Order</p>
      </div>
    </div>
  );
});

FactoryOrderPDF.displayName = "FactoryOrderPDF";
export default FactoryOrderPDF;
