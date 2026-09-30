import Link from "next/link";
import { getSite, companyName, telHref, verticalHref } from "@/lib/site";
import NavBar from "./NavBar";
import SocialLinks from "./SocialLinks";
import { IconMail, IconPhone } from "./Icons";

/** Announcement bar (optional), contact strip and the main navigation. */
export default async function Header() {
  const { company: c, settings: s, verticals } = await getSite();
  return (
    <>
      {s.announcement && (
        <div className="bg-gold text-navy-950">
          <div className="wrap py-2 text-center text-[13px] font-medium">
            {s.announcement_link ? <Link href={s.announcement_link} className="hover:underline">{s.announcement} →</Link> : s.announcement}
          </div>
        </div>
      )}
      <div className="hidden bg-navy-950 text-white/75 md:block">
        <div className="wrap flex h-10 items-center justify-between text-[12.5px]">
          <div className="flex items-center gap-6">
            {c.phone && <a href={telHref(c.phone)} className="flex items-center gap-2 hover:text-gold-light"><IconPhone className="h-3.5 w-3.5 text-gold" />{c.phone}</a>}
            {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-2 hover:text-gold-light"><IconMail className="h-3.5 w-3.5 text-gold" />{c.email}</a>}
            {c.gstin && <span className="hidden lg:inline">GSTIN <span className="font-mono text-white/90">{c.gstin}</span></span>}
          </div>
          <SocialLinks c={c} className="[&_a]:h-7 [&_a]:w-7 [&_a]:border-0" />
        </div>
      </div>
      <NavBar logo={c.logo_url} name={companyName(c)} cta={{ label: s.header_cta_label || "Get a quote", href: s.header_cta_link || "/contact" }}
        verticals={verticals.map((v) => ({ title: v.title, href: verticalHref(v), code: v.code }))} />
    </>
  );
}
