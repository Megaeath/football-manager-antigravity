import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  productionBrowserSourceMaps: true, 
  experimental: {
    serverSourceMaps: true, // ตัวนี้สำคัญมากเพื่อให้เห็นชื่อฟังก์ชันใน Node.js
  },
};

export default nextConfig;
