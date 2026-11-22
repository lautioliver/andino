"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { SKY_OBJECT_INFO } from "@/data/astronomy";
import { getPlace } from "@/data/places";
import type { PlaceId } from "@/shared/types";
import { StatusMessage } from "@/shared/ui/StatusMessage";
import { CelestialObjectCard } from "./CelestialObjectCard";
import { DateTimePicker, LocationSelector } from "./CieloControls";
import { buildDatetimeISO, fechaArgentina, HORA_EJEMPLO, luzDelCielo, rumbo } from "./cielo";
import { computeSky, type SkyObjectId, sunAltitudeDeg } from "./motor";
import { SkyMap } from "./SkyMap";

function calcular(placeId: PlaceId | null, fecha: string, hora: string) {
  const place = getPlace(placeId);
  if (!place || !fecha || !hora) return null;
  try {
    const iso = buildDatetimeISO(fecha, hora);
    const objetos = computeSky(place, iso).map((o) => ({ ...o, kind: SKY_OBJECT_INFO[o.id as SkyObjectId].kind }));
    return { place, objetos, luz: luzDelCielo(sunAltitudeDeg(place, iso)) };
  } catch {
    return null;
  }
}

// Todo se calcula en el teléfono: funciona sin conexión, sin sensores y sin IA.
export function CieloExplorer() {
  const searchParams = useSearchParams();
  const [placeId, setPlaceId] = useState<PlaceId | null>(() => getPlace(searchParams.get("placeId"))?.id ?? null);
  const [fecha, setFecha] = useState(() => fechaArgentina(new Date()));
  const [hora, setHora] = useState(HORA_EJEMPLO);
  const [esEjemplo, setEsEjemplo] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const resultado = useMemo(() => calcular(placeId, fecha, hora), [placeId, fecha, hora]);
  const place = getPlace(placeId);
  const seleccionado = resultado?.objetos.find((o) => o.id === selectedId) ?? null;
  const ningunoVisible = resultado !== null && resultado.objetos.every((o) => !o.isAboveHorizon);

  function elegirLugar(id: PlaceId) {
    setPlaceId(id);
    // Deja el lugar en la URL para compartir y para volver a Pacha con el mismo contexto.
    window.history.replaceState(null, "", `?placeId=${id}`);
  }

  // Desde el mapa, la ficha queda fuera de pantalla en el celular: la traemos a la vista.
  function elegirDesdeMapa(id: string) {
    setSelectedId(id);
    requestAnimationFrame(() => document.getElementById("ficha-cielo")?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  function elegirMomento(nuevaFecha: string, nuevaHora: string) {
    setFecha(nuevaFecha);
    setHora(nuevaHora);
    setEsEjemplo(false);
  }

  return (
    <section className="space-y-5">
      <header>
        <h1 className="font-display text-[28px] leading-[34px] font-bold">
          {place ? `El cielo desde ${place.name}` : "Descubrí el cielo desde este lugar."}
        </h1>
        <p className="mt-1 text-sm text-text-muted">Posiciones calculadas para la fecha y hora seleccionadas.</p>
      </header>

      <div className="grid gap-4 rounded-card border border-border bg-surface p-4 md:grid-cols-2">
        <LocationSelector value={placeId} onChange={elegirLugar} />
        <DateTimePicker fecha={fecha} hora={hora} esEjemplo={esEjemplo} onChange={elegirMomento} />
      </div>

      {!place && <StatusMessage title="Elegí un lugar para calcular su cielo." />}

      {place && !resultado && (
        <StatusMessage title="Completá la fecha y la hora." tone="error">
          Necesitamos las dos para calcular las posiciones.
        </StatusMessage>
      )}

      {resultado && (
        <div className="grid gap-5 md:grid-cols-2 md:items-start">
          <div className="space-y-3">
            {resultado.luz !== "noche" && (
              <StatusMessage title={resultado.luz === "dia" ? "A esta hora es de día." : "A esta hora hay crepúsculo."}>
                {resultado.luz === "dia"
                  ? "El Sol está sobre el horizonte: salvo la Luna, estos objetos no se ven a simple vista. Probá una hora de la noche."
                  : "El cielo todavía tiene luz del Sol: puede que solo se vean la Luna y los objetos más brillantes."}
              </StatusMessage>
            )}

            <SkyMap objects={resultado.objetos} selectedId={selectedId} onSelect={elegirDesdeMapa} />
            <p className="text-center text-xs text-text-muted">
              Mapa esquemático: el centro es el punto sobre tu cabeza y el borde, el horizonte. Está pensado para mirar
              hacia arriba, por eso el este queda a la izquierda.
            </p>

            {ningunoVisible && (
              <StatusMessage title="Ningún objeto de la selección está sobre el horizonte.">
                Probá otra hora u otro lugar.
              </StatusMessage>
            )}
          </div>

          <div className="space-y-3">
            <ul className="grid gap-2" aria-label="Objetos calculados">
              {resultado.objetos.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(o.id)}
                    aria-pressed={o.id === selectedId}
                    className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-control border px-4 py-2 text-left ${
                      o.id === selectedId ? "border-sky bg-surface-raised" : "border-border bg-surface"
                    }`}
                  >
                    <span className="font-medium">{o.name}</span>
                    <span className="text-sm text-text-muted">
                      {o.isAboveHorizon ? `Hacia el ${rumbo(o.azimuthDeg)}` : "Bajo el horizonte"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {seleccionado ? (
              <div id="ficha-cielo" className="scroll-mb-24">
                <CelestialObjectCard object={seleccionado} info={SKY_OBJECT_INFO[seleccionado.id as SkyObjectId]} />
              </div>
            ) : (
              <p className="text-sm text-text-muted">Tocá un objeto del mapa o de la lista para ver su ficha.</p>
            )}
          </div>
        </div>
      )}

      <p className="max-w-[65ch] text-xs text-text-muted">
        Que un objeto esté sobre el horizonte no garantiza verlo: también influyen las nubes, la luz de la Luna y de las
        ciudades, y los cerros del horizonte local. Cálculo con astronomy-engine.
      </p>
    </section>
  );
}
