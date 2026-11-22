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
}

/** Vector unitario este-norte-arriba para una altitud y acimut. */
function direccion(alt: number, az: number): [number, number, number] {
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
  return { derecha, arriba, frente, escala, ancho, alto };
}

/** Coordenadas de cámara (x a la derecha, y arriba, z hacia adelante) de un punto del cielo. */
export function enCamara(c: Camara, alt: number, az: number): [number, number, number] {
  const d = direccion(alt, az);
  return [
    d[0] * c.derecha[0] + d[1] * c.derecha[1] + d[2] * c.derecha[2],
    d[0] * c.arriba[0] + d[1] * c.arriba[1] + d[2] * c.arriba[2],
    d[0] * c.frente[0] + d[1] * c.frente[1] + d[2] * c.frente[2],
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

/** Recorta un polígono en coordenadas de cámara contra el plano z = zMin (Sutherland–Hodgman). */
export function recortarPoligono(puntos: [number, number, number][], zMin = -0.2): [number, number, number][] {
  const salida: [number, number, number][] = [];
  for (let i = 0; i < puntos.length; i++) {
    const a = puntos[i];
    const b = puntos[(i + 1) % puntos.length];
    const aDentro = a[2] >= zMin;
    const bDentro = b[2] >= zMin;
    if (aDentro) salida.push(a);
    if (aDentro !== bDentro) {
      const t = (zMin - a[2]) / (b[2] - a[2]);
      salida.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), zMin]);
    }
  }
  return salida;
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
