"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ImageUploader from "@/components/ImageUploader";
import PermissionGate from "@/components/PermissionGate";
import { useAdminAccess } from "@/lib/AdminAccessContext";
import type { Leader } from "@/lib/types";

const empty: Partial<Leader> = { name: "", designation: "", bio: "", photo_url: "", linkedin_url: "", sort_order: 0 };

function LeadershipContent() {
  const { can } = useAdminAccess();
  const canCreate = can("leaders", "create");
  const canUpdate = can("leaders", "update");
  const canDelete = can("leaders", "delete");

  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [form, setForm] = useState<Partial<Leader>>(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from("leaders").select("*").order("sort_order");
    setLeaders((data as Leader[]) || []);
  }
  useEffect(() => { load(); }, []);

  async function handleSave() {
    setSaving(true);
    const payload = { ...form };
    const { error } = form.id
      ? await supabase.from("leaders").update(payload).eq("id", form.id)
      : await supabase.from("leaders").insert(payload);
    setSaving(false);
    if (!error) { setForm(empty); load(); } else { alert(error.message); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this leadership profile?")) return;
    await supabase.from("leaders").delete().eq("id", id);
    load();
  }

  const showForm = canCreate || (form.id && canUpdate);

  return (
    <div>
      <p className="eyebrow text-steel mb-2">People</p>
      <h1 className="font-display text-4xl mb-8">Leadership</h1>

      <div className="grid lg:grid-cols-2 gap-8">
        {showForm && (
          <div className="plate bg-white p-6 space-y-4 h-fit">
            <h2 className="font-display text-xl">{form.id ? "Edit Profile" : "Add New Profile"}</h2>
            <input placeholder="Name" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
            <input placeholder="Designation" value={form.designation || ""} onChange={(e) => setForm({ ...form, designation: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
            <textarea placeholder="Bio" rows={4} value={form.bio || ""} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
            <input placeholder="LinkedIn URL (optional)" value={form.linkedin_url || ""} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
            <input type="number" placeholder="Sort order" value={form.sort_order ?? 0} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} className="w-full border border-line px-3 py-2 text-sm" />
            <div>
              <label className="block text-sm font-medium mb-1">Photo</label>
              <ImageUploader folder="leaders" currentUrl={form.photo_url} onUploaded={(url) => setForm({ ...form, photo_url: url })} />
            </div>
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving} className="bg-copper hover:bg-copper-light transition-colors text-ink font-medium px-5 py-2">
                {saving ? "Saving…" : form.id ? "Update" : "Add Profile"}
              </button>
              {form.id && <button onClick={() => setForm(empty)} className="text-sm text-slate underline">Cancel edit</button>}
            </div>
          </div>
        )}

        <div className={showForm ? "" : "lg:col-span-2"}>
          <div className="space-y-3">
            {leaders.length === 0 && <p className="text-sm text-slate font-mono">No profiles yet.</p>}
            {leaders.map((l) => (
              <div key={l.id} className="plate bg-white p-4 flex items-center gap-4">
                {l.photo_url && <img src={l.photo_url} alt={l.name} className="w-14 h-14 object-cover object-top" />}
                <div className="flex-1">
                  <p className="font-medium">{l.name}</p>
                  <p className="text-xs text-slate">{l.designation}</p>
                </div>
                {canUpdate && <button onClick={() => setForm(l)} className="text-xs text-steel underline">Edit</button>}
                {canDelete && <button onClick={() => handleDelete(l.id)} className="text-xs text-red-600 underline">Delete</button>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLeadershipPage() {
  return (
    <PermissionGate resource="leaders">
      <LeadershipContent />
    </PermissionGate>
  );
}
