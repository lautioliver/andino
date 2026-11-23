// «Cuándo»: de las noches de tu viaje, cuál promete más cielo oscuro y despejado.
// Una noche cuenta como oscura mientras el Sol está a más de 18° bajo el horizonte (terminó el
// crepúsculo astronómico) y la Luna no está arriba, o es tan fina que casi no ilumina.
// Las nubes salen de un pronóstico horario (Open-Meteo, ver pronostico.ts): si no hay, se elige solo por la oscuridad.
//
// Las horas quedan al minuto y con los criterios de la línea de tiempo de la portada
// (features/pacha/linea.ts), para que la misma noche no muestre dos horas distintas del mismo hecho.
//
// Lógica pura, sin DOM ni imports relativos de valor: los tests corren este .ts directo con node.
import { Body, Equator, Horizon, Illumination, KM_PER_AU, MakeTime, MoonPhase, Observer, RAD2DEG } from "astronomy-engine";

/** Se muestran las horas en la de Argentina (UTC−3, sin horario de verano). */
const OFFSET_MS = -3 * 3600_000;
const MINUTO_MS = 60_000;
/** Resolución del barrido de la noche; cada cambio se afina después al minuto. */
export const PASO_MIN = 5;
/** Sol más bajo que esto: terminó el crepúsculo astronómico. */
export const SOL_NOCHE = -18;
/**
 * Salida y puesta de la Luna como las define astronomy-engine (SearchRiseSet), que es lo que muestra
 * la línea de tiempo: asoma el borde superior, con 34′ de refracción en el horizonte. El radio es el
 * ecuatorial que usa la biblioteca.
 */
const REFRACCION_HORIZONTE = 34 / 60;
const RADIO_LUNA_AU = 1738.1 / KM_PER_AU;
/** Debajo de esta fracción iluminada, la Luna no arruina el cielo aunque esté arriba. */
export const LUNA_FINA = 0.1;
/** Una franja más corta que esto no se anuncia en el titular de la portada: esa noche se cuenta como con Luna. */
export const FRANJA_ANUNCIABLE_MIN = 30;
/**
 * Cómo se nombra la nubosidad (% de cielo cubierto): hasta DESPEJADO_HASTA, «despejado»; hasta
 * ALGO_NUBLADO_HASTA, «algo nublado»; más que eso, «nublado». Son umbrales nuestros para leer el
 * porcentaje de un vistazo, no una escala oficial: por eso el número se muestra siempre al lado.
 */
export const DESPEJADO_HASTA = 25;
export const ALGO_NUBLADO_HASTA = 60;

/** El recordatorio de «Avisame esta noche»: cuánto dura el evento y cuánto antes avisa. */
export const RECORDATORIO_MIN = 60;
export const ALARMA_MIN = 30;

const HORA_MS = 3_600_000;
/** Open-Meteo da hasta 16 días de pronóstico; con margen, más horas que esto es una respuesta rara. */
const MAX_HORAS = 24 * 32;

export interface Lugar {
  latitude: number;
  longitude: number;
}

export interface Franja {
  /** ISO con offset −03:00. */
  desde: string;
  hasta: string;
}

/** Pronóstico horario de nubes de un lugar, tal como lo deja `leerOpenMeteo`. */
export interface NubesHorarias {
  /** ISO en UTC de la primera hora. */
  desde: string;
  /** % de cielo cubierto (0 a 100) de cada hora desde `desde`; null si esa hora no tiene dato. */
  porHora: (number | null)[];
}

export type EstadoDelCielo = "despejado" | "algo-nublado" | "nublado";

export interface NocheDeCielo {
  /** YYYY-MM-DD de la tarde en que empieza la noche. */
  fecha: string;
  /** Sol a −18° de tarde y de madrugada, al minuto; null si esa noche no llega a oscurecer del todo. */
  nocheCerrada: string | null;
  alba: string | null;
  /** Fracción iluminada de la Luna (0 a 1) a la medianoche. */
  lunaIluminada: number;
  /** Minutos de la franja: de `franja.desde` a `franja.hasta`. 0 si no hay franja. */
  minutosOscuros: number;
  /** El tramo más largo con Sol bajo −18° y sin Luna que moleste, al minuto. */
  franja: Franja | null;
  /**
   * Nubosidad media prevista (%, entero) en la franja oscura; si no hay franja, en toda la noche
   * cerrada. null si el pronóstico no cubre esas horas o no hay pronóstico.
   */
  nubes: number | null;
  /** Lo que se compara para elegir la mejor noche: ver `puntaje`. */
  puntaje: number;
}

function aISOLocal(ms: number): string {
  return `${new Date(ms + OFFSET_MS).toISOString().slice(0, 19)}-03:00`;
}

