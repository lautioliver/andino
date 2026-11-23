// «Apuntá»: hacia dónde mira la cámara de atrás del teléfono, a partir de DeviceOrientation.
// Lógica pura (sin DOM): los tests corren este .ts directo con node.
//
// Convención W3C: el marco de la Tierra es x = este, y = norte, z = arriba, y la rotación del
// dispositivo es R = Rz(alpha) · Rx(beta) · Ry(gamma). Las columnas de R son los ejes del teléfono
// (x = borde derecho, y = tope, z = sale de la pantalla) vistos desde la Tierra. La cámara de atrás
// apunta al −z del teléfono, esté la pantalla vertical u horizontal; su «arriba» es el tope del
// teléfono o, con la pantalla rotada, el borde que quedó arriba.

export interface Vista {
  /** Acimut desde el norte, en sentido horario (0–360). */
  az: number;
  /** Altura sobre el horizonte (−90 a 90). */
  alt: number;
  /**
   * Inclinación lateral (−180 a 180): cuánto está volcado el «arriba» de la imagen respecto de la vertical.
   * Positiva con el tope hacia la izquierda de quien sostiene el teléfono (giro antihorario).
   */
  giro: number;
}

export type Vector = readonly [number, number, number];

/** Orientación completa de la cámara de atrás, en el marco de la Tierra (este, norte, arriba). */
export interface Pose {
  /** Hacia dónde mira. */
  frente: Vector;
  /** El «arriba» de la imagen, perpendicular a `frente`. */
  arriba: Vector;
}

const rad = Math.PI / 180;
const punto = (a: Vector, b: Vector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cruz = (a: Vector, b: Vector): Vector => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * alpha, beta y gamma en grados, con alpha absoluto (0 = el tope del teléfono al norte, crece hacia el oeste).
 * `anguloPantalla` es `screen.orientation.angle`: 0 con la pantalla parada, 90 cuando el contenido rotó porque
 * el teléfono se acostó con el tope a la izquierda, 270 con el tope a la derecha.
 */
export function poseDeLaCamara(alpha: number, beta: number, gamma: number, anguloPantalla = 0): Pose {
  const [cA, sA] = [Math.cos(alpha * rad), Math.sin(alpha * rad)];
  const [cB, sB] = [Math.cos(beta * rad), Math.sin(beta * rad)];
  const [cG, sG] = [Math.cos(gamma * rad), Math.sin(gamma * rad)];
  const x: Vector = [cA * cG - sA * sB * sG, sA * cG + cA * sB * sG, -cB * sG];
  const y: Vector = [-sA * cB, cA * cB, sB];
  const z: Vector = [cA * sG + sA * sB * cG, sA * sG - cA * sB * cG, cB * cG];
  const [cP, sP] = [Math.cos(anguloPantalla * rad), Math.sin(anguloPantalla * rad)];
  return {
    frente: [-z[0], -z[1], -z[2]],
    arriba: [sP * x[0] + cP * y[0], sP * x[1] + cP * y[1], sP * x[2] + cP * y[2]],
  };
}

/** Rumbo, altura e inclinación lateral de una pose. */
export function vistaDePose({ frente, arriba }: Pose): Vista {
  const [este, norte, cenit] = frente;
  const horizontal = Math.hypot(este, norte);
  const alt = Math.asin(Math.max(-1, Math.min(1, cenit))) / rad;
  // Mirando justo al cenit o al suelo no hay rumbo: se toma el norte y el giro lleva toda la vuelta.
  const conRumbo = horizontal > 1e-6;
  const az = conRumbo ? (Math.atan2(este, norte) / rad + 360) % 360 : 0;
  // Sin inclinación lateral, la derecha de la imagen es horizontal (frente × cenit) y el arriba sale de ahí.
  const derecha0: Vector = conRumbo ? [norte / horizontal, -este / horizontal, 0] : [1, 0, 0];
  const arriba0 = cruz(derecha0, frente);
  // `|| 0`: sin inclinación, el −0 de la cuenta se entrega como 0.
  const giro = Math.atan2(-punto(arriba, derecha0), punto(arriba, arriba0)) / rad || 0;
  return { az, alt, giro };
}

/** Hacia dónde mira la cámara de atrás: `poseDeLaCamara` y `vistaDePose` en un paso. */
export function vistaDeLaCamara(alpha: number, beta: number, gamma: number, anguloPantalla = 0): Vista {
  return vistaDePose(poseDeLaCamara(alpha, beta, gamma, anguloPantalla));
}

/**
 * alpha absoluto según lo que entregue el navegador, o null si no hay forma de saber dónde está
 * el norte (en ese caso no se simula: se gira con el dedo).
 * - Android/Chrome: `deviceorientationabsolute`, con alpha ya referido al norte.
 * - iOS/Safari: alpha es relativo; el norte viene en `webkitCompassHeading` (horario desde el norte).
 */
export function alphaAbsoluto(e: { alpha: number | null; absolute?: boolean; webkitCompassHeading?: number }): number | null {
  if (typeof e.webkitCompassHeading === "number" && Number.isFinite(e.webkitCompassHeading)) {
    return (360 - e.webkitCompassHeading) % 360;
  }
  if (e.absolute && typeof e.alpha === "number") return e.alpha;
  return null;
}

/** Diferencia más corta de `a` a `b` en grados (−180 a 180). */
export function deltaAngular(a: number, b: number): number {
  return ((((b - a) % 360) + 540) % 360) - 180;
}

/**
 * Filtro de paso bajo para que el cielo no tiemble: acerca `anterior` a `nueva` en fracción `k`.
 * Se filtran los vectores y no rumbo, altura e inclinación por separado: mirando cerca del cenit esos
 * ángulos saltan aunque el teléfono casi no se mueva, y con vectores no hay casos de borde que cuidar.
 */
export function suavizarPose(anterior: Pose | null, nueva: Pose, k = 0.25): Pose {
  if (!anterior) return nueva;
  const mezcla = (a: Vector, b: Vector): Vector => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const f = mezcla(anterior.frente, nueva.frente);
  const largoF = Math.hypot(f[0], f[1], f[2]);
  if (largoF < 1e-6) return nueva; // lecturas opuestas: no hay camino corto entre las dos
  const frente: Vector = [f[0] / largoF, f[1] / largoF, f[2] / largoF];
  // El arriba mezclado se vuelve a dejar perpendicular al frente.
  const a = mezcla(anterior.arriba, nueva.arriba);
  const sobra = punto(a, frente);
  const p: Vector = [a[0] - sobra * frente[0], a[1] - sobra * frente[1], a[2] - sobra * frente[2]];
  const largoA = Math.hypot(p[0], p[1], p[2]);
  if (largoA < 1e-6) return nueva;
  return { frente, arriba: [p[0] / largoA, p[1] / largoA, p[2] / largoA] };
}
