import { getPlace } from "@/data/places";
import { errorDeIA, errorJSON } from "@/features/pacha/errorDeIA";
import { MAX_PREGUNTA, responder } from "@/features/pacha/preguntar";

export const maxDuration = 30;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const place = getPlace(typeof body?.placeId === "string" ? body.placeId : null);
  const pregunta = typeof body?.question === "string" ? body.question.trim() : "";
  if (!place) return errorJSON(400, "Lugar desconocido.");
  if (!pregunta) return errorJSON(400, "Escribí una pregunta.");
  if (pregunta.length > MAX_PREGUNTA) return errorJSON(413, `La pregunta puede tener hasta ${MAX_PREGUNTA} caracteres.`);

  try {
    return Response.json(await responder(place, pregunta, request.signal));
  } catch (e) {
    return errorDeIA("pacha/ask", e);
  }
}
