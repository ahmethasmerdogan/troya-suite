import type { Config } from "tailwindcss";

// Token kaynağı: docs/DESIGN_SYSTEM.md (tek doğruluk kaynağı).
// Renk/spacing/radius hard-coded değil — hepsi buradan ve index.css'teki CSS değişkenlerinden.
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces
        page: "var(--bg-page)",
        surface: "var(--bg-surface)",
        "surface-alt": "var(--bg-surface-alt)",
        sunken: "var(--bg-sunken)",
        inverse: "var(--bg-inverse)",
        "inverse-alt": "var(--bg-inverse-alt)",
        // Text
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        tertiary: "var(--text-tertiary)",
        disabled: "var(--text-disabled)",
        "on-inverse": "var(--text-on-inverse)",
        "on-inverse-2": "var(--text-on-inverse-2)",
        // Borders
        "border-subtle": "var(--border-subtle)",
        "border-default": "var(--border-default)",
        "border-strong": "var(--border-strong)",
        // Accent (tek primary)
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          pressed: "var(--accent-pressed)",
          soft: "var(--accent-soft)",
        },
        // Yapısal kabuk (rail/topbar koyu alanları — tema-sabit lacivert)
        shell: {
          DEFAULT: "var(--shell-bg)",
          deep: "var(--shell-bg-deep)",
          surface: "var(--shell-surface)",
          hover: "var(--shell-hover)",
          active: "var(--shell-active)",
          border: "var(--shell-border)",
          text: "var(--shell-text)",
          dim: "var(--shell-dim)",
        },
        // Semantic (status pills)
        success: { bg: "var(--success-bg)", text: "var(--success-text)", dot: "var(--success-dot)", border: "var(--success-border)" },
        warning: { bg: "var(--warning-bg)", text: "var(--warning-text)", dot: "var(--warning-dot)", border: "var(--warning-border)" },
        danger: { bg: "var(--danger-bg)", text: "var(--danger-text)", dot: "var(--danger-dot)", border: "var(--danger-border)" },
        info: { bg: "var(--info-bg)", text: "var(--info-text)", dot: "var(--info-dot)", border: "var(--info-border)" },
        neutral: { bg: "var(--neutral-bg)", text: "var(--neutral-text)", border: "var(--neutral-border)" },
      },
      borderColor: {
        DEFAULT: "var(--border-default)",
      },
      fontFamily: {
        // Tek font — tüm sistemde Geist Sans. (mono = sans; ayrı terminal fontu yok.)
        sans: ["Geist Variable", "Geist Sans", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["Geist Variable", "Geist Sans", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "10px",
        md: "12px",
        lg: "16px",
        pill: "9999px",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },
      maxWidth: {
        content: "1440px",
      },
      transitionTimingFunction: {
        emphasized: "cubic-bezier(0.16,1,0.3,1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
