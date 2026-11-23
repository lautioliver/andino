// Matemática del cielo inmersivo: de J2000 a horizonte local y de ahí a la pantalla.
// Lógica pura (sin DOM). Escrito por jehp23.
import { MakeTime, Observer, Rotation_EQJ_HOR } from "astronomy-engine";
// Sin imports de valor relativos: los tests corren este .ts directo con node (ver motor.test.mjs).
import type { SkyLocation } from "./motor";

const RAD = Math.PI / 180;

/** Matriz 3×3 (fila mayor) de J2000 ecuatorial a horizonte (x = norte, y = oeste, z = cenit). */
export type Matriz = readonly number[];

/** Incluye precesión y nutación a la fecha (astronomy-engine). Una por instante y lugar. */
export function matrizHorizonte(location: SkyLocation, datetimeISO: string): Matriz {
  const time = MakeTime(new Date(datetimeISO));
  const { rot } = Rotation_EQJ_HOR(time, new Observer(location.latitude, location.longitude, location.heightMeters ?? 0));
  // Misma convención que RotateVector de astronomy-engine: salida_i = Σ_j rot[j][i] · v_j.
  return [rot[0][0], rot[1][0], rot[2][0], rot[0][1], rot[1][1], rot[2][1], rot[0][2], rot[1][2], rot[2][2]];
}

/** Refracción de Bennett (grados), solo cerca o sobre el horizonte, como el motor. */
export function refraccion(altitudDeg: number): number {
  if (altitudDeg < -1) return 0;
  return 1.02 / Math.tan((altitudDeg + 10.3 / (altitudDeg + 5.11)) * RAD) / 60;
}

/** AR/Dec J2000 en grados → altitud aparente y acimut (desde el norte, horario). */
export function aHorizonte(m: Matriz, arDeg: number, decDeg: number): { alt: number; az: number } {
  const cd = Math.cos(decDeg * RAD);
  const vx = cd * Math.cos(arDeg * RAD);
  const vy = cd * Math.sin(arDeg * RAD);
  const vz = Math.sin(decDeg * RAD);
  const norte = m[0] * vx + m[1] * vy + m[2] * vz;
  const oeste = m[3] * vx + m[4] * vy + m[5] * vz;
  const arriba = m[6] * vx + m[7] * vy + m[8] * vz;
  const alt = Math.asin(Math.max(-1, Math.min(1, arriba))) / RAD;
  const az = ((Math.atan2(-oeste, norte) / RAD) % 360 + 360) % 360;
  return { alt: alt + refraccion(alt), az };
}

export interface Vista {
  /** Rumbo hacia el que se mira, grados desde el norte. */
  az: number;
  /** Altura del centro de la vista, grados. */
  alt: number;
  /** Campo visual horizontal, grados. */
  fov: number;
  /** Inclinación lateral de la cámara, grados (`Vista.giro` de orientacion.ts). Sin ella, el horizonte queda nivelado. */
  giro?: number;
}

/** Vector unitario este-norte-arriba para una altitud y acimut. */
export function direccion(alt: number, az: number): [number, number, number] {
  const ca = Math.cos(alt * RAD);
  return [ca * Math.sin(az * RAD), ca * Math.cos(az * RAD), Math.sin(alt * RAD)];
}

export interface Camara {
  derecha: [number, number, number];
  arriba: [number, number, number];
  frente: [number, number, number];
  escala: number;
  ancho: number;
  alto: number;
}

