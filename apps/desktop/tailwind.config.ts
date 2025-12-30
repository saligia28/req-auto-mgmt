import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./renderer/index.html', './renderer/src/**/*.{ts,tsx,jsx,js}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        // Claude 主题
        claude: {
          bg: '#FAF9F7',
          panel: '#FFFFFF',
          border: '#E5E5E5',
          primary: '#D97706',
          secondary: '#92400E',
          text: {
            main: '#1a1a1a',
            dim: '#6b7280',
          },
        },
        // Notion 主题
        notion: {
          bg: '#FFFFFF',
          panel: '#F7F6F3',
          border: '#E5E5E3',
          primary: '#2383E2',
          secondary: '#1D6EC8',
          text: {
            main: '#37352F',
            dim: '#9B9A97',
          },
        },
        // Hacker 主题
        hacker: {
          bg: '#0a0a0a',
          panel: '#111111',
          border: '#2a2a2a',
          primary: '#00ff41',
          secondary: '#008f11',
          alert: '#ff0055',
          text: {
            main: '#f0f0f0',
            dim: '#b0b0b0',
            code: '#00ff41',
          },
        },
      },
      boxShadow: {
        neon: '0 0 5px rgba(0, 255, 65, 0.5), 0 0 10px rgba(0, 255, 65, 0.3)',
        soft: '0 2px 8px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
