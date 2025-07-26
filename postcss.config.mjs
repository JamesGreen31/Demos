/**
 * PostCSS configuration. We only load TailwindCSS as a plugin which allows the
 * `@tailwind` directives in our CSS to be processed during build.
 */
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
  },
};

export default config;
