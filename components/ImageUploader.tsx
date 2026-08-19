"use client";
import { useState } from "react";
import { supabase, MEDIA_BUCKET, publicUrlFor } from "@/lib/supabaseClient";

/**
 * Reusable upload control used across every admin CRUD screen.
 * Uploads a file into the shared "media" storage bucket and returns
 * its public URL via onUploaded().
 */
export default function ImageUploader({
  folder,
  currentUrl,
  onUploaded
}: {
  folder: string;
  currentUrl?: string;
  onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    const path = `${folder}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
    const { error: uploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, file, { upsert: true });
    setUploading(false);
    if (uploadError) {
      setError(uploadError.message);
      return;
    }
    onUploaded(publicUrlFor(path));
  }

  return (
    <div className="space-y-2">
      {currentUrl && (
        <img src={currentUrl} alt="Current upload" className="h-24 w-24 object-cover border border-line" />
      )}
      <input
        type="file"
        accept="image/*,video/*"
        onChange={handleFile}
        disabled={uploading}
        className="text-sm"
      />
      <p className="text-xs text-slate">
        For sharpest results, upload photos at least 1000px wide — small/compressed images (like WhatsApp
        photos) look pixelated once stretched to fill their frame.
      </p>
      {uploading && <p className="text-xs text-slate">Uploading…</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
