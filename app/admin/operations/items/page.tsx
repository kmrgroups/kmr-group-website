"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import PermissionGate from "@/components/PermissionGate";
import { useAdminAccess } from "@/lib/AdminAccessContext";
import type { InventoryItem, ItemType } from "@/lib/types";

const empty: Partial<InventoryItem> = {
  item_code: "", name: "", item_type: "trading", category: "", unit_of_measure: "nos",
  hsn_code: "", standard_cost: 0, selling_price: 0, reorder_level: 0, is_active: true
};

const ITEM_TYPES: { key: ItemType; label: string }[] = [
  { key: "raw_material", label: "Raw Material" },
  { key: "finished_good", label: "Finished Good" },
  { key: "trading", label: "Trading Goods" },
  { key: "service", label: "Service" }
];

function ItemsContent() {
  const { can } = useAdminAccess();
  const canCreate = can("inventory_items", "create");
  const canUpdate = can("inventory_items", "update");
  const canDelete = can("inventory_items", "delete");

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [form, setForm] = useState<Partial<InventoryItem>>(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from("inventory_items").select("*").order("name");
    setItems((data as InventoryItem[]) || []);
  }
  useEffect(() => { load(); }, []);

  async function handleSave() {
    if (!form.item_code || !form.name) { alert("Item code and name are required."); return; }
    setSaving(true);
    const { error } = form.id
      ? await supabase.from("inventory_items").update(form).eq("id", form.id)
      : await supabase.from("inventory_items").insert(form);
    setSaving(false);
    if (!error) { setForm(empty); load(); } else { alert(error.message); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this item?")) return;
    await supabase.from("inventory_items").delete().eq("id", id);
    load();
  }

  const showForm = canCreate || (form.id && canUpdate);

  return (
    <div>
      <p className="eyebrow text-steel mb-2">Operations · Master Data</p>
      <h1 className="font-display text-4xl mb-8">Items Master</h1>

      <div className="grid lg:grid-cols-2 gap-8">
        {showForm && (
          <div className="plate bg-white p-6 space-y-4 h-fit">
            <h2 className="font-display text-xl">{form.id ? "Edit Item" : "Add New Item"}</h2>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Item code / SKU" value={form.item_code || ""} onChange={(e) => setForm({ ...form, item_code: e.target.value })} className="border border-line px-3 py-2 text-sm" />
              <input placeholder="Unit (nos, kg, ltr...)" value={form.unit_of_measure || ""} onChange={(e) => setForm({ ...form, unit_of_measure: e.target.value })} className="border border-line px-3 py-2 text-sm" />
            </div>
            <input placeholder="Item name" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <select value={form.item_type} onChange={(e) => setForm({ ...form, item_type: e.target.value as ItemType })} className="border border-line px-3 py-2 text-sm">
                {ITEM_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              <input placeholder="Category" value={form.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })} className="border border-line px-3 py-2 text-sm" />
            </div>
            <input placeholder="HSN Code" value={form.hsn_code || ""} onChange={(e) => setForm({ ...form, hsn_code: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate mb-1">Standard cost (₹)</label>
                <input type="number" value={form.standard_cost ?? 0} onChange={(e) => setForm({ ...form, standard_cost: Number(e.target.value) })} className="w-full border border-line px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate mb-1">Selling price (₹)</label>
                <input type="number" value={form.selling_price ?? 0} onChange={(e) => setForm({ ...form, selling_price: Number(e.target.value) })} className="w-full border border-line px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate mb-1">Reorder level</label>
                <input type="number" value={form.reorder_level ?? 0} onChange={(e) => setForm({ ...form, reorder_level: Number(e.target.value) })} className="w-full border border-line px-3 py-2 text-sm" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active ?? true} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Active
            </label>
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving} className="bg-copper hover:bg-copper-light transition-colors text-ink font-medium px-5 py-2">
                {saving ? "Saving…" : form.id ? "Update" : "Add Item"}
              </button>
              {form.id && <button onClick={() => setForm(empty)} className="text-sm text-slate underline">Cancel edit</button>}
            </div>
          </div>
        )}

        <div className={showForm ? "" : "lg:col-span-2"}>
          <div className="space-y-3">
            {items.length === 0 && <p className="text-sm text-slate font-mono">No items yet.</p>}
            {items.map((i) => (
              <div key={i.id} className="plate bg-white p-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium">{i.name} {!i.is_active && <span className="text-xs text-red-600">(inactive)</span>}</p>
                  <p className="text-xs text-slate font-mono">{i.item_code} · {ITEM_TYPES.find((t) => t.key === i.item_type)?.label} · {i.unit_of_measure} · ₹{i.selling_price}</p>
                </div>
                {canUpdate && <button onClick={() => setForm(i)} className="text-xs text-steel underline">Edit</button>}
                {canDelete && <button onClick={() => handleDelete(i.id)} className="text-xs text-red-600 underline">Delete</button>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminItemsPage() {
  return (
    <PermissionGate resource="inventory_items">
      <ItemsContent />
    </PermissionGate>
  );
}
