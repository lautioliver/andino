// La Yacana, la llama del cielo andino: una constelación oscura en la Vía Láctea, con dos estrellas
// brillantes por ojos. Fuentes y límites de lo que podemos afirmar: docs/fuentes-cielo-andino.md.
//
// Lógica pura, sin DOM ni imports relativos de valor: los tests corren este .ts directo con node.
import { Body, GeoVector, HorizonFromVector, MakeTime, Observer, Rotation_EQJ_HOR, RotateVector, Spherical, VectorFromSphere } from "astronomy-engine";

export interface Lugar {
  latitude: number;
  longitude: number;
}

/** AR, Dec J2000 en grados. */
export type Coordenada = readonly [number, number];

export interface FiguraAndina {
  id: "yacana";
  nombre: string;
  /** Los ojos (Llamaqñawin): α y β Centauri, según Pinasco (2024). Huarochirí habla de «dos ojos» sin nombrar estrellas. */
  ojos: readonly [Coordenada, Coordenada];
  /**
   * Dónde escribir el nombre: la Vía Láctea entre la Cruz del Sur y ε Scorpii (Urton 1981, según Magli 2004),
   * en l = 325°, b = 2° galácticas, en Norma. Es un punto de referencia, no un borde de la figura.
   */
  etiqueta: Coordenada;
}

export const YACANA: FiguraAndina = {
  id: "yacana",
  nombre: "Yacana",
  ojos: [
    [219.902, -60.834], // α Cen
    [210.956, -60.373], // β Cen
  ],
  etiqueta: [232.49, -53.94],
};

export interface Posicion {
  /** Altitud geométrica en grados (sin refracción, como posicionDelSigno). */
  alt: number;
  /** Acimut desde el norte, en sentido horario. */
  az: number;
}

function horizonte(observer: Observer, datetimeISO: string, [ar, dec]: Coordenada): Posicion {
  const time = MakeTime(new Date(datetimeISO));
  const eqj = VectorFromSphere(new Spherical(dec, ar, 1), time);
  const hor = HorizonFromVector(RotateVector(Rotation_EQJ_HOR(time, observer), eqj), "");
  return { alt: hor.lat, az: hor.lon };
}

/** Dónde están los dos ojos de la Yacana, para un lugar y un instante (ISO con zona). */
export function posicionDeLosOjos(lugar: Lugar, datetimeISO: string): [Posicion, Posicion] {
  const observer = new Observer(lugar.latitude, lugar.longitude, 0);
  return [horizonte(observer, datetimeISO, YACANA.ojos[0]), horizonte(observer, datetimeISO, YACANA.ojos[1])];
}

/**
 * La mejor hora de la noche para ver los ojos de la Yacana: cuando el más bajo de los dos está
 * más alto, con el Sol más de 12° bajo el horizonte. `fecha` es la tarde en que empieza la noche.
 * null si esa noche no suben los dos a `alturaMinima` grados con cielo oscuro.
 */
export function mejorMomentoYacana(
  lugar: Lugar,
  fecha: string,
  alturaMinima = 10,
): { datetimeISO: string; alt: number; az: number } | null {
  const inicio = new Date(`${fecha}T18:00:00-03:00`).getTime();
  const observer = new Observer(lugar.latitude, lugar.longitude, 0);
  let mejor: { datetimeISO: string; alt: number; az: number } | null = null;
  for (let min = 0; min <= 12 * 60; min += 10) {
    const instante = new Date(inicio + min * 60_000);
    const time = MakeTime(instante);
    const sol = HorizonFromVector(RotateVector(Rotation_EQJ_HOR(time, observer), GeoVector(Body.Sun, time, true)), "");
    if (sol.lat > -12) continue;
    const datetimeISO = instante.toISOString();
    const [a, b] = [horizonte(observer, datetimeISO, YACANA.ojos[0]), horizonte(observer, datetimeISO, YACANA.ojos[1])];
    const alt = Math.min(a.alt, b.alt);
    // Acimut del punto medio entre los ojos (están a 4° uno del otro: el promedio simple alcanza, salvo cruzando el norte, que no pasa).
    if (alt >= alturaMinima && (!mejor || alt > mejor.alt)) mejor = { datetimeISO, alt, az: (a.az + b.az) / 2 };
  }
  return mejor;
}
