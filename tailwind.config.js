/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Catppuccin Light Palette for Neobrutalism
        primary: {
          DEFAULT: '#89b4fa',
          hover: '#6da3e8',
        },
        secondary: '#9399b2',
        success: '#40a02b',
        warning: '#df8e1d',
        danger: '#d20f39',
        bg: {
          DEFAULT: '#ffffff',
          secondary: '#f5f5f5',
          tertiary: '#e8e8e8',
        },
        border: {
          DEFAULT: '#000000',
          light: '#404040',
        },
        text: {
          DEFAULT: '#1a1a1a',
          secondary: '#4a4a4a',
          tertiary: '#6a6a6a',
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
