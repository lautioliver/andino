"use client";

import { useEffect, useRef } from "react";
import { camara, proyectar } from "./firmamento";
import { pintarFirmamento, precalcular, prefiereMenosMovimiento } from "./lienzo";
import { type SkyLocation, sunAltitudeDeg } from "./motor";

interface Props {
  location: SkyLocation;
  datetimeISO: string;
  /** Rumbo hacia el que se mira, grados desde el norte. */
  az?: number;
  /** Altura del centro de la vista, grados. */
  alt?: number;
  className?: string;
}

/**
 * Cielo calculado como fondo: el mismo dibujo que el cielo inmersivo, sin interacción ni etiquetas.
 * Es decorativo para lectores de pantalla; quien lo usa cuenta en texto qué se está viendo.
 */
export function CieloDeFondo({ location, datetimeISO, az = 180, alt = 35, className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const pre = precalcular(location, datetimeISO);
    const solAlt = sunAltitudeDeg(location, datetimeISO);
    const quieto = prefiereMenosMovimiento();
    let ancho = 0;
    let alto = 0;
    let raf = 0;

    const dibujar = (t: number) => {
      if (ancho === 0 || alto === 0) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(ancho * dpr)) canvas.width = Math.round(ancho * dpr);
      if (canvas.height !== Math.round(alto * dpr)) canvas.height = Math.round(alto * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cam = camara({ az, alt, fov: ancho < 640 ? 80 : 100 }, ancho, alto);
      const horizonteY = proyectar(cam, 0, az)?.y ?? alto;
      pintarFirmamento(ctx, { pre, cam, solAlt, horizonteY, t, quieto, fuente: "sans-serif", conNombres: false });
    };

    const ro = new ResizeObserver(([e]) => {
      ancho = e.contentRect.width;
      alto = e.contentRect.height;
      dibujar(performance.now());
    });
    ro.observe(canvas);

    const bucle = (t: number) => {
      dibujar(t);
      raf = requestAnimationFrame(bucle);
    };
    if (!quieto) raf = requestAnimationFrame(bucle);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [location, datetimeISO, az, alt]);

  return <canvas ref={canvasRef} aria-hidden className={`block h-full w-full ${className}`} />;
}
