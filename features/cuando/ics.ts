// Arma un archivo .ics (iCalendar, RFC 5545) con un solo evento y una alarma: el recordatorio de
// «Avisame esta noche». Función pura, sin imports de código: los tests corren este .ts directo con node.
import type { EventoDeCalendario } from "./evento";

/** Máximo de octetos por línea, sin contar el salto (RFC 5545, 3.1). */
const MAX_OCTETOS = 75;
// Caracteres de control: no pueden ir en un valor. El salto de línea de un texto se escapa antes.
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/g;

/** Instante → "20261123T001500Z". */
export function fechaUTC(ms: number): string {
  return `${new Date(ms).toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;
}

/** Escapa un valor de tipo TEXT (RFC 5545, 3.3.11): barra invertida, punto y coma, coma y saltos de línea. */
export function escaparTexto(texto: string): string {
  return texto
    .replace(/[\\;,]/g, (caracter) => `\\${caracter}`)
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(CONTROL, "");
}

/** Para valores que no son TEXT (URI, UID): sin saltos ni caracteres de control, que partirían la línea. */
function sinControl(valor: string): string {
  return valor.replace(/[\r\n]/g, "").replace(CONTROL, "");
}

function octetos(caracter: string): number {
  const c = caracter.codePointAt(0)!;
  return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
}

/**
 * Pliega una línea de más de 75 octetos (RFC 5545, 3.1): corta con CRLF y sigue con un espacio.
 * Cuenta octetos de UTF-8, no letras, y nunca corta por el medio de un carácter.
 */
export function plegar(linea: string): string {
  const partes: string[] = [];
  let parte = "";
  let largo = 0;
  for (const caracter of linea) {
    const n = octetos(caracter);
    if (largo + n > MAX_OCTETOS) {
      partes.push(parte);
      // El espacio con que empieza la línea siguiente también cuenta.
      parte = " ";
      largo = 1;
    }
    parte += caracter;
    largo += n;
  }
  partes.push(parte);
  return partes.join("\r\n");
}

/** El .ics completo: líneas plegadas y terminadas en CRLF, también la última. */
export function armarIcs(e: EventoDeCalendario): string {
  const titulo = escaparTexto(e.titulo);
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ANDINO//Recordatorio de cielo//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${sinControl(e.uid)}`,
    `DTSTAMP:${fechaUTC(e.creado)}`,
    `DTSTART:${fechaUTC(e.inicio)}`,
    `DTEND:${fechaUTC(e.fin)}`,
    `SUMMARY:${titulo}`,
    `DESCRIPTION:${escaparTexto(e.descripcion)}`,
    `LOCATION:${escaparTexto(e.lugar)}`,
    // GEO es latitud;longitud: ese punto y coma separa los dos números, no se escapa.
    `GEO:${e.geo.latitude};${e.geo.longitude}`,
    `URL:${sinControl(e.url)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${titulo}`,
    `TRIGGER:-PT${e.alarmaMin}M`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lineas.map((l) => `${plegar(l)}\r\n`).join("");
}
