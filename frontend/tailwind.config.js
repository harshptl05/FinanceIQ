/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'InterVariable',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'SF Mono',
          'Menlo',
          'monospace',
        ],
      },
      colors: {
        // Deep, slightly blue-tinted dark canvas
        ink: {
          950: '#05070d',
          900: '#0a0e17',
          850: '#0e1320',
          800: '#131a2a',
          700: '#1c2438',
          600: '#283046',
          500: '#3a425c',
          400: '#5c6582',
        },
        // Primary brand: emerald with electric edge
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        // Accent palette for stats / charts / glow
        accent: {
          violet: '#8b5cf6',
          cyan: '#22d3ee',
          amber: '#f59e0b',
          rose: '#f43f5e',
          sky: '#38bdf8',
        },
      },
      backgroundImage: {
        'grid-faint': "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
        'mesh-hero': "radial-gradient(at 18% 20%, rgba(16,185,129,0.18) 0px, transparent 55%), radial-gradient(at 82% 12%, rgba(139,92,246,0.16) 0px, transparent 50%), radial-gradient(at 65% 95%, rgba(34,211,238,0.10) 0px, transparent 60%)",
        'mesh-app': "radial-gradient(at 0% 0%, rgba(16,185,129,0.10) 0px, transparent 45%), radial-gradient(at 100% 0%, rgba(139,92,246,0.08) 0px, transparent 45%), radial-gradient(at 100% 100%, rgba(34,211,238,0.06) 0px, transparent 50%)",
      },
      backgroundSize: {
        'grid-32': '32px 32px',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(16,185,129,0.4), 0 0 24px -2px rgba(16,185,129,0.35)',
        'glow-violet': '0 0 0 1px rgba(139,92,246,0.4), 0 0 24px -2px rgba(139,92,246,0.30)',
        'glass': '0 1px 0 0 rgba(255,255,255,0.06) inset, 0 8px 24px -10px rgba(0,0,0,0.5)',
        'card': '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(255,255,255,0.04)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      animation: {
        'shimmer': 'shimmer 2.4s linear infinite',
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: 0.6 },
          '50%': { opacity: 1 },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
    },
  },
  plugins: [],
}
