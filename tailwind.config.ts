import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        graphite: "#F4F2EC",
        torch: "#7BAE24",
        steel: "#66707A",
        obsidian: "#171A1F",
        moss: "#FFFFFF",
        acid: "#7BAE24",
        brass: "#7BAE24",
        sage: "#5F8F1F",
        ember: "#F59E0B",
        card: "#FFFFFF",
        "card-soft": "#F2F0EA",
        "text-primary": "#171A1F",
        "text-secondary": "#66707A"
      },
      boxShadow: {
        panel: "0 12px 32px rgba(0, 0, 0, 0.18)"
      }
    }
  },
  plugins: []
};

export default config;
