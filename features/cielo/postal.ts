// «Postal de tu noche»: la imagen del cielo calculado que el viajero se lleva y comparte. Acá, lo que no
// dibuja: la leyenda, el nombre del archivo, el enlace, el texto que la acompaña y las medidas de la
// composición. El dibujo está en postalLienzo.ts.
//
// Lógica pura, sin DOM ni imports relativos de valor: los tests corren este .ts directo con node.

type Lang = "es" | "en";

/** El dominio que va impreso en la postal. */
export const SITIO = "andino-neon.vercel.app";

export const LEMA: Record<Lang, string> = {
  es: "Tu mejor noche de cielo en Jujuy",
  en: "Your best night under the sky in Jujuy",
};

/** De dónde es el cielo de la postal. */
export interface LugarPostal {
  /** Nombre de la parada. `null`: el cielo se calculó desde la ubicación del teléfono, lejos del recorrido. */
  nombre: string | null;
  /** El cielo se calculó desde la ubicación del teléfono y `nombre` es la parada más cercana. */
  cerca?: boolean;
  /** La parada para el enlace a /cielo. Las coordenadas del teléfono nunca van en el enlace. */
  placeId: string | null;
}

const MESES: Record<Lang, string[]> = {
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

/**
 * La fecha y la hora de un instante en Argentina (UTC−3 todo el año), sea cual sea la zona con la que
 * venga escrito: `fecha` y `hora` como las espera /cielo, y `texto` para leer.
 */
export function momentoPostal(iso: string, lang: Lang): { fecha: string; hora: string; texto: string } {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) throw new RangeError(`Instante no válido: ${iso}`);
  const local = new Date(ms - 3 * 3600_000).toISOString();
  const [anio, mes, dia] = [local.slice(0, 4), Number(local.slice(5, 7)), Number(local.slice(8, 10))];
  const hora = local.slice(11, 16);
  const fecha = lang === "en" ? `${MESES.en[mes - 1]} ${dia}, ${anio}` : `${dia} de ${MESES.es[mes - 1]} de ${anio}`;
  return { fecha: local.slice(0, 10), hora, texto: `${fecha} · ${hora}` };
}

export interface Leyenda {
  /** «El cielo de», chico, arriba del lugar. */
  rotulo: string;
  /** El lugar, en grande. */
  lugar: string;
  /** «23 de noviembre de 2026 · 23:30», en hora de Argentina. */
  momento: string;
  /** Rótulo y lugar en una frase: «El cielo de Tilcara». */
  frase: string;
}

/** La leyenda de la postal, en el idioma de la app. Los nombres de lugar quedan en español. */
export function leyendaPostal(lugar: LugarPostal, iso: string, lang: Lang): Leyenda {
  const en = lang === "en";
  const momento = momentoPostal(iso, lang).texto;
  if (lugar.nombre === null) {
    const rotulo = en ? "The sky from" : "El cielo desde";
    return { rotulo, lugar: en ? "My location" : "Mi ubicación", momento, frase: `${rotulo} ${en ? "my location" : "mi ubicación"}` };
  }
  const rotulo = lugar.cerca ? (en ? "The sky near" : "El cielo cerca de") : en ? "The sky over" : "El cielo de";
  return { rotulo, lugar: lugar.nombre, momento, frase: `${rotulo} ${lugar.nombre}` };
}

/**
 * La línea chica y honesta. Con el Sol arriba (o recién puesto) la postal marca las figuras donde están,
 * aunque no se vean: también lo dice.
 */
export function notaPostal(sinEstrellas: boolean, lang: Lang): string {
  const nota = lang === "en" ? "Calculated sky, not a photo" : "Cielo calculado, no una foto";
  if (!sinEstrellas) return nota;
  return `${nota} · ${lang === "en" ? "in this light the stars can't be seen" : "con esta luz las estrellas no se ven"}`;
}

/** "Posta de Hornillos" → "posta-de-hornillos": minúsculas sin tildes, solo letras, números y guiones; 40 caracteres como mucho. */
function enMinusculasConGuiones(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-/, "")
    .slice(0, 40)
    .replace(/-$/, "");
}

/** Nombre del archivo: «andino-cielo-tilcara-2026-11-23-2330.png». Sin lugar con nombre, solo el momento. */
export function nombreArchivoPostal(lugar: LugarPostal, iso: string): string {
  const { fecha, hora } = momentoPostal(iso, "es");
  const partes = ["andino", "cielo", lugar.nombre ? enMinusculasConGuiones(lugar.nombre) : "", fecha, hora.replace(":", "")];
  return `${partes.filter(Boolean).join("-")}.png`;
}

