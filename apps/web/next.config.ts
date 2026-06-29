import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['mammoth', 'pdfjs-dist'],
  experimental: {
    middlewareClientMaxBodySize: 73400320, // 70MB
  },
};

export default nextConfig;
