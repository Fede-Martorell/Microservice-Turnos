import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Reservas · Gestión de negocios",
    short_name: "Reservas",
    description: "Tu espacio de reservas y gestión de negocios.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "es",
    background_color: "#f7f8f5",
    theme_color: "#34553e",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
