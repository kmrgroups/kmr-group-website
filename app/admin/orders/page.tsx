"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import PermissionGate from "@/components/PermissionGate";
import type { Order } from "@/lib/types";

const statusColor: Record<Order["status"], string> = {
  paid: "text-signal",
  created: "text-copper",
  failed: "text-red-600"
};

function OrdersContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<"all" | Order["status"]>("all");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders((data as Order[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const visible = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const paidTotal = orders.filter((o) => o.status === "paid").reduce((sum, o) => sum + Number(o.amount), 0);

  return (
    <div>
      <p className="eyebrow text-steel mb-2">Sales</p>
      <h1 className="font-display text-4xl mb-2">Orders</h1>
      <p className="text-sm text-slate mb-6 font-mono">
        Total collected (paid orders): ₹{paidTotal.toLocaleString("en-IN")}
      </p>

      <div className="flex gap-2 mb-6">
        {(["all", "paid", "created", "failed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 text-sm border ${filter === s ? "border-copper text-copper" : "border-line text-slate"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate font-mono">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-slate font-mono">No orders yet.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((o) => (
            <div key={o.id} className="plate bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="font-medium">
                  {o.product_name} <span className="text-xs text-slate font-mono">× {o.quantity}</span>
                </p>
                <span className={`text-xs font-mono uppercase ${statusColor[o.status]}`}>{o.status}</span>
              </div>
              <p className="text-sm text-slate">
                ₹{Number(o.amount).toLocaleString("en-IN")} · {o.customer_name} · {o.customer_phone}
                {o.customer_email ? ` · ${o.customer_email}` : ""}
              </p>
              <p className="text-xs text-slate mt-1">{o.shipping_address}</p>
              <p className="text-xs text-slate font-mono mt-1">
                {new Date(o.created_at).toLocaleString("en-IN")} · {o.razorpay_order_id}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <PermissionGate resource="orders">
      <OrdersContent />
    </PermissionGate>
  );
}
