/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#0a0e1a",
        foreground: "#f9fafb",
        card: "rgba(31, 41, 55, 0.6)",
        border: "rgba(255, 255, 255, 0.1)",
        muted: "#1f2937",
        "muted-foreground": "#9ca3af",
        primary: {
          DEFAULT: "#3b82f6",
          foreground: "#0a0e1a",
        },
        secondary: {
          DEFAULT: "#1f2937",
          foreground: "#f9fafb",
        },
        destructive: {
          DEFAULT: "#ef4444",
          foreground: "#f9fafb",
        },
        success: "#10b981",
        warning: "#f59e0b",
        electric: {
          DEFAULT: "#3b82f6",
          soft: "#60a5fa",
        },
        purple: {
          DEFAULT: "#8b5cf6",
          soft: "#a78bfa",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Space Grotesk"', "Inter", "sans-serif"],
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #3b82f6, #8b5cf6)",
        "gradient-text":
          "linear-gradient(135deg, #60a5fa 0%, #8b5cf6 50%, #6366f1 100%)",
        "gradient-hero-bg":
          "radial-gradient(ellipse at top, rgba(48, 60, 130, 0.5), transparent 60%), radial-gradient(ellipse at bottom right, rgba(80, 50, 160, 0.35), transparent 60%)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0) translateX(0)" },
          "50%": { transform: "translateY(-20px) translateX(8px)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 30px -6px rgba(59, 130, 246, 0.6)" },
          "50%": {
            boxShadow:
              "0 0 60px -4px rgba(59, 130, 246, 0.9), 0 0 100px -20px rgba(139, 92, 246, 0.6)",
          },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        dash: {
          to: { strokeDashoffset: "-20" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "float-slow": "float-slow 9s ease-in-out infinite",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        "fade-up": "fade-up 0.8s ease-out both",
        dash: "dash 1.5s linear infinite",
      },
    },
  },
  plugins: [],
};
