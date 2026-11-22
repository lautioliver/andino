// «Apuntá»: hacia dónde mira la cámara de atrás del teléfono, a partir de DeviceOrientation.
// Lógica pura (sin DOM): los tests corren este .ts directo con node.
//
// Convención W3C: el marco de la Tierra es x = este, y = norte, z = arriba, y la rotación del
// dispositivo es R = Rz(alpha) · Rx(beta) · Ry(gamma). La cámara de atrás apunta al −z del
// teléfono, así que su dirección es −R·(0, 0, 1). No depende de si la pantalla está vertical
// u horizontal.

export interface Vista {
  /** Acimut desde el norte, en sentido horario (0–360). */
  az: number;
  /** Altura sobre el horizonte (−90 a 90). */
  alt: number;
}

const rad = Math.PI / 180;

/** alpha, beta y gamma en grados, con alpha absoluto (0 = el tope del teléfono al norte, crece hacia el oeste). */
export function vistaDeLaCamara(alpha: number, beta: number, gamma: number): Vista {
  const [cA, sA] = [Math.cos(alpha * rad), Math.sin(alpha * rad)];
  const [cB, sB] = [Math.cos(beta * rad), Math.sin(beta * rad)];
  const [cG, sG] = [Math.cos(gamma * rad), Math.sin(gamma * rad)];
  const este = -cA * sG - sA * sB * cG;
  const norte = -sA * sG + cA * sB * cG;
  const arriba = -cB * cG;
  const az = (Math.atan2(este, norte) / rad + 360) % 360;
  const alt = Math.asin(Math.max(-1, Math.min(1, arriba))) / rad;
  return { az, alt };
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

/** Filtro de paso bajo para que el cielo no tiemble: acerca `anterior` a `nueva` en fracción `k`. */
export function suavizar(anterior: Vista | null, nueva: Vista, k = 0.25): Vista {
  if (!anterior) return nueva;
  return {
    az: (anterior.az + deltaAngular(anterior.az, nueva.az) * k + 360) % 360,
    alt: anterior.alt + (nueva.alt - anterior.alt) * k,
  };
}
