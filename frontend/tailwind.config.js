/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Основные цвета тёмной темы
        dark: {
          950: '#030305',
          900: '#0a0a0f',
          850: '#0d0d14',
          800: '#111118',
          750: '#15151e',
          700: '#1a1a24',
          600: '#22222f',
          500: '#2a2a3a',
          400: '#3a3a4d',
          300: '#4a4a60',
        },
        // Акцентные цвета
        accent: {
          purple: '#8b5cf6',
          violet: '#7c3aed',
          indigo: '#6366f1',
          blue: '#3b82f6',
          cyan: '#06b6d4',
        },
        // Градиенты
        gradient: {
          start: '#8b5cf6',
          middle: '#6366f1',
          end: '#3b82f6',
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-card': 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.05) 50%, transparent 100%)',
        'gradient-card-purple': 'linear-gradient(135deg, rgba(139, 92, 246, 0.4) 0%, rgba(99, 102, 241, 0.2) 50%, rgba(59, 130, 246, 0.1) 100%)',
        'gradient-sidebar': 'linear-gradient(180deg, #0d0d14 0%, #0a0a0f 100%)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(139, 92, 246, 0.3)',
        'glow-sm': '0 0 10px rgba(139, 92, 246, 0.2)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 8px 32px rgba(0, 0, 0, 0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(139, 92, 246, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)' },
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
