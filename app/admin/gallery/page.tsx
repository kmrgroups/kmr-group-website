"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ImageUploader from "@/components/ImageUploader";
import PermissionGate from "@/components/PermissionGate";
import { useAdminAccess } from "@/lib/AdminAccessContext";
import type { GalleryItem } from "@/lib/types";

const empty: Partial<GalleryItem> = { title: "", media_type: "photo", media_url: "", sort_order: 0 };

function GalleryContent() {
  const { can } = useAdminAccess();
  const canCreate = can("gallery_items", "create");
  const canUpdate = can("gallery_items", "update");
  const canDelete = can("gallery_items", "delete");

  const [items, setItems] = useState<GalleryItem[]>([]);
  const [form, setForm] = useState<Partial<GalleryItem>>(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from("gallery_items").select("*").order("sort_order");
    setItems((data as GalleryItem[]) || []);
  }
  useEffect(() => { load(); }, []);

  async function handleSave() {
    if (!form.media_url) { alert("Please upload a photo or video first."); return; }
    setSaving(true);
    const { error } = form.id
      ? await supabase.from("gallery_items").update(form).eq("id", form.id)
      : await supabase.from("gallery_items").insert(form);
    setSaving(false);
    if (!error) { setForm(empty); load(); } else { alert(error.message); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this gallery item?")) return;
    await supabase.from("gallery_items").delete().eq("id", id);
    load();
  }

  const showForm = canCreate || (form.id && canUpdate);

  return (
    <div>
      <p className="eyebrow text-steel mb-2">Media</p>
      <h1 className="font-display text-4xl mb-8">Gallery</h1>

      <div className="grid lg:grid-cols-2 gap-8">
        {showForm && (
          <div className="plate bg-white p-6 space-y-4 h-fit">
            <h2 className="font-display text-xl">{form.id ? "Edit Item" : "Add New Item"}</h2>
            <input placeholder="Title (optional)" value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border border-line px-3 py-2 text-sm" />
            <select value={form.media_type || "photo"} onChange={(e) => setForm({ ...form, media_type: e.target.value as "photo" | "video" })} className="w-full border border-line px-3 py-2 text-sm">
              <option value="photo">Photo</option>
              <option value="video">Video</option>
            </select>
            <div>
              <label className="block text-sm font-medium mb-1">File</label>
              <ImageUploader folder="gallery" currentUrl={form.media_url} onUploaded={(url) => setForm({ ...form, media_url: url })} />
            </div>
            <input type="number" placeholder="Sort order" value={form.sort_order ?? 0} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} className="w-full border border-line px-3 py-2 text-sm" />
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving} className="bg-copper hover:bg-copper-light transition-colors text-ink font-medium px-5 py-2">
                {saving ? "Saving…" : form.id ? "Update" : "Add Item"}
              </button>
              {form.id && <button onClick={() => setForm(empty)} className="text-sm text-slate underline">Cancel edit</button>}
            </div>
          </div>
        )}

        <div className={showForm ? "grid grid-cols-2 gap-3" : "grid grid-cols-3 gap-3 lg:col-span-2"}>
          {items.length === 0 && <p className="text-sm text-slate font-mono col-span-2">No gallery items yet.</p>}
          {items.map((g) => (
            <div key={g.id} className="plate bg-white p-3">
              <p className="text-xs font-mono text-slate mb-1">{g.media_type.toUpperCase()}</p>
              <p className="text-sm font-medium mb-2 line-clamp-1">{g.title || "Untitled"}</p>
              <div className="flex gap-3">
                {canUpdate && <button onClick={() => setForm(g)} className="text-xs text-steel underline">Edit</button>}
                {canDelete && <button onClick={() => handleDelete(g.id)} className="text-xs text-red-600 underline">Delete</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminGalleryPage() {
  return (
    <PermissionGate resource="gallery_items">
      <GalleryContent />
    </PermissionGate>
  );
}
