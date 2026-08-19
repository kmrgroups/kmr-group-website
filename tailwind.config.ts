import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0B1220",
        "ink-2": "#141F33",
        warehouse: "#F7F4EC",
        paper: "#FCFBF7",
        steel: "#1F3A5F",
        "steel-light": "#3D5A80",
        copper: "#B08D57",
        "copper-light": "#C9A96E",
        slate: "#6B7280",
        "slate-light": "#9CA3AF",
        signal: "#3F7D58",
        line: "#E4E0D4"
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"]
      },
      backgroundImage: {
        blueprint:
          "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)"
      },
      backgroundSize: {
        grid: "34px 34px"
      }
    }
  },
  plugins: []
};
export default config;
