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

  const area = (key: keyof CompanyInfo, label: string, rows: number) => (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <textarea
        value={(form[key] as string) ?? ""}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        disabled={!canUpdate}
        rows={rows}
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
        <p className="eyebrow text-steel pt-2">Identity</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {field("trade_name", "Trade Name (as on GST certificate)")}
          {field("brand_name", "Brand Name (short, for the menu)")}
          {field("legal_name", "Legal Name (as on GST certificate)")}
          {field("constitution", "Constitution (Proprietorship, LLP, Pvt Ltd …)")}
          {field("proprietor_name", "Proprietor / Director")}
          {field("proprietor_title", "Their title (Proprietor, Director …)")}
          {field("founded_year", "Founded Year", "number")}
        </div>

        <p className="eyebrow text-steel pt-2">Registrations</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {field("gstin", "GSTIN")}
          {field("udyam_number", "Udyam Registration No. (MSME)")}
          {field("msme_category", "MSME Category (Micro / Small / Medium)")}
          {field("cin", "CIN (companies / LLPIN — leave empty for a proprietorship)")}
        </div>
        {field("trademark_status", "Trademark (e.g. TM application no., class and status)")}
        <p className="text-xs text-slate">Keep full registration records and certificates under Admin → Finance &amp; Compliance. Never put Aadhaar, PAN or bank account numbers here — this information is public on the website.</p>

        <p className="eyebrow text-steel pt-2">Address &amp; Contact</p>
        <div>
          <label className="block text-sm font-medium mb-1">Registered Address (street)</label>
          <textarea
            value={form.registered_address || ""}
            onChange={(e) => setForm({ ...form, registered_address: e.target.value })}
            disabled={!canUpdate}
            rows={2}
            className="w-full border border-line px-3 py-2 text-sm disabled:bg-warehouse"
          />
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {field("city", "City / Town")}
          {field("state", "State")}
          {field("postal_code", "PIN Code")}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {field("email", "Email")}
          {field("phone", "Phone")}
          {field("whatsapp_number", "WhatsApp Number (with country code, no +)")}
          {field("website_url", "Website")}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {field("map_lat", "Map Latitude", "number")}
          {field("map_lng", "Map Longitude", "number")}
        </div>

        <p className="eyebrow text-steel pt-2">Brand &amp; About</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {field("tagline", "Tagline (under the logo)")}
          {field("slogan", "Slogan")}
        </div>
        {area("short_about", "Short description (site footer)", 2)}
        {area("vision", "Vision (About page)", 3)}
        {area("mission", "Mission (About page)", 3)}
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1">Logo with business verticals</label>
            <p className="text-xs text-slate mb-2">Shown on the About page.</p>
            <ImageUploader folder="company" currentUrl={form.logo_full_url} onUploaded={(url) => setForm({ ...form, logo_full_url: url })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Letterhead</label>
            <p className="text-xs text-slate mb-2">Blank letterhead for staff to download (image).</p>
            <ImageUploader folder="company" currentUrl={form.letterhead_url} onUploaded={(url) => setForm({ ...form, letterhead_url: url })} />
          </div>
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
