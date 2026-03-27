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
  } | null;
}

interface OrderData {
  order_number: string;
  order_date: string;
  season: string | null;
  total_amount: number | null;
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
  payments?: { amount: number; payment_date: string; payment_method: string | null }[];
}

const InvoicePDF = forwardRef<HTMLDivElement, Props>(({ order, items, payments = [] }, ref) => {
  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Number(order.total_amount || 0) - totalPaid;

  return (
    <div ref={ref} className="bg-white text-black p-10 max-w-[800px] mx-auto text-sm" style={{ fontFamily: "Arial, sans-serif" }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-8 border-b-2 border-[#1a365d] pb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1a365d]" style={{ fontFamily: "Georgia, serif" }}>Luciana</h1>
          <p className="text-xs text-gray-500 tracking-widest uppercase mt-1">Fine Accessories</p>
        </div>
        <div className="text-right">
          <h2 className="text-lg font-bold text-[#1a365d] uppercase tracking-wider">Invoice</h2>
          <p className="text-gray-600 mt-1">INV-{order.order_number}</p>
          <p className="text-gray-600">{new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
      </div>

      {/* Client Info */}
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
        </div>
        <div className="text-right">
          <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-bold">Invoice Details</h3>
          <p><span className="text-gray-500">Order:</span> #{order.order_number}</p>
          <p><span className="text-gray-500">Order Date:</span> {new Date(order.order_date).toLocaleDateString()}</p>
          {order.season && <p><span className="text-gray-500">Season:</span> {order.season}</p>}
          <p><span className="text-gray-500">Terms:</span> Net 30</p>
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
            <th className="text-right p-2 text-xs uppercase">Amount</th>
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

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-72">
          <div className="flex justify-between py-2 border-b text-gray-600">
            <span>Total Pairs</span>
            <span>{totalQty}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span>Subtotal</span>
            <span className="font-bold">${Number(order.total_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </div>
          {payments.length > 0 && (
            <>
              {payments.map((p, i) => (
                <div key={i} className="flex justify-between py-1 text-green-700 text-xs">
                  <span>Payment ({new Date(p.payment_date).toLocaleDateString()}{p.payment_method ? ` — ${p.payment_method}` : ""})</span>
                  <span>-${Number(p.amount).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between py-2 border-b text-green-700">
                <span>Total Paid</span>
                <span className="font-bold">-${totalPaid.toFixed(2)}</span>
              </div>
            </>
          )}
          <div className={`flex justify-between py-3 text-lg px-3 mt-2 ${balance > 0 ? "bg-red-700" : "bg-[#1a365d]"} text-white`}>
            <span className="font-bold">Balance Due</span>
            <span className="font-bold">${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-gray-400 border-t pt-4">
        <p>Payment due within 30 days of invoice date. Thank you for your business.</p>
        <p className="mt-1 font-bold text-[#c9a84c]">Luciana Fine Accessories</p>
      </div>
    </div>
  );
});

InvoicePDF.displayName = "InvoicePDF";
export default InvoicePDF;
