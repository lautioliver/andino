"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SKY_OBJECT_INFO } from "@/data/astronomy";
import { getPlace } from "@/data/places";
import type { PlaceId } from "@/shared/types";
import { Badge } from "@/shared/ui/Badge";
import { Button, LinkButton } from "@/shared/ui/Button";
import { StatusMessage } from "@/shared/ui/StatusMessage";
import { CelestialObjectCard } from "./CelestialObjectCard";
import { DateTimePicker, LocationSelector } from "./CieloControls";
import {
  buildDatetimeISO,
  DEMO_CIELO,
  fechaArgentina,
  HORA_EJEMPLO,
  luzDelCielo,
  momentoDesdeURL,
  queryCielo,
  rumbo,
} from "./cielo";
import { desplazarISO } from "./firmamento";
import { aISOLocal } from "./jornada";
import { computeSky, type SkyObjectId, sunAltitudeDeg } from "./motor";
import { SkyCanvas } from "./SkyCanvas";

function calcular(placeId: PlaceId | null, fecha: string, hora: string, desfaseMin: number) {
  const place = getPlace(placeId);
  if (!place || !fecha || !hora) return null;
  try {
    const base = buildDatetimeISO(fecha, hora);
    const iso = desfaseMin === 0 ? base : desplazarISO(base, desfaseMin);
    const objetos = computeSky(place, iso).map((o) => ({ ...o, kind: SKY_OBJECT_INFO[o.id as SkyObjectId].kind }));
    const solAlt = sunAltitudeDeg(place, iso);
    return { place, iso, objetos, solAlt, luz: luzDelCielo(solAlt) };
  } catch {
    return null;
  }
}

const VIAJE_MAX = 12 * 60;

/** Este minuto en Argentina: "YYYY-MM-DDTHH:MM". */
const minutoActual = () => aISOLocal(new Date()).slice(0, 16);

function textoDesfase(min: number) {
  if (min === 0) return "hora elegida";
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  return `${min > 0 ? "+" : "−"}${h ? `${h} h` : ""}${h && m ? " " : ""}${m ? `${m} min` : ""}`;
}

