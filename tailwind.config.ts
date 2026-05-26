import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#EC8223',
          blue: '#3B8DBC',
          green: '#7DA842',
        },
        ink: {
          900: '#1F2937',
          700: '#4B5563',
          500: '#6B7280',
          400: '#9CA3AF',
        },
        bg: {
          card: '#FFFFFF',
          muted: '#F9FAFB',
          subtle: '#F3F4F6',
          warm: '#FAF7F2',
        },
        line: '#E5E7EB',
        danger: '#D65046',
        status: {
          planning:  { bg: '#F3F4F6', fg: '#9CA3AF', ring: '#D1D5DB' },
          production:{ bg: '#FEF1E4', fg: '#EC8223', ring: '#F5B878' },
          review:    { bg: '#E4F0F7', fg: '#3B8DBC', ring: '#8DB9D5' },
          done:      { bg: '#EDF3E0', fg: '#7DA842', ring: '#B1C884' },
          frozen:    { bg: '#E5E7EB', fg: '#6B7280', ring: '#9CA3AF' },
        },
      },
      fontFamily: {
        sans: ['Heebo', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(17,24,39,0.06), 0 1px 2px rgba(17,24,39,0.04)',
        pop:  '0 12px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
} satisfies Config;
