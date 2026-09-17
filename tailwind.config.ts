import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dce8ff",
          500: "#3b6ef6",
          600: "#2f56d6",
          700: "#2745ad",
          900: "#14245e",
        },
      },
    },
  },
  plugins: [],
};

export default config;
