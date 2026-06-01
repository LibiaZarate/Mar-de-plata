import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1440px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // Paleta semántica del wireframe (cream / rose / sage / ambr / sky / lila)
        cream: {
          50: "#FBF7F0",
          100: "#F6F0E4",
          200: "#EFE6D3",
        },
        rosey: {
          50: "#FBE9EC",
          100: "#F4D2D6",
          200: "#EDB5C0",
          300: "#E098A8",
          400: "#C97A8B",
          500: "#A65265",
        },
        sage: {
          50: "#EDF3EA",
          100: "#D8E5D2",
          200: "#B9CFAF",
          300: "#8FAE82",
          400: "#6E9362",
          500: "#4E7045",
          600: "#3B5734",
        },
        skyy: {
          50: "#E7EFF9",
          100: "#D4E0EE",
          200: "#B6CADF",
          300: "#88A6C8",
          400: "#5E84AC",
          500: "#3E608A",
          600: "#2E486A",
        },
        ambr: {
          50: "#FAEFD7",
          100: "#F5DCB1",
          200: "#EBC487",
          300: "#D9A05B",
          400: "#BF7F34",
          500: "#8E5A21",
          600: "#6E4318",
        },
        lila: {
          50: "#EBE4F4",
          100: "#DCD2EA",
          200: "#BFAFD9",
          300: "#9482BC",
          400: "#6F5DA0",
          500: "#544478",
          600: "#3E3258",
        },

        // Canales (alias)
        meta: "#88A6C8",
        tiktok: "#9482BC",
        grupo: "#8FAE82",
        recurrente: "#D9A05B",
        organico: "#A09588",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ['"DM Serif Display"', '"Cormorant Garamond"', "Georgia", "serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
