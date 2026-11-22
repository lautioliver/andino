// Reconocimiento de lugar a partir de una foto (AND-04/05). Solo servidor.
// La IA elige entre las paradas del Tren Solar del dataset o dice que no sabe; las fuentes salen siempre del dataset,
// nunca del modelo, y el texto largo de la ficha sigue siendo el curado.
import { generateText, Output } from "ai";
import { z } from "zod";
import { getPlace, places } from "@/data/places";
import type { PachaResult, PlaceId } from "@/shared/types";
import { fichas } from "./fichas";

export type Idioma = "es" | "en";

export const MODELO = process.env.PACHA_MODEL ?? "google/gemini-2.5-flash";
export const TIMEOUT_MS = 25_000;

const ids = places.map((p) => p.id) as [PlaceId, ...PlaceId[]];

const esquema = z.object({
  candidatePlaceId: z
    .enum(ids)
    .nullable()
    .describe("Id del lugar del catálogo que se ve en la foto, o null si no es ninguno o no se puede saber."),
  confidenceLabel: z
    .enum(["alta", "media", "insuficiente"])
    .describe("alta: rasgos inconfundibles del lugar. media: compatible pero podría ser otro. insuficiente: no alcanza."),
  summary: z
    .string()
    .describe(
      "3–4 frases para el turista, en el idioma pedido: qué se ve en la foto, qué es el lugar y un poco de su territorio e historia. Solo con datos de las fichas.",
    ),
  followUpSuggestions: z
    .array(z.string())
    .max(3)
    .describe("Hasta 3 preguntas cortas, en el idioma pedido, que el visitante podría hacerse sobre lo que ve, respondibles con las fichas."),
});

const catalogo = places
  .map((p) => {
    const f = fichas[p.id];
    return `- ${p.id} (${p.name}, ${f.region})\n  Cómo se ve: ${f.aspecto ?? f.photo.alt}.\n  Ficha: ${[f.summary, ...f.more].join(" ")}`;
  })
  .join("\n");

const IDIOMA: Record<Idioma, string> = {
  es: "Escribí summary y followUpSuggestions en español rioplatense, tuteando con vos, en tono sobrio.",
  en: "Write summary and followUpSuggestions in clear, friendly English for an international visitor. Keep place names in Spanish (Purmamarca, Paleta del Pintor, Posta de Hornillos, El Bayeh).",
};

const instrucciones = (lang: Idioma) => `Sos el guía de ANDINO, una app para los pasajeros del Tren Solar de la Quebrada (Quebrada de Humahuaca, Jujuy, Argentina).
El tren recorre Volcán, Tumbaya, Purmamarca, la Posta de Hornillos, Maimará, el apeadero de la bodega El Bayeh y Tilcara.
Te pasan una foto que sacó un pasajero, desde el tren o en una parada. Decidí cuál de estas paradas se ve, usando solo estas fichas:

${catalogo}

Reglas:
- Elegí un lugar solo si hay rasgos visibles que lo identifiquen. Si la foto es de otra cosa (una persona, comida, una ciudad, otro paisaje) o no alcanza para distinguir entre los lugares, devolvé candidatePlaceId null y confidenceLabel "insuficiente".
- "alta" solo con rasgos inconfundibles (por ejemplo, el cerro de franjas de colores detrás del pueblo de Purmamarca, o el cementerio en la loma al pie de la Paleta del Pintor en Maimará).
- Cuidado con los cerros de colores, que hay en varias paradas: Purmamarca es un pueblo de casas bajas al pie del Cerro de los Siete Colores, con franjas rojizas, verdes y violetas; Maimará se reconoce por su cementerio: un racimo apretado de bóvedas y nichos claros, con algún cardón, sobre una loma baja al pie de una gran pared de cerro morada, rosada y ocre (la Paleta del Pintor), con quebradas verticales. Ese racimo parece un pueblo, pero si está sobre una loma, al pie de una montaña enorme y sin calles ni árboles entre las construcciones, es el cementerio de Maimará. El Cerro de los Siete Colores de Purmamarca es más chico, en franjas inclinadas y nítidas, con el pueblo y arboledas adelante. Si solo se ven cerros de colores sin otro rasgo propio, usá "media".
- El Bayeh es una bodega en Maimará: se reconoce por hileras de parras (viñedos) en el llano, un galpón de bodega o ánforas de barro, a veces con la Paleta del Pintor de fondo. Si hay viñedos, es El Bayeh, aunque se vea la Paleta del Pintor; si se ve el cementerio en la loma, es Maimará. Sin viñedos, galpón ni ánforas, no es El Bayeh.
- El Tren Solar (blanco con franja roja) aparece en varias paradas: el tren solo no alcanza; buscá el cartel de la estación o el paisaje. El cartel negro "VOLCAN" en el andén es Volcán.
- La Posta de Hornillos se reconoce por su capilla blanca con campanario de cúpula y por un caserón colonial blanco de puertas verdes alrededor de un patio de tierra, junto a la Ruta 9.
- Si reconocés el lugar, el summary le explica al pasajero qué está viendo: qué es el lugar y un poco de su territorio e historia, como lo contaría un guía del tren.
- No inventes fechas, cifras, nombres ni historia que no estén en las fichas. Si no sabés, decilo.
- ${IDIOMA[lang]}`;

export async function analizarFoto(imagen: Uint8Array, mediaType: string, lang: Idioma = "es", signal?: AbortSignal): Promise<PachaResult> {
  const { output } = await generateText({
    model: MODELO,
    system: instrucciones(lang),
    output: Output.object({ schema: esquema }),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: lang === "en" ? "Which stop of the catalogue is this photo? Answer in English." : "¿Qué parada del catálogo es esta foto?" },
          { type: "file", mediaType, data: imagen },
        ],
      },
    ],
    timeout: TIMEOUT_MS,
    abortSignal: signal,
  });

  return normalizar(output);
}

/** Lo que devuelve el modelo nunca sale tal cual: se valida contra el dataset. */
export function normalizar(o: z.infer<typeof esquema>): PachaResult {
  const place = o.confidenceLabel === "insuficiente" ? undefined : getPlace(o.candidatePlaceId);
  return {
    candidatePlaceId: place?.id ?? null,
    confidenceLabel: place ? o.confidenceLabel : "insuficiente",
    summary: o.summary.trim().slice(0, 900),
    sourceUrls: place?.sourceUrls ?? [],
    // Sin lugar no hay ficha que responda las preguntas: mejor no sugerir ninguna.
    followUpSuggestions: place ? o.followUpSuggestions.map((s) => s.trim()).filter(Boolean).slice(0, 3) : [],
    demoMode: false,
  };
}
