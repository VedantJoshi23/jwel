import type { Config } from 'tailwindcss';

// Color/radius/font values map 1:1 to DESIGN.md §2 design tokens — keep this
// file and DESIGN.md in sync; this is the Figma-spec-to-code translation point.
const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#FAF6EF',
        surface: '#FFFFFF',
        'surface-alt': '#F3ECDC',
        ink: {
          primary: '#1C0A2E',
          secondary: '#6B5030',
          muted: '#A09060',
        },
        brand: {
          primary: '#1F0A3D',
          accent: '#B8960C',
        },
        feedback: {
          success: '#2E7D4F',
          warning: '#B8860C',
          error: '#B3261E',
        },
        border: {
          DEFAULT: '#D9CEB0',
          strong: '#1F0A3D',
        },
        footer: {
          bg: '#140728',
          ink: '#F2EAD4',
        },
      },
      borderRadius: {
        none: '0px',
        s: '6px',
        m: '14px',
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        sans: ['var(--font-sans)', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,.10)',
        modal: '0 2px 20px rgba(0,0,0,.08)',
      },
      maxWidth: {
        content: '1280px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
