import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        graphite: "#F4F2EC",
        torch: "#B7F54A",
        steel: "#66707A",
        obsidian: "#171A1F",
        moss: "#FFFFFF",
        acid: "#B7F54A",
        brass: "#B7F54A",
        sage: "#34C759",
        ember: "#F59E0B",
        card: "#FFFFFF",
        "card-soft": "#F3F1EA",
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
