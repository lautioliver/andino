"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { nombreObjeto, SKY_OBJECT_INFO } from "@/data/astronomy";
import { useLang } from "@/shared/i18n/lang";
import { YACANA } from "./andino";
import { campoVisible } from "./camaraTrasera";
import { CelestialObjectCard } from "./CelestialObjectCard";
import { rumbo, rumboYAltura } from "./cielo";
import { CompartirCielo } from "./CompartirCielo";
import { CARDINALES, cardinalEn, dibujarCielo, type Objeto, precalcular } from "./dibujo";
import { type Candidato, enLaMira } from "./mira";
import type { SkyLocation, SkyObjectId } from "./motor";
import type { LugarPostal } from "./postal";
import { type EstadoBrujula, useBrujula } from "./useBrujula";
import { type EstadoCamara, useCamara } from "./useCamara";
import { usePantallaEncendida } from "./usePantallaEncendida";
import { type EnMira, type EstadoVisor, VisorCamara } from "./VisorCamara";

/** Límites de la altura de la mirada: el cielo dibujado no baja del horizonte; con la cámara sigue al teléfono. */
const acotar = (alt: number, conCamara: boolean) => (conCamara ? Math.min(85, Math.max(-85, alt)) : Math.min(80, Math.max(5, alt)));

interface Props {
  location: SkyLocation;
  datetimeISO: string;
  solAlt: number;
  objetos: Objeto[];
  selectedId: string | null;
  /** `desdeVisor`: se eligió en «Ver con la cámara», a pantalla completa; la página de atrás no se mueve. */
  onSelect?: (id: string, desdeVisor?: boolean) => void;
  nombreLugar: string;
  /** "fondo": quieto, sin arrastre ni barra, deja pasar el scroll (portada del Inicio). */
  modo?: "interactivo" | "fondo";
  /** Muestra la Yacana, la llama del cielo andino (ojos y nombre en Puna). */
  yacana?: boolean;
  /** Avisa cuando «Apuntá» se enciende o se apaga: el explorador pasa al cielo de este momento. */
  onApuntar?: (activa: boolean) => void;
  /** Ofrece «Compartir este cielo» bajo el cielo: la postal lleva este lugar en la leyenda y en el enlace. */
  postal?: LugarPostal;
}

/** Marca de la entrada que el visor suma al historial, para reconocerla antes de retirarla. */
const MARCA_HISTORIAL = "andinoCamara";

/** Qué muestra el visor: primero lo que impide usarlo (y la persona puede resolver), después si ya hay imagen y rumbo. */
function estadoDelVisor(brujula: EstadoBrujula, camara: EstadoCamara, mostrando: boolean): EstadoVisor {
  if (brujula === "denegada") return "sin-movimiento";
  if (brujula === "sin-brujula") return "sin-brujula";
  if (camara === "denegada") return "camara-denegada";
  if (camara === "sin-camara") return "sin-camara";
  return mostrando ? "listo" : "pidiendo";
}

const prefiereMenosMovimiento = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Cielo inmersivo: mirás hacia un rumbo con el horizonte abajo y arrastrás para girar.
 * Todo lo que se dibuja está calculado para el lugar y el instante; nada es decorativo.
 * Para lectores de pantalla, la lista de objetos de la página es el control accesible.
 */
