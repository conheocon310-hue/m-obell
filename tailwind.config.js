/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        serif: ['"Klee One"', 'cursive'],
        mono: ['"JetBrains Mono"', 'monospace'],
        digital: ['"Orbitron"', 'sans-serif'],
      },
      colors: {
        app: {
          dark: '#050505',
          card: 'rgba(20, 20, 25, 0.6)',
        },
        neon: {
          cyan: '#00f3ff',
          magenta: '#ff00ff',
          lime: '#ccff00',
          purple: '#bc13fe',
          amber: '#ffaa00'
        }
      },
      animation: {
        'slide-up': 'slideUp 0.4s cubic-bezier(0, 0, 0.2, 1)',
        'mesh': 'mesh 20s ease infinite',
        'shake': 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both',
        'flash-green': 'flashGreen 0.5s ease-out',
        'flash-red': 'flashRed 0.5s ease-out',
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        mesh: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        shake: {
          '10%, 90%': { transform: 'translate3d(-2px, 0, 0)' },
          '20%, 80%': { transform: 'translate3d(4px, 0, 0)' },
          '30%, 50%, 70%': { transform: 'translate3d(-8px, 0, 0)' },
          '40%, 60%': { transform: 'translate3d(8px, 0, 0)' }
        },
        flashGreen: {
          '0%': { backgroundColor: 'rgba(0, 255, 128, 0.3)' },
          '100%': { backgroundColor: 'transparent' }
        },
        flashRed: {
          '0%': { backgroundColor: 'rgba(255, 0, 60, 0.4)' },
          '100%': { backgroundColor: 'transparent' }
        }
      }
    },
  },
  plugins: [],
}
