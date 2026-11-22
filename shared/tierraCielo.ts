// Transición Tierra → Cielo (docs/design.md §7): la foto con la que se sale de Pacha
// aparece sobre el cielo calculado y se funde con él. Vive solo en memoria y solo durante
// la navegación: al recargar o compartir /cielo no hay foto ni animación.
import { useSyncExternalStore } from "react";
import type { PlaceId } from "@/shared/types";

/** Nombre compartido de la view transition entre la foto de Pacha y el cielo. */
export const VT_TIERRA_CIELO = "tierra-cielo";

export interface FotoDeSalida {
  placeId: PlaceId;
  src: string;
}

let pendiente: FotoDeSalida | null = null;
// Next conserva el estado de /cielo entre visitas: Cielo escucha cada salida en vez de leerla solo al montar.
const oyentes = new Set<() => void>();
function avisar() {
  oyentes.forEach((o) => o());
}
function suscribir(o: () => void) {
  oyentes.add(o);
  return () => oyentes.delete(o);
}

/** Pacha: se llama al tocar «Mirar el cielo completo». */
export function salirHaciaElCielo(foto: FotoDeSalida) {
  pendiente = foto;
  avisar();
}

/** Cielo: la foto de llegada como estado de React (se actualiza en cada salida desde Pacha). */
export function useFotoDeLlegada(placeId: PlaceId | null): FotoDeSalida | null {
  const foto = useSyncExternalStore(suscribir, () => pendiente, () => null);
  return foto && foto.placeId === placeId ? foto : null;
}

/** Cielo: cuando la foto terminó de fundirse. */
export function olvidarFotoDeLlegada() {
  pendiente = null;
  avisar();
}
