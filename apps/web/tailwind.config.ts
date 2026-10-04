import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#080808',
        panel: '#10100f',
        panelSoft: '#151412',
        line: '#4b3615',
        skybrand: '#e3aa3a',
        violetbrand: '#0b79ff',
        pinkbrand: '#0b79ff',
        mintbrand: '#e3aa3a',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(227,170,58,.30), 0 16px 45px rgba(0,0,0,.28)',
      },
      borderRadius: {
        card: '22px',
      },
    },
  },
  plugins: [],
};

export default config;
