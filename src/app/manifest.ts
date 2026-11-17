import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MAFER Hipismo — 5y6 La Rinconada",
    short_name: "MAFER 5y6",
    description: "Arma tu cuadro 5y6 y sigue las jornadas de La Rinconada.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#090a0f",
    theme_color: "#090a0f",
    categories: ["sports", "entertainment"],
    icons: [
      {
        src: "/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
