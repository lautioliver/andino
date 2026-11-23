"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import catalogoJSON from "@/data/cielo/catalogo.json";
import { nombreObjeto, SKY_OBJECT_INFO, type SkyObjectKind } from "@/data/astronomy";
import { useLang } from "@/shared/i18n/lang";
import type { SkyObject } from "@/shared/types";
import { YACANA } from "./andino";
import { campoVisible } from "./camaraTrasera";
import { CelestialObjectCard } from "./CelestialObjectCard";
import { rumbo, rumboYAltura } from "./cielo";
import {
  aHorizonte,
  aPantalla,
  type Camara,
  camara,
  colorEstrella,
  coloresCielo,
  enCamara,
  matrizHorizonte,
  oscuridad,
  proyectar,
  radioEstrella,
  recortarPoligono,
} from "./firmamento";
import { type Candidato, enLaMira } from "./mira";
import type { SkyLocation, SkyObjectId } from "./motor";
import { type EstadoBrujula, useBrujula } from "./useBrujula";
import { type EstadoCamara, useCamara } from "./useCamara";
import { usePantallaEncendida } from "./usePantallaEncendida";
import { type EnMira, type EstadoVisor, VisorCamara } from "./VisorCamara";

type Punto = [number, number];
interface Catalogo {
  estrellas: [number, number, number, number][];
  constelaciones: { id: string; nombre: string; etiqueta: Punto; lineas: Punto[][] }[];
  viaLactea: { nivel: number; poligonos: Punto[][] }[];
}
const catalogo = catalogoJSON as unknown as Catalogo;

// Colores del lienzo (el canvas no lee variables CSS): los tokens de .oscuro en design.md §6.
const SKY = "179, 163, 255"; // --violeta-ink (oscuro): constelaciones
const SAND = "255, 154, 110"; // --puna-ink (oscuro): horizonte y cardinales
const TEXT = "248, 250, 252"; // --text (oscuro)
const MUTED = "203, 213, 225"; // --text-muted (oscuro)
const LUNA = "236, 228, 210"; // la Luna, pálida: no se tiñe con la marca
const NOCHE = "15, 23, 42"; // --noche: velo y sombra del dibujo sobre la imagen de la cámara

/** Límites de la altura de la mirada: el cielo dibujado no baja del horizonte; con la cámara sigue al teléfono. */
const acotar = (alt: number, conCamara: boolean) => (conCamara ? Math.min(85, Math.max(-85, alt)) : Math.min(80, Math.max(5, alt)));

const CARDINALES = [
  { label: "N", az: 0 },
  { label: "NE", az: 45 },
  { label: "E", az: 90 },
  { label: "SE", az: 135 },
  { label: "S", az: 180 },
  { label: "SO", az: 225 },
  { label: "O", az: 270 },
  { label: "NO", az: 315 },
];

/** Cardinales en inglés: solo cambia el oeste (O → W). */
const cardinalEn = (label: string) => label.replace("O", "W");

type Objeto = SkyObject & { kind: SkyObjectKind };

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
}

interface Precalculo {
  estrellas: { alt: number; az: number; mag: number; color: string; fase: number; velocidad: number }[];
  lineas: { alt: number; az: number }[][];
  etiquetas: { id: string; nombre: string; alt: number; az: number }[];
  viaLactea: { nivel: number; poligonos: { alt: number; az: number }[][] }[];
  yacana: { ojos: { alt: number; az: number }[]; etiqueta: { alt: number; az: number } };
}

