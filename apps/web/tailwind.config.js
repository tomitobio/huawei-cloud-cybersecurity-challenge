/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Restrained enterprise SOC palette
        base: {
          900: '#0a0e17',
          850: '#0d1220',
          800: '#111827',
          700: '#1b2436',
          600: '#28344a',
        },
        accent: {
          DEFAULT: '#e11d48', // Huawei-ish red accent, restrained
          soft: '#fb7185',
          cyan: '#22d3ee',
          emerald: '#34d399',
          amber: '#fbbf24',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
