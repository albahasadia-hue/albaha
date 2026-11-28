import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  sassOptions: {
    silenceDeprecations: ['legacy-js-api'],
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/app-mockup',
          destination: '/app-mockup/index.html',
        },
        {
          source: '/mockup',
          destination: '/app-mockup/index.html',
        },
        {
          source: '/public/app-mockup',
          destination: '/app-mockup/index.html',
        },
        {
          source: '/public/app-mockup/index.html',
          destination: '/app-mockup/index.html',
        },
      ],
    };
  },
};

export default nextConfig;
