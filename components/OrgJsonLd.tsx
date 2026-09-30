import { getSite, companyName } from "@/lib/site";
import { SITE_URL } from "@/lib/mail";

/** Tells Google who the company is (name, logo, address, phone, social pages) — shown in search results. */
export default async function OrgJsonLd() {
  const { company: c } = await getSite();
  const same = [c.linkedin_url, c.facebook_url, c.instagram_url, c.youtube_url, c.twitter_url].filter(Boolean);
  const data = {
    "@context": "https://schema.org", "@type": ["Organization", "LocalBusiness"], "@id": `${SITE_URL}/#org`,
    name: companyName(c), legalName: c.legal_name || undefined, url: SITE_URL, logo: c.logo_url || undefined, image: c.about_image_url || c.logo_url || undefined,
    description: c.short_about || undefined, email: c.email || undefined, telephone: c.phone || undefined,
    foundingDate: c.founded_year ? String(c.founded_year) : undefined, taxID: c.gstin || undefined,
    address: c.city || c.registered_address ? { "@type": "PostalAddress", streetAddress: c.registered_address || undefined, addressLocality: c.city || undefined,
      addressRegion: c.state || undefined, postalCode: c.postal_code || undefined, addressCountry: "IN" } : undefined,
    sameAs: same.length ? same : undefined,
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
