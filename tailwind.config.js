/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        table: {
          felt: 'var(--color-felt)',
          border: 'var(--color-border)',
          card: 'var(--color-card)',
          accent: 'var(--color-accent)',
        }
      }
    },
  },
  plugins: [],
}
