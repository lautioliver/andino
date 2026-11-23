// «Cámara» de «Apuntá»: la imagen de la cámara de atrás detrás del cielo dibujado.
// Lógica pura (sin DOM): los tests corren este .ts directo con node.

const RAD = Math.PI / 180;

/**
 * Campo visual diagonal que se le supone a la cámara de atrás, en grados. El navegador no lo informa:
 * es el de un lente de unos 26 mm equivalentes (2·atan(21,6 / 26) ≈ 80°), habitual en la cámara principal.
 * Cada teléfono es distinto y el video puede venir recortado: por eso la interfaz dice que la
 * coincidencia es aproximada.
 */
export const DIAGONAL_SUPUESTA_DEG = 80;

export interface Tamanio {
  ancho: number;
  alto: number;
}

/**
 * Campo visual horizontal (grados) de la parte del video que queda a la vista cuando cubre un área
 * recortándose (`object-fit: cover`). Con ese campo, el cielo dibujado y la imagen coinciden en el
 * centro y en los bordes laterales. `null` si falta alguna medida (el video todavía no cargó).
 */
export function campoVisible(video: Tamanio, area: Tamanio, diagonalDeg = DIAGONAL_SUPUESTA_DEG): number | null {
  if (!(video.ancho > 0 && video.alto > 0 && area.ancho > 0 && area.alto > 0)) return null;
  // Distancia focal en píxeles del video, para una cámara ideal (sin distorsión).
  const focal = Math.hypot(video.ancho, video.alto) / 2 / Math.tan((diagonalDeg * RAD) / 2);
  const escala = Math.max(area.ancho / video.ancho, area.alto / video.alto);
  const mitadVisible = area.ancho / 2 / escala;
  return (2 * Math.atan(mitadVisible / focal)) / RAD;
}

export type FalloDeCamara = "denegada" | "sin-camara";

/** Por qué falló getUserMedia: sin permiso, o sin una cámara que se pueda usar. */
export function falloDeCamara(error: unknown): FalloDeCamara {
  const nombre = typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";
  return nombre === "NotAllowedError" || nombre === "SecurityError" ? "denegada" : "sin-camara";
}

/**
 * Con `facingMode: { ideal: "environment" }`, un equipo sin cámara de atrás entrega la del frente, que mira
 * para el otro lado: no sirve de fondo. Muchos navegadores no informan el lado; ahí se acepta la que haya.
 */
export function esCamaraDeAtras(facingMode: string | undefined): boolean {
  return facingMode !== "user";
}
