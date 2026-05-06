import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-roboto)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Map SSI theme tokens to Tailwind utilities (consumed via bg-surface, text-primary, etc.)
        surface: {
          primary: 'var(--color-theme-primary)',
          secondary: 'var(--color-theme-secondary)',
          tertiary: 'var(--color-theme-tertiary)',
        },
        text: {
          primary: 'var(--color-theme-text-primary)',
          secondary: 'var(--color-theme-text-secondary)',
          tertiary: 'var(--color-theme-text-tertiary)',
        },
        border: {
          DEFAULT: 'var(--color-theme-charcoal)',
          subtle: 'var(--color-theme-input-border)',
        },
        crimson: 'var(--color-theme-crimson)',
        buy: 'var(--color-theme-buy)',
        sell: 'var(--color-theme-sell)',
        ssi: {
          up: 'var(--ssi-up)',
          down: 'var(--ssi-down)',
          ref: 'var(--ssi-ref)',
          ceil: 'var(--ssi-ceil)',
          floor: 'var(--ssi-floor)',
          stable: 'var(--ssi-stable)',
        },
      },
      borderRadius: {
        sm: '0.125rem',
        md: '0.25rem',
        lg: '0.5rem',
      },
      fontSize: {
        '3xs': ['0.625rem', { lineHeight: '1rem' }],
        '2xs': ['0.688rem', { lineHeight: '1rem' }],
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.813rem', { lineHeight: '1.125rem' }],
        base: ['0.875rem', { lineHeight: '1.25rem' }],
        md: ['0.938rem', { lineHeight: '1.25rem' }],
        lg: ['1.125rem', { lineHeight: '1.5rem' }],
        xl: ['1.25rem', { lineHeight: '1.5rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
      },
    },
  },
  plugins: [],
};

export default config;
