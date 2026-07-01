import type { Config } from 'tailwindcss';

// Color tokens match the GLINT wireframe design system.
// To white-label: update the hex values below — every component reads from
// these named tokens, so a palette swap here propagates everywhere.
const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Page backgrounds
        canvas: '#FFFFFF',
        surface: '#FFFFFF',
        'surface-alt': '#FDF6EE',    // warm cream — alternating section bg
        'surface-warm': '#F5E8D4',   // slightly deeper cream — new arrivals section
        'price-bg': '#F7E8C0',       // cream-yellow — price tag background

        // Text
        ink: {
          primary: '#200810',        // near-black
          secondary: '#5E2E18',      // dark brown
          muted: '#9A6040',          // muted warm brown
        },

        // Brand
        brand: {
          primary: '#6B0A1E',        // crimson — buttons, announcement bar, badges
          accent: '#C8922A',         // gold — logo border, nav active underline
          dark: '#7A3828',           // secondary crimson — hover states, footer dividers
        },

        // Feedback
        feedback: {
          success: '#2E7D4F',
          warning: '#B8860C',
          error: '#B3261E',
        },

        // Borders
        border: {
          DEFAULT: '#E4CCA0',        // warm tan — default borders
          strong: '#6B0A1E',         // crimson — active/focus borders
          warm: '#C8A070',           // medium warm — sidebar filter borders
          sale: '#D4B880',           // cart item border
        },

        // Footer
        footer: {
          bg: '#2C0610',             // very dark maroon
          ink: '#F2EAD4',            // warm off-white
          accent: '#C89A40',         // gold-amber — footer secondary text
          muted: '#C09040',          // footer link color
          divider: '#7A3828',        // footer border/divider
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

      letterSpacing: {
        logo: '0.2em',
        wide: '0.08em',
        widest: '0.22em',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
