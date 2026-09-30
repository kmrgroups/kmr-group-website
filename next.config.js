/** @type {import('next').NextConfig} */

// KMR software products run as their own apps and are shown under www.kmr-groups.com/it/…
// Visitors only ever see www.kmr-groups.com. Set HRM_ORIGIN / CONSOLE_ORIGIN in Vercel if the apps' addresses change.
const HRM_ORIGIN = (process.env.HRM_ORIGIN || "https://kmr-hrm.vercel.app").replace(/\/+$/, "");
const CONSOLE_ORIGIN = (process.env.CONSOLE_ORIGIN || "https://kmr-console.vercel.app").replace(/\/+$/, "");

// Security headers for every page (no strict Content-Security-Policy: Razorpay checkout, Google Maps and fonts load from other sites)
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://checkout.razorpay.com\" \"https://api.razorpay.com\")" },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/((?!it/).*)", headers: SECURITY_HEADERS }];
  },
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
      ],
    };
  },
  async redirects() {
    return [
      { source: "/it/hrm.html", destination: "/it/hrm", permanent: false },
      { source: "/it/console.html", destination: "/it/console", permanent: false },
      // older addresses of the website
      { source: "/verticals", destination: "/businesses", permanent: true },
      { source: "/products", destination: "/shop", permanent: true },
      { source: "/legal/:slug", destination: "/policies/:slug", permanent: true },
      { source: "/admin/:path*", destination: "/", permanent: false },
    ];
  },
};
module.exports = nextConfig;
