/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Monocraft pixel font is the app-wide typeface (declared in index.css).
        mono: ['Monocraft', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      // Squared-off corners everywhere, to match the pixel-font look.
      // `full` is deliberately left circular so loading spinners stay rings
      // (a square spinner with a spinning border reads as broken) and the
      // avatar badge stays a circle. Use `rounded-none` to square those too.
      borderRadius: {
        none: '0',
        sm: '0',
        DEFAULT: '0',
        md: '0',
        lg: '0',
        xl: '0',
        '2xl': '0',
        '3xl': '0',
        full: '9999px',
      },
      colors: {
        // Green-tinted "slate" scale for the dark mint theme.
        // Heatmap + chart data colors deliberately use green/lime/yellow/
        // orange/red and are left untouched so performance meaning is preserved.
        slate: {
          50: '#EAFBF3',
          100: '#DBF3E6',
          200: '#D9FFF8',
          300: '#C4F4C7',
          400: '#9BB291',
          500: '#5E7461',
          600: '#35503F',
          700: '#22402F',
          800: '#152B20',
          900: '#0D1D15',
          950: '#08130D',
        },
        // Warm gold accent (was amber).
        amber: {
          300: '#E8C888',
          400: '#D9AE63',
          500: '#C8963E',
          600: '#B0822F',
          700: '#7A5A26',
        },
      },
    },
  },
  plugins: [],
}
