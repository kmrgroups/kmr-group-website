"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ImageUploader from "@/components/ImageUploader";
import PermissionGate from "@/components/PermissionGate";
import { useAdminAccess } from "@/lib/AdminAccessContext";
import { COMPLIANCE_CATEGORIES } from "@/lib/resources";
import type { ComplianceRecord } from "@/lib/types";

const empty: Partial<ComplianceRecord> = {
  category: "gst", title: "", reference_number: "", issuing_authority: "",
  issue_date: "", expiry_date: "", document_url: "", notes: "", reminder_days_before: 30
};

function daysUntil(dateStr?: string) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function statusFor(record: ComplianceRecord) {
  const days = daysUntil(record.expiry_date);
  if (days === null) return { label: "No expiry set", color: "text-slate", bg: "bg-line/40" };
  if (days < 0) return { label: `Expired ${Math.abs(days)}d ago`, color: "text-red-700", bg: "bg-red-100" };
  if (days <= record.reminder_days_before) return { label: `Expires in ${days}d`, color: "text-copper", bg: "bg-copper/10" };
  return { label: `Valid · ${days}d left`, color: "text-signal", bg: "bg-signal/10" };
}

function ComplianceContent() {
  const { can } = useAdminAccess();
  const [items, setItems] = useState<ComplianceRecord[]>([]);
  const [form, setForm] = useState<Partial<ComplianceRecord>>(empty);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  async function load() {
    const { data } = await supabase.from("compliance_records").select("*").order("expiry_date", { ascending: true });
    setItems((data as ComplianceRecord[]) || []);
  }
  useEffect(() => { load(); }, []);

  const canCreate = can("compliance_records", "create");
  const canUpdate = can("compliance_records", "update");
  const canDelete = can("compliance_records", "delete");

  async function handleSave() {
    if (!form.title) { alert("Please give this record a title."); return; }
    setSaving(true);
    const payload = { ...form, updated_at: new Date().toISOString() };
    const { error } = form.id
      ? await supabase.from("compliance_records").update(payload).eq("id", form.id)
      : await supabase.from("compliance_records").insert(payload);
    setSaving(false);
    if (!error) { setForm(empty); load(); } else { alert(error.message); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this compliance record?")) return;
    await supabase.from("compliance_records").delete().eq("id", id);
    load();
  }

  const summary = useMemo(() => {
    const expired = items.filter((i) => (daysUntil(i.expiry_date) ?? 999) < 0).length;
    const expiring = items.filter((i) => {
      const d = daysUntil(i.expiry_date);
      return d !== null && d >= 0 && d <= i.reminder_days_before;
    }).length;
    return { expired, expiring, total: items.length };
  }, [items]);

  const visible = filter === "all" ? items : items.filter((i) => i.category === filter);

  return (
    <div>
      <p className="eyebrow text-steel mb-2">Finance & Legal</p>
      <h1 className="font-display text-4xl mb-2">Compliance Dashboard</h1>
      <p className="text-sm text-slate mb-6">
        Tracks GST, Udyam, trademark, employee welfare, pollution control, local body licenses, and more —
        with renewal reminders.
      </p>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="plate bg-white p-4">
          <p className="eyebrow text-slate mb-1">Total Records</p>
          <p className="font-display text-3xl">{summary.total}</p>
        </div>
        <div className="plate bg-white p-4 border-copper">
          <p className="eyebrow text-copper mb-1">Expiring Soon</p>
          <p className="font-display text-3xl text-copper">{summary.expiring}</p>
        </div>
        <div className="plate bg-white p-4 border-red-400">
          <p className="eyebrow text-red-600 mb-1">Expired</p>
          <p className="font-display text-3xl text-red-600">{summary.expired}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {canCreate && (
          <div className="plate bg-white p-6 space-y-4 h-fit">
            <h2 className="font-display text-xl">{form.id ? "Edit Record" : "Add Compliance Record"}</h2>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as any })} className="w-full border border-line px-3 py-2 text-sm">
                {COMPLIANCE_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <input placeholder="Title (e.g. GSTIN Registration)" value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
            <input placeholder="Reference / registration number" value={form.reference_number || ""} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
            <input placeholder="Issuing authority" value={form.issuing_authority || ""} onChange={(e) => setForm({ ...form, issuing_authority: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate mb-1">Issue date</label>
                <input type="date" value={form.issue_date || ""} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate mb-1">Expiry date</label>
                <input type="date" value={form.expiry_date || ""} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate mb-1">Remind me this many days before expiry</label>
              <input type="number" value={form.reminder_days_before ?? 30} onChange={(e) => setForm({ ...form, reminder_days_before: Number(e.target.value) })} className="w-full border border-line px-3 py-2 text-sm" />
            </div>
            <textarea placeholder="Notes" rows={3} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
            <div>
              <label className="block text-sm font-medium mb-1">Document (certificate/license scan)</label>
              <ImageUploader folder="compliance" currentUrl={form.document_url} onUploaded={(url) => setForm({ ...form, document_url: url })} />
            </div>
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving} className="bg-copper hover:bg-copper-light transition-colors text-ink font-medium px-5 py-2">
                {saving ? "Saving…" : form.id ? "Update" : "Add Record"}
              </button>
              {form.id && <button onClick={() => setForm(empty)} className="text-sm text-slate underline">Cancel edit</button>}
            </div>
          </div>
        )}

        <div className={canCreate ? "" : "lg:col-span-2"}>
          <div className="flex gap-2 mb-4 flex-wrap">
            <button onClick={() => setFilter("all")} className={`px-3 py-1.5 text-xs border ${filter === "all" ? "border-copper text-copper" : "border-line text-slate"}`}>All</button>
            {COMPLIANCE_CATEGORIES.map((c) => (
              <button key={c.key} onClick={() => setFilter(c.key)} className={`px-3 py-1.5 text-xs border ${filter === c.key ? "border-copper text-copper" : "border-line text-slate"}`}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {visible.length === 0 && <p className="text-sm text-slate font-mono">No records in this category yet.</p>}
            {visible.map((r) => {
              const status = statusFor(r);
              return (
                <div key={r.id} className="plate bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <p className="font-medium">
                      {r.title} <span className="text-xs text-slate font-mono">· {COMPLIANCE_CATEGORIES.find((c) => c.key === r.category)?.label}</span>
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded ${status.bg} ${status.color}`}>{status.label}</span>
                  </div>
                  {r.reference_number && <p className="text-xs text-slate">Ref: {r.reference_number}</p>}
                  {r.issuing_authority && <p className="text-xs text-slate">{r.issuing_authority}</p>}
                  {r.expiry_date && <p className="text-xs text-slate font-mono">Expires: {new Date(r.expiry_date).toLocaleDateString("en-IN")}</p>}
                  {r.document_url && (
                    <a href={r.document_url} target="_blank" rel="noopener noreferrer" className="text-xs text-steel underline">View document</a>
                  )}
                  <div className="flex gap-3 mt-2">
                    {canUpdate && <button onClick={() => setForm(r)} className="text-xs text-steel underline">Edit</button>}
                    {canDelete && <button onClick={() => handleDelete(r.id)} className="text-xs text-red-600 underline">Delete</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminCompliancePage() {
  return (
    <PermissionGate resource="compliance_records">
      <ComplianceContent />
    </PermissionGate>
  );
}
