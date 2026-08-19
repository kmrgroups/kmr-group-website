"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import PermissionGate from "@/components/PermissionGate";
import { useAdminAccess } from "@/lib/AdminAccessContext";
import type { Warehouse } from "@/lib/types";

const empty: Partial<Warehouse> = { name: "", address: "", is_active: true };

function WarehousesContent() {
  const { can } = useAdminAccess();
  const canCreate = can("warehouses", "create");
  const canUpdate = can("warehouses", "update");
  const canDelete = can("warehouses", "delete");

  const [items, setItems] = useState<Warehouse[]>([]);
  const [form, setForm] = useState<Partial<Warehouse>>(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from("warehouses").select("*").order("name");
    setItems((data as Warehouse[]) || []);
  }
  useEffect(() => { load(); }, []);

  async function handleSave() {
    if (!form.name) { alert("Warehouse name is required."); return; }
    setSaving(true);
    const { error } = form.id
      ? await supabase.from("warehouses").update(form).eq("id", form.id)
      : await supabase.from("warehouses").insert(form);
    setSaving(false);
    if (!error) { setForm(empty); load(); } else { alert(error.message); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this warehouse?")) return;
    await supabase.from("warehouses").delete().eq("id", id);
    load();
  }

  const showForm = canCreate || (form.id && canUpdate);

  return (
    <div>
      <p className="eyebrow text-steel mb-2">Operations · Master Data</p>
      <h1 className="font-display text-4xl mb-8">Warehouses</h1>

      <div className="grid lg:grid-cols-2 gap-8">
        {showForm && (
          <div className="plate bg-white p-6 space-y-4 h-fit">
            <h2 className="font-display text-xl">{form.id ? "Edit Warehouse" : "Add New Warehouse"}</h2>
            <input placeholder="Warehouse / location name" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
            <textarea placeholder="Address" rows={2} value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active ?? true} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Active
            </label>
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving} className="bg-copper hover:bg-copper-light transition-colors text-ink font-medium px-5 py-2">
                {saving ? "Saving…" : form.id ? "Update" : "Add Warehouse"}
              </button>
              {form.id && <button onClick={() => setForm(empty)} className="text-sm text-slate underline">Cancel edit</button>}
            </div>
          </div>
        )}

        <div className={showForm ? "" : "lg:col-span-2"}>
          <div className="space-y-3">
            {items.length === 0 && <p className="text-sm text-slate font-mono">No warehouses yet.</p>}
            {items.map((w) => (
              <div key={w.id} className="plate bg-white p-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium">{w.name} {!w.is_active && <span className="text-xs text-red-600">(inactive)</span>}</p>
                  <p className="text-xs text-slate">{w.address}</p>
                </div>
                {canUpdate && <button onClick={() => setForm(w)} className="text-xs text-steel underline">Edit</button>}
                {canDelete && <button onClick={() => handleDelete(w.id)} className="text-xs text-red-600 underline">Delete</button>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminWarehousesPage() {
  return (
    <PermissionGate resource="warehouses">
      <WarehousesContent />
    </PermissionGate>
  );
}
