"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import PermissionGate from "@/components/PermissionGate";
import { useAdminAccess } from "@/lib/AdminAccessContext";
import type { InventoryItem, StockTransaction, StockTransactionType, Warehouse } from "@/lib/types";

const TX_TYPES: { key: StockTransactionType; label: string }[] = [
  { key: "opening", label: "Opening Stock" },
  { key: "purchase_receipt", label: "Purchase Receipt (stock in)" },
  { key: "sales_dispatch", label: "Sales Dispatch (stock out)" },
  { key: "production_consumption", label: "Production Consumption (stock out)" },
  { key: "production_output", label: "Production Output (stock in)" },
  { key: "adjustment", label: "Manual Adjustment (+/-)" }
];

const empty = {
  item_id: "", warehouse_id: "", transaction_type: "opening" as StockTransactionType,
  quantity: 0, unit_cost: 0, reference_note: "", transaction_date: new Date().toISOString().slice(0, 10)
};

function StockContent() {
  const { can } = useAdminAccess();
  const canCreate = can("stock_transactions", "create");

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [{ data: itemData }, { data: whData }, { data: txData }] = await Promise.all([
      supabase.from("inventory_items").select("*").eq("is_active", true).order("name"),
      supabase.from("warehouses").select("*").eq("is_active", true).order("name"),
      supabase.from("stock_transactions").select("*").order("created_at", { ascending: false }).limit(100)
    ]);
    setItems((itemData as InventoryItem[]) || []);
    setWarehouses((whData as Warehouse[]) || []);
    setTransactions((txData as StockTransaction[]) || []);
  }
  useEffect(() => { load(); }, []);

  const balances = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach((t) => {
      const key = `${t.item_id}::${t.warehouse_id}`;
      map.set(key, (map.get(key) || 0) + Number(t.quantity));
    });
    return map;
  }, [transactions]);

  function itemName(id: string) { return items.find((i) => i.id === id)?.name || "Unknown item"; }
  function warehouseName(id: string) { return warehouses.find((w) => w.id === id)?.name || "Unknown warehouse"; }

  async function handleSave() {
    if (!form.item_id || !form.warehouse_id || !form.quantity) {
      alert("Please select an item, warehouse, and enter a quantity.");
      return;
    }
    let qty = Number(form.quantity);
    if (["sales_dispatch", "production_consumption"].includes(form.transaction_type)) {
      qty = -Math.abs(qty); // these always reduce stock
    } else if (form.transaction_type !== "adjustment") {
      qty = Math.abs(qty); // opening/purchase/production_output always add stock
    }
    setSaving(true);
    const { error } = await supabase.from("stock_transactions").insert({ ...form, quantity: qty });
    setSaving(false);
    if (!error) {
      setForm({ ...empty, item_id: form.item_id, warehouse_id: form.warehouse_id });
      load();
    } else {
      alert(error.message);
    }
  }

  return (
    <div>
      <p className="eyebrow text-steel mb-2">Operations · Inventory</p>
      <h1 className="font-display text-4xl mb-8">Stock Ledger</h1>

      <div className="grid lg:grid-cols-2 gap-8">
        {canCreate && (
          <div className="plate bg-white p-6 space-y-4 h-fit">
            <h2 className="font-display text-xl">Record a Stock Movement</h2>
            {items.length === 0 || warehouses.length === 0 ? (
              <p className="text-sm text-slate">
                Add at least one Item (Operations → Items Master) and one Warehouse
                (Operations → Warehouses) before recording stock.
              </p>
            ) : (
              <>
                <select value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value })} className="w-full border border-line px-3 py-2 text-sm">
                  <option value="">Select item</option>
                  {items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.item_code})</option>)}
                </select>
                <select value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })} className="w-full border border-line px-3 py-2 text-sm">
                  <option value="">Select warehouse</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <select value={form.transaction_type} onChange={(e) => setForm({ ...form, transaction_type: e.target.value as StockTransactionType })} className="w-full border border-line px-3 py-2 text-sm">
                  {TX_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} className="border border-line px-3 py-2 text-sm" />
                  <input type="number" placeholder="Unit cost (₹, optional)" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: Number(e.target.value) })} className="border border-line px-3 py-2 text-sm" />
                </div>
                <input type="date" value={form.transaction_date} onChange={(e) => setForm({ ...form, transaction_date: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
                <input placeholder="Reference note (optional)" value={form.reference_note} onChange={(e) => setForm({ ...form, reference_note: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
                <p className="text-xs text-slate">
                  For Manual Adjustment, use a negative quantity to reduce stock. All other types automatically move stock in the correct direction.
                </p>
                <button onClick={handleSave} disabled={saving} className="bg-copper hover:bg-copper-light transition-colors text-ink font-medium px-5 py-2">
                  {saving ? "Saving…" : "Record Movement"}
                </button>
              </>
            )}
          </div>
        )}

        <div className={canCreate ? "" : "lg:col-span-2"}>
          <h2 className="font-display text-xl mb-3">Current Stock on Hand</h2>
          <div className="space-y-2 mb-8">
            {balances.size === 0 && <p className="text-sm text-slate font-mono">No stock recorded yet.</p>}
            {Array.from(balances.entries()).map(([key, qty]) => {
              const [itemId, warehouseId] = key.split("::");
              return (
                <div key={key} className="plate bg-white p-3 flex justify-between text-sm">
                  <span>{itemName(itemId)} <span className="text-xs text-slate">@ {warehouseName(warehouseId)}</span></span>
                  <span className={`font-mono ${qty < 0 ? "text-red-600" : ""}`}>{qty}</span>
                </div>
              );
            })}
          </div>

          <h2 className="font-display text-xl mb-3">Recent Movements</h2>
          <div className="space-y-2">
            {transactions.slice(0, 20).map((t) => (
              <div key={t.id} className="text-xs text-slate border-b border-line pb-2">
                {new Date(t.transaction_date).toLocaleDateString("en-IN")} · {itemName(t.item_id)} @ {warehouseName(t.warehouse_id)} ·{" "}
                <span className={t.quantity < 0 ? "text-red-600" : "text-signal"}>{t.quantity > 0 ? "+" : ""}{t.quantity}</span> ·{" "}
                {TX_TYPES.find((x) => x.key === t.transaction_type)?.label}
                {t.reference_note && ` · ${t.reference_note}`}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminStockPage() {
  return (
    <PermissionGate resource="stock_transactions">
      <StockContent />
    </PermissionGate>
  );
}
