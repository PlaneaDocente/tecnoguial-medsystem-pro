/** @type {import('next').NextConfig} */

const isElectronBuild = process.env.ELECTRON_BUILD === 'true';

const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      { hostname: 'images.pexels.com' },
      { hostname: 'images.unsplash.com' },
      { hostname: 'lh3.googleusercontent.com' }, // avatares de Google
    ],
  },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // FIX: Webpack watchOptions robusto para Windows
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.watchOptions = {
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          '**/C:/DumpStack.log.tmp',
          '**/C:/hiberfil.sys',
          '**/C:/pagefile.sys',
          '**/C:/swapfile.sys',
          '**/C:/System Volume Information/**',
        ],
        followSymlinks: false,
        poll: false,
      };
    }
    return config;
  },
};

if (isElectronBuild) {
  nextConfig.output = 'export';
  nextConfig.distDir = 'dist';
  nextConfig.trailingSlash = true;
} else {
  // Headers de seguridad para servidor (Vercel).
  // NOTA: la CSP sigue con 'unsafe-inline' y 'unsafe-eval' en script-src.
  // Es una debilidad conocida que resolveremos en un hardening posterior.
  // Aquí solo agregamos accounts.google.com para que el OAuth funcione.
  nextConfig.headers = async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        {
          key: 'Content-Security-Policy',
          value:
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: blob: https:; " +
            "connect-src 'self' https://*.supabase.co https://*.supabase.in https://accounts.google.com; " +
            "frame-src https://accounts.google.com;",
        },
      ],
    },
  ];
}

module.exports = nextConfig;