/**
 * El enlace a /cielo con ese cielo: `placeId`, `fecha` y `hora`, los parámetros que la pantalla ya respeta
 * (los mismos de `queryCielo`). Sin parada, solo el momento: quien lo abre ve su propio cielo de esa hora.
 */
export function enlacePostal(origen: string, lugar: LugarPostal, iso: string): string {
  const { fecha, hora } = momentoPostal(iso, "es");
  const q = new URLSearchParams();
  if (lugar.placeId) q.set("placeId", lugar.placeId);
  q.set("fecha", fecha);
  q.set("hora", hora);
  return `${origen}/cielo?${q}`;
}

/** Título y texto que acompañan a la imagen en el menú de compartir. El texto termina con el enlace. */
export function textoPostal(lugar: LugarPostal, iso: string, lang: Lang, origen: string): { titulo: string; texto: string } {
  const l = leyendaPostal(lugar, iso, lang);
  const enlace = enlacePostal(origen, lugar, iso);
  return {
    titulo: `${l.frase} · ANDINO`,
    texto:
      lang === "en"
        ? `${l.frase} · ${l.momento} (Argentina time). A calculated sky, not a photo. See it in ANDINO: ${enlace}`
        : `${l.frase} · ${l.momento} (hora de Argentina). Es el cielo calculado, no una foto. Miralo en ANDINO: ${enlace}`,
  };
}

/**
 * Medidas de la imagen, en píxeles. Vertical, 4:5: la proporción más alta que WhatsApp e Instagram muestran
 * entera. Arriba el cielo, a sangre; abajo el pie, sobre Noche, con la leyenda y la marca.
 *
 * Los tamaños de letra del pie están pensados para la miniatura: a un cuarto del tamaño (270 px de ancho,
 * lo que mide en un chat) el lugar, el momento y «ANDINO» siguen midiendo 11 px o más.
 */
export const POSTAL = {
  ancho: 1080,
  alto: 1350,
  margen: 64,
  cielo: { x: 0, y: 0, ancho: 1080, alto: 925 },
  /**
   * El cielo se dibuja con medidas de pantalla y se amplía: 1 px del dibujo son `escalaCielo` de la imagen.
   * Con 2,5 (432 px de dibujo a lo ancho) y un campo de 100° (el de /cielo en pantallas anchas; en el
   * teléfono es 80° en unos 375 px), los rótulos quedan casi tan separados entre sí como en el teléfono y
   * entra más cielo a los costados.
   */
  escalaCielo: 2.5,
  campoCielo: 100,
  /** Un filete en Puna entre el cielo y el pie. */
  filete: { y: 925, alto: 5 },
  pie: { y: 930, alto: 420 },
  /** Líneas de texto: tamaño de letra y línea de base (`y`). */
  rotulo: { tamanio: 30, y: 990 },
  lugar: { tamanio: 92, minimo: 60, y: 1080 },
  momento: { tamanio: 44, y: 1142 },
  /** El isotipo: un cuadrado de `lado` píxeles con la esquina de arriba a la izquierda en (margen, y). */
  isotipo: { lado: 84, y: 1180 },
  /** «ANDINO» y, debajo, el sitio: a la derecha del isotipo. El lema, enfrente, alineado a la derecha. */
  marca: { tamanio: 46, y: 1222 },
  sitio: { tamanio: 28, y: 1258 },
  lema: { tamanio: 27, y: 1222 },
  nota: { tamanio: 25, y: 1312 },
} as const;

/** Tamaño de letra con el que un texto que mide `anchoMedido` a `tamanio` entra en `anchoDisponible`, sin bajar de `minimo`. */
export function tamanioQueEntra(anchoMedido: number, tamanio: number, anchoDisponible: number, minimo: number): number {
  if (!(anchoMedido > anchoDisponible)) return tamanio;
  return Math.max(minimo, Math.floor((tamanio * anchoDisponible) / anchoMedido));
}

/**
 * El isotipo de ANDINO: los trazados de public/brand/andino-mark.svg, en una caja de 64 × 64 y sin el fondo
 * (como shared/ui/AndinoMark.tsx), para dibujarlo en el lienzo sin pedir el archivo: la postal se arma
 * también sin señal. Un test los compara con el SVG.
 */
export const ISOTIPO = {
  caja: 64,
  orbita: { d: "M10 40 A24 24 0 1 1 50 47", color: "#fffaf7", grosor: 6 },
  estrella: { d: "M44 7 L46.8 15.2 L55 18 L46.8 20.8 L44 29 L41.2 20.8 L33 18 L41.2 15.2 Z", color: "#fffaf7" },
  cumbres: { d: "M14 52 L25 36 L31 44 L37 38 L48 52 Z", color: "#ff7a45" },
} as const;
