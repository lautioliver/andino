// Respuesta común de las rutas /api/satelites/*: valida la entrada, calcula y responde. Solo servidor.
import type { NextRequest } from "next/server";
import { getPlace } from "@/data/places";
import { DIAS_CALCULABLES, nocheCalculable, type PasosDeLaNoche } from "./pasos";

function error(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

/**
 * GET ?placeId=&fecha=YYYY-MM-DD. Solo lugares del dataset y noches cercanas: las órbitas pierden
 * precisión con los días, y así hay pocas combinaciones en caché aunque lleguen entradas inventadas.
 */
export async function responderPasos(
  request: NextRequest,
  calcular: (placeId: string, fecha: string) => Promise<PasosDeLaNoche | null>,
  etiqueta: string,
): Promise<Response> {
  const place = getPlace(request.nextUrl.searchParams.get("placeId"));
  const fecha = request.nextUrl.searchParams.get("fecha");
  if (!place) return error(400, "Lugar desconocido.");
  if (!fecha || !nocheCalculable(fecha, Date.now())) {
    return error(400, `Fecha fuera de rango: solo noches de hasta ${DIAS_CALCULABLES} días antes o después de hoy.`);
  }

  try {
    const pasos = await calcular(place.id, fecha);
    if (!pasos) return error(422, "No se pudo calcular la noche para ese lugar.");
    return Response.json(pasos, {
      headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (e) {
    console.error(`[satelites/${etiqueta}]`, e);
    return error(502, "Las órbitas de los satélites no están disponibles ahora.");
  }
}