export function camara(vista: Vista, ancho: number, alto: number): Camara {
  const frente = direccion(vista.alt, vista.az);
  // derecha = frente × cenit; arriba = derecha × frente.
  const dx = frente[1];
  const dy = -frente[0];
  const n = Math.hypot(dx, dy) || 1;
  const derecha: [number, number, number] = [dx / n, dy / n, 0];
  const arriba: [number, number, number] = [
    derecha[1] * frente[2] - derecha[2] * frente[1],
    derecha[2] * frente[0] - derecha[0] * frente[2],
    derecha[0] * frente[1] - derecha[1] * frente[0],
  ];
  const escala = ancho / 2 / (2 * Math.tan((vista.fov * RAD) / 4));
  if (!vista.giro) return { derecha, arriba, frente, escala, ancho, alto };
  // Teléfono ladeado: los ejes de la imagen giran alrededor de la mirada y el horizonte se inclina al revés.
  const c = Math.cos(vista.giro * RAD);
  const s = Math.sin(vista.giro * RAD);
  return {
    derecha: [c * derecha[0] + s * arriba[0], c * derecha[1] + s * arriba[1], c * derecha[2] + s * arriba[2]],
    arriba: [c * arriba[0] - s * derecha[0], c * arriba[1] - s * derecha[1], c * arriba[2] - s * derecha[2]],
    frente,
    escala,
    ancho,
    alto,
  };
}

/** Coordenadas de cámara (x a la derecha, y arriba, z hacia adelante) de un punto del cielo. */
export function enCamara(c: Camara, alt: number, az: number): [number, number, number] {
  const d = direccion(alt, az);
  return enCamaraVector(c, d[0], d[1], d[2]);
}

/** Lo mismo, para un vector unitario este-norte-arriba. */
function enCamaraVector(c: Camara, x: number, y: number, z: number): [number, number, number] {
  return [
    x * c.derecha[0] + y * c.derecha[1] + z * c.derecha[2],
    x * c.arriba[0] + y * c.arriba[1] + z * c.arriba[2],
    x * c.frente[0] + y * c.frente[1] + z * c.frente[2],
  ];
}

/** Proyección estereográfica a píxeles. `null` si queda detrás del observador. */
export function aPantalla(c: Camara, p: readonly [number, number, number]): { x: number; y: number } | null {
  if (p[2] < -0.2) return null;
  const k = 2 / (1 + p[2]);
  return { x: c.ancho / 2 + p[0] * k * c.escala, y: c.alto / 2 - p[1] * k * c.escala };
}

export function proyectar(c: Camara, alt: number, az: number) {
  return aPantalla(c, enCamara(c, alt, az));
}

/**
 * Los polos galácticos, [AR, Dec] J2000 en grados (norte: 12 h 51,4 min, +27° 08′; el sur es su antípoda).
 * La Vía Láctea no llega hasta ahí: son la referencia de «afuera» de sus regiones.
 */
export const POLOS_GALACTICOS: readonly (readonly [number, number])[] = [
  [192.86, 27.13],
  [12.86, -27.13],
];

/**
 * Puntos [AR, Dec] J2000 (grados) → tira de vectores unitarios locales este-norte-arriba: x, y, z de cada
 * punto, seguidos. Para lo que se recalcula en cada cuadro (la Vía Láctea), así no hay trigonometría por cuadro.
 */
export function tiraLocal(m: Matriz, puntos: readonly (readonly [number, number])[]): Float64Array {
  const tira = new Float64Array(puntos.length * 3);
  puntos.forEach(([ar, dec], i) => {
    const { alt, az } = aHorizonte(m, ar, dec);
    tira.set(direccion(alt, az), i * 3);
  });
  return tira;
}

/** Lo que se usa de un trazado de lienzo: lo cumple el contexto 2D y, en los tests, un registrador. */
export interface Trazo {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  rect(x: number, y: number, ancho: number, alto: number): void;
}

