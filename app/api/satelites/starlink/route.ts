import type { NextRequest } from "next/server";
import { getPlace } from "@/data/places";
import { pasosStarlink } from "@/features/satelites/starlink";

export const maxDuration = 30;

const DIA_MS = 86_400_000;

function error(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get("placeId");
  const fecha = request.nextUrl.searchParams.get("fecha") ?? "";
  if (!getPlace(placeId)) return error(400, "Lugar desconocido.");
  // Las órbitas pierden precisión con los días: solo noches cercanas (y menos combinaciones en caché).
  const t = Date.parse(`${fecha}T12:00:00-03:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(t) || Math.abs(t - Date.now()) > 3 * DIA_MS) {
    return error(400, "Fecha fuera de rango: solo noches de hasta 3 días antes o después de hoy.");
  }

  try {
    const pasos = await pasosStarlink(placeId!, fecha);
    if (!pasos) return error(422, "No se pudo calcular la noche para ese lugar.");
    return Response.json(pasos, {
      headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (e) {
    console.error("[satelites/starlink]", e);
    return error(502, "Las órbitas de los satélites no están disponibles ahora.");
  }
}
