"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types";

export default function BuyNowButton({ product }: { product: Product }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", quantity: 1 });

  async function handlePlaceOrder() {
    setError("");
    if (!form.name || !form.phone || !form.address) {
      setError("Please fill in your name, phone, and shipping address.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.id,
        quantity: form.quantity,
        customerName: form.name,
        customerEmail: form.email,
        customerPhone: form.phone,
        shippingAddress: form.address
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      setError(data.error || "Could not place the order.");
      return;
    }
    // The order page shows how to pay (bank transfer / UPI) and where to report the payment
    router.push(`/order/${data.token}`);
  }

  if (product.stock_quantity <= 0) {
    return (
      <button disabled className="inline-block bg-slate-light text-white font-medium px-6 py-3 cursor-not-allowed">
        Out of Stock
      </button>
    );
  }

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-block bg-copper hover:bg-copper-light transition-colors text-ink font-medium px-6 py-3"
        >
          Buy Now
        </button>
      ) : (
        <div className="plate bg-white p-5 max-w-sm space-y-3">
          <h3 className="font-display text-xl mb-1">Shipping Details</h3>
          <input
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border border-line px-3 py-2 text-sm"
          />
          <input
            placeholder="Phone number"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full border border-line px-3 py-2 text-sm"
          />
          <input
            placeholder="Email (optional)"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full border border-line px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Shipping address"
            rows={3}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full border border-line px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-2">
            <label className="text-sm">Qty</label>
            <input
              type="number"
              min={1}
              max={product.stock_quantity}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
              className="w-20 border border-line px-3 py-2 text-sm"
            />
          </div>
          <p className="text-xs text-slate">After placing the order you pay by bank transfer (NEFT / IMPS / RTGS) or UPI. We dispatch once the payment reaches our account.</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={handlePlaceOrder}
              disabled={loading}
              className="bg-copper hover:bg-copper-light transition-colors text-ink font-medium px-5 py-2"
            >
              {loading ? "Placing order…" : `Place order · ₹${(product.price * form.quantity).toLocaleString("en-IN")}`}
            </button>
            <button onClick={() => setOpen(false)} className="text-sm text-slate underline">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
