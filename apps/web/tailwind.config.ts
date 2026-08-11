import type { Config } from 'tailwindcss';

/**
 * Colour tokens are indirect: every name below resolves to a CSS custom
 * property defined in `app/globals.css`'s `:root`, not to a literal hex.
 *
 * The variables hold **raw channels** (`200 146 42`), not `#C8922A`, and the
 * values below wrap them with `<alpha-value>`. That is load-bearing: this
 * codebase uses Tailwind opacity modifiers heavily (`bg-brand-accent/10`,
 * `bg-brand-primary/5`, `hover:bg-feedback-error/90`). A `var(--x)` holding a
 * finished colour cannot take an alpha modifier, and every one of those
 * utilities would silently stop applying opacity.
 *
 * A second, dark "Aurora" palette lived behind a `[data-theme='aurora']`
 * block here, switchable at runtime — evaluated live and removed by explicit
 * decision (`ADR-0020`). The indirection stayed: it's what makes a
 * white-label palette swap a `globals.css` edit rather than a grep across
 * every component, independent of whether a second theme exists.
 *
 * To white-label: edit the `:root` palette in `app/globals.css`.
 */
const channel = (name: string) => `rgb(var(--color-${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Page backgrounds
        canvas: channel('canvas'),
        surface: channel('surface'),
        'surface-alt': channel('surface-alt'),
        'surface-warm': channel('surface-warm'),
        'surface-band': channel('surface-band'),
        'price-bg': channel('price-bg'),

        // Text
        ink: {
          primary: channel('ink-primary'),
          secondary: channel('ink-secondary'),
          muted: channel('ink-muted'),
        },

        // Brand
        brand: {
          primary: channel('brand-primary'),
          // The crimson in its *foreground* role — text, icons, outline
          // borders — as opposed to `primary`, which is a fill that carries
          // white text. On the classic ivory ground the two are the same
          // colour and this is a pure rename; on a dark ground they cannot be,
          // and the arithmetic says so: no single value clears 4.5:1 both
          // against white *and* against a near-black surface. Exactly the
          // split `accentDeep` already makes for gold, in the other direction.
          ink: channel('brand-ink'),
          accent: channel('brand-accent'),
          // The accent darkened until it is legible *as text* on a light
          // ground — the bright accent stays for borders and rules, where the
          // contrast requirement does not apply the same way.
          accentDeep: channel('brand-accent-deep'),
          dark: channel('brand-dark'),
        },

        // Feedback
        feedback: {
          success: channel('feedback-success'),
          warning: channel('feedback-warning'),
          error: channel('feedback-error'),
        },

        // Borders
        border: {
          DEFAULT: channel('border'),
          strong: channel('border-strong'),
          warm: channel('border-warm'),
          sale: channel('border-sale'),
        },

        // Footer
        footer: {
          bg: channel('footer-bg'),
          ink: channel('footer-ink'),
          accent: channel('footer-accent'),
          muted: channel('footer-muted'),
          divider: channel('footer-divider'),
        },
      },

      // `s`/`m` bumped and `l` added under ADR-0019 — "buttons are boxy"
      // was a fair read of 6px on a brand whose whole pitch is that
      // affordable doesn't mean cut-rate. Product photography frames stay at
      // `none` on purpose (DESIGN.md §2.4: luxury references avoid rounded
      // photo frames) — the roundness lives in the controls around the
      // imagery, not the imagery itself. `rounded-full` (buttons, inputs,
      // badges, the search bar) is Tailwind's built-in 9999px and needs no
      // token here.
      borderRadius: {
        none: '0px',
        s: '10px',
        m: '18px',
        l: '28px',
      },

      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        sans: ['var(--font-sans)', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },

      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,.10)',
        modal: '0 2px 20px rgba(0,0,0,.08)',
        // Glass surfaces sit *above* their background rather than on it, so
        // they carry a deeper, softer shadow than the flat card does. Bigger
        // surface reads as thicker material.
        glass: '0 8px 32px rgba(0,0,0,.38)',
        'glass-lg': '0 20px 60px rgba(0,0,0,.5)',
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
