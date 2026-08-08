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
          // The same gold, darkened until it is legible *as text* on a light
          // ground. #C8922A on its own 10% tint measures 2.52:1 against a
          // 4.5:1 requirement, so the accent badge was unreadable by the
          // standard NFR-5 commits to. The bright gold stays for borders and
          // rules, where contrast rules do not apply the same way; text uses
          // this. 4.64:1 on the tint, 5.46:1 on white.
          accentDeep: '#88631D',     // gold for text on light backgrounds
          dark: '#7A3828',           // secondary crimson — hover states, footer dividers
        },

        // Feedback
        // Darkened for AA. These are used as text on a 10% tint of themselves
        // (components/ui/badge.tsx), which is the hardest case they face:
        // success measured 4.29:1 and warning 3.62:1 against the 4.5:1 body
        // text requirement, so a status badge — the admin UI's main
        // colour-coded surface — was failing. Found by
        // e2e/accessibility.spec.ts.
        //
        // Chosen as the smallest darkening that clears 4.5:1 with margin, so
        // the palette shifts as little as possible: success 4.71:1, warning
        // 4.65:1 on their own tints. Error already passed at 5.40:1 and is
        // unchanged.
        feedback: {
          success: '#2B764A',
          warning: '#886309',
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
