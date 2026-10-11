/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0a0f1d',
        surface: '#111827',
        surfaceMuted: '#1f2937',
        border: '#374151',
        primary: {
          DEFAULT: '#06b6d4',
          hover: '#0891b2',
          foreground: '#042f2e'
        },
        accent: {
          blue: '#3b82f6',
          cyan: '#06b6d4',
          green: '#10b981',
          red: '#ef4444',
          amber: '#f59e0b'
        }
      }
    },
  },
  plugins: [],
}
