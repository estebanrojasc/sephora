import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
