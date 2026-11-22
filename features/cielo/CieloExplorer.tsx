"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { nombreObjeto, SKY_OBJECT_INFO } from "@/data/astronomy";
import { getPlace } from "@/data/places";
import { type Lang, useLang } from "@/shared/i18n/lang";
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

const textos = {
  es: {
    badge: "De noche",
    titulo: "El cielo desde",
    sinLugar: "Descubrí el cielo desde este lugar.",
    bajada: "El cielo de ahora, calculado para el lugar donde estás. Apuntá el teléfono para encontrar las constelaciones.",
    elegiLugar: "Elegí un lugar para calcular su cielo.",
    completa: "Completá la fecha y la hora.",
    completaTexto: "Necesitamos las dos para calcular las posiciones.",
    dia: "Es de día: las estrellas no se ven.",
    crepusculo: "Todavía hay luz: solo se ven las estrellas más brillantes.",
    tenues: "Las constelaciones están marcadas tenues para que sepas dónde están.",
    ocultarYacana: "Ocultar la Yacana",
    verYacana: "Ver la Yacana",
    yacana: "La llama del cielo andino: una figura oscura de la Vía Láctea; sus ojos son α y β Centauri.",
    viajar: "Viajar en el tiempo",
    enVivo: "ahora, en vivo",
    pausar: "Pausar",
    reproducir: "Reproducir",
    volverHora: "Volver a la hora elegida",
    lugarMomento: "Lugar y momento",
    queHay: "Qué hay en el cielo",
    objetos: "Objetos calculados",
    hacia: "Hacia el",
    bajo: "Bajo el horizonte",
    tocaObjeto: "Tocá un objeto de la lista para ver su ficha.",
    esDia: "A esta hora es de día.",
    hayCrepusculo: "A esta hora hay crepúsculo.",
    esDiaTexto: "El Sol está sobre el horizonte: salvo la Luna, estos objetos no se ven a simple vista. Probá una hora de la noche.",
    crepusculoTexto: "El cielo todavía tiene luz del Sol: puede que solo se vean la Luna y los objetos más brillantes.",
    ninguno: "Ningún objeto de la selección está sobre el horizonte.",
    ningunoTexto: "Probá otra hora u otro lugar.",
    volverPaisaje: "Volver al paisaje",
    demo: "Ver la noche de la demo",
    nota1:
      "Estrellas, constelaciones y Vía Láctea en su posición calculada para este lugar y momento (catálogo d3-celestial, estrellas hasta magnitud 5). La silueta del horizonte es plana: no incluye los cerros.",
    nota2:
      "Que un objeto esté sobre el horizonte no garantiza verlo: también influyen las nubes, la luz de la Luna y de las ciudades, y los cerros del horizonte local. Cálculo con astronomy-engine.",
  },
  en: {
    badge: "At night",
    titulo: "The sky from",
    sinLugar: "Discover the sky from this place.",
    bajada: "The sky right now, calculated for where you are. Point your phone to find the constellations.",
    elegiLugar: "Choose a place to calculate its sky.",
    completa: "Fill in the date and time.",
    completaTexto: "We need both to calculate the positions.",
    dia: "It's daytime: the stars can't be seen.",
    crepusculo: "There's still light: only the brightest stars are visible.",
    tenues: "Constellations are drawn faintly so you know where they are.",
    ocultarYacana: "Hide the Yacana",
    verYacana: "Show the Yacana",
    yacana: "The llama of the Andean sky: a dark shape in the Milky Way; its eyes are α and β Centauri.",
    viajar: "Travel in time",
    enVivo: "live, right now",
    pausar: "Pause",
    reproducir: "Play",
    volverHora: "Back to the chosen time",
    lugarMomento: "Place and time",
    queHay: "What's in the sky",
    objetos: "Calculated objects",
    hacia: "To the",
    bajo: "Below the horizon",
    tocaObjeto: "Tap an object in the list to see its card.",
    esDia: "It's daytime at this hour.",
    hayCrepusculo: "It's twilight at this hour.",
    esDiaTexto: "The Sun is above the horizon: except for the Moon, these objects can't be seen with the naked eye. Try a time at night.",
    crepusculoTexto: "The sky still has sunlight: you may only see the Moon and the brightest objects.",
    ninguno: "None of the selected objects is above the horizon.",
    ningunoTexto: "Try another time or place.",
    volverPaisaje: "Back to the landscape",
    demo: "See the demo night",
    nota1:
      "Stars, constellations and the Milky Way in their calculated position for this place and moment (d3-celestial catalogue, stars down to magnitude 5). The horizon is drawn flat: it does not include the mountains.",
    nota2:
      "An object being above the horizon doesn't guarantee you'll see it: clouds, moonlight, city lights and the local mountains also matter. Calculated with astronomy-engine.",
  },
};

