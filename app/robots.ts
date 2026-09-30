import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/mail";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/order/", "/it/console", "/it/hrm", "/it/app/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
