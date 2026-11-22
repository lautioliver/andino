import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ANDINO — Tu mejor noche de cielo en Jujuy",
    short_name: "ANDINO",
    description: "Cuándo salir, adónde mirar y qué estás viendo en el cielo de la Quebrada.",
    lang: "es-AR",
    start_url: "/",
    display: "standalone",
    background_color: "#fffaf7",
    theme_color: "#fffaf7",
    icons: [{ src: "/brand/pacha-mark.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