// Hasta dónde se proyecta un anillo tal cual: más lejos de la mirada que este ángulo (la estereográfica se va
// al infinito en el antípoda), sus vértices se dejan sobre el círculo de ese ángulo.
const ANGULO_LIMITE = 150 * RAD;
const COS_LIMITE = Math.cos(ANGULO_LIMITE);
/** Radio del círculo límite en la proyección, en unidades de `escala`. */
const RADIO_LIMITE = 2 * Math.tan(ANGULO_LIMITE / 2);
/** Sobre el círculo límite, dos puntos seguidos del trazado no se separan más que este ángulo: la recta entre ellos no se acerca a la pantalla. */
const PASO_LIMITE = 30 * RAD;
const COS_PASO = Math.cos(PASO_LIMITE);
/** Cuántos puntos puede sumar un tramo del anillo, como mucho: su vértice y los del medio giro por el círculo. */
const PUNTOS_POR_TRAMO = Math.ceil(Math.PI / PASO_LIMITE);
/** Un punto de afuera sirve de testigo si queda bien adentro del círculo límite: a menos de 120° de la mirada. */
const COS_TESTIGO = Math.cos(ANGULO_LIMITE - PASO_LIMITE);
/** Margen de la pantalla, en píxeles: hasta ahí llega el trazado exacto y el rectángulo que invierte el relleno. */
const MARGEN_PANTALLA = 16;

/** Donde se arma cada anillo ya proyectado (x, y de cada punto, seguidos). Se reutiliza de un cuadro a otro. */
let borrador = new Float64Array(0);

/**
 * Proyecta un anillo a píxeles, en `borrador`, y devuelve cuántos números dejó (dos por punto). Lo que queda
 * más allá del círculo límite se deja sobre él, en su misma dirección.
 */
function proyectarAnillo(c: Camara, anillo: ArrayLike<number>, radio: number): number {
  const lugar = Math.ceil(anillo.length / 3) * PUNTOS_POR_TRAMO * 2;
  if (borrador.length < lugar) borrador = new Float64Array(lugar);
  const b = borrador;
  const [dx, dy, dz] = c.derecha;
  const [ax, ay, az] = c.arriba;
  const [fx, fy, fz] = c.frente;
  const cx = c.ancho / 2;
  const cy = c.alto / 2;
  const fin = anillo.length - (anillo.length % 3);
  let n = 0;
  // `lejos`: el punto quedó sobre el círculo límite. El del primer punto y el del anterior.
  let lejos0 = false;
  let lejosA = false;
  for (let i = 0; i <= fin; i += 3) {
    let x: number;
    let y: number;
    let lejos: boolean;
    if (i < fin) {
      const vx = anillo[i];
      const vy = anillo[i + 1];
      const vz = anillo[i + 2];
      const z = vx * fx + vy * fy + vz * fz;
      const px = vx * dx + vy * dy + vz * dz;
      const py = vx * ax + vy * ay + vz * az;
      lejos = z < COS_LIMITE;
      let k: number;
      if (lejos) {
        const r = Math.sqrt(px * px + py * py);
        // Justo en el antípoda de la mirada no hay dirección: el anillo sigue sin ese vértice.
        if (r === 0) continue;
        k = radio / r;
      } else k = (2 * c.escala) / (1 + z);
      x = cx + px * k;
      y = cy - py * k;
    } else {
      // La última vuelta no agrega un punto: mira el tramo que cierra el anillo en el primero.
      if (n === 0) break;
      x = b[0];
      y = b[1];
      lejos = lejos0;
    }
    if (n > 0 && lejos && lejosA) {
      // Dos seguidos sobre el círculo límite. Si están muy separados (el anillo pasa cerca del antípoda de la
      // mirada), la recta entre ellos cortaría camino por la pantalla: se va por el círculo, por el lado corto.
      const ux = b[n - 2] - cx;
      const uy = b[n - 1] - cy;
      const escalar = ux * (x - cx) + uy * (y - cy);
      if (escalar < COS_PASO * radio * radio) {
        const desde = Math.atan2(uy, ux);
        const giro = Math.atan2(ux * (y - cy) - uy * (x - cx), escalar);
        const pasos = Math.ceil(Math.abs(giro) / PASO_LIMITE);
        for (let j = 1; j < pasos; j++) {
          b[n++] = cx + radio * Math.cos(desde + (giro * j) / pasos);
          b[n++] = cy + radio * Math.sin(desde + (giro * j) / pasos);
        }
      }
    }
    if (i < fin) {
      if (n === 0) lejos0 = lejos;
      b[n++] = x;
      b[n++] = y;
    }
    lejosA = lejos;
  }
  return n;
}

