"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import PermissionGate from "@/components/PermissionGate";
import { useAdminAccess } from "@/lib/AdminAccessContext";
import type { Vendor } from "@/lib/types";

const empty: Partial<Vendor> = {
  name: "", contact_person: "", email: "", phone: "", gstin: "", address: "", notes: "", is_active: true
};

function VendorsContent() {
  const { can } = useAdminAccess();
  const canCreate = can("vendors", "create");
  const canUpdate = can("vendors", "update");
  const canDelete = can("vendors", "delete");

  const [items, setItems] = useState<Vendor[]>([]);
  const [form, setForm] = useState<Partial<Vendor>>(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from("vendors").select("*").order("name");
    setItems((data as Vendor[]) || []);
  }
  useEffect(() => { load(); }, []);

  async function handleSave() {
    if (!form.name) { alert("Vendor name is required."); return; }
    setSaving(true);
    const { error } = form.id
      ? await supabase.from("vendors").update(form).eq("id", form.id)
      : await supabase.from("vendors").insert(form);
    setSaving(false);
    if (!error) { setForm(empty); load(); } else { alert(error.message); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this vendor?")) return;
    await supabase.from("vendors").delete().eq("id", id);
    load();
  }

  const showForm = canCreate || (form.id && canUpdate);

  return (
    <div>
      <p className="eyebrow text-steel mb-2">Operations · Master Data</p>
      <h1 className="font-display text-4xl mb-8">Vendors</h1>

      <div className="grid lg:grid-cols-2 gap-8">
        {showForm && (
          <div className="plate bg-white p-6 space-y-4 h-fit">
            <h2 className="font-display text-xl">{form.id ? "Edit Vendor" : "Add New Vendor"}</h2>
            <input placeholder="Vendor / supplier name" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Contact person" value={form.contact_person || ""} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} className="border border-line px-3 py-2 text-sm" />
              <input placeholder="GSTIN" value={form.gstin || ""} onChange={(e) => setForm({ ...form, gstin: e.target.value })} className="border border-line px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className="border border-line px-3 py-2 text-sm" />
              <input placeholder="Phone" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="border border-line px-3 py-2 text-sm" />
            </div>
            <textarea placeholder="Address" rows={2} value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
            <textarea placeholder="Notes" rows={2} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active ?? true} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Active
            </label>
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving} className="bg-copper hover:bg-copper-light transition-colors text-ink font-medium px-5 py-2">
                {saving ? "Saving…" : form.id ? "Update" : "Add Vendor"}
              </button>
              {form.id && <button onClick={() => setForm(empty)} className="text-sm text-slate underline">Cancel edit</button>}
            </div>
          </div>
        )}

        <div className={showForm ? "" : "lg:col-span-2"}>
          <div className="space-y-3">
            {items.length === 0 && <p className="text-sm text-slate font-mono">No vendors yet.</p>}
            {items.map((v) => (
              <div key={v.id} className="plate bg-white p-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium">{v.name} {!v.is_active && <span className="text-xs text-red-600">(inactive)</span>}</p>
                  <p className="text-xs text-slate">{v.contact_person} {v.phone && `· ${v.phone}`} {v.gstin && `· GSTIN: ${v.gstin}`}</p>
                </div>
                {canUpdate && <button onClick={() => setForm(v)} className="text-xs text-steel underline">Edit</button>}
                {canDelete && <button onClick={() => handleDelete(v.id)} className="text-xs text-red-600 underline">Delete</button>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminVendorsPage() {
  return (
    <PermissionGate resource="vendors">
      <VendorsContent />
    </PermissionGate>
  );
}
