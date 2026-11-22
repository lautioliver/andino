import type { SkyObjectId } from "@/features/cielo/motor";

// Fichas educativas de Cielo Andino. Contenido curado, separado de las posiciones:
// la altitud y el acimut los calcula features/cielo/motor.ts, nunca estos textos ni la IA.
// No incluye relatos ni nombres andinos: requieren fuentes y revisión cultural (plan.md §3.2).
// Propiedad: jehp23.

export type SkyObjectKind = "satélite" | "planeta" | "estrella";

export interface SkyObjectInfo {
  kind: SkyObjectKind;
  summary: string;
  sources: { label: string; url: string }[];
}

export const SKY_OBJECT_INFO: Record<SkyObjectId, SkyObjectInfo> = {
  luna: {
    kind: "satélite",
    summary:
      "El único satélite natural de la Tierra, a unos 384.000 km. No tiene luz propia: refleja la del Sol, y por eso cambia de fase en un ciclo de unos 29,5 días.",
    sources: [{ label: "NASA Science · La Luna", url: "https://science.nasa.gov/moon/" }],
  },
  jupiter: {
    kind: "planeta",
    summary:
      "El planeta más grande del sistema solar, un gigante gaseoso. A simple vista es un punto brillante que casi no titila; con binoculares se ven sus cuatro lunas mayores.",
    sources: [{ label: "NASA Science · Júpiter", url: "https://science.nasa.gov/jupiter/" }],
  },
  saturno: {
    kind: "planeta",
    summary:
      "El sexto planeta desde el Sol, conocido por sus anillos de hielo y roca. A simple vista se ve como una estrella amarillenta y estable; los anillos requieren telescopio.",
    sources: [{ label: "NASA Science · Saturno", url: "https://science.nasa.gov/saturn/" }],
  },
  sirio: {
    kind: "estrella",
    summary:
      "La estrella más brillante del cielo nocturno, en la constelación del Can Mayor. Está a unos 8,6 años luz: es una de las estrellas más cercanas al Sol.",
    sources: [{ label: "Wikipedia · Sirio", url: "https://es.wikipedia.org/wiki/Sirio" }],
  },
  acrux: {
    kind: "estrella",
    summary:
      "La estrella más brillante de la Cruz del Sur, a unos 320 años luz. Prolongando el eje largo de la Cruz se ubica aproximadamente el polo sur celeste.",
    sources: [
      { label: "Wikipedia · Acrux", url: "https://es.wikipedia.org/wiki/Acrux" },
      { label: "Wikipedia · Crux", url: "https://es.wikipedia.org/wiki/Crux" },
    ],
  },
};