/** "HH:MM" de una hora ISO, en UTC−3. Sin redondear: el minuto en curso, como la línea de tiempo. */
export function hora(datetimeISO: string): string {
  return new Date(new Date(datetimeISO).getTime() + OFFSET_MS).toISOString().slice(11, 16);
}

/** El Sol (su centro, sin refracción) más bajo que SOL_NOCHE: lo que busca SearchAltitude en la línea de tiempo. */
function esNocheCerrada(ms: number, obs: Observer): boolean {
  const time = MakeTime(new Date(ms));
  const eq = Equator(Body.Sun, time, obs, true, true);
  return Horizon(time, obs, eq.ra, eq.dec).altitude < SOL_NOCHE;
}

/** La Luna asoma sobre el horizonte, aunque sea el borde: entre su salida y su puesta de la línea de tiempo. */
function hayLuna(ms: number, obs: Observer): boolean {
  const time = MakeTime(new Date(ms));
  const eq = Equator(Body.Moon, time, obs, true, true);
  const radio = RAD2DEG * Math.asin(RADIO_LUNA_AU / eq.dist);
  return Horizon(time, obs, eq.ra, eq.dec).altitude + radio >= -REFRACCION_HORIZONTE;
}

/**
 * Entre dos muestras vecinas del barrido que dan distinto (`antes` da `alEmpezar`; `despues`, lo
 * contrario), el último minuto en punto que todavía da `alEmpezar`. El cambio cae dentro de ese minuto,
 * y ese es el que se muestra: las horas no se redondean, igual que en la línea de tiempo.
 * Búsqueda binaria entre minutos en punto: 2 o 3 evaluaciones por borde.
 */
function minutoDelCambio(antes: number, despues: number, alEmpezar: boolean, cumple: (ms: number) => boolean): number {
  let [igual, distinto] = [antes, despues];
  while (distinto - igual > MINUTO_MS) {
    // Al menos un minuto más que `igual` y siempre antes que `distinto`: cada vuelta achica el tramo.
    const medio = igual + Math.ceil((distinto - igual) / (2 * MINUTO_MS)) * MINUTO_MS;
    if (cumple(medio) === alEmpezar) igual = medio;
    else distinto = medio;
  }
  return igual;
}

/**
 * El tramo seguido de `true` más largo, como índices [desde, hasta); el primero si empatan.
 * En Jujuy la Luna sale o se pone una sola vez por noche oscura, pero no lo damos por hecho.
 */
export function tramoMasLargo(muestras: boolean[]): { desde: number; hasta: number } | null {
  let mejor: { desde: number; hasta: number } | null = null;
  let desde: number | null = null;
  for (let i = 0; i <= muestras.length; i++) {
    if (muestras[i]) {
      desde ??= i;
    } else if (desde !== null) {
      if (!mejor || i - desde > mejor.hasta - mejor.desde) mejor = { desde, hasta: i };
      desde = null;
    }
  }
  return mejor;
}

/**
 * Lee la respuesta de Open-Meteo (`hourly=cloud_cover&timezone=UTC`): horas "2026-11-22T00:00" en UTC
 * y un % por hora. Devuelve null si la forma no es la esperada o no trae ningún dato: nunca inventa.
 */
export function leerOpenMeteo(json: unknown): NubesHorarias | null {
  const r = json as { utc_offset_seconds?: unknown; hourly?: { time?: unknown; cloud_cover?: unknown } } | null;
  const horas = r?.hourly?.time;
  const nubes = r?.hourly?.cloud_cover;
  if (r?.utc_offset_seconds !== 0 || !Array.isArray(horas) || !Array.isArray(nubes)) return null;
  if (horas.length === 0 || horas.length > MAX_HORAS || horas.length !== nubes.length) return null;
  const instante = (h: unknown) => (typeof h === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:00$/.test(h) ? Date.parse(`${h}:00Z`) : NaN);
  const desde = instante(horas[0]);
  // Una hora por posición, sin saltos: de eso depende `nubosidadMedia`.
  if (Number.isNaN(desde) || horas.some((h, i) => instante(h) !== desde + i * HORA_MS)) return null;
  const porHora = nubes.map((v) => (typeof v === "number" && v >= 0 && v <= 100 ? v : null));
  if (porHora.every((v) => v === null)) return null;
  return { desde: new Date(desde).toISOString(), porHora };
}

/**
 * Nubosidad media (%) entre dos instantes, pesando cada hora por los minutos que entran en el tramo.
 * Cada valor se toma como válido para la hora que empieza ahí: el pronóstico es horario, no da más detalle.
 * null si falta el dato de alguna de esas horas: no se promedia a medias.
 */
