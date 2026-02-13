/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fff8ed',
          100: '#ffecd1',
          200: '#ffd89e',
          300: '#ffbc60',
          400: '#ff9900',
          500: '#e68a00',
          600: '#cc7a00',
          700: '#a66300',
          800: '#804d00',
          900: '#663d00',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
