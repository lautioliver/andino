"use client";

// Cielo como una escena a pantalla completa con una hoja inferior que se arrastra. Mobile first:
// los controles quedan abajo, al alcance del pulgar. Propiedad: jehp23 (features/cielo).
// Todo se calcula en el teléfono: funciona sin conexión, sin sensores y sin IA.
import { Body, Equator, Horizon, Illumination, MakeTime, Observer } from "astronomy-engine";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, ViewTransition } from "react";
import { SKY_OBJECT_INFO } from "@/data/astronomy";
import { getPlace, places } from "@/data/places";
import { olvidarFotoDeLlegada, useFotoDeLlegada, VT_TIERRA_CIELO } from "@/shared/tierraCielo";
import type { PlaceId } from "@/shared/types";
import {
  buildDatetimeISO,
  DEMO_CIELO,
  describirAltura,
  fechaArgentina,
  HORA_EJEMPLO,
  luzDelCielo,
  momentoDesdeURL,
  queryCielo,
  rumbo,
} from "./cielo";
import { type Astro, pintarEscena } from "./escena";
import estilos from "./escena.module.css";
import { camara, desplazarISO } from "./firmamento";
import { altitudCamara, gradosTapados, limitarAltitud, limitarHoja, type PosicionHoja, soltarHoja } from "./hoja";
import { precalcular, prefiereMenosMovimiento } from "./lienzo";
import { computeSky, type SkyObjectId, sunAltitudeDeg } from "./motor";

const VIAJE_MAX = 12 * 60;
const LUZ = { dia: "De día", crepusculo: "Crepúsculo", noche: "Noche cerrada" } as const;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
/** Alto de la barra de navegación móvil de AppShell (min-h-12 + borde). */
const NAV_MOVIL = 49;
/** Duraciones de docs/experiencia-astroturismo.md: 300 ms paneles, 800 ms girar el cielo. */
const MS_HOJA = 300;
const MS_GIRO = 800;

function textoDesfase(min: number) {
  if (min === 0) return null;
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  return `${min > 0 ? "+" : "−"}${h ? `${h} h` : ""}${h && m ? " " : ""}${m ? `${m} min` : ""}`;
}

/** Anima un valor de `desde` a `hasta` con easing de salida; sin movimiento si se prefiere así. */
function animar(desde: number, hasta: number, ms: number, alPaso: (v: number) => void, alTerminar?: () => void) {
  const duracion = prefiereMenosMovimiento() ? 0 : ms;
  const inicio = performance.now();
  const paso = (t: number) => {
    const u = duracion ? Math.min(1, Math.max(0, (t - inicio) / duracion)) : 1;
    alPaso(desde + (hasta - desde) * (1 - (1 - u) ** 3));
    if (u < 1) requestAnimationFrame(paso);
    else alTerminar?.();
  };
  requestAnimationFrame(paso);
}

function ahoraEnArgentina() {
  const iso = desplazarISO(new Date().toISOString(), 0);
  return { fecha: iso.slice(0, 10), hora: iso.slice(11, 16) };
}

