// Reconocimiento de lugar a partir de una foto (AND-04/05). Solo servidor.
// La IA elige entre los lugares del dataset o dice que no sabe; las fuentes salen siempre del dataset,
// nunca del modelo, y el texto largo de la ficha sigue siendo el curado.
import { generateText, Output } from "ai";
import { z } from "zod";
import { getPlace, places } from "@/data/places";
import type { PachaResult, PlaceId } from "@/shared/types";
import { fichas } from "./fichas";

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
    .describe("1–2 frases en español rioplatense sobre lo que se ve en la foto. Sin datos que no estén en las fichas."),
  followUpSuggestions: z
    .array(z.string())
    .max(3)
    .describe("Hasta 3 preguntas cortas que el visitante podría hacerse sobre lo que ve, respondibles con las fichas."),
});

const catalogo = places
  .map((p) => {
    const f = fichas[p.id];
    return `- ${p.id} (${p.name}, ${f.region})\n  Cómo se ve: ${f.photo.alt}.\n  Ficha: ${[f.summary, ...f.more].join(" ")}`;
  })
  .join("\n");

const instrucciones = `Sos el guía de ANDINO, una app de turismo de la Quebrada de Humahuaca (Jujuy, Argentina).
Te pasan una foto que sacó un visitante. Decidí cuál de estos lugares del catálogo se ve, usando solo estas fichas:

${catalogo}

Reglas:
- Elegí un lugar solo si hay rasgos visibles que lo identifiquen. Si la foto es de otra cosa (una persona, comida, una ciudad, otro paisaje) o no alcanza para distinguir entre los lugares, devolvé candidatePlaceId null y confidenceLabel "insuficiente".
- "alta" solo con rasgos inconfundibles (por ejemplo, el cerro de franjas de colores detrás del pueblo de Purmamarca).
- No inventes fechas, cifras, nombres ni historia que no estén en las fichas. Si no sabés, decilo.
- Escribí en español rioplatense, tuteando con vos, en tono sobrio.`;

export async function analizarFoto(imagen: Uint8Array, mediaType: string, signal?: AbortSignal): Promise<PachaResult> {
  const { output } = await generateText({
    model: MODELO,
    system: instrucciones,
    output: Output.object({ schema: esquema }),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "¿Qué lugar del catálogo es esta foto?" },
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
    summary: o.summary.trim().slice(0, 600),
    sourceUrls: place?.sourceUrls ?? [],
    // Sin lugar no hay ficha que responda las preguntas: mejor no sugerir ninguna.
    followUpSuggestions: place ? o.followUpSuggestions.map((s) => s.trim()).filter(Boolean).slice(0, 3) : [],
    demoMode: false,
  };
}
