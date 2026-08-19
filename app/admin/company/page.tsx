"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ImageUploader from "@/components/ImageUploader";
import PermissionGate from "@/components/PermissionGate";
import { useAdminAccess } from "@/lib/AdminAccessContext";
import type { CompanyInfo } from "@/lib/types";

function CompanyContent() {
  const { can } = useAdminAccess();
  const canUpdate = can("company_info", "update");
  const [form, setForm] = useState<Partial<CompanyInfo>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.from("company_info").select("*").limit(1).maybeSingle().then(({ data }) => {
      if (data) setForm(data);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const payload = { ...form, updated_at: new Date().toISOString() };
    const { error } = form.id
      ? await supabase.from("company_info").update(payload).eq("id", form.id)
      : await supabase.from("company_info").insert(payload);
    setSaving(false);
    setMessage(error ? `Error: ${error.message}` : "Saved.");
  }

  const field = (key: keyof CompanyInfo, label: string, type: string = "text") => (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        value={(form[key] as string | number) ?? ""}
        onChange={(e) => setForm({ ...form, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
        disabled={!canUpdate}
        className="w-full border border-line px-3 py-2 text-sm disabled:bg-warehouse"
      />
    </div>
  );

  return (
    <div className="max-w-3xl">
      <p className="eyebrow text-steel mb-2">Legal & Contact</p>
      <h1 className="font-display text-4xl mb-8">Company Info</h1>

      <div className="plate bg-white p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">Company Logo</label>
          <p className="text-xs text-slate mb-2">
            Shown in the top navigation bar and site footer. A square or wide transparent PNG works best.
          </p>
          <ImageUploader
            folder="company"
            currentUrl={form.logo_url}
            onUploaded={(url) => setForm({ ...form, logo_url: url })}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {field("legal_name", "Legal Name")}
          {field("brand_name", "Brand Name")}
          {field("founded_year", "Founded Year", "number")}
          {field("gstin", "GSTIN")}
          {field("cin", "CIN")}
          {field("email", "Email")}
          {field("phone", "Phone")}
          {field("whatsapp_number", "WhatsApp Number (with country code, no +)")}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Registered Address</label>
          <textarea
            value={form.registered_address || ""}
            onChange={(e) => setForm({ ...form, registered_address: e.target.value })}
            rows={3}
            className="w-full border border-line px-3 py-2 text-sm"
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {field("map_lat", "Map Latitude", "number")}
          {field("map_lng", "Map Longitude", "number")}
        </div>
        <p className="eyebrow text-steel pt-2">Social Links</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {field("facebook_url", "Facebook URL")}
          {field("instagram_url", "Instagram URL")}
          {field("linkedin_url", "LinkedIn URL")}
          {field("youtube_url", "YouTube URL")}
          {field("twitter_url", "X / Twitter URL")}
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !canUpdate}
          className="bg-copper hover:bg-copper-light transition-colors text-ink font-medium px-6 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {!canUpdate && <p className="text-xs text-slate font-mono">View only — you don't have edit permission for Company Info.</p>}
        {message && <p className="text-sm text-slate">{message}</p>}
      </div>
    </div>
  );
}

export default function AdminCompanyPage() {
  return (
    <PermissionGate resource="company_info">
      <CompanyContent />
    </PermissionGate>
  );
}