/** Posiciones de todo el catálogo para un instante y lugar: se calcula una vez, no por cuadro. */
function precalcular(location: SkyLocation, datetimeISO: string): Precalculo {
  const m = matrizHorizonte(location, datetimeISO);
  const h = ([ar, dec]: readonly [number, number]) => aHorizonte(m, ar, dec);
  return {
    estrellas: catalogo.estrellas.map(([ar, dec, mag, bv], i) => {
      const [r, g, b] = colorEstrella(bv);
      return { ...aHorizonte(m, ar, dec), mag, color: `${r}, ${g}, ${b}`, fase: (i * 2.399) % (2 * Math.PI), velocidad: 0.6 + ((i * 7) % 13) / 10 };
    }),
    lineas: catalogo.constelaciones.flatMap((c) => c.lineas.map((linea) => linea.map(h))),
    etiquetas: catalogo.constelaciones.map((c) => ({ id: c.id, nombre: c.nombre, ...h(c.etiqueta) })),
    viaLactea: catalogo.viaLactea.map((n) => ({ nivel: n.nivel, poligonos: n.poligonos.map((p) => p.map(h)) })),
    yacana: { ojos: YACANA.ojos.map(h), etiqueta: h(YACANA.etiqueta) },
  };
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
export function SkyCanvas({ location, datetimeISO, solAlt, objetos, selectedId, onSelect, nombreLugar, modo = "interactivo", yacana = false, onApuntar }: Props) {
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
      const s = { pre, az, alt: altVista, giro: giroVista, fov, solAlt, objetos, selectedId, tamanio: area, yacana, apuntando, conCamara };
      const { ancho, alto } = s.tamanio;
      if (ancho === 0 || alto === 0) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(ancho * dpr)) canvas.width = Math.round(ancho * dpr);
      if (canvas.height !== Math.round(alto * dpr)) canvas.height = Math.round(alto * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cam: Camara = camara({ az: s.az, alt: s.alt, fov: s.fov, giro: s.giro }, ancho, alto);
      const oscuro = oscuridad(s.solAlt);
      // Apuntando con luz, las figuras (líneas y nombres, no las estrellas) se marcan tenues para que sepas
      // dónde están aunque no se vean. En blanco: el celeste se pierde contra el cielo de día.
      const guia = s.apuntando ? Math.max(oscuro, 0.6) : oscuro;
      const tinta = s.apuntando && oscuro < 0.6 ? TEXT : SKY;
      const horizonteY = proyectar(cam, 0, s.az)?.y ?? alto;
      // Con la cámara el horizonte puede estar ladeado: que un rótulo esté sobre él lo decide su altura, no la fila de la pantalla.
      const enElCielo = (y: number) => (s.conCamara ? y < alto + 12 : y < horizonteY);
      // Sobre la imagen de la cámara el dibujo lleva más peso: líneas más marcadas y sombra bajo los textos.
      const sombra = (activa: boolean) => {
        ctx.shadowColor = activa && s.conCamara ? `rgba(${NOCHE}, 0.9)` : "transparent";
        ctx.shadowBlur = activa && s.conCamara ? 3 : 0;
      };

      // 1. Cielo: color calculado según la altura del Sol. Con la cámara detrás, el lienzo queda
      // transparente y solo lleva un velo de Noche para que el dibujo se lea sobre la imagen de día.
      if (s.conCamara) {
        ctx.clearRect(0, 0, ancho, alto);
        ctx.fillStyle = `rgba(${NOCHE}, 0.4)`;
      } else {
        const { cenit, horizonte } = coloresCielo(s.solAlt);
        const fondo = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizonteY));
        fondo.addColorStop(0, cenit);
        fondo.addColorStop(1, horizonte);
        ctx.fillStyle = fondo;
      }
      ctx.fillRect(0, 0, ancho, alto);

      // 2. Vía Láctea: capas apenas visibles que se suman donde es más densa.
      if (oscuro > 0) {
        for (const nivel of s.pre.viaLactea) {
          // Un solo trazado por nivel con regla par-impar: los anillos interiores son huecos.
          ctx.fillStyle = `rgba(${TEXT}, ${0.04 * oscuro})`;
          ctx.beginPath();
          for (const poligono of nivel.poligonos) {
            const recortado = recortarPoligono(poligono.map((p) => enCamara(cam, p.alt, p.az)));
            if (recortado.length < 3) continue;
            recortado.forEach((p, i) => {
              const q = aPantalla(cam, p);
              if (!q) return;
              if (i === 0) ctx.moveTo(q.x, q.y);
              else ctx.lineTo(q.x, q.y);
            });
            ctx.closePath();
          }
          ctx.fill("evenodd");
        }
      }

      // 3. Constelaciones: líneas y nombres tenues.
      if (guia > 0) {
        ctx.strokeStyle = `rgba(${tinta}, ${s.conCamara ? 0.5 : 0.22 * guia})`;
        ctx.lineWidth = s.conCamara ? 1.25 : 1;
        ctx.beginPath();
        for (const linea of s.pre.lineas) {
          let anterior: { x: number; y: number } | null = null;
          for (const p of linea) {
            const q = p.alt > -2 ? proyectar(cam, p.alt, p.az) : null;
            if (q && anterior) {
              ctx.moveTo(anterior.x, anterior.y);
              ctx.lineTo(q.x, q.y);
            }
            anterior = q;
          }
        }
        ctx.stroke();

        ctx.font = `500 10px ${fuente}`;
        ctx.textAlign = "center";
        ctx.fillStyle = `rgba(${tinta}, ${s.conCamara ? 0.95 : 0.5 * guia})`;
        sombra(true);
        for (const e of s.pre.etiquetas) {
          if (e.alt < 4) continue;
          const q = proyectar(cam, e.alt, e.az);
          if (q && q.x > -40 && q.x < ancho + 40 && q.y > 0 && enElCielo(q.y)) ctx.fillText(e.nombre.toUpperCase(), q.x, q.y);
        }
        sombra(false);
      }

      // 4. Estrellas: posición, brillo y color reales; titileo suave (más cerca del horizonte).
      // Con la cámara se marcan también con luz, como las figuras: muestran dónde están, no que se vean.
      const luzEstrellas = s.conCamara ? guia : oscuro;
      if (luzEstrellas > 0) {
        const tt = t / 1000;
        for (const e of s.pre.estrellas) {
          if (e.alt < 0) continue;
          const q = proyectar(cam, e.alt, e.az);
          if (!q || q.x < -4 || q.x > ancho + 4 || q.y < -4 || q.y > alto + 4) continue;
          const amplitud = quieto ? 0 : 0.08 + 0.22 * (1 - Math.min(1, e.alt / 45));
          const titileo = 1 - amplitud * (0.5 + 0.5 * Math.sin(tt * e.velocidad * 2.2 + e.fase));
          const brillo = Math.min(1, Math.max(0.18, 1.15 - e.mag * 0.17)) * luzEstrellas * titileo;
          ctx.fillStyle = `rgba(${e.color}, ${brillo})`;
          ctx.beginPath();
          ctx.arc(q.x, q.y, radioEstrella(e.mag), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 4b. Yacana (docs/fuentes-cielo-andino.md): es una figura oscura de la Vía Láctea, no un dibujo de
      // estrellas. Solo sus ojos (α y β Cen) y su nombre, en arena y sin líneas, para no confundirla con las occidentales.
      if (s.yacana && guia > 0) {
        ctx.strokeStyle = `rgba(${SAND}, ${0.8 * guia})`;
        ctx.lineWidth = 1.25;
        const ojos = s.pre.yacana.ojos.filter((o) => o.alt > 0).map((o) => proyectar(cam, o.alt, o.az));
        for (const q of ojos) {
          if (!q) continue;
          ctx.beginPath();
          ctx.arc(q.x, q.y, 8, 0, Math.PI * 2);
          ctx.stroke();
        }
        const [a, b] = ojos;
        ctx.textAlign = "center";
        sombra(true);
        if (a && b && enElCielo(a.y)) {
          ctx.font = `500 10px ${fuente}`;
          ctx.fillStyle = `rgba(${SAND}, ${0.7 * guia})`;
          ctx.fillText(langRef.current === "en" ? "eyes of the Yacana" : "ojos de la Yacana", (a.x + b.x) / 2, Math.min(a.y, b.y) - 14);
        }
        const e = s.pre.yacana.etiqueta;
        const q = e.alt >= 4 ? proyectar(cam, e.alt, e.az) : null;
        if (q && q.x > -60 && q.x < ancho + 60 && q.y > 0 && enElCielo(q.y)) {
          ctx.font = `italic 500 15px ${fuente}`;
          ctx.fillStyle = `rgba(${SAND}, ${0.9 * guia})`;
          ctx.fillText("Yacana", q.x, q.y);
        }
        sombra(false);
      }

      // 5. Suelo: todo lo que está bajo el horizonte, con el borde en arena. Con la cámara, solo el borde:
      // abajo se ve el paisaje real.
      ctx.beginPath();
      let primero = true;
      // Con el teléfono ladeado el horizonte cruza la pantalla en diagonal y entra más rumbo que el del campo horizontal.
      const mitadHorizonte = s.conCamara ? 120 : s.fov;
      for (let d = -mitadHorizonte; d <= mitadHorizonte; d += 2) {
        const q = proyectar(cam, 0, s.az + d);
        if (!q) continue;
        if (primero) {
          ctx.moveTo(q.x, q.y);
          primero = false;
        } else ctx.lineTo(q.x, q.y);
      }
      if (!s.conCamara) {
        ctx.lineTo(ancho + 10, alto + 10);
        ctx.lineTo(-10, alto + 10);
        ctx.closePath();
        const suelo = ctx.createLinearGradient(0, horizonteY, 0, alto);
        suelo.addColorStop(0, "rgb(14, 17, 30)");
        suelo.addColorStop(1, "rgb(6, 8, 16)");
        ctx.fillStyle = suelo;
        ctx.fill();
      }
      ctx.strokeStyle = `rgba(${SAND}, ${s.conCamara ? 0.9 : 0.45})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      sombra(true);
      ctx.font = `600 12px ${fuente}`;
      ctx.textAlign = "center";
      for (const c of CARDINALES) {
        const q = proyectar(cam, -4, c.az);
        if (!q || q.x < 0 || q.x > ancho) continue;
        ctx.fillStyle = `rgba(${c.label.length === 1 ? SAND : MUTED}, ${c.label.length === 1 ? 0.95 : 0.6})`;
        ctx.fillText(langRef.current === "en" ? cardinalEn(c.label) : c.label, q.x, q.y + 6);
      }

      // 6. Luna, planetas y estrellas destacadas: tocables.
      const nuevos: { id: string; x: number; y: number }[] = [];
      ctx.font = `600 12px ${fuente}`;
      ctx.textAlign = "left";
      for (const o of s.objetos) {
        if (!o.isAboveHorizon) continue;
        const q = proyectar(cam, o.altitudeDeg, o.azimuthDeg);
        if (!q || q.x < -20 || q.x > ancho + 20 || q.y < -20 || q.y > alto + 20) continue;
        nuevos.push({ id: o.id, x: q.x, y: q.y });
        const radio = o.kind === "satélite" ? 9 : o.kind === "planeta" ? 4 : 3.2;
        const color = o.kind === "satélite" ? LUNA : o.kind === "planeta" ? "255, 236, 200" : TEXT;
        ctx.fillStyle = `rgba(${color}, ${o.kind === "satélite" ? 1 : Math.max(0.6, oscuro)})`;
        ctx.beginPath();
        ctx.arc(q.x, q.y, radio, 0, Math.PI * 2);
        ctx.fill();
        const elegido = o.id === s.selectedId;
        if (elegido) {
          ctx.strokeStyle = `rgba(${TEXT}, 0.9)`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(q.x, q.y, radio + 7, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = `rgba(${TEXT}, ${elegido ? 1 : 0.85})`;
        ctx.fillText(nombreObjeto(o.id, o.name, langRef.current), q.x + radio + (elegido ? 11 : 6), q.y + 4);
      }
      sombra(false);
      objetivos.current = nuevos;
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
        className="relative h-[62svh] max-h-[720px] min-h-[380px] w-full cursor-grab touch-none select-none outline-offset-[-2px] active:cursor-grabbing"
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

      {/* Barra bajo el cielo: hacia dónde mirás y los cuatro rumbos. */}
      <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4 border-b border-border px-4 md:px-6">
        <p className="min-w-0 py-3 text-sm text-text-muted" aria-live="polite">
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
