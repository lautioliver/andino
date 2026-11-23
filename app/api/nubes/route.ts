import type { NextRequest } from "next/server";
import { getPlace } from "@/data/places";
import { nubesDe } from "@/features/cuando/pronostico";

export const maxDuration = 15;

function error(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

/** Nubosidad horaria prevista para un lugar de la lista: /api/nubes?placeId=purmamarca. */
export async function GET(request: NextRequest) {
  const place = getPlace(request.nextUrl.searchParams.get("placeId"));
  if (!place) return error(400, "Lugar desconocido.");

  try {
    const nubes = await nubesDe(place.id);
    if (!nubes) return error(502, "El pronóstico de nubes no está disponible ahora.");
    // La caché de una hora es la de nubesDe (pronostico.ts); acá solo se evita repetir el pedido durante unos minutos.
    return Response.json(nubes, { headers: { "cache-control": "public, max-age=300, s-maxage=600" } });
  } catch {
    // nubesDe ya registró el motivo. Quien pide se queda sin pronóstico y sigue como antes de conocer las nubes.
    return error(502, "El pronóstico de nubes no está disponible ahora.");
  }
}
