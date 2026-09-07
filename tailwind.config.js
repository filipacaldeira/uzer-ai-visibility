/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg:             'rgb(var(--brand-bg) / <alpha-value>)',
          sidebar:        'rgb(var(--brand-sidebar) / <alpha-value>)',
          card:           'rgb(var(--brand-card) / <alpha-value>)',
          elevated:       'rgb(var(--brand-elevated) / <alpha-value>)',
          primary:        'rgb(var(--brand-primary) / <alpha-value>)',
          'primary-dim':  'rgb(var(--brand-primary-dim) / <alpha-value>)',
          secondary:      'rgb(var(--brand-secondary) / <alpha-value>)',
          tertiary:       'rgb(var(--brand-tertiary) / <alpha-value>)',
          text:           'rgb(var(--brand-text) / <alpha-value>)',
          muted:          'rgb(var(--brand-muted) / <alpha-value>)',
          dim:            'rgb(var(--brand-dim) / <alpha-value>)',
          border:         'rgb(var(--brand-border) / <alpha-value>)',
          'border-bright':'rgb(var(--brand-border-bright) / <alpha-value>)',
          success:        'rgb(var(--brand-success) / <alpha-value>)',
          warning:        'rgb(var(--brand-warning) / <alpha-value>)',
          danger:         'rgb(var(--brand-danger) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '0.9rem' }],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.4)',
        'card-hover': '0 4px 12px rgba(6,182,212,0.15), 0 2px 6px rgba(0,0,0,0.4)',
        glow: '0 0 20px rgba(6,182,212,0.25)',
      },
    },
  },
  plugins: [],
}
