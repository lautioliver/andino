import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ANDINO — Explorá la Tierra. Descubrí el universo.",
    short_name: "ANDINO",
    description: "Paisajes de Jujuy con fuentes y el cielo calculado para el mismo lugar.",
    lang: "es-AR",
    start_url: "/",
    display: "standalone",
    background_color: "#0b1020",
    theme_color: "#0b1020",
    icons: [{ src: "/brand/pacha-mark.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