export function nubosidadMedia(nubes: NubesHorarias | null | undefined, desdeMs: number, hastaMs: number): number | null {
  if (!nubes || !Array.isArray(nubes.porHora) || !(hastaMs > desdeMs)) return null;
  const base = Date.parse(nubes.desde);
  if (Number.isNaN(base)) return null;
  let suma = 0;
  for (let i = Math.floor((desdeMs - base) / HORA_MS); base + i * HORA_MS < hastaMs; i++) {
    const v = nubes.porHora[i];
    if (typeof v !== "number") return null;
    const minutos = Math.min(hastaMs, base + (i + 1) * HORA_MS) - Math.max(desdeMs, base + i * HORA_MS);
    suma += v * minutos;
  }
  return suma / (hastaMs - desdeMs);
}

export function estadoDelCielo(nubes: number): EstadoDelCielo {
  if (nubes <= DESPEJADO_HASTA) return "despejado";
  return nubes <= ALGO_NUBLADO_HASTA ? "algo-nublado" : "nublado";
}

/**
 * La regla para comparar noches: minutos oscuros × parte del cielo sin nubes. Una noche de 4 h oscuras
 * con 50 % de nubes vale lo mismo que una de 2 h despejada. Sin pronóstico, los minutos oscuros tal cual
 * (como antes de conocer las nubes).
 */
export function puntaje(minutosOscuros: number, nubes: number | null): number {
  return nubes === null ? minutosOscuros : minutosOscuros * (1 - nubes / 100);
}

/**
 * Recorre la noche de `fecha` (de 18:00 a 08:00 del día siguiente) cada PASO_MIN minutos y afina al
 * minuto cada borde: dónde cambia entre dos muestras vecinas, se deba al Sol o a la Luna.
 * Con `nubes`, suma la nubosidad prevista para la franja oscura.
 */
export function nocheDeCielo(lugar: Lugar, fecha: string, nubes: NubesHorarias | null = null): NocheDeCielo {
  const obs = new Observer(lugar.latitude, lugar.longitude, 0);
  const inicio = new Date(`${fecha}T18:00:00-03:00`).getTime();
  const fin = inicio + 14 * 3600_000;
  const paso = PASO_MIN * MINUTO_MS;
  const lunaIluminada = Illumination(Body.Moon, MakeTime(new Date(inicio + 6 * 3600_000))).phase_fraction;
  const lunaFina = lunaIluminada < LUNA_FINA;
  const esNoche = (t: number) => esNocheCerrada(t, obs);
  const sinLuna = (t: number) => lunaFina || !hayLuna(t, obs);
  const estaOscuro = (t: number) => esNoche(t) && sinLuna(t);

  const muestras: { esNoche: boolean; oscuro: boolean }[] = [];
  for (let t = inicio; t < fin; t += paso) {
    const noche = esNoche(t);
    muestras.push({ esNoche: noche, oscuro: noche && sinLuna(t) });
  }
  // Un tramo de muestras [desde, hasta) que cumplen, con cada borde afinado al minuto entre la última
  // muestra de un lado y la primera del otro. En las puntas del barrido no hay vecina: queda la punta.
  const alMinuto = (tramo: { desde: number; hasta: number }, cumple: (ms: number) => boolean) => {
    const cambio = (i: number, alEmpezar: boolean) => minutoDelCambio(inicio + (i - 1) * paso, inicio + i * paso, alEmpezar, cumple);
    return {
      desde: tramo.desde === 0 ? inicio : cambio(tramo.desde, false),
      hasta: tramo.hasta === muestras.length ? fin : cambio(tramo.hasta, true),
    };
  };

  const noches = muestras.map((m) => m.esNoche);
  const cerrada = noches.includes(true) ? alMinuto({ desde: noches.indexOf(true), hasta: noches.lastIndexOf(true) + 1 }, esNoche) : null;
  const tramo = tramoMasLargo(muestras.map((m) => m.oscuro));
  const mejor = tramo ? alMinuto(tramo, estaOscuro) : null;
  // La duración sale de los mismos bordes que se muestran: «de 21:20 a 00:56» son 3 h 36 min.
  const oscuros = mejor ? (mejor.hasta - mejor.desde) / MINUTO_MS : 0;
  // Las nubes se miran donde importa: en la franja oscura; sin franja, en toda la noche cerrada.
  const ventana = mejor ?? cerrada;
  const media = ventana ? nubosidadMedia(nubes, ventana.desde, ventana.hasta) : null;
  // Entero: el mismo número que se muestra es el que se usa para elegir.
  const nubosidad = media === null ? null : Math.round(media);

  return {
    fecha,
    nocheCerrada: cerrada ? aISOLocal(cerrada.desde) : null,
    alba: cerrada ? aISOLocal(cerrada.hasta) : null,
    lunaIluminada,
    minutosOscuros: oscuros,
    franja: mejor ? { desde: aISOLocal(mejor.desde), hasta: aISOLocal(mejor.hasta) } : null,
    nubes: nubosidad,
    puntaje: puntaje(oscuros, nubosidad),
  };
}

