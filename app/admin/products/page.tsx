"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ImageUploader from "@/components/ImageUploader";
import PermissionGate from "@/components/PermissionGate";
import { useAdminAccess } from "@/lib/AdminAccessContext";
import type { Product } from "@/lib/types";

const empty: Partial<Product> = {
  name: "", sku: "", category: "", description: "", price: 0, mrp: 0, stock_quantity: 0, image_url: "", is_active: true
};

function ProductsContent() {
  const { can } = useAdminAccess();
  const canCreate = can("products", "create");
  const canUpdate = can("products", "update");
  const canDelete = can("products", "delete");

  const [items, setItems] = useState<Product[]>([]);
  const [form, setForm] = useState<Partial<Product>>(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    setItems((data as Product[]) || []);
  }
  useEffect(() => { load(); }, []);

  async function handleSave() {
    setSaving(true);
    const { error } = form.id
      ? await supabase.from("products").update(form).eq("id", form.id)
      : await supabase.from("products").insert(form);
    setSaving(false);
    if (!error) { setForm(empty); load(); } else { alert(error.message); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this product?")) return;
    await supabase.from("products").delete().eq("id", id);
    load();
  }

  const showForm = canCreate || (form.id && canUpdate);

  return (
    <div>
      <p className="eyebrow text-steel mb-2">Marketplace</p>
      <h1 className="font-display text-4xl mb-8">Products</h1>

      <div className="grid lg:grid-cols-2 gap-8">
        {showForm && (
          <div className="plate bg-white p-6 space-y-4 h-fit">
            <h2 className="font-display text-xl">{form.id ? "Edit Product" : "Add New Product"}</h2>
            <input placeholder="Product name" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="SKU" value={form.sku || ""} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="border border-line px-3 py-2 text-sm" />
              <input placeholder="Category" value={form.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })} className="border border-line px-3 py-2 text-sm" />
            </div>
            <textarea placeholder="Description" rows={4} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
            <div className="grid grid-cols-3 gap-3">
              <input type="number" placeholder="Price (₹)" value={form.price ?? 0} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="border border-line px-3 py-2 text-sm" />
              <input type="number" placeholder="MRP (₹)" value={form.mrp ?? 0} onChange={(e) => setForm({ ...form, mrp: Number(e.target.value) })} className="border border-line px-3 py-2 text-sm" />
              <input type="number" placeholder="Stock qty" value={form.stock_quantity ?? 0} onChange={(e) => setForm({ ...form, stock_quantity: Number(e.target.value) })} className="border border-line px-3 py-2 text-sm" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active ?? true} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Visible on website
            </label>
            <div>
              <label className="block text-sm font-medium mb-1">Product Photo</label>
              <ImageUploader folder="products" currentUrl={form.image_url} onUploaded={(url) => setForm({ ...form, image_url: url })} />
            </div>
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving} className="bg-copper hover:bg-copper-light transition-colors text-ink font-medium px-5 py-2">
                {saving ? "Saving…" : form.id ? "Update" : "Add Product"}
              </button>
              {form.id && <button onClick={() => setForm(empty)} className="text-sm text-slate underline">Cancel edit</button>}
            </div>
          </div>
        )}

        <div className={showForm ? "" : "lg:col-span-2"}>
          <div className="space-y-3">
            {items.length === 0 && <p className="text-sm text-slate font-mono">No products yet.</p>}
            {items.map((p) => (
              <div key={p.id} className="plate bg-white p-4 flex items-center gap-4">
                {p.image_url && <img src={p.image_url} alt={p.name} className="w-14 h-14 object-cover" />}
                <div className="flex-1">
                  <p className="font-medium">{p.name} {!p.is_active && <span className="text-xs text-red-600">(hidden)</span>}</p>
                  <p className="text-xs text-slate">₹{p.price} · Stock: {p.stock_quantity} · {p.sku}</p>
                </div>
                {canUpdate && <button onClick={() => setForm(p)} className="text-xs text-steel underline">Edit</button>}
                {canDelete && <button onClick={() => handleDelete(p.id)} className="text-xs text-red-600 underline">Delete</button>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminProductsPage() {
  return (
    <PermissionGate resource="products">
      <ProductsContent />
    </PermissionGate>
  );
}
