/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/webview/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Shepherd Design System - Primary Accent
        primary: {
          DEFAULT: '#3A6F74',
          hover: '#2D5A5E',
        },
        // Shepherd Neutrals
        neutral: {
          0: '#FFFFFF',
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
        // Shepherd Semantic Colors
        success: '#059669',
        warning: '#D97706',
        danger: '#DC2626',
        // VS Code fallback colors (for sidebar integration)
        'vscode-bg': 'var(--vscode-editor-background)',
        'vscode-fg': 'var(--vscode-editor-foreground)',
        'vscode-border': 'var(--vscode-panel-border)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        drag: '0 4px 12px rgb(0 0 0 / 0.1)',
      },
      transitionDuration: {
        DEFAULT: '150ms',
        fast: '150ms',
        normal: '200ms',
      },
    },
  },
  plugins: [],
};
