import { getSite, companyName, fullAddress, mapLinks, telHref } from "@/lib/site";
import { PageHero } from "@/components/Blocks";
import EnquiryForm from "@/components/EnquiryForm";
import SocialLinks from "@/components/SocialLinks";
import { IconClock, IconMail, IconPhone, IconPin, IconWhatsApp } from "@/components/Icons";

export const revalidate = 60;
export const metadata = { title: "Contact us" };

export default async function ContactPage() {
  const { company: c } = await getSite();
  const address = fullAddress(c);
  const { embed: map, open: mapOpen } = mapLinks(c);
  const cards = [
    { icon: IconPin, title: "Visit us", body: address, href: mapOpen, cta: "Open in Google Maps" },
    { icon: IconPhone, title: "Call us", body: [c.phone, c.alt_phone].filter(Boolean).join("  ·  "), href: telHref(c.phone), cta: "Call now" },
    { icon: IconMail, title: "Email us", body: c.email, href: c.email ? `mailto:${c.email}` : undefined, cta: "Write to us" },
    { icon: IconClock, title: "Business hours", body: c.business_hours },
  ].filter((x) => x.body);

  return (
    <>
      <PageHero eyebrow="Contact us" title="Let’s start a conversation" intro="Products, software, training, careers or a trade enquiry — we reply within one working day." />

      <section className="relative z-10 -mt-10">
        <div className="wrap grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ icon: Icon, title, body, href, cta }) => (
            <div key={title} className="card flex flex-col p-7">
              <span className="grid h-12 w-12 place-items-center bg-navy text-gold-light"><Icon className="h-5 w-5" /></span>
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-dark">{title}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-navy">{body}</p>
              {href && cta && <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="link-gold mt-auto pt-4 text-sm">{cta} →</a>}
            </div>
          ))}
        </div>
      </section>

      <section className="py-14">
        <div className="wrap grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <EnquiryForm business="general" title="Send us a message" intro="Tell us a little about what you need and the best way to reach you." submitLabel="Send message" />
          <div className="flex flex-col gap-6">
            <div className="card overflow-hidden">
              <iframe title={`${companyName(c)} location`} className="h-[340px] w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen src={map} />
              <a href={mapOpen} target="_blank" rel="noopener noreferrer" className="link-gold block border-t border-line px-5 py-3 text-sm">Open in Google Maps →</a>
            </div>
            <div className="pattern-navy p-7 text-white">
              <p className="font-display text-xl">{companyName(c)}</p>
              {c.gstin && <p className="mt-2 text-sm text-white/65">GSTIN <span className="font-mono text-white/90">{c.gstin}</span></p>}
              {c.udyam_number && <p className="text-sm text-white/65">Udyam <span className="font-mono text-white/90">{c.udyam_number}</span></p>}
              {c.whatsapp_number && <a href={`https://wa.me/${c.whatsapp_number.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="btn-gold mt-6"><IconWhatsApp className="h-4 w-4" /> Chat on WhatsApp</a>}
              <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-light">Follow us</p>
              <SocialLinks c={c} className="mt-3" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
