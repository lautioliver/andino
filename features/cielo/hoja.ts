// Hoja inferior de Cielo: a qué posición encastra al soltarla y cómo encuadrar el cielo que deja
// a la vista. Lógica pura (sin DOM). Propiedad: jehp23.

export type PosicionHoja = "alta" | "baja";

/** Velocidad (px/ms) a partir de la cual un tirón decide la posición, sin importar dónde se suelte. */
const TIRON = 0.4;

/** Topes del centro del cielo visible, en grados. */
export const ALTITUD_MIN = 8;
export const ALTITUD_MAX = 80;

/**
 * `desplazamiento`: cuánto está bajada la hoja (0 = alta, `recorrido` = baja).
 * `velocidad`: px/ms al soltar, positiva hacia abajo.
 */
export function soltarHoja({
  desplazamiento,
  recorrido,
  velocidad,
}: {
  desplazamiento: number;
  recorrido: number;
  velocidad: number;
}): PosicionHoja {
  if (recorrido <= 0) return "baja";
  if (velocidad <= -TIRON) return "alta";
  if (velocidad >= TIRON) return "baja";
  return desplazamiento < recorrido / 2 ? "alta" : "baja";
}

export function limitarHoja(desplazamiento: number, recorrido: number): number {
  return Math.min(recorrido, Math.max(0, desplazamiento));
}

/**
 * Cuántos grados hay que bajar la cámara para que el centro del cielo visible (sobre la hoja)
 * quede donde antes estaba el centro de la pantalla. Aproximación lineal de la proyección.
 */
export function gradosTapados(pxTapados: number, ancho: number, fov: number): number {
  if (pxTapados <= 0 || ancho <= 0) return 0;
  return ((pxTapados / 2) * fov) / ancho;
}

/** Topes del centro del cielo visible: abajo se sigue viendo el horizonte; arriba, sin pasar el cenit. */
export function limitarAltitud(altitud: number): number {
  return Math.min(ALTITUD_MAX, Math.max(ALTITUD_MIN, altitud));
}

/** Altura de la cámara para que el centro del cielo visible (sobre la hoja) quede a `altitudVisible`. */
export function altitudCamara(altitudVisible: number, tapados: number): number {
  return altitudVisible - tapados;
}
