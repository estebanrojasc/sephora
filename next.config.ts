import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Router cache del cliente: no reutilizar segmentos RSC obsoletos en admin.
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 30,
    },
  },
  // Evita 304 en páginas admin (RSC segments cacheados en Vercel).
  async headers() {
    return [
      {
        source: "/admin/:path*",
        headers: [
          {
            key: "Cache-Control",
            value:
              "private, no-store, no-cache, must-revalidate, max-age=0, s-maxage=0",
          },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Vercel-CDN-Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/api/bitacora/:path*",
        headers: [
          {
            key: "Cache-Control",
            value:
              "private, no-store, no-cache, must-revalidate, max-age=0, s-maxage=0",
          },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Vercel-CDN-Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/api/records/:path*",
        headers: [
          {
            key: "Cache-Control",
            value:
              "private, no-store, no-cache, must-revalidate, max-age=0, s-maxage=0",
          },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Vercel-CDN-Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
  // Permite que recursos del dev server (incluido /_next/webpack-hmr)
  // sean alcanzados desde orígenes distintos a localhost. Necesario cuando
  // exponemos el dev server vía Cloudflare Quick Tunnel o desde la LAN.
  // Doc: node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/allowedDevOrigins.md
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "192.168.100.41",
    "localhost",
  ],
  outputFileTracingIncludes: {
    "/api/records/[id]/excel": ["./templates/RUTA CFT-ABL -2026.xlsx"],
  },
};

export default nextConfig;
