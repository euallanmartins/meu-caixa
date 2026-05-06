import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    qualities: [60, 65, 75],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
};

export default nextConfig;
