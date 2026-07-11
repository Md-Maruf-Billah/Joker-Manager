import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // PlayLive brand palette (official brand guidelines)
        brand: {
          red: "#EC1E24",
          redDark: "#B0221F",
          danger: "#C4141A",
          burgundy: "#7C0917",
          green: "#034C2A",
          teal: "#144B64",
          gold: "#C69D42",
          black: "#000000",
          gray: "#D6D6D6"
        },
        // Staff app (light, Apple system-gray inspired)
        ink: "#1d1d1f",
        inksoft: "#48484a",
        muted: "#6e6e73",
        faint: "#8e8e93",
        surface: "#F5F5F7",
        card: "#FFFFFF",
        field: "#F5F5F6",
        jackpot: "#96721D",
        success: "#1F8A4F",
        // TV display (dark, tier-themed)
        tv: {
          bg: "#0a0a0b",
          fresh: "#D9B15B",
          building: "#49B57C",
          hot: "#EC1E24",
          probability: "#E8C245",
          danger: "#FF4141",
          celebration: "#FFD666",
          message: "#C69D42"
        }
      },
      fontFamily: {
        sans: ["Montserrat", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        display: ["Montserrat", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"]
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.03)",
        panel: "0 24px 50px rgba(0,0,0,0.08)",
        toast: "0 20px 40px rgba(0,0,0,0.14)"
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-300px 0" },
          "100%": { backgroundPosition: "300px 0" }
        },
        glowPulse: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" }
        },
        livePulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" }
        }
      },
      animation: {
        shimmer: "shimmer 1.4s infinite linear",
        glowPulse: "glowPulse 2.8s ease-in-out infinite",
        livePulse: "livePulse 1.6s ease-in-out infinite"
      }
    }
  },
  plugins: []
} satisfies Config;
