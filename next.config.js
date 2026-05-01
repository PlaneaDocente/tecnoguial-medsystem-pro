/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },

  webpack: (config) => {
    config.watchOptions = {
      ignored: [
        '**/node_modules',
        '**/.git',
        '**/C:/hiberfil.sys',
        '**/C:/pagefile.sys',
        '**/C:/swapfile.sys',
        '**/C:/System Volume Information'
      ],
    };
    return config;
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // 🔐 CORS (más controlado)
          {
            key: "Access-Control-Allow-Origin",
            value: "*", // luego lo puedes restringir a tu dominio
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },

          // ⚡ rendimiento
          {
            key: "Access-Control-Max-Age",
            value: "86400",
          },

          // 🔐 seguridad mejorada
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN", // antes ALLOWALL (inseguro)
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'",
          },
        ],
      },
    ];
  },

  images: {
    remotePatterns: [
      { hostname: "images.pexels.com" },
      { hostname: "images.unsplash.com" },
      { hostname: "chat2db-cdn.oss-us-west-1.aliyuncs.com" },
      { hostname: "cdn.chat2db-ai.com" },
    ],
  },
};

module.exports = nextConfig;