"use client";

import { useId, useSyncExternalStore } from "react";
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
 * «Avisame esta noche»: el evento de calendario que empieza con el cielo de esa noche, para Google Calendar
 * (se abre con el evento ya cargado) o para el Calendario de Apple (un .ics, que avisa ALARMA_MIN minutos antes).
 * Si el cielo de esa noche ya empezó, no hay nada que recordar y lo dice.
 */
export function Avisame({ placeId, noche, esHoy }: { placeId: PlaceId; noche: NocheDeCielo; esHoy: boolean }) {
  const lang = useLang();
  const en = lang === "en";
  const rotulo = useId();
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

  const enlace = (para: "google" | "apple") => `/api/recordatorio?${new URLSearchParams({ placeId, fecha: noche.fecha, lang, para })}`;

  return (
    <div role="group" aria-labelledby={rotulo}>
      <p id={rotulo} className="eyebrow text-text-muted">
        {esHoy ? (en ? "Remind me tonight" : "Avisame esta noche") : en ? "Remind me that night" : "Avisame esa noche"}
      </p>
      {/* Enlaces comunes y no <Link>: uno sale a Google Calendar y el otro es un archivo, no pantallas de la app.
          En un teléfono angosto van uno debajo del otro: lado a lado no entran en 375 px. */}
      <div className="mt-3 flex flex-col gap-3 min-[30rem]:flex-row">
        <a href={enlace("google")} target="_blank" rel="noopener" className={buttonClass("violeta")}>
          Google Calendar
        </a>
        <a href={enlace("apple")} className={buttonClass("violeta")}>
          {en ? "Apple Calendar" : "Calendario de Apple"}
        </a>
      </div>
      {/* Un enlace a Google Calendar no puede fijar el aviso: solo el .ics lleva la alarma. */}
      <p className="mt-3 max-w-[44ch] text-sm leading-5 text-text-muted">
        {en
          ? `Starts at ${hora(inicio)} (Argentina time). Apple alerts you ${ALARMA_MIN} minutes before; Google uses your default notification.`
          : `Empieza a las ${hora(inicio)} (hora de Argentina). Apple te avisa ${ALARMA_MIN} minutos antes; Google, con el aviso que tengas por defecto.`}
      </p>
    </div>
  );
}
