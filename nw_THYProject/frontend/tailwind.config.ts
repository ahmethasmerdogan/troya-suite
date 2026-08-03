import type { Config } from "tailwindcss";

// Tailwind, index.css'teki token'ların adlandırılmış yüzüdür.
// Burada hiçbir ham renk YOKTUR — hepsi CSS değişkenine bağlıdır.
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        panel: "var(--panel)",
        raised: "var(--raised)",
        sunken: "var(--sunken)",

        hair: "var(--hair)",
        line: "var(--line)",
        "line-firm": "var(--line-firm)",

        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",
        "ink-4": "var(--ink-4)",

        brand: {
          DEFAULT: "var(--brand)",
          hover: "var(--brand-hover)",
          active: "var(--brand-active)",
          wash: "var(--brand-wash)",
        },

        inverse: "var(--inverse)",
        "inverse-2": "var(--inverse-2)",
        "on-inverse": "var(--on-inverse)",
        "on-inverse-2": "var(--on-inverse-2)",
      },
      borderColor: { DEFAULT: "var(--line)" },
      borderRadius: {
        sm: "var(--r-sm)",
        DEFAULT: "var(--r-md)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        xl: "var(--r-lg)",
        full: "999px",
        pill: "999px",
      },
      fontFamily: {
        sans: ["Geist Variable", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["Geist Mono Variable", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      spacing: {
        rail: "var(--rail)",
        topbar: "var(--topbar)",
        pane: "var(--pane)",
        control: "var(--control)",
        row: "var(--row)",
      },
      maxWidth: { content: "1400px", prose: "72ch" },
      // Gölge YOK — sistemin kuralı. Tailwind'in varsayılanları da nötrlenir.
      boxShadow: { none: "none", DEFAULT: "none", sm: "none", md: "none", lg: "none", xl: "none" },
      transitionTimingFunction: { out: "cubic-bezier(0.16,1,0.3,1)" },
    },
  },
  plugins: [],
} satisfies Config;
