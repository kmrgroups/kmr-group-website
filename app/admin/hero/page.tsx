"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ImageUploader from "@/components/ImageUploader";
import PermissionGate from "@/components/PermissionGate";
import { useAdminAccess } from "@/lib/AdminAccessContext";
import type { HeroContent } from "@/lib/types";

function HeroContentEditor() {
  const { can } = useAdminAccess();
  const canUpdate = can("hero_content", "update") || can("hero_content", "create");
  const [hero, setHero] = useState<Partial<HeroContent>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.from("hero_content").select("*").limit(1).maybeSingle().then(({ data }) => {
      if (data) setHero(data);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const payload = { ...hero, updated_at: new Date().toISOString() };
    const { error } = hero.id
      ? await supabase.from("hero_content").update(payload).eq("id", hero.id)
      : await supabase.from("hero_content").insert(payload);
    setSaving(false);
    setMessage(error ? `Error: ${error.message}` : "Saved.");
  }

  return (
    <div className="max-w-2xl">
      <p className="eyebrow text-steel mb-2">Homepage</p>
      <h1 className="font-display text-4xl mb-8">Hero Banner</h1>

      <div className="plate bg-white p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">Headline</label>
          <input
            value={hero.headline || ""}
            onChange={(e) => setHero({ ...hero, headline: e.target.value })}
            className="w-full border border-line px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Subheadline</label>
          <textarea
            value={hero.subheadline || ""}
            onChange={(e) => setHero({ ...hero, subheadline: e.target.value })}
            rows={3}
            className="w-full border border-line px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Button Label</label>
            <input
              value={hero.cta_label || ""}
              onChange={(e) => setHero({ ...hero, cta_label: e.target.value })}
              className="w-full border border-line px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Button Link</label>
            <input
              value={hero.cta_link || ""}
              onChange={(e) => setHero({ ...hero, cta_link: e.target.value })}
              className="w-full border border-line px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Banner Image</label>
          <ImageUploader
            folder="hero"
            currentUrl={hero.banner_image_url}
            onUploaded={(url) => setHero({ ...hero, banner_image_url: url })}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !canUpdate}
          className="bg-copper hover:bg-copper-light transition-colors text-ink font-medium px-6 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {!canUpdate && <p className="text-xs text-slate font-mono">View only — you don't have edit permission for the Hero Banner.</p>}
        {message && <p className="text-sm text-slate">{message}</p>}
      </div>
    </div>
  );
}

export default function AdminHeroPage() {
  return (
    <PermissionGate resource="hero_content">
      <HeroContentEditor />
    </PermissionGate>
  );
}
