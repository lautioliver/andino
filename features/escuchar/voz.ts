// «Escuchar»: la parte pura de la lectura en voz alta: qué voz usar y cómo partir el texto.
// Sin DOM ni imports de código: los tests corren este .ts directo con node. El navegador está en lector.ts.

type Idioma = "es" | "en";

/** Lo que hace falta saber de una voz del navegador (SpeechSynthesisVoice) para elegir. */
export interface Voz {
  lang: string;
  name: string;
  voiceURI?: string;
  localService?: boolean;
  default?: boolean;
}

// Dentro de cada idioma, qué regiones van primero. Español: Argentina, después el resto de América y al
// final cualquier otra (España incluida). Inglés: cualquiera.
const REGIONES: Record<Idioma, string[][]> = {
  es: [["es-ar"], ["es-419", "es-mx", "es-us"]],
  en: [],
};

// Voces de Apple que no sirven para explicar nada: las de efectos (cantan, susurran, hacen de robot) y las
// sintéticas viejas. Están en la lista de un Mac y de un iPhone mezcladas con las buenas, y por orden
// alfabético quedan antes («Albert» antes que «Samantha», «Eddy» antes que «Paulina»).
// Safari las delata en el identificador; Chrome en Mac solo da el nombre, a veces traducido.
const URI_DE_EFECTO = /eloquence|speech\.synthesis\.voice/i;
const NOMBRES_DE_EFECTO = new Set(
  "albert,bad news,bahh,bells,boing,bubbles,buenas noticias,cellos,eddy,flo,fred,good news,grandma,grandpa,jester,junior,kathy,organ,ralph,reed,rocko,sandy,shelley,superstar,trinoids,whisper,wobble,zarvox".split(
    ",",
  ),
);

/** "es_AR" (así lo informa algún Android) → "es-ar". */
function etiqueta(lang: unknown): string {
  return typeof lang === "string" ? lang.trim().toLowerCase().replace(/_/g, "-") : "";
}

const empiezaCon = (tag: string, prefijo: string) => tag === prefijo || tag.startsWith(`${prefijo}-`);

/** Qué tan preferida es la región de la voz (0 = la mejor), o -1 si la voz es de otro idioma. */
function nivelDeRegion(voz: Voz, idioma: Idioma): number {
  const tag = etiqueta(voz.lang);
  if (!empiezaCon(tag, idioma)) return -1;
  const niveles = REGIONES[idioma];
  const nivel = niveles.findIndex((regiones) => regiones.some((r) => empiezaCon(tag, r)));
  return nivel === -1 ? niveles.length : nivel;
}

function esDeEfecto(voz: Voz): boolean {
  if (typeof voz.voiceURI === "string" && URI_DE_EFECTO.test(voz.voiceURI)) return true;
  // «Eddy (español (México))» → "eddy".
  const nombre = (typeof voz.name === "string" ? voz.name : "").split("(")[0].trim().toLowerCase();
  return NOMBRES_DE_EFECTO.has(nombre);
}

/**
 * La voz para leer en ese idioma, o null si no hay ninguna: nunca una de otro idioma.
 * Entre las del idioma gana, en este orden: la que no es de efectos, la región preferida, la que viene en el
 * teléfono (no necesita señal) y la que el sistema marca por defecto. Si empatan, la primera de la lista.
 */
export function elegirVoz<V extends Voz>(voces: readonly V[], idioma: Idioma): V | null {
  let mejor: V | null = null;
  let puntajeDeLaMejor: number[] = [];
  for (const voz of voces) {
    if (!voz) continue;
    const nivel = nivelDeRegion(voz, idioma);
    if (nivel === -1) continue;
    const puntaje = [esDeEfecto(voz) ? 1 : 0, nivel, voz.localService === false ? 1 : 0, voz.default ? 0 : 1];
    if (mejor === null || esMenor(puntaje, puntajeDeLaMejor)) {
      mejor = voz;
      puntajeDeLaMejor = puntaje;
    }
  }
  return mejor;
}

