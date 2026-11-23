// El enlace que abre Google Calendar con el evento de «Avisame esta noche» ya cargado.
// Función pura y sin imports de código, como ics.ts: los tests corren este .ts directo con node.
import type { EventoDeCalendario } from "./evento";

/** El destino es siempre este: lo que cambia de un evento a otro va en la consulta, codificado. */
export const GOOGLE_CALENDAR = "https://calendar.google.com/calendar/render";

/** Instante → "20261129T002000Z": en UTC, el mismo formato que DTSTART y DTEND en el .ics. */
function fechaUTC(ms: number): string {
  return `${new Date(ms).toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;
}

/**
 * La URL de Google Calendar con título, horas, descripción y lugar del evento. Las horas van en UTC
 * y sin `ctz`: cada persona las ve en la zona de su calendario. Un enlace no puede fijar el aviso:
 * el evento queda con el que esa persona tenga por defecto.
 */
export function urlDeGoogleCalendar(e: Pick<EventoDeCalendario, "titulo" | "inicio" | "fin" | "descripcion" | "lugar">): string {
  // URLSearchParams codifica todo lo que no sea letra, número o *-._ : ningún dato puede cortar
  // la consulta (&, #), sumar otro parámetro ni cambiar el destino.
  const consulta = new URLSearchParams({
    action: "TEMPLATE",
    text: e.titulo,
    dates: `${fechaUTC(e.inicio)}/${fechaUTC(e.fin)}`,
    details: e.descripcion,
    location: e.lugar,
  });
  return `${GOOGLE_CALENDAR}?${consulta}`;
}
