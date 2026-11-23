"use client";

import { useSyncExternalStore } from "react";
import { useLang } from "@/shared/i18n/lang";
import type { PlaceId } from "@/shared/types";
import { buttonClass } from "@/shared/ui/Button";
import { ALARMA_MIN, hora, inicioDelCielo, type NocheDeCielo } from "./cuando";

// El reloj del visitante: se vuelve a mirar cada medio minuto, por si la noche empieza con la página abierta.
function cadaMedioMinuto(avisar: () => void) {
  const id = setInterval(avisar, 30_000);
  return () => clearInterval(id);
}

/**
 * «Avisame esta noche»: baja un evento de calendario (.ics) que empieza con el cielo de esa noche y
 * avisa ALARMA_MIN minutos antes. Si el cielo de esa noche ya empezó, no hay nada que recordar y lo dice.
 */
export function Avisame({ placeId, noche, esHoy }: { placeId: PlaceId; noche: NocheDeCielo; esHoy: boolean }) {
  const lang = useLang();
  const en = lang === "en";
  const inicio = inicioDelCielo(noche);
  const inicioMs = inicio ? new Date(inicio).getTime() : null;
  const yaEmpezo = useSyncExternalStore(
    cadaMedioMinuto,
    () => inicioMs !== null && Date.now() >= inicioMs,
    () => false,
  );

  if (inicio === null) return null;
  if (yaEmpezo) {
    return (
      <p className="flex min-h-12 items-center text-sm text-text-muted">
        {esHoy
          ? en
            ? "Tonight's sky has already started: no reminder needed."
            : "El cielo de esta noche ya empezó: no hace falta el recordatorio."
          : en
            ? "That night has already started."
            : "Esa noche ya empezó."}
      </p>
    );
  }

  return (
    <div>
      {/* Enlace común y no <Link>: es un archivo que se baja, no una pantalla de la app. */}
      <a href={`/api/recordatorio?${new URLSearchParams({ placeId, fecha: noche.fecha, lang })}`} className={buttonClass("violeta")}>
        {esHoy ? (en ? "Remind me tonight" : "Avisame esta noche") : en ? "Remind me that night" : "Avisame esa noche"}
      </a>
      <p className="mt-2 max-w-[44ch] text-sm leading-5 text-text-muted">
        {en
          ? `Downloads a calendar event: it starts at ${hora(inicio)} and alerts you ${ALARMA_MIN} minutes before (Argentina time).`
          : `Baja un evento para tu calendario: empieza a las ${hora(inicio)} y te avisa ${ALARMA_MIN} minutos antes (hora de Argentina).`}
      </p>
    </div>
  );
}
