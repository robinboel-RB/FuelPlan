import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        panel: "#111827",
        panelAlt: "#0f172a",
        border: "#1f2937",
        accent: "#22d3ee",
        success: "#22c55e",
        warning: "#f59e0b",
        danger: "#ef4444"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(34,211,238,0.15), 0 0 24px rgba(34,211,238,0.1)"
      }
    }
  },
  plugins: []
};

export default config;

