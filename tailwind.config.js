/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        // 背景
        "bg-base": "var(--bg-base-default)",
        "bg-surface": "var(--bg-base-secondary)",
        "bg-tertiary": "var(--bg-base-tertiary)",
        "bg-menu": "var(--bg-menu)",
        // 品牌
        brand: {
          DEFAULT: "var(--bg-brand)",
          hover: "var(--bg-brand-hover)",
          soft: "var(--bg-brand-popup)",
        },
        // 文本
        "text-default": "var(--text-default)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
        "text-onbrand": "var(--text-onbrand)",
        // 状态
        "status-online": "var(--status-primary-default)",
        "status-error": "var(--status-error-default)",
        // 头像配色
        violet: "var(--accent-violet)",
        coral: "var(--accent-coral)",
        amber: "var(--accent-amber)",
        cyan: "var(--accent-cyan)",
        teal: "var(--accent-teal)",
        // 边框
        border: {
          neutral: "var(--border-neutral-l1)",
          "neutral-2": "var(--border-neutral-l2)",
          brand: "var(--border-brand)",
          error: "var(--border-error)",
        },
      },
      fontFamily: {
        sans: ['"SF Pro Text"', "system-ui", "-apple-system", "sans-serif"],
        heading: ['"SF Pro"', "system-ui", "-apple-system", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      borderRadius: {
        DEFAULT: "var(--radius-6)",
      },
      boxShadow: {
        menu: "0 8px 24px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};
