import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  corePlugins: {
    preflight: false,
    container: false,
  },
  theme: {
    extend: {
      colors: {
        baha: {
          emerald: '#006c35',
          emeraldDeep: '#015a2d',
          royal: '#0A2E5C',
          royalDeep: '#061A33',
          sapphire: '#0B4F6C',
          gold: '#e6b25f',
          cream: '#F5EFE4',
          paper: '#FCFBF7',
        },
      },
      borderRadius: {
        baha: '9px',
      },
      fontFamily: {
        heading: ['Alexandria', 'IBM Plex Sans Arabic', 'Readex Pro', 'sans-serif'],
        body: ['IBM Plex Sans Arabic', 'Readex Pro', 'Alexandria', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
