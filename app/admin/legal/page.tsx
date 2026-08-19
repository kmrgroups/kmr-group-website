"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import PermissionGate from "@/components/PermissionGate";
import { useAdminAccess } from "@/lib/AdminAccessContext";
import type { LegalPage } from "@/lib/types";

const slugs: LegalPage["slug"][] = ["terms", "privacy", "refund", "shipping", "grievance"];

function LegalContent() {
  const { can } = useAdminAccess();
  const canUpdate = can("legal_pages", "update");
  const [pages, setPages] = useState<LegalPage[]>([]);
  const [activeSlug, setActiveSlug] = useState<LegalPage["slug"]>("terms");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const { data } = await supabase.from("legal_pages").select("*");
    setPages((data as LegalPage[]) || []);
  }
  useEffect(() => { load(); }, []);

  const current = pages.find((p) => p.slug === activeSlug);

  async function handleSave(content: string, title: string) {
    setSaving(true);
    setMessage("");
    const { error } = await supabase
      .from("legal_pages")
      .update({ content, title, updated_at: new Date().toISOString() })
      .eq("slug", activeSlug);
    setSaving(false);
    setMessage(error ? `Error: ${error.message}` : "Saved.");
    load();
  }

  return (
    <div>
      <p className="eyebrow text-steel mb-2">Compliance</p>
      <h1 className="font-display text-4xl mb-8">Legal Pages</h1>

      <div className="flex gap-2 mb-6 flex-wrap">
        {slugs.map((s) => (
          <button
            key={s}
            onClick={() => setActiveSlug(s)}
            className={`px-4 py-2 text-sm border ${activeSlug === s ? "border-copper text-copper" : "border-line text-slate"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {current && (
        <LegalEditor key={current.id} page={current} saving={saving} message={message} onSave={handleSave} readOnly={!canUpdate} />
      )}
    </div>
  );
}

function LegalEditor({
  page, saving, message, onSave, readOnly
}: {
  page: LegalPage; saving: boolean; message: string; onSave: (content: string, title: string) => void; readOnly: boolean;
}) {
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState(page.content);

  return (
    <div className="plate bg-white p-6 space-y-4 max-w-3xl">
      <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={readOnly} className="w-full border border-line px-3 py-2 text-sm font-medium disabled:bg-warehouse" />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={readOnly}
        rows={16}
        className="w-full border border-line px-3 py-2 text-sm font-mono leading-relaxed disabled:bg-warehouse"
      />
      {readOnly ? (
        <p className="text-xs text-slate font-mono">View only — you don't have edit permission for Legal Pages.</p>
      ) : (
        <button onClick={() => onSave(content, title)} disabled={saving} className="bg-copper hover:bg-copper-light transition-colors text-ink font-medium px-6 py-2.5">
          {saving ? "Saving…" : "Save Page"}
        </button>
      )}
      {message && <p className="text-sm text-slate">{message}</p>}
    </div>
  );
}

export default function AdminLegalPage() {
  return (
    <PermissionGate resource="legal_pages">
      <LegalContent />
    </PermissionGate>
  );
}
