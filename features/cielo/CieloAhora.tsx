"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import type { AndinoPlace } from "@/shared/types";
import { luzDelCielo, rumbo } from "./cielo";
import { desplazarISO } from "./firmamento";
import { sunAltitudeDeg } from "./motor";

// El catálogo de estrellas se baja aparte: el titular de Inicio no lo espera.
const CieloDeFondo = dynamic(() => import("./CieloDeFondo").then((m) => m.CieloDeFondo), { ssr: false });

const RUMBO_AZ = 180; // Mirando al sur: Cruz del Sur y la Vía Láctea austral.
const LUZ = { dia: "de día", crepusculo: "crepúsculo", noche: "de noche" } as const;

// La hora del teléfono, al minuto. En el servidor no hay "ahora": el cielo aparece al hidratar.
const minutoActual = () => Math.floor(Date.now() / 60000);
const sinAhora = () => null;
function cadaMinuto(avisar: () => void) {
  const id = window.setInterval(avisar, 20000);
  return () => window.clearInterval(id);
}

/**
 * El cielo calculado para un lugar en este momento, como fondo de su contenedor
 * (que tiene que ser `relative`). Incluye la leyenda que dice qué se está viendo.
 */
export function CieloAhora({ place }: { place: AndinoPlace }) {
  const minuto = useSyncExternalStore(cadaMinuto, minutoActual, sinAhora);
  if (minuto === null) return null;
  const iso = desplazarISO(new Date(minuto * 60000).toISOString(), 0);
  const luz = luzDelCielo(sunAltitudeDeg(place, iso));

  return (
    <>
      <div className="absolute inset-0">
        <CieloDeFondo location={place} datetimeISO={iso} az={RUMBO_AZ} />
      </div>
      <p className="absolute top-4 left-4 right-4 w-fit rounded-full bg-bg/70 px-3 py-1 text-xs text-text-muted">
        {place.name} ahora, al {rumbo(RUMBO_AZ)} ·{" "}
        <span className="font-medium text-text tabular-nums">{iso.slice(11, 16)}</span> · {LUZ[luz]}
      </p>
    </>
  );
}
