"use client";

import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { useEffect, useMemo, useState, ViewTransition } from "react";
import { SKY_OBJECT_INFO } from "@/data/astronomy";
import { getPlace } from "@/data/places";
import type { PlaceId } from "@/shared/types";
import { Button, LinkButton } from "@/shared/ui/Button";
import { fotoDeLlegada, olvidarFotoDeLlegada, VT_TIERRA_CIELO } from "@/shared/tierraCielo";
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
  // Si se llega desde Pacha, la foto del lugar arranca sobre el cielo y se funde con él.
  const [llegada, setLlegada] = useState(() => fotoDeLlegada(placeId));

  const resultado = useMemo(() => calcular(placeId, fecha, hora, desfase), [placeId, fecha, hora, desfase]);

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
    <section className="space-y-5">
      <header>
        <h1 className="font-display text-[28px] leading-[34px] font-bold">
          {place ? `El cielo desde ${place.name}` : "Descubrí el cielo desde este lugar."}
        </h1>
        <p className="mt-1 text-sm text-text-muted">Posiciones calculadas para la fecha y hora seleccionadas.</p>
      </header>

      {!place && <StatusMessage title="Elegí un lugar para calcular su cielo." />}

      {place && !resultado && (
        <StatusMessage title="Completá la fecha y la hora." tone="error">
          Necesitamos las dos para calcular las posiciones.
        </StatusMessage>
      )}

      {resultado && (
        <ViewTransition name={VT_TIERRA_CIELO} share={VT_TIERRA_CIELO} default="none">
          <div className="relative -mx-4 overflow-hidden md:mx-0 md:rounded-hero md:border md:border-border">
            <SkyCanvas
              location={resultado.place}
              datetimeISO={resultado.iso}
              solAlt={resultado.solAlt}
              objetos={resultado.objetos}
              selectedId={selectedId}
              onSelect={elegirDesdeMapa}
              nombreLugar={resultado.place.name}
            />
            {llegada && (
              <div
                className="fundir-en-cielo pointer-events-none absolute inset-0"
                onAnimationEnd={() => {
                  olvidarFotoDeLlegada();
                  setLlegada(null);
                }}
              >
                <Image src={llegada.src} alt="" fill sizes="(max-width: 1120px) 100vw, 1120px" className="object-cover" />
              </div>
            )}
          </div>
        </ViewTransition>
      )}

      {resultado && (
        <div className="space-y-3 rounded-card border border-border bg-surface p-4">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="viaje-tiempo" className="text-sm text-text-muted">
              Viajar en el tiempo
            </label>
            <p className="font-display text-xl font-bold tabular-nums">
              {resultado.iso.slice(8, 10)}/{resultado.iso.slice(5, 7)} · {resultado.iso.slice(11, 16)}
              <span className="ml-2 font-sans text-xs font-normal text-text-muted">{textoDesfase(desfase)}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="shrink-0"
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
            <button type="button" className="text-sm text-sky underline underline-offset-2" onClick={() => setDesfase(0)}>
              Volver a la hora elegida
            </button>
          )}
        </div>
      )}

      <div className="grid gap-4 rounded-card border border-border bg-surface p-4 md:grid-cols-2">
        <LocationSelector value={placeId} onChange={elegirLugar} />
        <DateTimePicker fecha={fecha} hora={hora} esEjemplo={esEjemplo} onChange={elegirMomento} />
      </div>

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

            <p className="text-xs text-text-muted">
              Estrellas, constelaciones y Vía Láctea en su posición calculada para este lugar y momento (catálogo
              d3-celestial, estrellas hasta magnitud 5). La silueta del horizonte es plana: no incluye los cerros.
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
              <p className="text-sm text-text-muted">Tocá un objeto del cielo o de la lista para ver su ficha.</p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        {place && (
          <LinkButton variant="earth" href={`/explorar?placeId=${place.id}`}>
            Volver al paisaje
          </LinkButton>
        )}
        <Button variant="ghost" onClick={verNocheDeDemo}>
          Ver la noche de la demo
        </Button>
      </div>

      <p className="max-w-[65ch] text-xs text-text-muted">
        Que un objeto esté sobre el horizonte no garantiza verlo: también influyen las nubes, la luz de la Luna y de las
        ciudades, y los cerros del horizonte local. Cálculo con astronomy-engine.
      </p>
    </section>
  );
}