/**
 * Agrega al trazado una región del cielo, para rellenar con la regla par-impar (los anillos interiores son
 * huecos). Cada anillo es una tira de vectores unitarios locales (ver `tiraLocal`); `afuera`, otra tira con
 * puntos que se sabe que no son de la región. Devuelve si hay que rellenar: `false` cuando no puede asegurar
 * qué lado es el de adentro, y en ese cuadro la región no se dibuja.
 *
 * Los anillos van enteros, sin recortar contra lo que se ve: un recorte une con una recta el punto donde el
 * anillo sale de la vista con el punto donde vuelve a entrar, y si el anillo da la vuelta al cielo (la Vía
 * Láctea) esa recta cruza la pantalla. Lo que queda más allá del círculo límite se deja sobre él, en su
 * misma dirección: el anillo rodea la pantalla por afuera igual que el real. Así cada borde queda en su
 * lugar, pero el relleno sale al revés cuando el antípoda de la mirada cae dentro de la región. Lo deciden
 * los puntos de afuera: si el trazado los rellenaría, se suma un rectángulo que cubre la pantalla y lo invierte.
 */
export function trazarRegion(trazo: Trazo, c: Camara, anillos: readonly ArrayLike<number>[], afuera: ArrayLike<number>): boolean {
  const cx = c.ancho / 2;
  const cy = c.alto / 2;
  const radio = RADIO_LIMITE * c.escala;
  // La pantalla tiene que entrar holgada en el círculo límite (con un campo visual disparatado no entra).
  if (!(Math.hypot(c.ancho, c.alto) < radio && radio < Infinity)) return false;

  // Testigos: los puntos de afuera que quedan delante, ya en píxeles, y cuántas veces cruzan los anillos la
  // semirrecta que sale de cada uno hacia la derecha (impar: el trazado lo rellenaría).
  const testigos: number[] = [];
  for (let i = 0; i + 2 < afuera.length; i += 3) {
    const p = enCamaraVector(c, afuera[i], afuera[i + 1], afuera[i + 2]);
    if (!(p[2] >= COS_TESTIGO)) continue;
    const k = (2 * c.escala) / (1 + p[2]);
    testigos.push(cx + p[0] * k, cy - p[1] * k);
  }
  if (testigos.length === 0) return false;
  const cruces = new Array<number>(testigos.length / 2).fill(0);

  // De qué lados de la pantalla (con su margen) queda un punto: un bit por lado, 0 si está adentro.
  const izquierda = -MARGEN_PANTALLA;
  const derecha = c.ancho + MARGEN_PANTALLA;
  const arriba = -MARGEN_PANTALLA;
  const abajo = c.alto + MARGEN_PANTALLA;
  const lados = (x: number, y: number) => (x < izquierda ? 1 : x > derecha ? 2 : 0) | (y < arriba ? 4 : y > abajo ? 8 : 0);

  for (const anillo of anillos) {
    const n = proyectarAnillo(c, anillo, radio);
    if (n === 0) continue;
    const b = borrador;
    for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
      for (let t = 0; t < testigos.length; t += 2) {
        const ty = testigos[t + 1];
        if (b[j + 1] > ty !== b[i + 1] > ty && testigos[t] < b[j] + ((ty - b[j + 1]) * (b[i] - b[j])) / (b[i + 1] - b[j + 1])) cruces[t >> 1]++;
      }
    }
    // Al lienzo no van los puntos de más: una tanda de puntos seguidos que quedan todos del mismo lado de la
    // pantalla se reemplaza por la recta entre el primero y el último, que tampoco la toca. Lo que se ve no cambia.
    trazo.moveTo(b[0], b[1]);
    let comunes = lados(b[0], b[1]);
    let salteado = -1;
    for (let i = 2; i < n; i += 2) {
      const l = lados(b[i], b[i + 1]);
      if (comunes & l) {
        comunes &= l;
        salteado = i;
        continue;
      }
      if (salteado >= 0) trazo.lineTo(b[salteado], b[salteado + 1]);
      trazo.lineTo(b[i], b[i + 1]);
      comunes = l;
      salteado = -1;
    }
    // El cierre vuelve al primer punto: si la última tanda no comparte lado con él, termina en su último punto.
    if (salteado >= 0 && !(comunes & lados(b[0], b[1]))) trazo.lineTo(b[salteado], b[salteado + 1]);
    trazo.closePath();
  }

  // Los testigos están afuera: si el trazado los rellenaría, quedó al revés. Y si no coinciden entre ellos,
  // algo no cerró: mejor un cuadro sin la región que el cielo entero relleno.
  const alReves = cruces[0] % 2 === 1;
  for (const veces of cruces) if ((veces % 2 === 1) !== alReves) return false;
  if (alReves) trazo.rect(-MARGEN_PANTALLA, -MARGEN_PANTALLA, c.ancho + 2 * MARGEN_PANTALLA, c.alto + 2 * MARGEN_PANTALLA);
  return true;
}

