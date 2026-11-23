import type { NextRequest } from "next/server";
import { pasosEstacion } from "@/features/satelites/estacion";
import { responderPasos } from "@/features/satelites/ruta";

export const maxDuration = 30;

/** Pasos visibles de la Estación Espacial Internacional: GET ?placeId=&fecha=YYYY-MM-DD. */
export function GET(request: NextRequest) {
  return responderPasos(request, pasosEstacion, "estacion");
}
