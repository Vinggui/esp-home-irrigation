import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#2563eb", // Blue-600
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#f1f5f9", // Blue-50
          foreground: "#1e40af", // Blue-800
        },
        destructive: {
          DEFAULT: "#dc2626", // Red-600
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "#f8fafc", // Slate-50
          foreground: "#64748b", // Slate-500
        },
        accent: {
          DEFAULT: "#dbeafe", // Blue-100
          foreground: "#1e40af", // Blue-800
        },
        popover: {
          DEFAULT: "#ffffff",
          foreground: "#0f172a", // Slate-900
        },
        card: {
          DEFAULT: "#ffffff",
          foreground: "#0f172a", // Slate-900
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
