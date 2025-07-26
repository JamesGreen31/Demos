// Import the Inter font helper from Next.js which allows the font to be
// automatically downloaded and applied. This avoids manually including font
// files in the project.
import { Inter } from "next/font/google";

// Import global CSS styles that will be applied to every page in the
// application. Tailwind directives are expanded in this file.
import "./globals.css";

// Configure the Inter font so only the latin character subset is loaded. The
// resulting `inter` object contains a `className` that applies the font to any
// element.
const inter = Inter({ subsets: ["latin"] });

// Metadata used by Next.js to populate the `<head>` of the HTML document. These
// values will be used for the page title and meta description.
export const metadata = {
  title: "Ckplace Demos",
  description: "Ckplace Demos",
};

// Root layout component that wraps all pages. The `children` prop contains the
// page to render. Here we add the `inter` font class to the `<body>` so the
// font is applied globally.
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
