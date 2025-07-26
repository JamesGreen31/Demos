/**
 * TailwindCSS configuration specifying which files should be scanned for class
 * names and defining a small set of custom theme extensions.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  // Paths to all template files where Tailwind classes might appear
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Additional background gradient utilities
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
