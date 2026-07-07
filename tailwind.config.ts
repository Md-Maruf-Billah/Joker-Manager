import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        felt: {
          950: "oklch(16% 0.018 150)",
          900: "oklch(20% 0.02 150)",
          850: "oklch(23% 0.022 150)",
          800: "oklch(27% 0.024 150)"
        },
        ink: "oklch(17% 0.01 72)",
        paper: "oklch(93% 0.012 78)",
        muted: "oklch(73% 0.026 80)",
        gold: {
          300: "oklch(84% 0.13 86)",
          400: "oklch(77% 0.15 82)",
          500: "oklch(70% 0.16 78)",
          600: "oklch(61% 0.14 73)"
        },
        joker: {
          green: "oklch(70% 0.18 153)",
          purple: "oklch(66% 0.16 306)",
          red: "oklch(63% 0.17 26)"
        }
      },
      boxShadow: {
        glow: "0 0 40px color-mix(in oklch, oklch(77% 0.15 82), transparent 72%)",
        panel: "0 22px 70px color-mix(in oklch, oklch(9% 0.02 150), transparent 44%)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
        display: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"]
      }
    }
  },
  plugins: []
} satisfies Config;

