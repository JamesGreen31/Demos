/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  ...(process.env.NODE_ENV === 'production' ? { basePath: '/Demos' } : {}),
};

export default nextConfig;