/** Color aproximado de una estrella según su índice B−V (de azulada a anaranjada), suavizado. */
export function colorEstrella(bv: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, (bv + 0.3) / 2.0));
  const azul: [number, number, number] = [170, 196, 255];
  const blanco: [number, number, number] = [250, 247, 240];
  const naranja: [number, number, number] = [255, 196, 140];
  const mezclar = (a: number[], b: number[], u: number) =>
    a.map((v, i) => Math.round(v + (b[i] - v) * u)) as [number, number, number];
  return t < 0.25 ? mezclar(azul, blanco, t / 0.25) : mezclar(blanco, naranja, (t - 0.25) / 0.75);
}

/** Radio en píxeles según magnitud (más brillante = más grande). */
export function radioEstrella(mag: number): number {
  return Math.max(0.5, 2.6 - 0.42 * mag);
}

/**
 * Cuánto se ven las estrellas según la altura del Sol: 0 de día, 1 de noche cerrada.
 * Las más brillantes aparecen en el crepúsculo civil, el resto hacia el náutico.
 */
export function oscuridad(altitudSolDeg: number): number {
  return Math.max(0, Math.min(1, (-altitudSolDeg - 3) / 12));
}

/** Colores del cielo (cenit y horizonte) según la altura del Sol. */
export function coloresCielo(altitudSolDeg: number): { cenit: string; horizonte: string } {
  const noche = { cenit: [6, 9, 22], horizonte: [18, 26, 48] };
  const crepusculo = { cenit: [22, 34, 72], horizonte: [150, 96, 84] };
  const dia = { cenit: [58, 110, 170], horizonte: [150, 190, 220] };
  const mezclar = (a: number[], b: number[], u: number) => a.map((v, i) => Math.round(v + (b[i] - v) * u));
  const rgb = (c: number[]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  let cenit: number[];
  let horizonte: number[];
  if (altitudSolDeg >= 4) {
    cenit = dia.cenit;
    horizonte = dia.horizonte;
  } else if (altitudSolDeg >= -6) {
    const u = (altitudSolDeg + 6) / 10;
    cenit = mezclar(crepusculo.cenit, dia.cenit, u);
    horizonte = mezclar(crepusculo.horizonte, dia.horizonte, u);
  } else {
    const u = Math.max(0, Math.min(1, (altitudSolDeg + 18) / 12));
    cenit = mezclar(noche.cenit, crepusculo.cenit, u);
    horizonte = mezclar(noche.horizonte, crepusculo.horizonte, u);
  }
  return { cenit: rgb(cenit), horizonte: rgb(horizonte) };
}

/** Instante desplazado `minutos` y expresado en hora de Argentina con zona explícita. */
export function desplazarISO(datetimeISO: string, minutos: number): string {
  const d = new Date(new Date(datetimeISO).getTime() + minutos * 60000 - 3 * 3600000);
  return `${d.toISOString().slice(0, 19)}-03:00`;
}
