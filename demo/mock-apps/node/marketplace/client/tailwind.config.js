/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        neon: {
          cyan: '#06B6D4',
          purple: '#A855F7',
          pink: '#EC4899',
          'dark-nav': '#0F172A',
        },
      },
    },
  },
  plugins: [],
};
