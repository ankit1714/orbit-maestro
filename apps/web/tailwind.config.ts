import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#e8f0fe',
          100: '#d2e3fc',
          200: '#aecbfa',
          300: '#8ab4f8',
          400: '#669df6',
          500: '#4285f4',
          600: '#1a73e8', // Signature Google Blue
          700: '#185abc',
          800: '#174ea6',
          900: '#1557b0', // Google Blue hover
        },
        google: {
          blue: '#1a73e8',
          blueHover: '#1557b0',
          blueLight: '#e8f0fe',
          blueBorder: '#d2e3fc',
          blueText: '#174ea6',
          green: '#137333',
          greenBg: '#e6f4ea',
          greenBorder: '#ceead6',
          yellow: '#b06000',
          yellowBg: '#fef7e0',
          yellowBorder: '#feefc3',
          red: '#c5221f',
          redBg: '#fce8e6',
          redBorder: '#fad2cf',
          gray: '#5f6368',
          grayLight: '#f1f3f4',
          grayHover: '#e8eaed',
          border: '#dadce0',
          dark: '#202124',
        },
        surface: {
          50: '#ffffff',
          100: '#f8f9fa',
          150: '#f1f3f4',
          200: '#e8eaed',
          300: '#dadce0',
          400: '#bdc1c6',
          500: '#80868b',
          600: '#5f6368',
          700: '#3c4043',
          800: '#202124',
          850: '#1f2328',
          900: '#ffffff', // Cards/panels in light mode
          950: '#f8f9fa', // Background canvas in light mode
        },
        zinc: {
          50: '#ffffff',
          100: '#f8f9fa',
          200: '#f1f3f4',
          300: '#e8eaed',
          400: '#dadce0',
          500: '#80868b',
          600: '#5f6368',
          700: '#3c4043',
          800: '#202124',
          850: '#1f2328',
          900: '#ffffff',
          950: '#f8f9fa',
        }
      },
      boxShadow: {
        'google-sm': '0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)',
        'google': '0 1px 3px 0 rgba(60,64,67,0.2), 0 4px 8px 3px rgba(60,64,67,0.1)',
        'google-md': '0 1px 3px 0 rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)',
        'google-lg': '0 2px 6px 2px rgba(60,64,67,0.15), 0 1px 2px 0 rgba(60,64,67,0.3)',
      },
      fontFamily: {
        sans: ['Google Sans', 'Inter', 'Roboto', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
};

export default config;
