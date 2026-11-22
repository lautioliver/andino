"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import catalogoJSON from "@/data/cielo/catalogo.json";
import type { SkyObjectKind } from "@/data/astronomy";
import type { SkyObject } from "@/shared/types";
import { YACANA } from "./andino";
import { rumbo } from "./cielo";
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
import type { SkyLocation } from "./motor";
import { useBrujula } from "./useBrujula";

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

type Objeto = SkyObject & { kind: SkyObjectKind };

interface Props {
  location: SkyLocation;
  datetimeISO: string;
  solAlt: number;
  objetos: Objeto[];
  selectedId: string | null;
  onSelect?: (id: string) => void;
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
  etiquetas: { nombre: string; alt: number; az: number }[];
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
    etiquetas: catalogo.constelaciones.map((c) => ({ nombre: c.nombre, ...h(c.etiqueta) })),
    viaLactea: catalogo.viaLactea.map((n) => ({ nivel: n.nivel, poligonos: n.poligonos.map((p) => p.map(h)) })),
    yacana: { ojos: YACANA.ojos.map(h), etiqueta: h(YACANA.etiqueta) },
  };
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
  // «Apuntá»: con la brújula encendida, el cielo sigue a la cámara de atrás del teléfono.
  const brujula = useBrujula((v) => {
    setAz(v.az);
    setAlt(Math.min(80, Math.max(5, v.alt)));
  });
  const apuntando = brujula.estado === "activa";
  const onApuntarRef = useRef(onApuntar);
  useEffect(() => {
    onApuntarRef.current = onApuntar;
  }, [onApuntar]);
  useEffect(() => {
    onApuntarRef.current?.(apuntando);
  }, [apuntando]);
  const fov = tamanio.ancho < 640 ? 80 : 100;

  const pre = useMemo(() => precalcular(location, datetimeISO), [location, datetimeISO]);

  // Vista actual para arrancar las animaciones de giro desde donde está.
  const vistaRef = useRef({ az, alt });
  useEffect(() => {
    vistaRef.current = { az, alt };
  }, [az, alt]);
  const objetivos = useRef<{ id: string; x: number; y: number }[]>([]);

  useEffect(() => {
    const el = contenedorRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setTamanio({ ancho: e.contentRect.width, alto: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const quieto = prefiereMenosMovimiento();
    const fuente = getComputedStyle(document.body).fontFamily;
    let raf = 0;

    const dibujar = (t: number) => {
      const s = { pre, az, alt, fov, solAlt, objetos, selectedId, tamanio, yacana };
      const { ancho, alto } = s.tamanio;
      if (ancho === 0 || alto === 0) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(ancho * dpr)) canvas.width = Math.round(ancho * dpr);
      if (canvas.height !== Math.round(alto * dpr)) canvas.height = Math.round(alto * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cam: Camara = camara({ az: s.az, alt: s.alt, fov: s.fov }, ancho, alto);
      const oscuro = oscuridad(s.solAlt);
      const horizonteY = proyectar(cam, 0, s.az)?.y ?? alto;

      // 1. Cielo: color calculado según la altura del Sol.
      const { cenit, horizonte } = coloresCielo(s.solAlt);
      const fondo = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizonteY));
      fondo.addColorStop(0, cenit);
      fondo.addColorStop(1, horizonte);
      ctx.fillStyle = fondo;
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
      if (oscuro > 0) {
        ctx.strokeStyle = `rgba(${SKY}, ${0.22 * oscuro})`;
        ctx.lineWidth = 1;
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
        ctx.fillStyle = `rgba(${SKY}, ${0.5 * oscuro})`;
        for (const e of s.pre.etiquetas) {
          if (e.alt < 4) continue;
          const q = proyectar(cam, e.alt, e.az);
          if (q && q.x > -40 && q.x < ancho + 40 && q.y > 0 && q.y < horizonteY) ctx.fillText(e.nombre.toUpperCase(), q.x, q.y);
        }
      }

      // 4. Estrellas: posición, brillo y color reales; titileo suave (más cerca del horizonte).
      if (oscuro > 0) {
        const tt = t / 1000;
        for (const e of s.pre.estrellas) {
          if (e.alt < 0) continue;
          const q = proyectar(cam, e.alt, e.az);
          if (!q || q.x < -4 || q.x > ancho + 4 || q.y < -4 || q.y > alto + 4) continue;
          const amplitud = quieto ? 0 : 0.08 + 0.22 * (1 - Math.min(1, e.alt / 45));
          const titileo = 1 - amplitud * (0.5 + 0.5 * Math.sin(tt * e.velocidad * 2.2 + e.fase));
          const brillo = Math.min(1, Math.max(0.18, 1.15 - e.mag * 0.17)) * oscuro * titileo;
          ctx.fillStyle = `rgba(${e.color}, ${brillo})`;
          ctx.beginPath();
          ctx.arc(q.x, q.y, radioEstrella(e.mag), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 4b. Yacana (docs/fuentes-cielo-andino.md): es una figura oscura de la Vía Láctea, no un dibujo de
      // estrellas. Solo sus ojos (α y β Cen) y su nombre, en arena y sin líneas, para no confundirla con las occidentales.
      if (s.yacana && oscuro > 0) {
        ctx.strokeStyle = `rgba(${SAND}, ${0.8 * oscuro})`;
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
        if (a && b && a.y < horizonteY) {
          ctx.font = `500 10px ${fuente}`;
          ctx.fillStyle = `rgba(${SAND}, ${0.7 * oscuro})`;
          ctx.fillText("ojos de la Yacana", (a.x + b.x) / 2, Math.min(a.y, b.y) - 14);
        }
        const e = s.pre.yacana.etiqueta;
        const q = e.alt >= 4 ? proyectar(cam, e.alt, e.az) : null;
        if (q && q.x > -60 && q.x < ancho + 60 && q.y > 0 && q.y < horizonteY) {
          ctx.font = `italic 500 15px ${fuente}`;
          ctx.fillStyle = `rgba(${SAND}, ${0.9 * oscuro})`;
          ctx.fillText("Yacana", q.x, q.y);
        }
      }

      // 5. Suelo: todo lo que está bajo el horizonte, con el borde en arena.
      ctx.beginPath();
      let primero = true;
      for (let d = -s.fov; d <= s.fov; d += 2) {
        const q = proyectar(cam, 0, s.az + d);
        if (!q) continue;
        if (primero) {
          ctx.moveTo(q.x, q.y);
          primero = false;
        } else ctx.lineTo(q.x, q.y);
      }
      ctx.lineTo(ancho + 10, alto + 10);
      ctx.lineTo(-10, alto + 10);
      ctx.closePath();
      const suelo = ctx.createLinearGradient(0, horizonteY, 0, alto);
      suelo.addColorStop(0, "rgb(14, 17, 30)");
      suelo.addColorStop(1, "rgb(6, 8, 16)");
      ctx.fillStyle = suelo;
      ctx.fill();
      ctx.strokeStyle = `rgba(${SAND}, 0.45)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = `600 12px ${fuente}`;
      ctx.textAlign = "center";
      for (const c of CARDINALES) {
        const q = proyectar(cam, -4, c.az);
        if (!q || q.x < 0 || q.x > ancho) continue;
        ctx.fillStyle = `rgba(${c.label.length === 1 ? SAND : MUTED}, ${c.label.length === 1 ? 0.95 : 0.6})`;
        ctx.fillText(c.label, q.x, q.y + 6);
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
        ctx.fillText(o.name, q.x + radio + (elegido ? 11 : 6), q.y + 4);
      }
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
  }, [pre, az, alt, fov, solAlt, objetos, selectedId, tamanio, yacana]);

  // Arrastrar para girar; un toque corto elige el objeto más cercano.
  const arrastre = useRef<{ x: number; y: number; az: number; alt: number; movio: boolean } | null>(null);

  function alPresionar(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastre.current = { x: e.clientX, y: e.clientY, az, alt, movio: false };
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
    setAlt(Math.min(80, Math.max(5, a.alt + dy * gradosPorPx)));
  }
  function alSoltar(e: React.PointerEvent) {
    const a = arrastre.current;
    arrastre.current = null;
    if (!a || a.movio) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    let mejor: { id: string; d: number } | null = null;
    for (const o of objetivos.current) {
      const d = Math.hypot(o.x - x, o.y - y);
      if (d <= 28 && (!mejor || d < mejor.d)) mejor = { id: o.id, d };
    }
    if (mejor) onSelect?.(mejor.id);
  }

  // Teclado: flechas para girar y subir o bajar la mirada (plan B sin gestos, design.md §8).
  function alTeclear(e: React.KeyboardEvent) {
    const paso = e.shiftKey ? 45 : 10;
    if (e.key === "ArrowLeft") setAz((a) => (a - paso + 360) % 360);
    else if (e.key === "ArrowRight") setAz((a) => (a + paso) % 360);
    else if (e.key === "ArrowUp") setAlt((a) => Math.min(80, a + 5));
    else if (e.key === "ArrowDown") setAlt((a) => Math.max(5, a - 5));
    else return;
    e.preventDefault();
    brujula.apagar();
  }

  const cardinal =
    "eyebrow -mb-px min-h-12 min-w-11 border-b-2 border-transparent text-text-muted transition-colors hover:text-text aria-pressed:border-violeta aria-pressed:text-text";
  // Cardinal más cercano a la mirada: marca el botón activo.
  const cardinalActivo = Math.round((((az % 360) + 360) % 360) / 90) % 4;

  if (modo === "fondo") {
    return (
      <div ref={contenedorRef} className="h-full w-full">
        <canvas
          ref={canvasRef}
          className="block h-full w-full"
          role="img"
          aria-label={`Cielo calculado para esta noche desde ${nombreLugar}, mirando hacia el ${rumbo(az)}.`}
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
        aria-label={`Cielo desde ${nombreLugar}. Usá las flechas para girar.`}
        className="h-[62svh] max-h-[720px] min-h-[380px] w-full cursor-grab touch-none select-none outline-offset-[-2px] active:cursor-grabbing"
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
          className="block h-full w-full"
          role="img"
          aria-label={`Cielo calculado desde ${nombreLugar}, mirando hacia el ${rumbo(az)}. Arrastrá para girar.`}
        />
      </div>

      {/* Barra bajo el cielo: hacia dónde mirás y los cuatro rumbos. Nada flota sobre las estrellas. */}
      <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4 border-b border-border px-4 md:px-6">
        <p className="min-w-0 py-3 text-sm text-text-muted" aria-live="polite">
          Mirando al <span className="text-text">{rumbo(az)}</span>
          <span className="hidden sm:inline"> · arrastrá o usá las flechas para girar</span>
        </p>
        <div role="group" aria-label="Mirar hacia" className="flex shrink-0">
          {CARDINALES.filter((c) => c.label.length === 1).map((c, i) => (
            <button
              key={c.label}
              type="button"
              onClick={() => {
                brujula.apagar();
                setAz(c.az);
              }}
              aria-label={`Mirar al ${rumbo(c.az)}`}
              aria-pressed={brujula.estado !== "activa" && i === cardinalActivo}
              className={cardinal}
            >
              {c.label}
            </button>
          ))}
          {brujula.disponible ? (
            <button
              type="button"
              onClick={brujula.estado === "activa" ? brujula.apagar : brujula.encender}
              aria-pressed={brujula.estado === "activa"}
              className={`${cardinal} ml-2 px-2 text-violeta-ink`}
            >
              {brujula.estado === "activa" ? "Apuntando" : "Apuntá"}
            </button>
          ) : null}
        </div>
      </div>

      {brujula.estado === "sin-brujula" || brujula.estado === "denegada" ? (
        <p role="status" className="mx-auto max-w-[1120px] px-4 py-3 text-sm text-text-muted md:px-6">
          {brujula.estado === "denegada"
            ? "Sin permiso para usar la brújula. Girá el cielo con el dedo."
            : "Este dispositivo no informa hacia dónde está el norte. Girá el cielo con el dedo."}
        </p>
      ) : null}
    </div>
  );
}
