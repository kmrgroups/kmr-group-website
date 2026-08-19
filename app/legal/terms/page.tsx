import { supabase } from "@/lib/supabaseClient";
import type { LegalPage } from "@/lib/types";

export const revalidate = 60;

export default async function LegalPageRoute() {
  const { data } = await supabase.from("legal_pages").select("*").eq("slug", "terms").maybeSingle();
  const page = data as LegalPage | null;

  return (
    <div className="mx-auto max-w-3xl px-5 py-20">
      <p className="eyebrow text-steel mb-3">Legal</p>
      <h1 className="font-display text-4xl mb-8">{page?.title || "terms"}</h1>
      <div className="prose prose-slate max-w-none whitespace-pre-line text-slate leading-relaxed">
        {page?.content || "This page has not been set up yet. Add content from Admin → Legal Pages."}
      </div>
      {page?.updated_at && (
        <p className="text-xs text-slate font-mono mt-10">
          Last updated: {new Date(page.updated_at).toLocaleDateString("en-IN")}
        </p>
      )}
    </div>
  );
}