export function CieloEscena() {
  const params = useSearchParams();
  const [placeId, setPlaceId] = useState<PlaceId>(() => getPlace(params.get("placeId"))?.id ?? "purmamarca");
  // ?fecha=&hora= permiten compartir un momento concreto (por ejemplo, el de la demo).
  const [momentoInicial] = useState(() => momentoDesdeURL(params.get("fecha"), params.get("hora")));
  const [fecha, setFecha] = useState(() => momentoInicial?.fecha ?? fechaArgentina(new Date()));
  const [hora, setHora] = useState(momentoInicial?.hora ?? HORA_EJEMPLO);
  const [esEjemplo, setEsEjemplo] = useState(momentoInicial === null);
  const [modo, setModo] = useState<"noche" | "ahora" | null>(momentoInicial ? null : "noche");
  // Viaje en el tiempo: minutos sumados a la fecha y hora elegidas; no se guarda en la URL.
  const [desfase, setDesfase] = useState(0);
  const [viajando, setViajando] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Vista: rumbo y altura del centro del cielo que queda visible sobre la hoja.
  const [az, setAz] = useState(180);
  const [altVisible, setAltVisible] = useState(35);
  const [tamanio, setTamanio] = useState({ ancho: 0, alto: 0 });
  // Hoja: posición en reposo, desplazamiento mientras se arrastra o anima, y medidas.
  const [posicion, setPosicion] = useState<PosicionHoja>("baja");
  const [desp, setDesp] = useState<number | null>(null);
  const [medidas, setMedidas] = useState({ total: 0, pie: 0 });
  // Si se llega desde Pacha, la foto del lugar arranca sobre el cielo y se funde con él.
  // Es reactiva: Next conserva el estado de /cielo entre visitas y el fundido tiene que repetirse.
  const llegada = useFotoDeLlegada(placeId);

  const place = getPlace(placeId)!;
  const base = buildDatetimeISO(fecha, hora);
  const iso = desfase === 0 ? base : desplazarISO(base, desfase);

  const escena = useMemo(() => {
    const objetos = computeSky(place, iso);
    const astros: Astro[] = objetos.map((o) => ({
      id: o.id,
      name: o.name,
      kind: SKY_OBJECT_INFO[o.id as SkyObjectId].kind,
      alt: o.altitudeDeg,
      az: o.azimuthDeg,
      visible: o.isAboveHorizon,
    }));
    const time = MakeTime(new Date(iso));
    const obs = new Observer(place.latitude, place.longitude, 0);
    const eq = Equator(Body.Sun, time, obs, true, true);
    const sol = Horizon(time, obs, eq.ra, eq.dec);
    const solAlt = sunAltitudeDeg(place, iso);
    return {
      pre: precalcular(place, iso),
      objetos,
      astros,
      solAlt,
      luna: { fraccion: Illumination(Body.Moon, time).phase_fraction, solAlt: sol.altitude, solAz: sol.azimuth },
      luz: luzDelCielo(solAlt),
    };
  }, [place, iso]);

  useEffect(() => {
    if (!viajando) return;
    const id = window.setInterval(() => {
      setDesfase((d) => {
        if (d + 4 > VIAJE_MAX) {
          setViajando(false);
          return d;
        }
        return d + 4;
      });
    }, 50);
    return () => window.clearInterval(id);
  }, [viajando]);

  // ---------- Hoja ----------
  const hojaRef = useRef<HTMLElement>(null);
  const pieRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const hoja = hojaRef.current;
    const pie = pieRef.current;
    if (!hoja || !pie) return;
    const medir = () => setMedidas({ total: hoja.offsetHeight, pie: pie.offsetHeight });
    const ro = new ResizeObserver(medir);
    ro.observe(hoja);
    ro.observe(pie);
    return () => ro.disconnect();
  }, []);
  const recorrido = Math.max(0, medidas.total - medidas.pie);
  const despActual = desp ?? (posicion === "alta" ? 0 : recorrido);
  const alta = posicion === "alta";

  function llevarHoja(destino: PosicionHoja) {
    const hasta = destino === "alta" ? 0 : recorrido;
    setPosicion(destino);
    animar(despActual, hasta, MS_HOJA, setDesp, () => setDesp(null));
  }

  const arrastreHoja = useRef<{ y: number; desp: number; movio: boolean; ultimo: { y: number; t: number }; v: number } | null>(null);
  function hojaPresionar(e: React.PointerEvent) {
    arrastreHoja.current = { y: e.clientY, desp: despActual, movio: false, ultimo: { y: e.clientY, t: e.timeStamp }, v: 0 };
  }
  function hojaMover(e: React.PointerEvent) {
    const a = arrastreHoja.current;
    if (!a) return;
    const dy = e.clientY - a.y;
    if (!a.movio && Math.abs(dy) > 6) {
      a.movio = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (!a.movio) return;
    const dt = e.timeStamp - a.ultimo.t;
    if (dt > 0) a.v = (e.clientY - a.ultimo.y) / dt;
    a.ultimo = { y: e.clientY, t: e.timeStamp };
    setDesp(limitarHoja(a.desp + dy, recorrido));
  }
  function hojaSoltar() {
    const a = arrastreHoja.current;
    if (!a?.movio) return; // Fue un toque: lo resuelve onClick.
    llevarHoja(soltarHoja({ desplazamiento: despActual, recorrido, velocidad: a.v }));
  }
  function hojaClick() {
    const a = arrastreHoja.current;
    arrastreHoja.current = null;
    if (a?.movio) return;
    llevarHoja(alta ? "baja" : "alta");
  }

  // ---------- Lienzo ----------
  const contenedorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tocables = useRef<{ id: string; x: number; y: number }[]>([]);
  const vista = useRef({ az, altVisible });
  useEffect(() => {
    vista.current = { az, altVisible };
  }, [az, altVisible]);
  const movil = tamanio.ancho < 768;
  const fov = movil ? 80 : 100;
  // En el celular la hoja tapa la parte de abajo del cielo: la cámara baja para compensar.
  // En escritorio la hoja va al costado y no tapa el centro.
  const tapados = movil ? gradosTapados(medidas.total - despActual, tamanio.ancho, fov) : 0;
  const camAlt = altitudCamara(altVisible, tapados);

  useEffect(() => {
    const el = contenedorRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setTamanio({ ancho: e.contentRect.width, alto: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const quieto = prefiereMenosMovimiento();
    const fuente = getComputedStyle(document.body).fontFamily;
    const claveVista = `${placeId}|${iso}|${az.toFixed(2)}|${camAlt.toFixed(2)}|${fov}`;
    let raf = 0;
    const dibujar = (t: number) => {
      const { ancho, alto } = tamanio;
      if (!ancho || !alto) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(ancho * dpr)) canvas.width = Math.round(ancho * dpr);
      if (canvas.height !== Math.round(alto * dpr)) canvas.height = Math.round(alto * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      tocables.current = pintarEscena(ctx, {
        pre: escena.pre,
        cam: camara({ az, alt: camAlt, fov }, ancho, alto),
        az,
        fov,
        solAlt: escena.solAlt,
        t,
        quieto,
        fuente,
        astros: escena.astros,
        luna: escena.luna,
        selectedId,
        claveVista,
      });
    };
    const bucle = (t: number) => {
      dibujar(t);
      raf = requestAnimationFrame(bucle);
    };
    if (quieto) dibujar(0);
    else raf = requestAnimationFrame(bucle);
    return () => cancelAnimationFrame(raf);
  }, [escena, placeId, iso, az, camAlt, fov, selectedId, tamanio]);

  // Girar suavemente hacia el astro elegido y abrir su ficha.
  function mirarA(id: string) {
    setSelectedId(id);
    if (!alta) llevarHoja("alta");
    const o = escena.astros.find((x) => x.id === id && x.visible);
    if (!o) return;
    const { az: az0, altVisible: alt0 } = vista.current;
    const dAz = ((o.az - az0 + 540) % 360) - 180;
    const destinoAlt = limitarAltitud(o.alt);
    animar(0, 1, MS_GIRO, (e) => {
      setAz((az0 + dAz * e + 360) % 360);
      setAltVisible(alt0 + (destinoAlt - alt0) * e);
    });
  }

  const arrastre = useRef<{ x: number; y: number; az: number; alt: number; movio: boolean } | null>(null);
  function alPresionar(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastre.current = { x: e.clientX, y: e.clientY, az, alt: altVisible, movio: false };
  }
  function alMover(e: React.PointerEvent) {
    const a = arrastre.current;
    if (!a || !tamanio.ancho) return;
    const dx = e.clientX - a.x;
    const dy = e.clientY - a.y;
    if (Math.hypot(dx, dy) > 6) a.movio = true;
    if (!a.movio) return;
    const gpp = fov / tamanio.ancho;
    setAz((((a.az - dx * gpp) % 360) + 360) % 360);
    setAltVisible(limitarAltitud(a.alt + dy * gpp));
  }
  function alSoltar(e: React.PointerEvent) {
    const a = arrastre.current;
    arrastre.current = null;
    if (!a || a.movio) return;
    const caja = contenedorRef.current?.getBoundingClientRect();
    const x = e.clientX - (caja?.left ?? 0);
    const y = e.clientY - (caja?.top ?? 0);
    let mejor: { id: string; d: number } | null = null;
    for (const o of tocables.current) {
      const d = Math.hypot(o.x - x, o.y - y);
      if (d <= 30 && (!mejor || d < mejor.d)) mejor = { id: o.id, d };
    }
    if (mejor) mirarA(mejor.id);
    else if (alta) llevarHoja("baja");
  }

  // ---------- Momento y lugar ----------
  // Deja lugar y momento en la URL: se puede compartir y recargar sin perder el contexto.
  function actualizarURL(id: PlaceId, momento: { fecha: string; hora: string } | null) {
    window.history.replaceState(null, "", queryCielo(id, momento));
  }

  function elegirLugar(id: PlaceId) {
    setPlaceId(id);
    actualizarURL(id, esEjemplo ? null : { fecha, hora });
  }

  function elegirMomento(
    nuevaFecha: string,
    nuevaHora: string,
    opciones: { ejemplo?: boolean; modo?: "noche" | "ahora"; lugar?: PlaceId } = {},
  ) {
    const momento = momentoDesdeURL(nuevaFecha, nuevaHora);
    if (!momento) return; // Campo a medio escribir: se ignora hasta que sea válido.
    const id = opciones.lugar ?? placeId;
    setPlaceId(id);
    setFecha(momento.fecha);
    setHora(momento.hora);
    setEsEjemplo(opciones.ejemplo ?? false);
    setModo(opciones.modo ?? null);
    setViajando(false);
    setDesfase(0);
    actualizarURL(id, opciones.ejemplo ? null : momento);
  }

  const seleccionado = escena.objetos.find((o) => o.id === selectedId) ?? null;
  const info = seleccionado ? SKY_OBJECT_INFO[seleccionado.id as SkyObjectId] : null;
  const ningunoVisible = escena.objetos.every((o) => !o.isAboveHorizon);
  const fechaTexto = `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]}`;
  const chip = (activo: boolean) =>
    `inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full border px-3 text-sm min-[360px]:px-4 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] ${
      activo ? "border-text bg-text font-medium text-bg" : "border-border bg-surface-raised/60 text-text hover:border-text-muted"
    }`;
  const campo = "min-h-12 w-full rounded-control border border-border bg-surface-raised px-3 text-text";
  const etiqueta = "text-[11px] font-medium tracking-[0.18em] text-text-muted uppercase";

  return (
    // En el celular ocupa toda la pantalla (la navegación queda abajo); en escritorio, debajo del encabezado.
    <div className="fixed inset-0 overflow-hidden bg-bg md:top-[53px]">
      <ViewTransition name={VT_TIERRA_CIELO} share={VT_TIERRA_CIELO} default="none">
        <div
          ref={contenedorRef}
          className="absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing"
          onPointerDown={alPresionar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={() => {
            arrastre.current = null;
          }}
        >
          <canvas
            ref={canvasRef}
            className="block h-full w-full"
            role="img"
            aria-label={`Cielo calculado desde ${place.name}, mirando hacia el ${rumbo(az)}. Arrastrá para girar.`}
          />
          {llegada && (
            <div
              key={llegada.src}
              className="fundir-en-cielo pointer-events-none absolute inset-0"
              onAnimationEnd={olvidarFotoDeLlegada}
            >
              <Image src={llegada.src} alt="" fill sizes="100vw" className="object-cover" />
            </div>
          )}
        </div>
      </ViewTransition>

      {/* Encabezado: flota sobre el cielo, sin caja. */}
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] md:px-8 md:pt-7">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-[0.18em] text-sand uppercase">El cielo desde</p>
          <h1 className="mt-1 font-display text-[34px] leading-[38px] font-bold tracking-tight md:text-[44px] md:leading-[48px]">
            {place.name}
          </h1>
          <p className="mt-1.5 text-sm text-text/80">
            {LUZ[escena.luz]} · mirando al {rumbo(az)}
          </p>
          {escena.luz === "dia" && (
            <p className="mt-1 max-w-[30ch] text-xs text-text/70">Salvo la Luna, a esta hora no se ven a simple vista.</p>
          )}
        </div>
        <Link
          href={`/explorar?placeId=${place.id}`}
          aria-label={`Ver el paisaje de ${place.name}`}
          className="pointer-events-auto mt-1 inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center gap-1.5 rounded-full border border-text/25 bg-bg/55 px-3 min-[360px]:px-4 text-sm text-text transition-colors duration-150 hover:border-text/60 active:scale-[0.97]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m3 20 6-11 4 7 2-3 6 7z" />
          </svg>
          <span className="max-[359px]:sr-only">Paisaje</span>
        </Link>
      </header>

      {/* Hoja inferior: sólida, sin vidrio; la sombra la separa del cielo. Lo que baja queda recortado sobre la navegación. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden md:bottom-0"
        style={{ bottom: movil ? `calc(${NAV_MOVIL}px + env(safe-area-inset-bottom))` : undefined }}
      >
        <section
          ref={hojaRef}
          aria-label="Controles del cielo"
          style={{ transform: medidas.total ? `translateY(${despActual}px)` : "translateY(100%)" }}
          className="pointer-events-auto absolute inset-x-0 bottom-0 flex max-h-[min(62dvh,560px)] flex-col rounded-t-[28px] border-t border-border bg-surface shadow-[0_-18px_48px_rgba(3,5,12,0.55)] md:right-auto md:left-6 md:w-[420px] md:border-x"
        >
          <div ref={pieRef} className="shrink-0 px-5 pb-4">
            <button
              type="button"
              onPointerDown={hojaPresionar}
              onPointerMove={hojaMover}
              onPointerUp={hojaSoltar}
              onPointerCancel={() => {
                arrastreHoja.current = null;
              }}
              onClick={hojaClick}
              aria-expanded={alta}
              aria-controls="hoja-detalle"
              aria-label={alta ? "Achicar el panel" : "Agrandar el panel"}
              className="-mx-5 flex h-12 w-[calc(100%+2.5rem)] touch-none items-center justify-center"
            >
              <span className={`h-1 rounded-full transition-[width,background-color] duration-200 ${alta ? "w-14 bg-text-muted" : "w-10 bg-border"}`} />
            </button>

            {/* El tiempo es el control protagonista. */}
            <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
              <div>
                <p className="font-display text-[34px] leading-[38px] min-[360px]:text-[40px] min-[360px]:leading-[40px] font-bold tabular-nums tracking-tight">{iso.slice(11, 16)}</p>
                <p className="mt-1 text-sm text-text-muted">
                  {fechaTexto}
                  {textoDesfase(desfase) && <span className="ml-2 text-sky tabular-nums">{textoDesfase(desfase)}</span>}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={chip(modo === "noche" && desfase === 0)}
                  onClick={() => elegirMomento(fechaArgentina(new Date()), HORA_EJEMPLO, { ejemplo: true, modo: "noche" })}
                >
                  Esta noche
                </button>
                <button
                  type="button"
                  className={chip(modo === "ahora" && desfase === 0)}
                  onClick={() => {
                    const a = ahoraEnArgentina();
                    elegirMomento(a.fecha, a.hora, { modo: "ahora" });
                  }}
                >
                  Ahora
                </button>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!viajando && desfase >= VIAJE_MAX) setDesfase(-VIAJE_MAX);
                  setViajando(!viajando);
                }}
                aria-label={viajando ? "Pausar el viaje en el tiempo" : "Ver girar el cielo"}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky text-bg shadow-[0_2px_0_rgba(3,5,12,0.35)] transition-transform duration-150 hover:bg-[#93d6f0] active:translate-y-px active:scale-[0.96]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  {viajando ? <path d="M7 5h4v14H7zM13 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}
                </svg>
              </button>
              <input
                type="range"
                aria-label="Viajar en el tiempo"
                aria-valuetext={`${iso.slice(11, 16)}${textoDesfase(desfase) ? `, ${textoDesfase(desfase)}` : ""}`}
                min={-VIAJE_MAX}
                max={VIAJE_MAX}
                step={5}
                value={desfase}
                onChange={(e) => {
                  setViajando(false);
                  setDesfase(Number(e.target.value));
                }}
                className={`${estilos.deslizador} min-h-12 w-full`}
              />
            </div>

            {/* Astros: tocar uno gira el cielo hacia él. */}
            <ul className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]" aria-label="Objetos calculados">
              {escena.objetos.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => mirarA(o.id)}
                    aria-pressed={o.id === selectedId}
                    className={`${chip(o.id === selectedId)} ${o.isAboveHorizon || o.id === selectedId ? "" : "text-text-muted"}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${o.isAboveHorizon ? (o.id === selectedId ? "bg-bg" : "bg-sand") : "border border-text-muted"}`}
                    />
                    {o.name.replace(/ \(.*\)$/, "")}
                    <span className="sr-only">{o.isAboveHorizon ? `, hacia el ${rumbo(o.azimuthDeg)}` : ", bajo el horizonte"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Detalle: se ve al subir la hoja; si no entra, se desplaza adentro sin tapar más cielo. */}
          <div id="hoja-detalle" className="min-h-0 overflow-y-auto overscroll-contain border-t border-border px-5 pt-4 pb-6" inert={!alta}>
            {seleccionado && info ? (
              <article aria-live="polite">
                <p className="text-[11px] font-medium tracking-[0.18em] text-sky uppercase">{info.kind}</p>
                <h2 className="mt-1 font-display text-2xl leading-7 font-bold">{seleccionado.name}</h2>
                <p className="mt-2 text-[15px] leading-6">
                  {seleccionado.isAboveHorizon ? (
                    <>
                      Hacia el <strong>{rumbo(seleccionado.azimuthDeg)}</strong>, {describirAltura(seleccionado.altitudeDeg)}.
                    </>
                  ) : (
                    "A esta hora está bajo el horizonte. Mové el tiempo para verlo salir."
                  )}
                </p>
                <p className="mt-2 text-sm leading-6 text-text-muted">{info.summary}</p>
                <p className="mt-2 text-xs text-text-muted">
                  Fuente:{" "}
                  <a href={info.sources[0].url} target="_blank" rel="noreferrer" className="text-sky underline underline-offset-2">
                    {info.sources[0].label}
                  </a>
                </p>
              </article>
            ) : (
              <p className="text-sm text-text-muted">
                {ningunoVisible
                  ? "Ningún objeto de la selección está sobre el horizonte. Probá otra hora u otro lugar."
                  : "Tocá un astro en el cielo o en la lista para conocerlo."}
              </p>
            )}

            {escena.luz === "crepusculo" && (
              <p className="mt-4 text-sm text-text-muted">
                El cielo todavía tiene luz del Sol: puede que solo se vean la Luna y los objetos más brillantes.
              </p>
            )}

            <fieldset className="mt-6">
              <legend className={etiqueta}>Fecha y hora (Argentina, UTC−3)</legend>
              <div className="mt-2 grid gap-3 min-[360px]:grid-cols-2">
                <input type="date" aria-label="Fecha" className={campo} value={fecha} onChange={(e) => elegirMomento(e.target.value, hora)} />
                <input type="time" aria-label="Hora" className={campo} value={hora} onChange={(e) => elegirMomento(fecha, e.target.value)} />
              </div>
              {esEjemplo && <p className="mt-2 text-xs text-sand">Ejemplo: hoy a las {HORA_EJEMPLO}. Cambialo para ver otro momento.</p>}
              <button
                type="button"
                className={`${chip(false)} mt-3`}
                onClick={() => elegirMomento(DEMO_CIELO.fecha, DEMO_CIELO.hora, { lugar: DEMO_CIELO.placeId })}
              >
                Ver la noche de la demo
              </button>
            </fieldset>

            <p className={`${etiqueta} mt-6`}>Lugar</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {places.map((p) => (
                <button key={p.id} type="button" className={chip(p.id === placeId)} aria-pressed={p.id === placeId} onClick={() => elegirLugar(p.id)}>
                  {p.name}
                </button>
              ))}
            </div>

            <p className="mt-6 text-xs leading-5 text-text-muted">
              Estrellas, constelaciones y Vía Láctea en su posición calculada para este lugar y momento (catálogo d3-celestial,
              estrellas hasta magnitud 5). La silueta del horizonte es plana: no incluye los cerros. Que algo esté sobre el
              horizonte no garantiza verlo: también influyen las nubes y la luz de la Luna y de las ciudades. Cálculo con
              astronomy-engine.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
