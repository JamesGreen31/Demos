/**
 * Configuration for the Next.js application.
 *
 * - `output: 'export'` instructs Next.js to generate a static export of the
 *   site when running `next build`.
 * - `reactStrictMode` enables additional checks and warnings during
 *   development.
 * - When building for production the app is served from the `/Demos` base
 *   path so all routes are prefixed accordingly.
 */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  ...(process.env.NODE_ENV === 'production' ? { basePath: '/Demos' } : {}),
};

export default nextConfig;