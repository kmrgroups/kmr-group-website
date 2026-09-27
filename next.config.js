/** @type {import('next').NextConfig} */

// KMR software products run as their own apps and are shown under www.kmr-groups.com/it/…
// Visitors only ever see www.kmr-groups.com. Set HRM_ORIGIN / CONSOLE_ORIGIN in Vercel if the apps' addresses change.
const HRM_ORIGIN = (process.env.HRM_ORIGIN || "https://kmr-hrm.vercel.app").replace(/\/+$/, "");
const CONSOLE_ORIGIN = (process.env.CONSOLE_ORIGIN || "https://kmr-console.vercel.app").replace(/\/+$/, "");

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
        { source: "/it/console", destination: `${CONSOLE_ORIGIN}/it/console` },
        { source: "/it/console/:path*", destination: `${CONSOLE_ORIGIN}/it/console/:path*` },
      ],
    };
  },
  async redirects() {
    return [
      { source: "/it/hrm.html", destination: "/it/hrm", permanent: false },
      { source: "/it/console.html", destination: "/it/console", permanent: false },
    ];
  },
};
module.exports = nextConfig;