/** Las horas en las que se miraron las nubes de esa noche: la franja oscura o, si no hay, la noche cerrada. */
export function ventanaDeNubes(n: NocheDeCielo): Franja | null {
  return n.franja ?? (n.nocheCerrada && n.alba ? { desde: n.nocheCerrada, hasta: n.alba } : null);
}

/**
 * Cuándo empieza el cielo de esa noche, para el recordatorio: al empezar la franja oscura; si la Luna
 * no deja franja, al cerrarse la noche. null si esa noche no llega a oscurecer.
 */
export function inicioDelCielo(n: NocheDeCielo): string | null {
  return n.franja?.desde ?? n.nocheCerrada;
}

export interface TitularDeLaNoche {
  texto: string;
  /** El titular da las horas de la franja: «esas horas» son las mismas en las que se miraron las nubes. */
  conFranja: boolean;
}

/**
 * El titular de «La noche en <lugar>» de la portada. Con una franja oscura de al menos
 * FRANJA_ANUNCIABLE_MIN, sus horas: las de `nocheDeCielo`, que son las de la línea de tiempo, las nubes
 * y el recordatorio. Sin franja, o con una más corta, cómo viene la Luna. null si esa noche no llega a
 * oscurecer: no hay nada que anunciar.
 * `luna` es la de esa noche: la fase ya en el idioma del titular y la parte iluminada en % (0 a 100).
 */
export function titularDeLaNoche(n: NocheDeCielo, luna: { fase: string; iluminada: number }, en: boolean): TitularDeLaNoche | null {
  if (n.nocheCerrada === null) return null;
  if (n.franja && n.minutosOscuros >= FRANJA_ANUNCIABLE_MIN) {
    const [desde, hasta] = [hora(n.franja.desde), hora(n.franja.hasta)];
    // Una Luna fina no corta la franja aunque esté arriba: esas noches no se promete «sin Luna».
    const sinLuna = n.lunaIluminada >= LUNA_FINA;
    const texto = en
      ? `Dark sky${sinLuna ? " with no Moon" : ""} from ${desde} to ${hasta}.`
      : `Cielo oscuro${sinLuna ? " y sin Luna" : ""} de ${desde} a ${hasta}.`;
    return { texto, conFranja: true };
  }
  if (luna.iluminada > 60) {
    const texto = en
      ? `${luna.fase} all night: great for seeing the moonlit mountains, not so much the Milky Way.`
      : `${luna.fase} toda la noche: ideal para ver los cerros iluminados, no tanto la Vía Láctea.`;
    return { texto, conFranja: false };
  }
  return { texto: en ? "The Moon is up for much of the night." : "La Luna acompaña buena parte de la noche.", conFranja: false };
}

/** Fase de la Luna a la medianoche de esa noche, en octavos del ciclo: 0 nueva, 2 cuarto creciente, 4 llena, 6 cuarto menguante. */
export function faseDeLaLuna(fecha: string): number {
  const medianoche = new Date(`${fecha}T18:00:00-03:00`).getTime() + 6 * HORA_MS;
  return Math.round(MoonPhase(MakeTime(new Date(medianoche))) / 45) % 8;
}

/** `n` fechas seguidas desde `fecha` (YYYY-MM-DD). */
export function fechasDesde(fecha: string, n: number): string[] {
  const base = new Date(`${fecha}T12:00:00Z`).getTime();
  return Array.from({ length: n }, (_, i) => new Date(base + i * 86_400_000).toISOString().slice(0, 10));
}

function laDeMas(noches: NocheDeCielo[], valor: (n: NocheDeCielo) => number): NocheDeCielo | null {
  let mejor: NocheDeCielo | null = null;
  for (const n of noches) {
    if (n.minutosOscuros === 0) continue;
    if (!mejor || valor(n) > valor(mejor) || (valor(n) === valor(mejor) && n.lunaIluminada < mejor.lunaIluminada)) mejor = n;
  }
  return mejor;
}

/**
 * Las noches del viaje en orden, y la mejor: la de más `puntaje` (minutos oscuros × parte del cielo
 * sin nubes); si empatan, la de Luna más fina, y si no, la primera. null si ninguna noche llega a
 * oscurecer. `masOscura` es la que ganaría sin mirar las nubes: sirve para explicar la elección.
 */
export function mejorNoche(
  lugar: Lugar,
  fechas: string[],
  nubes: NubesHorarias | null = null,
): { noches: NocheDeCielo[]; mejor: NocheDeCielo | null; masOscura: NocheDeCielo | null } {
  const noches = fechas.map((f) => nocheDeCielo(lugar, f, nubes));
  return { noches, mejor: laDeMas(noches, (n) => n.puntaje), masOscura: laDeMas(noches, (n) => n.minutosOscuros) };
}