export function SkyCanvas({ location, datetimeISO, solAlt, objetos, selectedId, onSelect, nombreLugar, modo = "interactivo", yacana = false, onApuntar, postal }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const lang = useLang();
  const en = lang === "en";
  // El lienzo se dibuja en un bucle: lee el idioma de una ref para no reiniciarlo.
  const langRef = useRef(lang);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tamanio, setTamanio] = useState({ ancho: 0, alto: 0 });
  // De fondo, la cámara mira al objeto más alto y lo deja en la franja de arriba, lejos del texto de la portada.
  const [destacado] = useState(() =>
    modo === "fondo"
      ? objetos.filter((o) => o.isAboveHorizon).sort((x, y) => y.altitudeDeg - x.altitudeDeg)[0]
      : objetos.find((o) => o.isAboveHorizon),
  );
  const [az, setAz] = useState(() => destacado?.azimuthDeg ?? 180);
  const [alt, setAlt] = useState(() => (modo === "fondo" && destacado ? Math.max(5, Math.min(80, destacado.altitudeDeg - 25)) : 40));
  // Inclinación lateral del teléfono. Solo se dibuja con la cámara detrás, donde tiene que coincidir con la imagen.
  const [giro, setGiro] = useState(0);

  // «Ver con la cámara»: el visor a pantalla completa, con la cámara de atrás detrás del dibujo.
  const [visor, setVisor] = useState(false);
  const escenaRef = useRef<HTMLDivElement>(null);
  const canvasVisorRef = useRef<HTMLCanvasElement>(null);
  const [tamanioVisor, setTamanioVisor] = useState({ ancho: 0, alto: 0 });
  /** Lo que quedó en la mira del visor y el objeto que tiene la ficha abierta. */
  const [miraId, setMiraId] = useState<string | null>(null);
  const [fichaId, setFichaId] = useState<string | null>(null);
  /** La cámara se apagó sola (pestaña oculta, o la cortó el sistema): se avisa bajo el cielo. */
  const [camaraCortada, setCamaraCortada] = useState(false);
  // Para los oyentes (historial, teclado, cámara), que no esperan a que React vuelva a dibujar.
  const abierto = useRef(false);
  const entradaEnHistorial = useRef(false);
  const apuntabaAntes = useRef(false);
  const botonVisorRef = useRef<HTMLButtonElement>(null);
  const candidatosRef = useRef<Candidato[]>([]);

  const { estado: estadoCamara, disponible: hayCamara, imagen, videoRef, encender: encenderCamara, apagar: apagarCamara, alMedir } = useCamara(visor, () => {
    // Se apagó sola: se vuelve al cielo de siempre, sin romper nada, y se avisa debajo.
    setCamaraCortada(true);
    cerrarVisor();
    retirarEntrada();
  });
  // «Apuntá»: con la brújula encendida, el cielo sigue a la cámara de atrás del teléfono. Mientras el
  // teléfono pregunta por la cámara, no corre el plazo para decidir que no hay brújula.
  const brujula = useBrujula((v) => {
    setAz(v.az);
    setAlt(v.alt);
    setGiro(v.giro);
    // La mira solo existe en el visor: fuera de él no se calcula.
    if (abierto.current) setMiraId((actual) => enLaMira(v, candidatosRef.current, actual)?.id ?? null);
  }, estadoCamara === "pidiendo");
  const { estado: estadoBrujula, encender: encenderBrujula, apagar: apagarBrujula } = brujula;
  const apuntando = estadoBrujula === "activa";
  const estadoBrujulaRef = useRef(estadoBrujula);
  useEffect(() => {
    estadoBrujulaRef.current = estadoBrujula;
  }, [estadoBrujula]);
  // La imagen real detrás del dibujo. Solo en el visor y apuntando: sin brújula, el cielo no sigue a la imagen.
  const conCamara = visor && apuntando && estadoCamara === "activa";
  const sinRumbo = estadoBrujula === "sin-brujula" || estadoBrujula === "denegada";
  useEffect(() => {
    if (sinRumbo) apagarCamara();
  }, [sinRumbo, apagarCamara]);
  usePantallaEncendida(apuntando);
  const onApuntarRef = useRef(onApuntar);
  useEffect(() => {
    onApuntarRef.current = onApuntar;
  }, [onApuntar]);
  useEffect(() => {
    onApuntarRef.current?.(apuntando);
  }, [apuntando]);
  // El área donde se dibuja: el recuadro de la página o, con el visor abierto, toda la pantalla.
  const area = visor ? tamanioVisor : tamanio;
  // Con la cámara, el campo del dibujo es el que se le supone a la imagen (aproximado: camaraTrasera.ts).
  const fov = (conCamara && imagen && campoVisible(imagen, area)) || (area.ancho < 640 ? 80 : 100);
  // La altura que se dibuja: la del estado, dentro de los límites de cada modo.
  const altVista = acotar(alt, conCamara);
  const giroVista = conCamara ? giro : 0;

  const pre = useMemo(() => precalcular(location, datetimeISO), [location, datetimeISO]);

  // Lo que la mira del visor puede nombrar: los objetos con ficha y los rótulos que se dibujan.
  const candidatos = useMemo<Candidato[]>(() => {
    const figura = (id: string, p: { alt: number; az: number }): Candidato => ({ id: `figura:${id}`, tipo: "figura", alt: p.alt, az: p.az });
    return [
      ...objetos.filter((o) => o.isAboveHorizon).map((o): Candidato => ({ id: o.id, tipo: "objeto", alt: o.altitudeDeg, az: o.azimuthDeg })),
      ...pre.etiquetas.filter((e) => e.alt >= 4).map((e) => figura(e.id, e)),
      ...(yacana && pre.yacana.etiqueta.alt >= 4 ? [figura(YACANA.id, pre.yacana.etiqueta)] : []),
    ];
  }, [objetos, pre, yacana]);
  useEffect(() => {
    candidatosRef.current = candidatos;
  }, [candidatos]);

  /** Cierra el visor: la cámara se apaga y la brújula vuelve a como estaba antes de entrar. */
  const cerrarVisor = useCallback(() => {
    if (!abierto.current) return;
    abierto.current = false;
    setVisor(false);
    setFichaId(null);
    apagarCamara();
    // Si falló (sin permiso, sin brújula), el estado queda: el aviso de siempre lo explica bajo el cielo.
    if (!apuntabaAntes.current && (estadoBrujulaRef.current === "activa" || estadoBrujulaRef.current === "pidiendo")) apagarBrujula();
    botonVisorRef.current?.focus({ preventScroll: true });
  }, [apagarCamara, apagarBrujula]);

  /** Saca del historial la entrada que se sumó al entrar, para que «atrás» vuelva a salir de la página. */
  const retirarEntrada = useCallback(() => {
    if (!entradaEnHistorial.current || document.visibilityState !== "visible") return;
    entradaEnHistorial.current = false;
    // Solo si seguimos parados en esa entrada: ante la duda, queda una entrada de más antes que irse de la página.
    if (window.history.state?.[MARCA_HISTORIAL] === true) window.history.back();
  }, []);

  const salirDelVisor = useCallback(() => {
    cerrarVisor();
    retirarEntrada();
  }, [cerrarVisor, retirarEntrada]);

  // «Atrás» del teléfono cierra el visor en lugar de irse de la página. Si la cámara se cortó con la pestaña
  // oculta, la entrada del historial se retira al volver.
  useEffect(() => {
    const alRetroceder = () => {
      entradaEnHistorial.current = false;
      cerrarVisor();
    };
    const alVolverAVerse = () => {
      if (!abierto.current) retirarEntrada();
    };
    window.addEventListener("popstate", alRetroceder);
    document.addEventListener("visibilitychange", alVolverAVerse);
    return () => {
      window.removeEventListener("popstate", alRetroceder);
      document.removeEventListener("visibilitychange", alVolverAVerse);
    };
  }, [cerrarVisor, retirarEntrada]);

  // Con Cache Components, al navegar la página queda oculta sin desmontarse: el visor no tiene que seguir abierto
  // al volver, y de la entrada del historial ya no se sabe nada.
  useLayoutEffect(
    () => () => {
      cerrarVisor();
      entradaEnHistorial.current = false;
    },
    [cerrarVisor],
  );

  /** El permiso de movimiento se pide dentro del toque, antes de cualquier espera (iPhone); después, la cámara. */
  async function pedirPermisos() {
    setCamaraCortada(false);
    if ((await encenderBrujula()) && abierto.current) await encenderCamara();
  }

  function entrarAlVisor() {
    if (abierto.current) return;
    abierto.current = true;
    apuntabaAntes.current = apuntando;
    setMiraId(null);
    setVisor(true);
    void pedirPermisos();
    // Una entrada más en el historial: «atrás» la consume y cierra el visor.
    window.history.pushState({ [MARCA_HISTORIAL]: true }, "");
    entradaEnHistorial.current = true;
  }

  function abrirFicha(id: string) {
    setFichaId(id);
    onSelect?.(id, true);
  }
  const cerrarFicha = useCallback(() => setFichaId(null), []);

  // Vista actual para arrancar las animaciones de giro desde donde está.
  const vistaRef = useRef({ az, alt: altVista });
  useEffect(() => {
    vistaRef.current = { az, alt: altVista };
  }, [az, altVista]);
  const objetivos = useRef<{ id: string; x: number; y: number }[]>([]);

  useEffect(() => {
    const el = contenedorRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setTamanio({ ancho: e.contentRect.width, alto: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = escenaRef.current;
    if (!visor || !el) return;
    const ro = new ResizeObserver(([e]) => setTamanioVisor({ ancho: e.contentRect.width, alto: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [visor]);

  // Al elegir un objeto desde la lista, giramos suavemente hacia él. Apuntando, manda el teléfono:
  // si no, el cielo en vivo (que se recalcula cada minuto) volvería a girar hacia el objeto elegido.
  useEffect(() => {
    if (apuntando) return;
    const o = objetos.find((x) => x.id === selectedId && x.isAboveHorizon);
    if (!o) return;
    const destinoAlt = Math.min(70, Math.max(15, o.altitudeDeg));
    const duracion = prefiereMenosMovimiento() ? 0 : 700;
    let raf = 0;
    const inicio = performance.now();
    const { az: az0, alt: alt0 } = vistaRef.current;
    const dAz = ((o.azimuthDeg - az0 + 540) % 360) - 180;
    const paso = (t: number) => {
      const u = duracion ? Math.min(1, (t - inicio) / duracion) : 1;
      const e = 1 - (1 - u) ** 3;
      setAz((az0 + dAz * e + 360) % 360);
      setAlt(alt0 + (destinoAlt - alt0) * e);
      if (u < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [selectedId, objetos, apuntando]);

  useEffect(() => {
    // Con el visor abierto se dibuja en su lienzo, a pantalla completa; el de la página queda quieto detrás.
    const canvas = (visor ? canvasVisorRef : canvasRef).current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const quieto = prefiereMenosMovimiento();
    const fuente = getComputedStyle(document.body).fontFamily;
    let raf = 0;

    const dibujar = (t: number) => {
      const { ancho, alto } = area;
      if (ancho === 0 || alto === 0) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(ancho * dpr)) canvas.width = Math.round(ancho * dpr);
      if (canvas.height !== Math.round(alto * dpr)) canvas.height = Math.round(alto * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      objetivos.current = dibujarCielo(
        ctx,
        { pre, az, alt: altVista, giro: giroVista, fov, solAlt, objetos, selectedId, yacana, apuntando, conCamara },
        { ancho, alto, t, quieto, fuente, lang: langRef.current },
      );
    };

    const bucle = (t: number) => {
      dibujar(t);
      raf = requestAnimationFrame(bucle);
    };
    if (quieto) dibujar(0);
    else raf = requestAnimationFrame(bucle);
    // Con movimiento reducido se redibuja solo cuando cambia algo (este efecto se vuelve a correr).
    return () => cancelAnimationFrame(raf);
  }, [pre, az, altVista, giroVista, fov, solAlt, objetos, selectedId, area, yacana, apuntando, conCamara, visor]);

  // Arrastrar para girar; un toque corto elige el objeto más cercano.
  const arrastre = useRef<{ x: number; y: number; az: number; alt: number; movio: boolean } | null>(null);

  function alPresionar(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastre.current = { x: e.clientX, y: e.clientY, az, alt: altVista, movio: false };
  }
  function alMover(e: React.PointerEvent) {
    const a = arrastre.current;
    if (!a || tamanio.ancho === 0) return;
    const dx = e.clientX - a.x;
    const dy = e.clientY - a.y;
    if (Math.hypot(dx, dy) > 6) a.movio = true;
    if (!a.movio) return;
    if (brujula.estado === "activa") brujula.apagar();
    const gradosPorPx = fov / tamanio.ancho;
    setAz((((a.az - dx * gradosPorPx) % 360) + 360) % 360);
    setAlt(acotar(a.alt + dy * gradosPorPx, false));
  }
  function alSoltar(e: React.PointerEvent) {
    const a = arrastre.current;
    arrastre.current = null;
    if (!a || a.movio) return;
    const id = objetoTocado(e.clientX, e.clientY, e.currentTarget, 28);
    if (id) onSelect?.(id);
  }
  /** El objeto dibujado más cerca de un toque (coordenadas de la ventana), dentro de `radio` píxeles. */
  function objetoTocado(clientX: number, clientY: number, lienzo: Element, radio: number): string | null {
    const r = lienzo.getBoundingClientRect();
    let mejor: { id: string; d: number } | null = null;
    for (const o of objetivos.current) {
      const d = Math.hypot(o.x - (clientX - r.left), o.y - (clientY - r.top));
      if (d <= radio && (!mejor || d < mejor.d)) mejor = { id: o.id, d };
    }
    return mejor?.id ?? null;
  }
  // En el visor, un toque sobre un objeto abre su ficha; en cualquier otro lugar, la cierra. Arrastrar no hace nada.
  function alTocarVisor(clientX: number, clientY: number) {
    const id = escenaRef.current ? objetoTocado(clientX, clientY, escenaRef.current, 32) : null;
    if (id) abrirFicha(id);
    else setFichaId(null);
  }

  // Teclado: flechas para girar y subir o bajar la mirada (plan B sin gestos, design.md §8).
  function alTeclear(e: React.KeyboardEvent) {
    const paso = e.shiftKey ? 45 : 10;
    if (e.key === "ArrowLeft") setAz((a) => (a - paso + 360) % 360);
    else if (e.key === "ArrowRight") setAz((a) => (a + paso) % 360);
    else if (e.key === "ArrowUp") setAlt(acotar(altVista + 5, false));
    else if (e.key === "ArrowDown") setAlt(acotar(altVista - 5, false));
    else return;
    e.preventDefault();
    brujula.apagar();
  }

  const cardinal =
    "eyebrow -mb-px min-h-12 min-w-11 border-b-2 border-transparent text-text-muted transition-colors hover:text-text aria-pressed:border-violeta aria-pressed:text-text";
  // Cardinal más cercano a la mirada: marca el botón activo.
  const cardinalActivo = Math.round((((az % 360) + 360) % 360) / 90) % 4;

  const hayVisor = brujula.disponible && hayCamara;
  // Hasta la primera lectura de la brújula, el dibujo todavía no está donde apunta el teléfono.
  const estadoVisor = estadoDelVisor(estadoBrujula, estadoCamara, conCamara && brujula.leyendo);
  // Lo que quedó en la mira, con su nombre en el idioma de la interfaz. Solo los objetos tienen ficha.
  let enMira: EnMira | null = null;
  if (miraId?.startsWith("figura:")) {
    const id = miraId.slice("figura:".length);
    const etiqueta = pre.etiquetas.find((e) => e.id === id);
    if (id === YACANA.id) enMira = { clase: en ? "Andean sky" : "Cielo andino", nombre: YACANA.nombre };
    else if (etiqueta) enMira = { clase: en ? "Constellation" : "Constelación", nombre: etiqueta.nombre };
  } else if (miraId) {
    const o = objetos.find((x) => x.id === miraId);
    const info = SKY_OBJECT_INFO[miraId as SkyObjectId];
    if (o && info) enMira = { clase: en ? info.en.kind : info.kind, nombre: nombreObjeto(o.id, o.name, lang), alAbrir: () => abrirFicha(o.id) };
  }
  const objetoDeLaFicha = fichaId ? objetos.find((o) => o.id === fichaId) : undefined;

  if (modo === "fondo") {
    return (
      <div ref={contenedorRef} className="h-full w-full">
        <canvas
          ref={canvasRef}
          className="block h-full w-full"
          role="img"
          aria-label={en ? `Sky calculated for tonight from ${nombreLugar}, facing ${rumbo(az, lang)}.` : `Cielo calculado para esta noche desde ${nombreLugar}, mirando hacia el ${rumbo(az)}.`}
        />
      </div>
    );
  }

  return (
    <div>
      <div
        ref={contenedorRef}
        tabIndex={0}
        role="group"
        aria-label={en ? `Sky from ${nombreLugar}. Use the arrow keys to turn.` : `Cielo desde ${nombreLugar}. Usá las flechas para girar.`}
        className="alto-cielo relative w-full cursor-grab touch-none select-none outline-offset-[-2px] active:cursor-grabbing"
        onKeyDown={alTeclear}
        onPointerDown={alPresionar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={() => {
          arrastre.current = null;
        }}
      >
        <canvas
          ref={canvasRef}
          className="relative block h-full w-full"
          role="img"
          aria-label={en ? `Sky calculated from ${nombreLugar}, facing ${rumbo(az, lang)}. Drag to turn.` : `Cielo calculado desde ${nombreLugar}, mirando hacia el ${rumbo(az)}. Arrastrá para girar.`}
        />
        {/* «Ver con la cámara»: un toque pide los permisos y abre el visor. Lo único que flota sobre las estrellas. */}
        {hayVisor ? (
          <button
            ref={botonVisorRef}
            type="button"
            onClick={entrarAlVisor}
            // Sin esto, el cielo captura el puntero para el arrastre y el toque no llega al botón.
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-4 left-4 inline-flex min-h-12 cursor-pointer items-center gap-2.5 rounded-full bg-puna pr-5 pl-4 text-[15px] font-semibold text-noche shadow-[0_10px_25px_-8px_rgb(0_0_0/0.7)] transition-[background-color,transform] hover:bg-puna-hover active:translate-y-px md:left-[max(1.5rem,calc(50%-536px))]"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8.5a2 2 0 0 1 2-2h1.6l1.2-2h6.4l1.2 2H18a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
              <circle cx="12" cy="12.5" r="3.4" />
            </svg>
            {en ? "See with the camera" : "Ver con la cámara"}
          </button>
        ) : null}
      </div>

      {/* Barra bajo el cielo: hacia dónde mirás y los cuatro rumbos. En los teléfonos más angostos el texto no
          entra al lado de los botones (quedaba partido en tres renglones): va en su propio renglón, arriba. */}
      <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4 border-b border-border px-4 max-[359px]:flex-wrap max-[359px]:gap-y-0 md:px-6">
        <p className="min-w-0 py-3 text-sm text-text-muted max-[359px]:w-full max-[359px]:pb-0" aria-live="polite">
          {en ? "Facing " : "Mirando al "}
          <span className="text-text">{rumbo(az, lang)}</span>
          <span className="hidden sm:inline">{en ? " · drag or use the arrow keys to turn" : " · arrastrá o usá las flechas para girar"}</span>
        </p>
        <div role="group" aria-label={en ? "Look toward" : "Mirar hacia"} className="flex shrink-0">
          {CARDINALES.filter((c) => c.label.length === 1).map((c, i) => (
            <button
              key={c.label}
              type="button"
              onClick={() => {
                brujula.apagar();
                setAz(c.az);
              }}
              aria-label={en ? `Look ${rumbo(c.az, lang)}` : `Mirar al ${rumbo(c.az)}`}
              aria-pressed={brujula.estado !== "activa" && i === cardinalActivo}
              className={cardinal}
            >
              {en ? cardinalEn(c.label) : c.label}
            </button>
          ))}
          {brujula.disponible ? (
            <button
              type="button"
              onClick={brujula.estado === "activa" ? brujula.apagar : brujula.encender}
              aria-pressed={brujula.estado === "activa"}
              className={`${cardinal} ml-2 px-2 text-violeta-ink`}
            >
              {brujula.estado === "activa" ? (en ? "Pointing" : "Apuntando") : en ? "Point" : "Apuntá"}
            </button>
          ) : null}
        </div>
      </div>

      {camaraCortada ? (
        <p role="status" className="mx-auto max-w-[1120px] px-4 py-3 text-sm text-text-muted md:px-6">
          {en ? "The camera turned off. Tap «See with the camera» to bring it back." : "La cámara se apagó. Tocá «Ver con la cámara» para volver a verla."}
        </p>
      ) : null}

      {brujula.estado === "sin-brujula" || brujula.estado === "denegada" ? (
        <p role="status" className="mx-auto max-w-[1120px] px-4 py-3 text-sm text-text-muted md:px-6">
          {brujula.estado === "denegada"
            ? en
              ? "No permission to use the compass. Turn the sky with your finger."
              : "Sin permiso para usar la brújula. Girá el cielo con el dedo."
            : en
              ? "This device doesn't report where north is. Turn the sky with your finger."
              : "Este dispositivo no informa hacia dónde está el norte. Girá el cielo con el dedo."}
        </p>
      ) : null}

      {/* La postal es del cielo de la página: el mismo lugar e instante, mirando hacia donde se mira acá. */}
      {postal ? <CompartirCielo cielo={{ pre, az, alt: acotar(alt, false), solAlt, objetos, yacana }} iso={datetimeISO} lugar={postal} /> : null}

      {/* El visor va en <body>: cubre el encabezado y el dock, y queda bajo la capa de la luz roja. */}
      {visor
        ? createPortal(
            <VisorCamara
              estado={estadoVisor}
              rumbo={rumboYAltura(az, alt, lang)}
              enMira={enMira}
              haciaElSuelo={alt < 0}
              ficha={objetoDeLaFicha ? <CelestialObjectCard object={objetoDeLaFicha} info={SKY_OBJECT_INFO[objetoDeLaFicha.id as SkyObjectId]} /> : null}
              onCerrarFicha={cerrarFicha}
              onTocar={alTocarVisor}
              onSalir={salirDelVisor}
              onReintentar={pedirPermisos}
              escenaRef={escenaRef}
            >
              {/* La cámara de atrás, a sangre. playsInline, muted y autoPlay: sin ellos iPhone no la muestra. */}
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                aria-hidden
                onLoadedMetadata={alMedir}
                onResize={alMedir}
                className={conCamara ? "pointer-events-none absolute inset-0 h-full w-full object-cover" : "hidden"}
              />
              <canvas
                ref={canvasVisorRef}
                className="absolute inset-0 block h-full w-full"
                role="img"
                aria-label={en ? `Sky calculated from ${nombreLugar}, drawn over the camera image.` : `Cielo calculado desde ${nombreLugar}, dibujado sobre la imagen de la cámara.`}
              />
            </VisorCamara>,
            document.body,
          )
        : null}
    </div>
  );
}
