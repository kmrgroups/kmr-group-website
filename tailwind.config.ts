import type { Config } from "tailwindcss";

// KMR premium corporate palette: deep navy + warm gold on ivory
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#0B1C3A", 950: "#060F22", 900: "#0B1C3A", 800: "#12294F", 700: "#1B3766", 600: "#274A85" },
        gold: { DEFAULT: "#C6A15B", light: "#E3CC94", dark: "#9A7838", pale: "#F6EEDD" },
        ivory: "#FAF7F1",
        sand: "#F2ECE1",
        ink: "#101828",
        muted: "#5E6778",
        line: "#E6DFD1",
        success: "#2F7A55",
        danger: "#B42318",
        // legacy names still used by a few components
        copper: "#C6A15B", "copper-light": "#E3CC94", steel: "#1B3766", slate: "#5E6778", "slate-light": "#98A2B3",
        paper: "#FAF7F1", warehouse: "#F2ECE1", signal: "#2F7A55",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,28,58,.04), 0 8px 24px -12px rgba(11,28,58,.18)",
        lift: "0 2px 4px rgba(11,28,58,.06), 0 24px 48px -20px rgba(11,28,58,.35)",
      },
      keyframes: {
        fadeUp: { "0%": { opacity: "0", transform: "translateY(14px)" }, "100%": { opacity: "1", transform: "none" } },
        kenburns: { "0%": { transform: "scale(1.02)" }, "100%": { transform: "scale(1.1)" } },
      },
      animation: { fadeUp: "fadeUp .8s ease both", kenburns: "kenburns 12s ease-out both" },
    },
  },
  plugins: [],
};
export default config;
