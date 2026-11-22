// Transición Tierra → Cielo (docs/design.md §7): la foto con la que se sale de Pacha
// aparece sobre el cielo calculado y se funde con él. Vive solo en memoria y solo durante
// la navegación: al recargar o compartir /cielo no hay foto ni animación.
import type { PlaceId } from "@/shared/types";

/** Nombre compartido de la view transition entre la foto de Pacha y el cielo. */
export const VT_TIERRA_CIELO = "tierra-cielo";

export interface FotoDeSalida {
  placeId: PlaceId;
  src: string;
}

let pendiente: FotoDeSalida | null = null;

/** Pacha: se llama al tocar «Ver el cielo desde acá». */
export function salirHaciaElCielo(foto: FotoDeSalida) {
  pendiente = foto;
}

/** Cielo: la foto con la que se llegó a este lugar, si se vino desde Pacha. */
export function fotoDeLlegada(placeId: PlaceId | null): FotoDeSalida | null {
  return pendiente && pendiente.placeId === placeId ? pendiente : null;
}

/** Cielo: cuando la foto terminó de fundirse. */
export function olvidarFotoDeLlegada() {
  pendiente = null;
}
