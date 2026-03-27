import { forwardRef } from "react";

interface OrderItem {
  id: string;
  quantity: number;
  color: string | null;
  size: string | null;
  styles: {
    style_code: string;
    name: string;
  } | null;
}

interface OrderData {
  order_number: string;
  order_date: string;
  season: string | null;
  clients: {
    company_name: string;
    contact_name: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
  } | null;
}

interface Props {
  order: OrderData;
  items: OrderItem[];
}

const PackingListPDF = forwardRef<HTMLDivElement, Props>(({ order, items }, ref) => {
  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div ref={ref} className="bg-white text-black p-10 max-w-[800px] mx-auto text-sm" style={{ fontFamily: "Arial, sans-serif" }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-8 border-b-2 border-[#1a365d] pb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1a365d]" style={{ fontFamily: "Georgia, serif" }}>Luciana</h1>
          <p className="text-xs text-gray-500 tracking-widest uppercase mt-1">Fine Accessories</p>
        </div>
        <div className="text-right">
          <h2 className="text-lg font-bold text-[#1a365d] uppercase tracking-wider">Packing List</h2>
          <p className="text-gray-600 mt-1">Order #{order.order_number}</p>
          <p className="text-gray-600">{new Date(order.order_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
      </div>

      {/* Ship To */}
      <div className="mb-8 p-4 bg-gray-50 border border-gray-200 rounded">
        <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-bold">Ship To</h3>
        <p className="font-bold text-base">{order.clients?.company_name}</p>
        {order.clients?.contact_name && <p>Attn: {order.clients.contact_name}</p>}
        {order.clients?.address && <p>{order.clients.address}</p>}
        {(order.clients?.city || order.clients?.state) && (
          <p>{[order.clients.city, order.clients.state, order.clients.zip_code].filter(Boolean).join(", ")}</p>
        )}
      </div>

      {/* Items */}
      <table className="w-full border-collapse mb-8">
        <thead>
          <tr className="bg-[#1a365d] text-white">
            <th className="text-left p-2 text-xs uppercase w-8">#</th>
            <th className="text-left p-2 text-xs uppercase">Style Code</th>
            <th className="text-left p-2 text-xs uppercase">Description</th>
            <th className="text-left p-2 text-xs uppercase">Size</th>
            <th className="text-left p-2 text-xs uppercase">Color</th>
            <th className="text-right p-2 text-xs uppercase">Qty</th>
            <th className="text-center p-2 text-xs uppercase">✓</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="p-2 text-gray-400">{idx + 1}</td>
              <td className="p-2 font-mono font-bold text-[#1a365d]">{item.styles?.style_code}</td>
              <td className="p-2">{item.styles?.name}</td>
              <td className="p-2 text-gray-600">{item.size || "—"}</td>
              <td className="p-2 text-gray-600">{item.color || "—"}</td>
              <td className="p-2 text-right font-bold">{item.quantity}</td>
              <td className="p-2 text-center">
                <span className="inline-block w-4 h-4 border border-gray-400"></span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary */}
      <div className="flex justify-between items-center bg-[#1a365d] text-white p-4 rounded mb-8">
        <span className="font-bold uppercase tracking-wider">Total Items</span>
        <span className="text-2xl font-bold">{totalQty} pairs</span>
      </div>

      {/* Box Count */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {["Box Count", "Total Weight", "Packed By"].map((label) => (
          <div key={label} className="border border-gray-300 rounded p-3">
            <p className="text-xs text-gray-500 uppercase mb-4">{label}</p>
            <div className="border-b border-gray-400"></div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-gray-400 border-t pt-4">
        <p className="font-bold text-[#c9a84c]">Luciana Fine Accessories</p>
      </div>
    </div>
  );
});

PackingListPDF.displayName = "PackingListPDF";
export default PackingListPDF;
