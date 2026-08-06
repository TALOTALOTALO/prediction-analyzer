import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#070d1a",
        card: "#0d1627",
        "card-hover": "#111e35",
        "green-bright": "#00dc82",
        "green-dim": "#00dc8218",
        "border-subtle": "rgba(255,255,255,0.07)",
        "text-dim": "rgba(255,255,255,0.55)",
      },
      backgroundImage: {
        "hero-gradient":
          "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,220,130,0.18) 0%, transparent 65%), linear-gradient(180deg, #070d1a 0%, #070d1a 100%)",
        "green-glow":
          "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0,220,130,0.12) 0%, transparent 70%)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
