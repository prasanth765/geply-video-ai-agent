/** @type {import('tailwindcss').Config} */
// god-mode theme — glassmorphic aesthetic with purple→pink gradients
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans:   ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif:  ['"Instrument Serif"', 'Georgia', 'serif'],
        mono:   ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      colors: {
        // Geply brand — purple → pink gradient family
        brand: {
          50:  '#FAF5FF',
          100: '#F3E8FF',
          200: '#E9D5FF',
          300: '#D8B4FE',
          400: '#C084FC',
          500: '#A855F7',
          600: '#9333EA',
          700: '#7E22CE',
          800: '#6B21A8',
          900: '#581C87',
        },
        accent: {
          400: '#F472B6',
          500: '#EC4899',
          600: '#DB2777',
        },
        // Ink background (near-black, never pure #000)
        ink: {
          50:  '#1F1B2E',
          100: '#18142A',
          200: '#14081F',
          300: '#0E0818',
          400: '#08050F',
          500: '#050308',
        },
        // Semantic — readable on dark
        success: '#10B981',
        warning: '#F59E0B',
        danger:  '#EF4444',
        info:    '#3B82F6',
      },
      backgroundImage: {
        'brand-gradient':    'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)',
        'aurora':            'radial-gradient(ellipse at 20% 10%, #2A1055 0%, #14081F 40%, #08050F 100%)',
        'glass-highlight':   'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glow-brand':   '0 0 24px rgba(168, 85, 247, 0.25)',
        'glow-accent':  '0 0 24px rgba(236, 72, 153, 0.20)',
        'glass':        '0 4px 24px rgba(0, 0, 0, 0.4)',
      },
      borderRadius: {
        'xl': '14px',
        '2xl': '20px',
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: '0.5' },
          '50%':      { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}