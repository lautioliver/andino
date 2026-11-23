import type { NextRequest } from "next/server";
import { getPlace } from "@/data/places";
import { recordatorio } from "@/features/cuando/recordatorio";
import { fechaDeLaNoche } from "@/features/pacha/noche";

const DIA_MS = 86_400_000;
/** Un recordatorio es para esta noche o una de las próximas: más allá de un mes no tiene sentido pedirlo. */
const NOCHES_MAX = 31;

function error(status: number, message: string) {
  return Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

/**
 * «Avisame esta noche»: /api/recordatorio?placeId=purmamarca&fecha=2026-11-28&lang=es devuelve un .ics
 * con el evento de esa noche. Un enlace común alcanza: el navegador lo baja y el teléfono lo abre en el calendario.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const place = getPlace(q.get("placeId"));
  if (!place) return error(400, "Lugar desconocido.");

  const lang = q.get("lang") ?? "es";
  if (lang !== "es" && lang !== "en") return error(400, "Idioma desconocido: es o en.");

  // El formato solo no alcanza: 2026-02-31 lo cumple y no existe.
  const fecha = q.get("fecha") ?? "";
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? Date.parse(`${fecha}T12:00:00Z`) : NaN;
  if (Number.isNaN(dia) || new Date(dia).toISOString().slice(0, 10) !== fecha) {
    return error(400, "Fecha inválida: se espera AAAA-MM-DD.");
  }
  const estaNoche = Date.parse(`${fechaDeLaNoche(new Date())}T12:00:00Z`);
  if (dia < estaNoche || dia > estaNoche + NOCHES_MAX * DIA_MS) {
    return error(400, `Fecha fuera de rango: solo desde esta noche hasta dentro de ${NOCHES_MAX} días.`);
  }

  const ics = recordatorio(place, fecha, lang, request.nextUrl.origin, Date.now());
  if (!ics) return error(422, "Esa noche no llega a oscurecer en ese lugar.");
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      // placeId y fecha ya están validados: solo letras, números y guiones.
      "content-disposition": `attachment; filename="andino-${place.id}-${fecha}.ics"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
