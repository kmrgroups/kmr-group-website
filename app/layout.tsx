import type { Metadata, Viewport } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getSite, companyName } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { company: c } = await getSite();
  const name = companyName(c);
  const description = c.short_about || "KMR Group of Companies — online shop, software solutions, training & development, import, export and trading.";
  return {
    metadataBase: new URL(c.website_url || "https://www.kmr-groups.com"),
    title: { default: c.tagline ? `${name} — ${c.tagline}` : name, template: `%s · ${name}` },
    description,
    manifest: "/manifest.json",
    openGraph: { type: "website", siteName: name, title: name, description, images: c.logo_full_url || c.logo_url ? [{ url: (c.logo_full_url || c.logo_url)! }] : undefined },
  };
}

export const viewport: Viewport = { themeColor: "#0B1C3A", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-ivory font-body text-ink antialiased">
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
