/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Catppuccin Mocha Palette
        primary: {
          DEFAULT: '#89b4fa',
          hover: '#74c7ec',
        },
        secondary: '#9399b2',
        success: '#a6e3a1',
        warning: '#f9e2af',
        danger: '#f38ba8',
        bg: {
          DEFAULT: '#1e1e2e',
          secondary: '#181825',
          tertiary: '#11111b',
        },
        border: {
          DEFAULT: '#313244',
          light: '#45475a',
        },
        text: {
          DEFAULT: '#cdd6f4',
          secondary: '#c9d1d9',
          tertiary: '#b1bac4',
        },
      },
      borderRadius: {
        'base': '8px',
      },
      boxShadow: {
        // Neobrutalism shadows - offset shadows instead of soft shadows
        'neo': '4px 4px 0px 0px rgba(0, 0, 0, 0.8)',
        'neo-sm': '2px 2px 0px 0px rgba(0, 0, 0, 0.8)',
        'neo-lg': '6px 6px 0px 0px rgba(0, 0, 0, 0.8)',
        'neo-xl': '8px 8px 0px 0px rgba(0, 0, 0, 0.8)',
      },
      borderWidth: {
        'neo': '3px',
      },
    },
  },
  plugins: [],
}