function textoDesfase(min: number, lang: Lang) {
  if (min === 0) return lang === "en" ? "chosen time" : "hora elegida";
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
  const lang = useLang();
  const t = textos[lang];
  // Sin momento en la URL, el cielo es el de ahora y sigue al reloj: se apunta y se ve lo que hay.
  const [ahora, setAhora] = useState(minutoActual);
  const [vivo, setVivo] = useState(momentoInicial === null);
  const [fecha, setFecha] = useState(() => momentoInicial?.fecha ?? fechaArgentina(new Date()));
  const [hora, setHora] = useState(() => momentoInicial?.hora ?? minutoActual().slice(11, 16));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Viaje en el tiempo: minutos sumados a la fecha y hora elegidas; no se guarda en la URL.
  const [desfase, setDesfase] = useState(0);
  const [viajando, setViajando] = useState(false);
  const [verYacana, setVerYacana] = useState(true);

  // Mientras «Apuntá» está encendido el cielo también es el de ahora; al apagarlo vuelve a lo que había.
  const [apuntando, setApuntando] = useState(false);
  const [vivoAntes, setVivoAntes] = useState(true);

  const resultado = useMemo(
    () => (vivo ? calcular(placeId, ahora.slice(0, 10), ahora.slice(11, 16), 0) : calcular(placeId, fecha, hora, desfase)),
    [placeId, fecha, hora, desfase, vivo, ahora],
  );

  useEffect(() => {
    if (!vivo) return;
    const id = window.setInterval(() => setAhora(minutoActual()), 15_000);
    return () => window.clearInterval(id);
  }, [vivo]);

  function alApuntar(activa: boolean) {
    setViajando(false);
    setApuntando(activa);
    if (activa) {
      setVivoAntes(vivo);
      setAhora(minutoActual());
      setVivo(true);
    } else {
      setVivo(vivoAntes);
    }
  }

  /** Para viajar en el tiempo desde «ahora», se fija este minuto como hora elegida. */
  function fijarAhora() {
    if (!vivo) return;
    setFecha(ahora.slice(0, 10));
    setHora(ahora.slice(11, 16));
    setVivo(false);
  }

  function volverAAhora() {
    setAhora(minutoActual());
    setVivo(true);
    setDesfase(0);
    setViajando(false);
    actualizarURL(placeId, null);
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
  // Sin elección, la ficha muestra el objeto más alto: la columna nunca queda vacía.
  const masAlto = resultado?.objetos.filter((o) => o.isAboveHorizon).sort((a, b) => b.altitudeDeg - a.altitudeDeg)[0] ?? null;
  const seleccionado = resultado?.objetos.find((o) => o.id === selectedId) ?? masAlto;
  const ningunoVisible = resultado !== null && resultado.objetos.every((o) => !o.isAboveHorizon);

  // Deja lugar y momento en la URL: se puede compartir y recargar sin perder el contexto.
  function actualizarURL(id: PlaceId | null, momento: { fecha: string; hora: string } | null) {
    if (id) window.history.replaceState(null, "", queryCielo(id, momento));
  }

  function elegirLugar(id: PlaceId) {
    setPlaceId(id);
    actualizarURL(id, vivo ? null : momentoDesdeURL(fecha, hora));
  }

  // Desde el mapa, la ficha queda fuera de pantalla en el celular: la traemos a la vista.
  function elegirDesdeMapa(id: string) {
    setSelectedId(id);
    requestAnimationFrame(() => document.getElementById("ficha-cielo")?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  function elegirMomento(nuevaFecha: string, nuevaHora: string) {
    setFecha(nuevaFecha);
    setHora(nuevaHora);
    setVivo(false);
    setDesfase(0);
    actualizarURL(placeId, momentoDesdeURL(nuevaFecha, nuevaHora));
  }

  function verNocheDeDemo() {
    const id = DEMO_CIELO.placeId;
    setPlaceId(id);
    setFecha(DEMO_CIELO.fecha);
    setHora(DEMO_CIELO.hora);
    setVivo(false);
    setDesfase(0);
    actualizarURL(id, DEMO_CIELO);
  }

  return (
    <section className="pt-8 md:pt-12">
      <header className="md:flex md:items-end md:justify-between md:gap-12">
        <div>
        <Badge tone="violeta">{t.badge}</Badge>
        <h1 className="display mt-5 max-w-[16ch] text-[clamp(2.75rem,8vw,5rem)]">
          {place ? (
            <>
              {t.titulo} <em className="acento">{place.name}</em>
            </>
          ) : (
            t.sinLugar
          )}
        </h1>
        </div>
        <p className="mt-5 max-w-[36ch] text-text-muted md:mb-2 md:text-right">{t.bajada}</p>
      </header>

      {!place && (
        <div className="mt-8">
          <StatusMessage title={t.elegiLugar} />
        </div>
      )}

      {place && !resultado && (
        <div className="mt-8">
          <StatusMessage title={t.completa} tone="error">
            {t.completaTexto}
          </StatusMessage>
        </div>
      )}

      {resultado && (
        <div className="oscuro bleed mt-8 md:mt-10">
          <SkyCanvas
            location={resultado.place}
            datetimeISO={resultado.iso}
            solAlt={resultado.solAlt}
            objetos={resultado.objetos}
            selectedId={seleccionado?.id ?? null}
            onSelect={elegirDesdeMapa}
            nombreLugar={resultado.place.name}
            yacana={verYacana}
            onApuntar={alApuntar}
          />
        </div>
      )}

      {resultado && vivo && resultado.luz !== "noche" && (
        <p className="mt-4 text-sm text-text-muted" aria-live="polite">
          {resultado.luz === "dia" ? t.dia : t.crepusculo} {t.tenues}
        </p>
      )}

      {resultado && (
        <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <button
            type="button"
            aria-pressed={verYacana}
            onClick={() => setVerYacana(!verYacana)}
            className="eyebrow min-h-11 border-b-2 border-transparent text-text-muted transition-colors hover:text-text aria-pressed:border-puna aria-pressed:text-puna-ink"
          >
            {verYacana ? t.ocultarYacana : t.verYacana}
          </button>
          <p className="text-sm text-text-muted">
            {t.yacana}
          </p>
        </div>
      )}

      {resultado && (
        <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:items-center md:gap-12">
          <div>
            <label htmlFor="viaje-tiempo" className="eyebrow text-text-muted">
              {t.viajar}
            </label>
            <p className="mt-2 flex items-baseline gap-3">
              <span className="headline text-3xl tabular-nums md:text-4xl">
                {resultado.iso.slice(8, 10)}/{resultado.iso.slice(5, 7)} · {resultado.iso.slice(11, 16)}
              </span>
              <span className={`text-sm tabular-nums ${vivo ? "text-success" : desfase !== 0 ? "text-violeta-ink" : "text-text-muted"}`}>
                {vivo ? t.enVivo : textoDesfase(desfase, lang)}
              </span>
            </p>
          </div>
          <div>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                disabled={apuntando}
                className="w-28 shrink-0"
                onClick={() => {
                  fijarAhora();
                  if (!viajando && desfase >= VIAJE_MAX) setDesfase(-VIAJE_MAX);
                  setViajando(!viajando);
                }}
              >
                {viajando ? t.pausar : t.reproducir}
              </Button>
              <input
                id="viaje-tiempo"
                type="range"
                disabled={apuntando}
                min={-VIAJE_MAX}
                max={VIAJE_MAX}
                step={10}
                value={desfase}
                onChange={(e) => {
                  fijarAhora();
                  setViajando(false);
                  setDesfase(Number(e.target.value));
                }}
                className="min-h-11 w-full accent-violeta"
              />
            </div>
            {!vivo && desfase !== 0 && (
              <button type="button" className="link-arrow text-sm text-violeta-ink" onClick={() => setDesfase(0)}>
                {t.volverHora}
              </button>
            )}
          </div>
        </div>
      )}

      <section aria-labelledby="momento" className="rule mt-12 pt-4 md:mt-16">
        <h2 id="momento" className="eyebrow text-text-muted">
          {t.lugarMomento}
        </h2>
        <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-12">
          <LocationSelector value={placeId} onChange={elegirLugar} />
          <DateTimePicker
            fecha={vivo ? ahora.slice(0, 10) : fecha}
            hora={vivo ? ahora.slice(11, 16) : hora}
            enVivo={vivo}
            onChange={elegirMomento}
            onAhora={volverAAhora}
          />
        </div>
      </section>

      {resultado && (
        <section aria-labelledby="objetos" className="mt-12 grid gap-10 md:mt-16 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-12">
          <div>
            <div className="rule flex items-baseline justify-between pt-4">
              <h2 id="objetos" className="headline text-3xl md:text-4xl">
                {t.queHay}
              </h2>
            </div>
            <ul className="mt-4 divide-y divide-border" aria-label={t.objetos}>
              {resultado.objetos.map((o, i) => {
                const activo = o.id === seleccionado?.id;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(o.id)}
                      aria-pressed={activo}
                      className="group flex min-h-14 w-full items-baseline gap-4 py-3 text-left"
                    >
                      <span className="eyebrow w-6 shrink-0 text-text-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                      <span className={`headline text-xl md:text-2xl ${activo ? "text-violeta-ink" : "group-hover:text-violeta-ink"}`}>{nombreObjeto(o.id, o.name, lang)}</span>
                      <span className={`ml-auto text-right text-sm ${o.isAboveHorizon ? "text-text-muted" : "text-text-muted"}`}>
                        {o.isAboveHorizon ? `${t.hacia} ${rumbo(o.azimuthDeg, lang)}` : t.bajo}
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
              <p className="rule pt-4 text-text-muted">{t.tocaObjeto}</p>
            )}

            {resultado.luz !== "noche" && (
              <StatusMessage title={resultado.luz === "dia" ? t.esDia : t.hayCrepusculo}>
                {resultado.luz === "dia" ? t.esDiaTexto : t.crepusculoTexto}
              </StatusMessage>
            )}

            {ningunoVisible && (
              <StatusMessage title={t.ninguno}>
                {t.ningunoTexto}
              </StatusMessage>
            )}
          </div>
        </section>
      )}

      <div className="mt-12 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-8 md:mt-16">
        {place && (
          <LinkButton variant="puna" href={`/explorar?placeId=${place.id}`}>
            {t.volverPaisaje}
          </LinkButton>
        )}
        <Button variant="ghost" onClick={verNocheDeDemo}>
          {t.demo}
        </Button>
      </div>

      <div className="rule mt-12 max-w-[75ch] space-y-2 pt-4 text-xs leading-5 text-text-muted">
        <p>{t.nota1}</p>
        <p>{t.nota2}</p>
      </div>
    </section>
  );
}
