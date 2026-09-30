"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types";

/** Buy (goods) or Enrol (courses): places the order, then the order page shows how to pay by bank transfer / UPI. */
export default function BuyNowButton({ product, mode = "buy" }: { product: Product; mode?: "buy" | "enrol" }) {
  const enrol = mode === "enrol";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", quantity: 1 });
  const input = "field";

  async function handlePlaceOrder() {
    setError("");
    if (!form.name || !form.phone || !form.address) {
      setError(`Please fill in your name, phone and ${enrol ? "address" : "shipping address"}.`);
      return;
    }
    setLoading(true);
    const res = await fetch("/api/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.id, quantity: form.quantity, customerName: form.name, customerEmail: form.email,
        customerPhone: form.phone, shippingAddress: form.address,
      }),
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

  if (!enrol && product.stock_quantity <= 0) {
    return <button disabled className="btn bg-sand text-muted">Out of stock</button>;
  }

  return (
    <div>
      {!open ? (
        <button onClick={() => setOpen(true)} className="btn-gold px-10 py-4 text-base">
          {enrol ? "Enrol now" : "Buy Now"}
        </button>
      ) : (
        <div className="card max-w-md space-y-3 p-6">
          <h3 className="mb-1 font-display text-xl font-semibold text-navy">{enrol ? "Participant details" : "Shipping Details"}</h3>
          <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
          <input placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={input} />
          <input placeholder="Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} />
          <textarea placeholder={enrol ? "Address (for the invoice and certificate)" : "Shipping address"} rows={3} value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })} className={input} />
          <div className="flex items-center gap-2">
            <label className="text-sm">{enrol ? "Participants" : "Qty"}</label>
            <input type="number" min={1} max={enrol ? 50 : product.stock_quantity} value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} className="field w-24" />
          </div>
          <p className="text-xs text-muted">
            {enrol
              ? "Next you pay the fee online or by bank transfer / UPI. Your seat is confirmed once the payment reaches our account."
              : "Next you pay online or by bank transfer / UPI. We dispatch once the payment reaches our account."}
          </p>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3">
            <button onClick={handlePlaceOrder} disabled={loading} className="btn-gold">
              {loading ? "Please wait…" : `${enrol ? "Enrol & pay" : "Continue to payment"} · ₹${(product.price * form.quantity).toLocaleString("en-IN")}`}
            </button>
            <button onClick={() => setOpen(false)} className="text-sm text-muted underline">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
