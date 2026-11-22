import type { SkyObjectId } from "@/features/cielo/motor";

// Fichas educativas de Cielo Andino. Contenido curado, separado de las posiciones:
// la altitud y el acimut los calcula features/cielo/motor.ts, nunca estos textos ni la IA.
// No incluye relatos ni nombres andinos: requieren fuentes y revisión cultural (plan.md §3.2).
// Propiedad: jehp23.

export type SkyObjectKind = "satélite" | "planeta" | "estrella";

export interface SkyObjectInfo {
  kind: SkyObjectKind;
  summary: string;
  /** Inglés: nombre, tipo y resumen (las posiciones no cambian con el idioma). */
  en: { name: string; kind: string; summary: string };
  sources: { label: string; url: string }[];
}

export const SKY_OBJECT_INFO: Record<SkyObjectId, SkyObjectInfo> = {
  luna: {
    kind: "satélite",
    summary:
      "El único satélite natural de la Tierra, a unos 384.000 km. No tiene luz propia: refleja la del Sol, y por eso cambia de fase en un ciclo de unos 29,5 días.",
    en: {
      name: "Moon",
      kind: "satellite",
      summary:
        "Earth's only natural satellite, about 384,000 km away. It has no light of its own: it reflects sunlight, which is why it goes through phases in a cycle of about 29.5 days.",
    },
    sources: [{ label: "NASA Science · La Luna", url: "https://science.nasa.gov/moon/" }],
  },
  jupiter: {
    kind: "planeta",
    summary:
      "El planeta más grande del sistema solar, un gigante gaseoso. A simple vista es un punto brillante que casi no titila; con binoculares se ven sus cuatro lunas mayores.",
    en: {
      name: "Jupiter",
      kind: "planet",
      summary:
        "The largest planet in the solar system, a gas giant. To the naked eye it is a bright point that barely twinkles; with binoculars you can see its four largest moons.",
    },
    sources: [{ label: "NASA Science · Júpiter", url: "https://science.nasa.gov/jupiter/" }],
  },
  saturno: {
    kind: "planeta",
    summary:
      "El sexto planeta desde el Sol, conocido por sus anillos de hielo y roca. A simple vista se ve como una estrella amarillenta y estable; los anillos requieren telescopio.",
    en: {
      name: "Saturn",
      kind: "planet",
      summary:
        "The sixth planet from the Sun, known for its rings of ice and rock. To the naked eye it looks like a steady, yellowish star; the rings need a telescope.",
    },
    sources: [{ label: "NASA Science · Saturno", url: "https://science.nasa.gov/saturn/" }],
  },
  sirio: {
    kind: "estrella",
    summary:
      "La estrella más brillante del cielo nocturno, en la constelación del Can Mayor. Está a unos 8,6 años luz: es una de las estrellas más cercanas al Sol.",
    en: {
      name: "Sirius",
      kind: "star",
      summary:
        "The brightest star in the night sky, in the constellation Canis Major. It is about 8.6 light-years away: one of the closest stars to the Sun.",
    },
    sources: [{ label: "Wikipedia · Sirio", url: "https://es.wikipedia.org/wiki/Sirio" }],
  },
  acrux: {
    kind: "estrella",
    summary:
      "La estrella más brillante de la Cruz del Sur, a unos 320 años luz. Prolongando el eje largo de la Cruz se ubica aproximadamente el polo sur celeste.",
    en: {
      name: "Acrux (Southern Cross)",
      kind: "star",
      summary:
        "The brightest star of the Southern Cross, about 320 light-years away. Extending the long axis of the Cross takes you roughly to the south celestial pole.",
    },
    sources: [
      { label: "Wikipedia · Acrux", url: "https://es.wikipedia.org/wiki/Acrux" },
      { label: "Wikipedia · Crux", url: "https://es.wikipedia.org/wiki/Crux" },
    ],
  },
};

/** Nombre del objeto en el idioma de la interfaz. */
export function nombreObjeto(id: string, nombre: string, lang: "es" | "en"): string {
  return lang === "en" ? (SKY_OBJECT_INFO[id as SkyObjectId]?.en.name ?? nombre) : nombre;
}
