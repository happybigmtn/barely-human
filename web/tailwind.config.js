/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        casino: {
          dark: '#0a0a0a',
          darker: '#050505',
          red: '#dc2626',
          green: '#16a34a',
          gold: '#fbbf24',
          purple: '#9333ea',
          cyan: '#06b6d4',
          orange: '#ea580c',
          pink: '#ec4899',
          blue: '#2563eb',
        },
        neon: {
          red: '#ff073a',
          green: '#39ff14',
          blue: '#00bfff',
          purple: '#bf00ff',
          yellow: '#ffff00',
          pink: '#ff1493',
          cyan: '#00ffff',
          orange: '#ff8c00',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Orbitron', 'sans-serif'],
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'dice-roll': 'dice-roll 0.6s ease-in-out',
        'neon-flicker': 'neon-flicker 1.5s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(255, 7, 58, 0.8)' },
          '100%': { boxShadow: '0 0 30px rgba(255, 7, 58, 1), 0 0 40px rgba(255, 7, 58, 0.5)' },
        },
        'dice-roll': {
          '0%': { transform: 'rotate(0deg) scale(1)' },
          '50%': { transform: 'rotate(180deg) scale(1.2)' },
          '100%': { transform: 'rotate(360deg) scale(1)' },
        },
        'neon-flicker': {
          '0%, 100%': { 
            textShadow: '0 0 5px currentColor, 0 0 10px currentColor, 0 0 15px currentColor',
          },
          '50%': { 
            textShadow: '0 0 2px currentColor, 0 0 5px currentColor, 0 0 8px currentColor',
          },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'casino-felt': 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      },
    },
  },
  plugins: [],
};