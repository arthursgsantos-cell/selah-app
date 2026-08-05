/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Habilita instrumentation.ts, que fixa o fuso do servidor em Brasília.
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
