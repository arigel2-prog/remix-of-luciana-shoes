import { forwardRef } from "react";

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

const FactoryOrderPDF = forwardRef<HTMLDivElement, Props>(({ order, items }, ref) => {
  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div ref={ref} className="bg-white text-black p-10 max-w-[800px] mx-auto text-sm" style={{ fontFamily: "Arial, sans-serif" }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-8 border-b-2 border-[#1a365d] pb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1a365d]" style={{ fontFamily: "Georgia, serif" }}>Luciana</h1>
          <p className="text-xs text-gray-500 tracking-widest uppercase mt-1">Factory Purchase Order</p>
        </div>
        <div className="text-right">
          <h2 className="text-lg font-bold text-[#1a365d] uppercase tracking-wider">Factory Order</h2>
          <p className="text-gray-600 mt-1">PO-{order.order_number}</p>
          <p className="text-gray-600">{new Date(order.order_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
          {order.season && <p className="text-gray-600">Season: {order.season}</p>}
        </div>
      </div>

      {/* Items — Factory Names */}
      <table className="w-full border-collapse mb-8">
        <thead>
          <tr className="bg-[#1a365d] text-white">
            <th className="text-left p-2 text-xs uppercase w-8">#</th>
            <th className="text-left p-2 text-xs uppercase">Factory Name</th>
            <th className="text-left p-2 text-xs uppercase">Factory Description</th>
            <th className="text-left p-2 text-xs uppercase">Size</th>
            <th className="text-left p-2 text-xs uppercase">Color</th>
            <th className="text-right p-2 text-xs uppercase">Qty</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="p-2 text-gray-400">{idx + 1}</td>
              <td className="p-2 font-bold">{item.styles?.factory_name || item.styles?.style_code}</td>
              <td className="p-2">{item.styles?.factory_description || item.styles?.name}</td>
              <td className="p-2 text-gray-600">{item.size || "—"}</td>
              <td className="p-2 text-gray-600">{item.color || "—"}</td>
              <td className="p-2 text-right font-bold">{item.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary */}
      <div className="flex justify-between items-center bg-[#1a365d] text-white p-4 rounded mb-8">
        <span className="font-bold uppercase tracking-wider">Total Pieces</span>
        <span className="text-2xl font-bold">{totalQty}</span>
      </div>

      {/* Notes */}
      <div className="border border-gray-300 rounded p-4 mb-8">
        <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-bold">Special Instructions</h4>
        <div className="h-20"></div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-gray-400 border-t pt-4">
        <p className="font-bold text-[#c9a84c]">Luciana Fine Accessories — Factory Order</p>
      </div>
    </div>
  );
});

FactoryOrderPDF.displayName = "FactoryOrderPDF";
export default FactoryOrderPDF;