function esMenor(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

/**
 * Largo máximo de un tramo, en caracteres. En algunos Chrome, con las voces que vienen por la red, una
 * lectura de más de unos 15 segundos se corta sola: a unos 15 caracteres por segundo, 160 son unos 11.
 */
export const MAX_TRAMO = 160;

const FIN_DE_ORACION = ".!?…";
const CIERRES = "»”’\"')]";
const PAUSAS = ",;:";
const LETRA = /\p{L}/u;
const LETRA_O_NUMERO = /[\p{L}\p{N}]/u;

/**
 * Parte un texto en tramos para leer uno detrás de otro: una oración por tramo, y las oraciones de más
 * de `max` caracteres, por sus comas o, si no alcanza, por palabras. No cambia ni saltea nada: los tramos
 * unidos con un espacio son el texto original, con los espacios y saltos de línea reducidos a uno.
 */
export function partirEnOraciones(texto: string, max: number = MAX_TRAMO): string[] {
  const limite = Number.isFinite(max) && max >= 1 ? Math.floor(max) : MAX_TRAMO;
  const limpio = String(texto ?? "").replace(/\s+/g, " ").trim();

  // 1. Cortes de oración: puntuación final (con sus comillas o paréntesis de cierre) seguida de un espacio.
  const oraciones: string[] = [];
  let inicio = 0;
  let i = 0;
  while (i < limpio.length) {
    if (!FIN_DE_ORACION.includes(limpio[i])) {
      i++;
      continue;
    }
    const puntuacion = i;
    while (i < limpio.length && FIN_DE_ORACION.includes(limpio[i])) i++;
    const soloUnPunto = i - puntuacion === 1 && limpio[puntuacion] === ".";
    while (i < limpio.length && CIERRES.includes(limpio[i])) i++;
    if (limpio[i] !== " ") continue; // "384.000", "21.30", "a.m." o el final del texto
    if (soloUnPunto && esInicial(limpio, puntuacion)) continue; // "c. 1600", "J. M. Arguedas"
    oraciones.push(limpio.slice(inicio, i));
    inicio = i + 1;
  }
  if (inicio < limpio.length) oraciones.push(limpio.slice(inicio));

  // 2. Un tramo sin letras ni números ("«…", "—") no se puede leer solo: va pegado al que sigue, o al
  // anterior si es el último. Si todo el texto es así, no hay nada para leer.
  const conTexto: string[] = [];
  let sueltos: string[] = [];
  for (const oracion of oraciones) {
    if (!LETRA_O_NUMERO.test(oracion)) sueltos.push(oracion);
    else {
      conTexto.push(sueltos.length === 0 ? oracion : `${sueltos.join(" ")} ${oracion}`);
      sueltos = [];
    }
  }
  if (sueltos.length > 0 && conTexto.length > 0) conTexto[conTexto.length - 1] += ` ${sueltos.join(" ")}`;

  // 3. Las oraciones largas, en tramos de hasta `limite` caracteres.
  return conTexto.flatMap((oracion) => acortar(oracion, limite, 0));
}

/** ¿El punto de la posición `punto` cierra una sola letra suelta? Entonces es una abreviatura o una inicial. */
function esInicial(texto: string, punto: number): boolean {
  if (punto < 1 || !LETRA.test(texto[punto - 1])) return false;
  return punto < 2 || !LETRA_O_NUMERO.test(texto[punto - 2]);
}

/** Tramos de hasta `max` caracteres: primero por las pausas (nivel 0), después por palabras (1) y, si no hay espacios, a la fuerza (2). */
function acortar(texto: string, max: number, nivel: 0 | 1 | 2): string[] {
  if (texto.length <= max) return [texto];
  if (nivel === 2) {
    // Por caracteres completos: un emoji o una letra rara no quedan partidos al medio.
    const caracteres = Array.from(texto);
    const tramos: string[] = [];
    let tramo = "";
    for (const c of caracteres) {
      if (tramo !== "" && tramo.length + c.length > max) {
        tramos.push(tramo);
        tramo = "";
      }
      tramo += c;
    }
    if (tramo !== "") tramos.push(tramo);
    return tramos;
  }

  const piezas = nivel === 0 ? porPausas(texto) : texto.split(" ");
  const tramos: string[] = [];
  let tramo = "";
  for (const pieza of piezas) {
    if (pieza.length > max) {
      if (tramo !== "") tramos.push(tramo);
      tramo = "";
      for (const parte of acortar(pieza, max, nivel === 0 ? 1 : 2)) tramos.push(parte);
    } else if (tramo === "") tramo = pieza;
    else if (tramo.length + 1 + pieza.length <= max) tramo += ` ${pieza}`;
    else {
      tramos.push(tramo);
      tramo = pieza;
    }
  }
  if (tramo !== "") tramos.push(tramo);
  return tramos;
}

/** "uno, dos: tres" → ["uno,", "dos:", "tres"]. Recorre el texto una vez (y sin lookbehind, que rompe Safari viejo). */
function porPausas(texto: string): string[] {
  const piezas: string[] = [];
  let inicio = 0;
  for (let i = 0; i < texto.length - 1; i++) {
    if (PAUSAS.includes(texto[i]) && texto[i + 1] === " ") {
      piezas.push(texto.slice(inicio, i + 1));
      inicio = i + 2;
    }
  }
  piezas.push(texto.slice(inicio));
  return piezas;
}
