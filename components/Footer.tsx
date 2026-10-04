import Link from "next/link";
import { getSite, companyName, fullAddress, mapLinks, telHref, verticalHref } from "@/lib/site";
import SocialLinks from "./SocialLinks";
import { IconClock, IconMail, IconPhone, IconPin } from "./Icons";

export default async function Footer() {
  const { company: c, verticals, policies, has } = await getSite();
  const name = companyName(c);
  const footerPolicies = policies.filter((p) => p.show_in_footer !== false);
  const addr = fullAddress(c);
  const head = "mb-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-light";
  const link = "text-white/70 transition-colors hover:text-gold-light";

  return (
    <footer className="pattern-navy mt-0 text-white">
      <div className="wrap grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-[1.45fr_1fr_1fr_1.25fr] lg:py-20">
        <div>
          <Link href="/" className="inline-block">
            {c.logo_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={c.logo_url} alt={name} className="h-14 w-auto max-w-[190px] rounded bg-white/95 object-contain p-1.5" />
              : <span className="border-2 border-gold px-2.5 py-0.5 font-display text-3xl font-bold text-white">KMR</span>}
          </Link>
          <p className="mt-5 font-display text-xl text-white">{name}</p>
          {c.tagline && <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-gold-light">{c.tagline}</p>}
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">{c.short_about || "A multi-business group in trading, software, training and industrial supply."}</p>
          <SocialLinks c={c} className="mt-6" />
        </div>

        <div>
          <p className={head}>Our businesses</p>
          <ul className="space-y-3 text-sm">
            {verticals.map((v) => <li key={v.id}><Link href={verticalHref(v)} className={link}>{v.title}</Link></li>)}
          </ul>
        </div>

        <div>
          <p className={head}>Company</p>
          <ul className="space-y-3 text-sm">
            {([["/about", "About us"], ["/about#founder", "Founder’s message"], has.leaders && ["/leadership", "Leadership"], ["/careers", "Careers"], has.gallery && ["/gallery", "Gallery"], ["/policies", "Policies"], ["/contact", "Contact"]]
              .filter(Boolean) as string[][]).map(([h, l]) => <li key={h}><Link href={h} className={link}>{l}</Link></li>)}
          </ul>
        </div>

        <div>
          <p className={head}>Get in touch</p>
          <ul className="space-y-4 text-sm text-white/75">
            {addr && <li className="flex gap-3"><IconPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" /><a href={mapLinks(c).open} target="_blank" rel="noopener noreferrer" className={link}>{addr}</a></li>}
            {c.phone && <li className="flex gap-3"><IconPhone className="mt-0.5 h-4 w-4 shrink-0 text-gold" /><a href={telHref(c.phone)} className={link}>{c.phone}</a>{c.alt_phone && <>&nbsp;·&nbsp;<a href={telHref(c.alt_phone)} className={link}>{c.alt_phone}</a></>}</li>}
            {c.email && <li className="flex gap-3"><IconMail className="mt-0.5 h-4 w-4 shrink-0 text-gold" /><a href={`mailto:${c.email}`} className={link}>{c.email}</a></li>}
            {c.business_hours && <li className="flex gap-3"><IconClock className="mt-0.5 h-4 w-4 shrink-0 text-gold" /><span>{c.business_hours}</span></li>}
          </ul>
        </div>
      </div>

      {(c.gstin || c.udyam_number) && (
        <div className="border-t border-white/10">
          <div className="wrap flex flex-wrap gap-x-10 gap-y-2 py-5 text-[12.5px] text-white/60">
            {c.gstin && <span>GSTIN <b className="font-mono font-medium text-white/85">{c.gstin}</b></span>}
            {c.udyam_number && <span>Udyam <b className="font-mono font-medium text-white/85">{c.udyam_number}</b>{c.msme_category ? ` · ${c.msme_category} enterprise` : ""}</span>}
            {c.cin && <span>CIN <b className="font-mono font-medium text-white/85">{c.cin}</b></span>}
            {c.constitution && <span>{c.constitution}</span>}
          </div>
        </div>
      )}

      <div className="border-t border-white/10 bg-navy-950/60">
        <div className="wrap flex flex-col gap-3 py-5 text-[12.5px] text-white/55 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} {c.legal_name && c.legal_name !== name ? `${name} (${c.legal_name})` : name}. All rights reserved.</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {footerPolicies.map((p) => <li key={p.slug}><Link href={`/policies/${p.slug}`} className="hover:text-gold-light">{p.title}</Link></li>)}
          </ul>
        </div>
        {c.slogan && <p className="pb-5 text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-gold/80">{c.slogan}</p>}
      </div>
    </footer>
  );
}
