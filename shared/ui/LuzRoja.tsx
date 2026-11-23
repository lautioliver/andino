"use client";

import { useSyncExternalStore } from "react";
import { useT } from "@/shared/i18n/lang";
import { CLAVE_LUZ_ROJA } from "./luzRojaGuardada";

const oyentes = new Set<() => void>();
const leer = () => document.documentElement.dataset.luz === "roja";

function suscribir(f: () => void) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

function setLuzRoja(encendida: boolean) {
  if (encendida) document.documentElement.dataset.luz = "roja";
  else delete document.documentElement.dataset.luz;
  try {
    if (encendida) localStorage.setItem(CLAVE_LUZ_ROJA, "1");
    else localStorage.removeItem(CLAVE_LUZ_ROJA);
  } catch {}
  oyentes.forEach((f) => f());
}

/** En el servidor siempre apagada: el script del layout la enciende antes de hidratar, sin desajuste. */
function useLuzRoja(): boolean {
  return useSyncExternalStore(suscribir, leer, () => false);
}

const textos = {
  es: {
    nombre: "Luz roja",
    paraQue: "Tiñe la pantalla de rojo para no perder la vista acostumbrada a la oscuridad; bajá también el brillo.",
    apagar: "Apagar la luz roja",
  },
  en: {
    nombre: "Red light",
    paraQue: "Tints the screen red so your eyes stay used to the dark; lower the brightness too.",
    apagar: "Turn off the red light",
  },
};

// Encendida, todo se ve en rojo: el estado se marca con el subrayado y el texto en Noche, no con color.
const boton = "eyebrow min-h-11 border-b-2 border-transparent text-text-muted transition-colors hover:text-text aria-pressed:border-text aria-pressed:text-text";

/** El control, con su explicación: va bajo el cielo de /cielo. */
export function LuzRojaControl() {
  const encendida = useLuzRoja();
  const t = useT(textos);
  return (
    <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <button type="button" aria-pressed={encendida} onClick={() => setLuzRoja(!encendida)} className={boton}>
        {t.nombre}
      </button>
      <p className="text-sm text-text-muted">{t.paraQue}</p>
    </div>
  );
}

/** En el encabezado, solo mientras está encendida: se puede apagar desde cualquier pantalla. */
export function LuzRojaEncendida() {
  const encendida = useLuzRoja();
  const t = useT(textos);
  if (!encendida) return null;
  return (
    <button type="button" aria-pressed aria-label={t.apagar} onClick={() => setLuzRoja(false)} className={boton}>
      {t.nombre}
    </button>
  );
}
