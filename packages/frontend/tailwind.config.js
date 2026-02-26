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
        // Wiz3D Prints brand palette
        primary: {
          50:  '#fff8ed',
          100: '#ffecd1',
          200: '#ffd89e',
          300: '#ffbc60',
          400: '#ff9900',  // wiz-orange-secondary
          500: '#e68a00',  // wiz-orange (main)
          600: '#e68a00',  // same — used as default btn color
          700: '#cc7a00',
          800: '#a66300',
          900: '#663d00',
        },
        iron: {
          950: '#0a0a0a',  // iron-black
          900: '#1a1a1a',  // iron-black-light (footer)
          800: '#2d2d2d',  // steel-grey-dark / card bg
          700: '#3a3a3a',  // steel-grey / card bg light
          600: '#4a4a4a',  // steel-grey-light
          500: '#66666e',  // gentle-silver
          400: '#7a7a7a',
          300: '#8a8a8a',
          200: '#9a9a9a',
          100: '#d1d5db',  // light text
          50:  '#e5e5e5',  // platinum-white (primary text)
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.75rem',
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
    },
  },
  plugins: [],
}
