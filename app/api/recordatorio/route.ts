import type { NextRequest } from "next/server";
import { getPlace } from "@/data/places";
import { urlDeGoogleCalendar } from "@/features/cuando/google";
import { armarIcs } from "@/features/cuando/ics";
import { recordatorio } from "@/features/cuando/recordatorio";
import { fechaDeLaNoche } from "@/features/pacha/noche";

const DIA_MS = 86_400_000;
/** Un recordatorio es para esta noche o una de las próximas: más allá de un mes no tiene sentido pedirlo. */
const NOCHES_MAX = 31;

function error(status: number, message: string) {
  return Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

/**
 * «Avisame esta noche»: /api/recordatorio?placeId=purmamarca&fecha=2026-11-28&lang=es&para=apple entrega
 * el evento de esa noche. Con para=apple (o sin `para`), un .ics que el teléfono abre en su calendario;
 * con para=google, una redirección a Google Calendar con el mismo evento ya cargado. Un enlace común alcanza.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const place = getPlace(q.get("placeId"));
  if (!place) return error(400, "Lugar desconocido.");

  const lang = q.get("lang") ?? "es";
  if (lang !== "es" && lang !== "en") return error(400, "Idioma desconocido: es o en.");

  // Sin `para`, el .ics de siempre. Repetido o con otro valor (también vacío) no se adivina cuál quiso.
  const paras = q.getAll("para");
  const para = paras.length === 0 ? "apple" : paras.length === 1 ? paras[0] : null;
  if (para !== "google" && para !== "apple") return error(400, "Calendario desconocido: google o apple.");

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

  const evento = recordatorio(place, fecha, lang, request.nextUrl.origin, Date.now());
  if (!evento) return error(422, "Esa noche no llega a oscurecer en ese lugar.");

  if (para === "google") {
    // No es una redirección abierta: el destino es siempre calendar.google.com (constante en google.ts).
    // El evento sale del lugar, la fecha y el idioma ya validados y viaja en la consulta, codificado:
    // nada del pedido elige a dónde va.
    return new Response(null, {
      status: 302,
      headers: { location: urlDeGoogleCalendar(evento), "cache-control": "no-store" },
    });
  }

  return new Response(armarIcs(evento), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      // inline y no attachment, para que Safari de iPhone abra la hoja de agregar al calendario en vez de mandarlo a Descargas.
      // placeId y fecha ya están validados: solo letras, números y guiones.
      "content-disposition": `inline; filename="andino-${place.id}-${fecha}.ics"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
