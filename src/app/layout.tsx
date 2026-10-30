import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "@/styles/globals.css";

const sans = localFont({
  src: "../../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2",
  variable: "--font-body",
  display: "swap",
  weight: "100 1000",
});
const editorial = localFont({
  src: "../../node_modules/@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2",
  variable: "--font-editorial",
  display: "swap",
  weight: "200 800",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "Reservas · Espacio de trabajo",
    template: "%s · Reservas",
  },
  description:
    "Plataforma de reservas y gestión de negocios. Base del producto en desarrollo.",
  applicationName: "Reservas",
  appleWebApp: { capable: true, title: "Reservas", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#34553e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${sans.variable} ${editorial.variable}`}>
      <body>
        <a
          href="#contenido"
          className="sr-only fixed top-4 left-4 z-50 rounded-lg bg-white p-3 focus:not-sr-only"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
