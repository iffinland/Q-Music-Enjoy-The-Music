/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'qm-ink': '#E4F0FF',
        'qm-ink-muted': '#9CC4EB',
        'qm-primary': '#38BDF8',
        'qm-primary-strong': '#0EA5E9',
        'qm-primary-soft': 'rgba(56, 189, 248, 0.14)',
        'qm-accent': '#F472B6',
        'qm-surface': '#030B17',
        'qm-surface-100': '#061126',
        'qm-surface-200': '#0B1C34',
        'qm-surface-300': '#10223F',
        'qm-border': '#15345C',
        'qm-border-strong': '#1F4374',
        'qm-success': '#34D399',
        'qm-warning': '#FBBF24',
        'qm-error': '#FB7185',
      },
      fontFamily: {
        sans: ['Figtree', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'qm-card': '0 15px 35px rgba(2, 12, 28, 0.55)',
        'qm-soft': '0 10px 20px rgba(12, 74, 110, 0.25)',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
        'pill': '999px',
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
}
