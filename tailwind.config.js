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
        app: {
          bg: 'var(--color-bg)',
          card: 'var(--color-card)',
          border: 'var(--color-border)',
          primary: 'var(--color-primary)',
          text: 'var(--color-text)',
          muted: 'var(--color-muted)',
          subtle: 'var(--color-subtle)',
        }
      }
    },
  },
  plugins: [],
}
