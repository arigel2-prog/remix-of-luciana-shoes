import { forwardRef } from "react";

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  total_price: number | null;
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
  total_amount: number | null;
  notes: string | null;
  status: string;
  clients: {
    company_name: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
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

const OrderConfirmationPDF = forwardRef<HTMLDivElement, Props>(({ order, items }, ref) => {
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
          <h2 className="text-lg font-bold text-[#1a365d] uppercase tracking-wider">Order Confirmation</h2>
          <p className="text-gray-600 mt-1">#{order.order_number}</p>
          <p className="text-gray-600">{new Date(order.order_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
      </div>

      {/* Client & Order Info */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-bold">Bill To</h3>
          <p className="font-bold text-base">{order.clients?.company_name}</p>
          {order.clients?.contact_name && <p>{order.clients.contact_name}</p>}
          {order.clients?.address && <p>{order.clients.address}</p>}
          {(order.clients?.city || order.clients?.state) && (
            <p>{[order.clients.city, order.clients.state, order.clients.zip_code].filter(Boolean).join(", ")}</p>
          )}
          {order.clients?.email && <p>{order.clients.email}</p>}
          {order.clients?.phone && <p>{order.clients.phone}</p>}
        </div>
        <div className="text-right">
          <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-bold">Order Details</h3>
          {order.season && <p><span className="text-gray-500">Season:</span> {order.season}</p>}
          <p><span className="text-gray-500">Status:</span> <span className="capitalize">{order.status.replace(/_/g, " ")}</span></p>
          <p><span className="text-gray-500">Total Pairs:</span> {totalQty}</p>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full border-collapse mb-8">
        <thead>
          <tr className="bg-[#1a365d] text-white">
            <th className="text-left p-2 text-xs uppercase">Style Code</th>
            <th className="text-left p-2 text-xs uppercase">Description</th>
            <th className="text-left p-2 text-xs uppercase">Size</th>
            <th className="text-left p-2 text-xs uppercase">Color</th>
            <th className="text-right p-2 text-xs uppercase">Qty</th>
            <th className="text-right p-2 text-xs uppercase">Unit Price</th>
            <th className="text-right p-2 text-xs uppercase">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="p-2 font-mono font-bold text-[#1a365d]">{item.styles?.style_code}</td>
              <td className="p-2">{item.styles?.name}</td>
              <td className="p-2 text-gray-600">{item.size || "—"}</td>
              <td className="p-2 text-gray-600">{item.color || "—"}</td>
              <td className="p-2 text-right">{item.quantity}</td>
              <td className="p-2 text-right">${Number(item.unit_price).toFixed(2)}</td>
              <td className="p-2 text-right font-bold">${Number(item.total_price || 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary */}
      <div className="flex justify-end mb-8">
        <div className="w-64">
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-bold">${Number(order.total_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between py-3 text-lg bg-[#1a365d] text-white px-3 mt-2">
            <span className="font-bold">Total</span>
            <span className="font-bold">${Number(order.total_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {order.notes && (
        <div className="mb-8 p-4 bg-gray-50 border border-gray-200 rounded">
          <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-bold">Notes</h4>
          <p className="text-gray-700">{order.notes}</p>
        </div>
      )}

      {/* Signature Lines */}
      <div className="grid grid-cols-2 gap-12 mt-12 pt-8 border-t">
        <div>
          <div className="border-b border-gray-400 mb-2 h-8"></div>
          <p className="text-xs text-gray-500">Client Signature & Date</p>
        </div>
        <div>
          <div className="border-b border-gray-400 mb-2 h-8"></div>
          <p className="text-xs text-gray-500">Luciana Representative</p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-gray-400 border-t pt-4">
        <p>Please review and confirm this order within 5 business days. Thank you for your business.</p>
        <p className="mt-1 font-bold text-[#c9a84c]">Luciana Fine Accessories</p>
      </div>
    </div>
  );
});

OrderConfirmationPDF.displayName = "OrderConfirmationPDF";
export default OrderConfirmationPDF;
