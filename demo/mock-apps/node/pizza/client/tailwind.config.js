/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#DC2626',
          amber: '#F59E0B',
          'dark-nav': '#1C1917',
        },
      },
    },
  },
  plugins: [],
};
