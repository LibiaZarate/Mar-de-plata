/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"DM Serif Display"', '"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        cream: {
          50: '#FBF7F0',
          100: '#F6F0E4',
          200: '#EFE6D3',
        },
        ink: {
          DEFAULT: '#2B2620',
          soft: '#4A423A',
          mute: '#8A7F72',
        },
        rosey: {
          50: '#F8E4E0',
          100: '#F4D2D6',
          200: '#EDB5C0',
          300: '#E098A8',
          400: '#C97A8B',
        },
        sage: {
          100: '#D8E5D2',
          200: '#B9CFAF',
          300: '#8FAE82',
        },
        skyy: {
          100: '#D4E0EE',
          200: '#B6CADF',
          300: '#88A6C8',
        },
        ambr: {
          100: '#F5DCB1',
          200: '#EBC487',
          300: '#D9A05B',
        },
        lila: {
          100: '#DCD2EA',
          200: '#BFAFD9',
          300: '#9482BC',
        },
      },
      boxShadow: {
        soft: '0 1px 0 rgba(43,38,32,0.08)',
      },
    },
  },
  plugins: [],
};
