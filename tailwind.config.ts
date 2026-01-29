import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    screens: {
      'xs': '375px',  // Petits mobiles
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1F3B57',
          50: '#E8EDF2',
          100: '#D1DBE5',
          200: '#A3B7CB',
          300: '#7593B1',
          400: '#476F97',
          500: '#1F3B57',
          600: '#1A3249',
          700: '#15283B',
          800: '#101F2D',
          900: '#0B151F',
        },
        accent: {
          DEFAULT: '#F59E0B',
          50: '#FEF3E2',
          100: '#FDE7C5',
          200: '#FBCF8B',
          300: '#F9B751',
          400: '#F7A017',
          500: '#F59E0B',
          600: '#C47F09',
          700: '#936007',
          800: '#624005',
          900: '#312003',
        },
        background: '#F5F7FA',
        foreground: '#0F172A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '0.5rem',    // 8px
        md: '0.75rem',   // 12px
        lg: '1rem',      // 16px (augmenté pour look moderne)
        xl: '1.25rem',   // 20px
        '2xl': '1.5rem', // 24px
        '3xl': '2rem',   // 32px
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)',
        md: '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
        lg: '0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)',
        card: '0 4px 12px rgba(31, 59, 87, 0.1)',
        'card-hover': '0 8px 24px rgba(31, 59, 87, 0.15)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