// Todo se calcula en el teléfono: funciona sin conexión, sin sensores y sin IA.
export function CieloExplorer() {
  const searchParams = useSearchParams();
  const [placeId, setPlaceId] = useState<PlaceId | null>(() => getPlace(searchParams.get("placeId"))?.id ?? null);
  // ?fecha=&hora= permiten compartir un momento concreto (por ejemplo, el de la demo).
  const [momentoInicial] = useState(() => momentoDesdeURL(searchParams.get("fecha"), searchParams.get("hora")));
  const [fecha, setFecha] = useState(() => momentoInicial?.fecha ?? fechaArgentina(new Date()));
  const [hora, setHora] = useState(momentoInicial?.hora ?? HORA_EJEMPLO);
  const [esEjemplo, setEsEjemplo] = useState(momentoInicial === null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Viaje en el tiempo: minutos sumados a la fecha y hora elegidas; no se guarda en la URL.
  const [desfase, setDesfase] = useState(0);
  const [viajando, setViajando] = useState(false);
  const [verYacana, setVerYacana] = useState(true);

  // En vivo: mientras «Apuntá» está encendido, el cielo es el de este momento y se actualiza solo.
  const [enVivo, setEnVivo] = useState<string | null>(null);

  const resultado = useMemo(
    () => (enVivo ? calcular(placeId, enVivo.slice(0, 10), enVivo.slice(11, 16), 0) : calcular(placeId, fecha, hora, desfase)),
    [placeId, fecha, hora, desfase, enVivo],
  );

  const activo = enVivo !== null;
  useEffect(() => {
    if (!activo) return;
    const id = window.setInterval(() => setEnVivo(minutoActual()), 15_000);
    return () => window.clearInterval(id);
  }, [activo]);

  function alApuntar(activa: boolean) {
    setViajando(false);
    setEnVivo(activa ? minutoActual() : null);
  }

  useEffect(() => {
    if (!viajando) return;
    const id = window.setInterval(() => {
      setDesfase((d) => {
        if (d + 5 > VIAJE_MAX) {
          setViajando(false);
          return d;
        }
        return d + 5;
      });
    }, 60);
    return () => window.clearInterval(id);
  }, [viajando]);
  const place = getPlace(placeId);
  const seleccionado = resultado?.objetos.find((o) => o.id === selectedId) ?? null;
  const ningunoVisible = resultado !== null && resultado.objetos.every((o) => !o.isAboveHorizon);

  // Deja lugar y momento en la URL: se puede compartir y recargar sin perder el contexto.
  function actualizarURL(id: PlaceId | null, momento: { fecha: string; hora: string } | null) {
    if (id) window.history.replaceState(null, "", queryCielo(id, momento));
  }

  function elegirLugar(id: PlaceId) {
    setPlaceId(id);
    actualizarURL(id, esEjemplo ? null : momentoDesdeURL(fecha, hora));
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
    setDesfase(0);
    actualizarURL(placeId, momentoDesdeURL(nuevaFecha, nuevaHora));
  }

  function verNocheDeDemo() {
    const id = DEMO_CIELO.placeId;
    setPlaceId(id);
    setFecha(DEMO_CIELO.fecha);
    setHora(DEMO_CIELO.hora);
    setEsEjemplo(false);
    setDesfase(0);
    actualizarURL(id, DEMO_CIELO);
  }

  return (
    <section className="pt-8 md:pt-16">
      <header>
        <Badge tone="sky">De noche</Badge>
        <h1 className="display mt-5 max-w-[14ch] text-[clamp(2.75rem,9vw,6rem)]">
          {place ? (
            <>
              El cielo desde <em className="text-sky">{place.name}</em>
            </>
          ) : (
            "Descubrí el cielo desde este lugar."
          )}
        </h1>
        <p className="lead mt-5 max-w-[45ch] text-text-muted">Posiciones calculadas para la fecha y hora seleccionadas.</p>
      </header>

      {!place && (
        <div className="mt-8">
          <StatusMessage title="Elegí un lugar para calcular su cielo." />
        </div>
      )}

      {place && !resultado && (
        <div className="mt-8">
          <StatusMessage title="Completá la fecha y la hora." tone="error">
            Necesitamos las dos para calcular las posiciones.
          </StatusMessage>
        </div>
      )}

      {resultado && (
        <div className="bleed mt-10 md:mt-14">
          <SkyCanvas
            location={resultado.place}
            datetimeISO={resultado.iso}
            solAlt={resultado.solAlt}
            objetos={resultado.objetos}
            selectedId={selectedId}
            onSelect={elegirDesdeMapa}
            nombreLugar={resultado.place.name}
            yacana={verYacana}
            onApuntar={alApuntar}
          />
        </div>
      )}

      {resultado && (
        <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <button
            type="button"
            aria-pressed={verYacana}
            onClick={() => setVerYacana(!verYacana)}
            className="eyebrow min-h-11 border-b-2 border-transparent text-text-muted transition-colors hover:text-text aria-pressed:border-sand aria-pressed:text-sand"
          >
            {verYacana ? "Ocultar la Yacana" : "Ver la Yacana"}
          </button>
          <p className="text-sm text-text-muted">
            La llama del cielo andino: una figura oscura de la Vía Láctea; sus ojos son α y β Centauri.
          </p>
        </div>
      )}

      {resultado && (
        <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:items-center md:gap-12">
          <div className="flex items-baseline justify-between gap-4 md:block">
            <label htmlFor="viaje-tiempo" className="eyebrow text-text-muted">
              Viajar en el tiempo
            </label>
            <p className="headline text-3xl tabular-nums md:mt-2 md:text-4xl">
              {resultado.iso.slice(8, 10)}/{resultado.iso.slice(5, 7)} · {resultado.iso.slice(11, 16)}
              <span className={`ml-3 align-middle font-sans text-xs tracking-normal ${activo ? "text-sky" : "text-text-muted"}`}>
                {activo ? "en vivo, mientras apuntás" : textoDesfase(desfase)}
              </span>
            </p>
          </div>
          <div>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                disabled={activo}
                className="w-28 shrink-0"
                onClick={() => {
                  if (!viajando && desfase >= VIAJE_MAX) setDesfase(-VIAJE_MAX);
                  setViajando(!viajando);
                }}
              >
                {viajando ? "Pausar" : "Reproducir"}
              </Button>
              <input
                id="viaje-tiempo"
                type="range"
                disabled={activo}
                min={-VIAJE_MAX}
                max={VIAJE_MAX}
                step={10}
                value={desfase}
                onChange={(e) => {
                  setViajando(false);
                  setDesfase(Number(e.target.value));
                }}
                className="min-h-11 w-full accent-sky"
              />
            </div>
            {desfase !== 0 && (
              <button type="button" className="link-arrow text-sm text-sky" onClick={() => setDesfase(0)}>
                Volver a la hora elegida
              </button>
            )}
          </div>
        </div>
      )}

      <section aria-labelledby="momento" className="rule mt-12 pt-4 md:mt-16">
        <h2 id="momento" className="eyebrow text-text-muted">
          Lugar y momento
        </h2>
        <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-12">
          <LocationSelector value={placeId} onChange={elegirLugar} />
          <DateTimePicker fecha={fecha} hora={hora} esEjemplo={esEjemplo} onChange={elegirMomento} />
        </div>
      </section>

      {resultado && (
        <section aria-labelledby="objetos" className="mt-12 grid gap-10 md:mt-16 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-12">
          <div>
            <div className="rule flex items-baseline justify-between pt-4">
              <h2 id="objetos" className="headline text-3xl md:text-4xl">
                Qué hay en el cielo
              </h2>
            </div>
            <ul className="mt-4 divide-y divide-border" aria-label="Objetos calculados">
              {resultado.objetos.map((o, i) => {
                const activo = o.id === selectedId;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(o.id)}
                      aria-pressed={activo}
                      className="group flex min-h-14 w-full items-baseline gap-4 py-3 text-left"
                    >
                      <span className="eyebrow w-6 shrink-0 text-text-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                      <span className={`headline text-xl md:text-2xl ${activo ? "text-sky" : "group-hover:text-sky"}`}>{o.name}</span>
                      <span className={`ml-auto text-right text-sm ${o.isAboveHorizon ? "text-text-muted" : "text-text-muted/60"}`}>
                        {o.isAboveHorizon ? `Hacia el ${rumbo(o.azimuthDeg)}` : "Bajo el horizonte"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="space-y-6">
            {seleccionado ? (
              <div id="ficha-cielo" className="scroll-mb-24">
                <CelestialObjectCard object={seleccionado} info={SKY_OBJECT_INFO[seleccionado.id as SkyObjectId]} />
              </div>
            ) : (
              <p className="rule pt-4 text-text-muted">Tocá un objeto del cielo o de la lista para ver su ficha.</p>
            )}

            {resultado.luz !== "noche" && (
              <StatusMessage title={resultado.luz === "dia" ? "A esta hora es de día." : "A esta hora hay crepúsculo."}>
                {resultado.luz === "dia"
                  ? "El Sol está sobre el horizonte: salvo la Luna, estos objetos no se ven a simple vista. Probá una hora de la noche."
                  : "El cielo todavía tiene luz del Sol: puede que solo se vean la Luna y los objetos más brillantes."}
              </StatusMessage>
            )}

            {ningunoVisible && (
              <StatusMessage title="Ningún objeto de la selección está sobre el horizonte.">
                Probá otra hora u otro lugar.
              </StatusMessage>
            )}
          </div>
        </section>
      )}

      <div className="mt-12 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-8 md:mt-16">
        {place && (
          <LinkButton variant="earth" href={`/explorar?placeId=${place.id}`}>
            Volver al paisaje
          </LinkButton>
        )}
        <Button variant="ghost" onClick={verNocheDeDemo}>
          Ver la noche de la demo
        </Button>
      </div>

      <div className="rule mt-12 max-w-[75ch] space-y-2 pt-4 text-xs leading-5 text-text-muted">
        <p>
          Estrellas, constelaciones y Vía Láctea en su posición calculada para este lugar y momento (catálogo d3-celestial,
          estrellas hasta magnitud 5). La silueta del horizonte es plana: no incluye los cerros.
        </p>
        <p>
          Que un objeto esté sobre el horizonte no garantiza verlo: también influyen las nubes, la luz de la Luna y de las
          ciudades, y los cerros del horizonte local. Cálculo con astronomy-engine.
        </p>
      </div>
    </section>
  );
}
