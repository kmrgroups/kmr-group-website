import Link from "next/link";
import FitImage from "@/components/FitImage";
import { supabase } from "@/lib/supabaseClient";
import { getSite, companyName, fullAddress, paragraphs } from "@/lib/site";
import { PageHero, RichText, SectionHead, CtaBand } from "@/components/Blocks";
import { IconLinkedIn, IconQuote, IconShield } from "@/components/Icons";
import type { Leader } from "@/lib/types";

export const revalidate = 60;
export const metadata = { title: "About us" };

export default async function AboutPage() {
  const { company: c } = await getSite();
  const { data: people } = await supabase.from("leaders").select("*").order("sort_order");
  const leaders = ((people as (Leader & { is_active?: boolean })[]) || []).filter((l) => l.is_active !== false);
  const name = companyName(c);
  const values = (c.core_values ?? "").split("\n").map((v) => v.trim()).filter(Boolean).map((v) => {
    const [t, ...rest] = v.split(/\s[—–-]\s/); return [t, rest.join(" — ")] as const;
  });
  const record = ([
    ["Trade name", c.trade_name], ["Legal name", c.legal_name], ["Constitution", c.constitution],
    [c.proprietor_title || "Proprietor", c.proprietor_name], ["GSTIN", c.gstin],
    ["Udyam registration", c.udyam_number ? `${c.udyam_number}${c.msme_category ? ` · ${c.msme_category} enterprise` : ""}` : null],
    ["CIN / LLPIN", c.cin], ["Trademark", c.trademark_status], ["Established", c.founded_year ? String(c.founded_year) : null],
    ["Registered office", fullAddress(c) || null],
  ] as [string, string | null | undefined][]).filter(([, v]) => v) as [string, string][];
  const message = paragraphs(c.founder_message);

  return (
    <>
      <PageHero eyebrow="About us" title={name} crumbs={[["About us"]]} intro={c.tagline ? `${c.tagline}. ${c.short_about ?? ""}` : c.short_about} />

      {/* Story */}
      <section className="py-16">
        <div className="wrap grid gap-16 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="eyebrow mb-4">Our story</p>
            <h2 className="h-display mb-6 text-2xl text-navy md:text-[32px]">{c.slogan || "One vision, many solutions"}</h2>
            {c.about_story ? <RichText text={c.about_story} /> : <p className="lead">{c.short_about}</p>}
          </div>
          <div className="space-y-6">
            {c.about_image_url && <FitImage src={c.about_image_url} alt={name} className="card aspect-[4/3] w-full" />}
            {c.vision && <div className="border-l-4 border-gold bg-white p-7 shadow-card"><p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-dark">Our vision</p><p className="mt-3 whitespace-pre-line font-display text-xl leading-relaxed text-navy">{c.vision}</p></div>}
            {c.mission && <div className="pattern-navy p-7 text-white"><p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-light">Our mission</p><p className="mt-3 whitespace-pre-line leading-relaxed text-white/85">{c.mission}</p></div>}
          </div>
        </div>
      </section>

      {/* Values */}
      {values.length > 0 && (
        <section className="bg-white py-16">
          <div className="wrap">
            <SectionHead eyebrow="What we stand for" title="Our core values" center />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {values.map(([t, d], i) => (
                <div key={t} className="card-hover p-7">
                  <div className="flex items-center justify-between"><IconShield className="h-9 w-9 text-gold" /><span className="font-display text-3xl text-line">0{i + 1}</span></div>
                  <h3 className="mt-5 font-display text-xl font-semibold text-navy">{t}</h3>
                  {d && <p className="mt-2 text-sm leading-relaxed text-muted">{d}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Founder */}
      {message.length > 0 && (
        <section id="founder" className="scroll-mt-24 py-16">
          <div className="wrap grid items-start gap-14 lg:grid-cols-[360px_1fr]">
            <div className="lg:sticky lg:top-28">
              <div className="corner">
                <div className="aspect-[4/5] overflow-hidden bg-navy">
                  {c.founder_photo_url
                    ? <FitImage src={c.founder_photo_url} alt={c.founder_name || "Founder"} className="h-full w-full" />
                    : <div className="pattern-navy grid h-full place-items-center font-display text-6xl text-gold/60">{(c.founder_name || "K").slice(0, 1)}</div>}
                </div>
              </div>
              <p className="mt-8 font-display text-2xl text-navy">{c.founder_name || c.proprietor_name}</p>
              <p className="text-sm text-muted">{c.founder_title || c.proprietor_title}</p>
            </div>
            <div>
              <p className="eyebrow mb-4">Founder’s message</p>
              <IconQuote className="h-12 w-12 text-gold" />
              <p className="mt-4 font-display text-xl leading-relaxed text-navy md:text-2xl">{message[0]}</p>
              <div className="mt-8"><RichText text={message.slice(1).join("\n\n")} /></div>
              {c.founder_signature_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.founder_signature_url} alt="" className="mt-6 h-16 w-auto" />
              )}
              <p className="mt-2 font-display text-lg text-navy">{c.founder_name || c.proprietor_name}</p>
            </div>
          </div>
        </section>
      )}

      {/* Leadership */}
      {leaders.length > 0 && (
        <section className="bg-white py-16">
          <div className="wrap">
            <SectionHead eyebrow="Leadership" title="The team behind the group" center />
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {leaders.map((l) => (
                <div key={l.id} className="group">
                  <div className="aspect-[4/5] overflow-hidden bg-sand">
                    {l.photo_url
                      ? <FitImage src={l.photo_url} alt={l.name} className="h-full w-full" />
                      : <div className="pattern-navy grid h-full place-items-center font-display text-4xl text-gold/60">{l.name.slice(0, 1)}</div>}
                  </div>
                  <div className="border-b-2 border-gold bg-white px-1 pt-5 pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div><h3 className="font-display text-xl font-semibold text-navy">{l.name}</h3><p className="text-sm text-gold-dark">{l.designation}</p></div>
                      {l.linkedin_url && <a href={l.linkedin_url} target="_blank" rel="noopener noreferrer" aria-label={`${l.name} on LinkedIn`} className="text-navy hover:text-gold-dark"><IconLinkedIn className="h-5 w-5" /></a>}
                    </div>
                    {l.bio && <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-muted">{l.bio}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Corporate information */}
      {record.length > 0 && (
        <section className="py-16">
          <div className="wrap grid gap-12 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="eyebrow mb-4">Corporate information</p>
              <h2 className="h-display text-2xl text-navy md:text-[30px]">Registered, compliant and accountable</h2>
              <p className="lead mt-5">Our registrations are public so you can verify who you are dealing with. Invoices carry the same GSTIN and address.</p>
              <Link href="/policies" className="btn-outline mt-8">Company policies</Link>
            </div>
            <dl className="card divide-y divide-line">
              {record.map(([k, v]) => (
                <div key={k} className="grid gap-1 px-6 py-4 sm:grid-cols-[200px_1fr]">
                  <dt className="text-[12px] font-semibold uppercase tracking-wider text-muted">{k}</dt>
                  <dd className={`text-sm text-navy ${/GSTIN|Udyam|CIN/.test(k) ? "font-mono" : ""}`}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      <CtaBand title="Want to know more about us?" text="Visit the gallery or get in touch — we are happy to talk." primary={["Contact us", "/contact"]} secondary={["Gallery", "/gallery"]} />
    </>
  );
}
