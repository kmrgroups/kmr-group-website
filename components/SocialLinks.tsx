import type { CompanyInfo } from "@/lib/types";
import { IconFacebook, IconInstagram, IconLinkedIn, IconWhatsApp, IconX, IconYouTube } from "./Icons";

/** Social profile links from Company info — only the ones that are filled in. */
export default function SocialLinks({ c, className = "", tone = "light" }: { c: Partial<CompanyInfo>; className?: string; tone?: "light" | "dark" }) {
  const items = [
    ["LinkedIn", c.linkedin_url, IconLinkedIn], ["Facebook", c.facebook_url, IconFacebook], ["Instagram", c.instagram_url, IconInstagram],
    ["YouTube", c.youtube_url, IconYouTube], ["X", c.twitter_url, IconX],
    ["WhatsApp", c.whatsapp_number ? `https://wa.me/${c.whatsapp_number.replace(/\D/g, "")}` : undefined, IconWhatsApp],
  ] as const;
  const cls = tone === "light"
    ? "border-white/20 text-white/80 hover:border-gold-light hover:text-gold-light"
    : "border-line text-navy hover:border-gold hover:text-gold-dark";
  const shown = items.filter(([, href]) => href);
  if (!shown.length) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {shown.map(([label, href, Icon]) => (
        <a key={label} href={href!} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}
          className={`grid h-9 w-9 place-items-center rounded-full border transition-colors ${cls}`}><Icon className="h-4 w-4" /></a>
      ))}
    </div>
  );
}
