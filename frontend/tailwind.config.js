/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        debt: '#ef4444',
        income: '#10b981',
        expense: '#f97316',
        transfer: '#3b82f6',
        subscription: '#8b5cf6',
        save: '#06b6d4',
      },
    },
  },
  plugins: [],
}
