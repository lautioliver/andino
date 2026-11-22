"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SkyObjectKind } from "@/data/astronomy";
import type { SkyObject } from "@/shared/types";
import { rumbo } from "./cielo";
import { type Camara, camara, proyectar } from "./firmamento";
import { MUTED, pintarFirmamento, precalcular, prefiereMenosMovimiento, SAND, TEXT } from "./lienzo";
import type { SkyLocation } from "./motor";

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
  onSelect: (id: string) => void;
  nombreLugar: string;
}

/**
 * Cielo inmersivo: mirás hacia un rumbo con el horizonte abajo y arrastrás para girar.
 * Todo lo que se dibuja está calculado para el lugar y el instante; nada es decorativo.
 * Para lectores de pantalla, la lista de objetos de la página es el control accesible.
 */
export function SkyCanvas({ location, datetimeISO, solAlt, objetos, selectedId, onSelect, nombreLugar }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tamanio, setTamanio] = useState({ ancho: 0, alto: 0 });
  const [az, setAz] = useState(() => {
    const visible = objetos.find((o) => o.isAboveHorizon);
    return visible ? visible.azimuthDeg : 180;
  });
  const [alt, setAlt] = useState(40);
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

  // Al elegir un objeto desde la lista, giramos suavemente hacia él.
  useEffect(() => {
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
  }, [selectedId, objetos]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const quieto = prefiereMenosMovimiento();
    const fuente = getComputedStyle(document.body).fontFamily;
    let raf = 0;

    const dibujar = (t: number) => {
      const s = { pre, az, alt, fov, solAlt, objetos, selectedId, tamanio };
      const { ancho, alto } = s.tamanio;
      if (ancho === 0 || alto === 0) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(ancho * dpr)) canvas.width = Math.round(ancho * dpr);
      if (canvas.height !== Math.round(alto * dpr)) canvas.height = Math.round(alto * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cam: Camara = camara({ az: s.az, alt: s.alt, fov: s.fov }, ancho, alto);
      const horizonteY = proyectar(cam, 0, s.az)?.y ?? alto;

      // 1 a 4. Cielo, Vía Láctea, constelaciones y estrellas.
      const oscuro = pintarFirmamento(ctx, { pre: s.pre, cam, solAlt: s.solAlt, horizonteY, t, quieto, fuente, conNombres: true });

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
        const color = o.kind === "satélite" ? SAND : o.kind === "planeta" ? "255, 236, 200" : TEXT;
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
  }, [pre, az, alt, fov, solAlt, objetos, selectedId, tamanio]);

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
    if (mejor) onSelect(mejor.id);
  }

  return (
    <div className="relative">
      <div
        ref={contenedorRef}
        className="h-[68vh] max-h-[720px] min-h-[420px] w-full cursor-grab touch-none select-none active:cursor-grabbing"
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

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
        <p className="rounded-full bg-bg/70 px-3 py-1 text-xs text-text-muted">
          Mirando al <span className="font-medium text-text">{rumbo(az)}</span> · arrastrá para girar
        </p>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 p-3">
        {CARDINALES.filter((c) => c.label.length === 1).map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => setAz(c.az)}
            aria-label={`Mirar al ${rumbo(c.az)}`}
            className="min-h-11 min-w-11 rounded-full border border-border bg-bg/80 text-sm font-medium text-text"
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
