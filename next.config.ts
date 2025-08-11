import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    // Evita que Webpack intente resolver 'canvas' (dependencia Node-only) requerida indirectamente por pdfjs-dist
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: false as any,
    } as any;
    // En algunos setups, agregar también en fallback ayuda
    // @ts-ignore - webpack typing opcional
    config.resolve.fallback = {
      ...(config.resolve as any).fallback,
      canvas: false,
    };
    return config;
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000', 
        'localhost:9002',
        '*.github.dev',
        '*.gitpod.io',
        '*.repl.co',
        '*.app.github.dev'
      ],
      bodySizeLimit: '2mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  transpilePackages: ['genkit', 'dotprompt'],
};

export default nextConfig;