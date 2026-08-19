"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import PermissionGate from "@/components/PermissionGate";
import { useAdminAccess } from "@/lib/AdminAccessContext";
import type { Vertical } from "@/lib/types";

const empty: Partial<Vertical> = { title: "", code: "", description: "", sort_order: 0 };

function VerticalsContent() {
  const { can } = useAdminAccess();
  const canCreate = can("verticals", "create");
  const canUpdate = can("verticals", "update");
  const canDelete = can("verticals", "delete");

  const [items, setItems] = useState<Vertical[]>([]);
  const [form, setForm] = useState<Partial<Vertical>>(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from("verticals").select("*").order("sort_order");
    setItems((data as Vertical[]) || []);
  }
  useEffect(() => { load(); }, []);

  async function handleSave() {
    setSaving(true);
    const { error } = form.id
      ? await supabase.from("verticals").update(form).eq("id", form.id)
      : await supabase.from("verticals").insert(form);
    setSaving(false);
    if (!error) { setForm(empty); load(); } else { alert(error.message); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this vertical?")) return;
    await supabase.from("verticals").delete().eq("id", id);
    load();
  }

  const showForm = canCreate || (form.id && canUpdate);

  return (
    <div>
      <p className="eyebrow text-steel mb-2">Business</p>
      <h1 className="font-display text-4xl mb-8">Verticals</h1>

      <div className="grid lg:grid-cols-2 gap-8">
        {showForm && (
          <div className="plate bg-white p-6 space-y-4 h-fit">
            <h2 className="font-display text-xl">{form.id ? "Edit Vertical" : "Add New Vertical"}</h2>
            <input placeholder="Title (e.g. Precision Manufacturing)" value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
            <input placeholder="Short code (e.g. MFG)" value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
            <textarea placeholder="Description" rows={4} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
            <input type="number" placeholder="Sort order" value={form.sort_order ?? 0} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} className="w-full border border-line px-3 py-2 text-sm" />
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving} className="bg-copper hover:bg-copper-light transition-colors text-ink font-medium px-5 py-2">
                {saving ? "Saving…" : form.id ? "Update" : "Add Vertical"}
              </button>
              {form.id && <button onClick={() => setForm(empty)} className="text-sm text-slate underline">Cancel edit</button>}
            </div>
          </div>
        )}

        <div className={showForm ? "" : "lg:col-span-2"}>
          <div className="space-y-3">
            {items.length === 0 && <p className="text-sm text-slate font-mono">No verticals yet.</p>}
            {items.map((v) => (
              <div key={v.id} className="plate bg-white p-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium">{v.title} <span className="text-xs text-slate font-mono">({v.code})</span></p>
                  <p className="text-xs text-slate line-clamp-1">{v.description}</p>
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

export default function AdminVerticalsPage() {
  return (
    <PermissionGate resource="verticals">
      <VerticalsContent />
    </PermissionGate>
  );
}
