/** @type {import('next').NextConfig} */

// KMR software products run as their own apps and are shown under www.kmr-groups.com/it/…
// Visitors only ever see www.kmr-groups.com. Set HRM_ORIGIN / CONSOLE_ORIGIN in Vercel if the apps' addresses change.
const HRM_ORIGIN = (process.env.HRM_ORIGIN || "https://kmr-hrm.vercel.app").replace(/\/+$/, "");
const CONSOLE_ORIGIN = (process.env.CONSOLE_ORIGIN || "https://kmr-console.vercel.app").replace(/\/+$/, "");
// KMR Studio (video maker) runs on the owner's PC and is published by Tailscale Funnel at a fixed https address.
// www.kmr-groups.com/kmr-studio opens it. Set KMR_STUDIO_URL in Vercel (e.g. https://kmr-pc.tail1234.ts.net) and redeploy.
// Until it is set, the address shows a short "not connected yet" page. A redirect (not a proxy) is used on purpose:
// video uploads are far larger than what Vercel can pass through.
const STUDIO_ORIGIN = (process.env.KMR_STUDIO_URL || "").trim().replace(/\/+$/, "");

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" }
    ]
  },
  async rewrites() {
    return {
      // "beforeFiles" so these win over any page of the website
      beforeFiles: [
        { source: "/it/hrm", destination: `${HRM_ORIGIN}/it/hrm` },
        { source: "/it/hrm/:path*", destination: `${HRM_ORIGIN}/it/hrm/:path*` },
        // one link per customer: www.kmr-groups.com/it/app/<customer> → the KMR Apps portal page
        { source: "/it/app/:customer", destination: "/it/apps.html" },
        { source: "/it/console", destination: `${CONSOLE_ORIGIN}/it/console` },
        { source: "/it/console/:path*", destination: `${CONSOLE_ORIGIN}/it/console/:path*` },
        // KMR Studio not connected yet: show the help page at the same address
        ...(STUDIO_ORIGIN ? [] : [
          { source: "/kmr-studio", destination: "/kmr-studio.html" },
          { source: "/kmr-studio/:path*", destination: "/kmr-studio.html" },
        ]),
      ],
    };
  },
  async redirects() {
    return [
      { source: "/it/hrm.html", destination: "/it/hrm", permanent: false },
      { source: "/it/console.html", destination: "/it/console", permanent: false },
      // KMR Studio: www.kmr-groups.com/kmr-studio (and the LinkedIn/X sign-in return /kmr-studio/oauth/callback) → the studio
      ...(STUDIO_ORIGIN ? [
        { source: "/kmr-studio", destination: `${STUDIO_ORIGIN}/`, permanent: false },
        { source: "/kmr-studio/:path*", destination: `${STUDIO_ORIGIN}/:path*`, permanent: false },
      ] : []),
    ];
  },
};
module.exports = nextConfig;
