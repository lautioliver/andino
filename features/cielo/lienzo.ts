// Dibujo del firmamento en un canvas 2D: fondo, Vía Láctea, constelaciones y estrellas.
// Lo comparten el cielo inmersivo (SkyCanvas) y el cielo de fondo (CieloDeFondo). Propiedad: jehp23.
import catalogoJSON from "@/data/cielo/catalogo.json";
import {
  aHorizonte,
  aPantalla,
  type Camara,
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

type Punto = [number, number];
interface Catalogo {
  estrellas: [number, number, number, number][];
  constelaciones: { id: string; nombre: string; etiqueta: Punto; lineas: Punto[][] }[];
  viaLactea: { nivel: number; poligonos: Punto[][] }[];
}
const catalogo = catalogoJSON as unknown as Catalogo;

// Colores del lienzo (el canvas no lee variables CSS): mismos tonos que los tokens de design.md.
export const SKY = "120, 200, 232"; // --sky
export const SAND = "231, 201, 156"; // --sand
export const TEXT = "245, 243, 238"; // --text
export const MUTED = "185, 195, 210"; // --text-muted

export interface Precalculo {
  estrellas: { alt: number; az: number; mag: number; color: string; fase: number; velocidad: number }[];
  lineas: { alt: number; az: number }[][];
  etiquetas: { nombre: string; alt: number; az: number }[];
  viaLactea: { nivel: number; poligonos: { alt: number; az: number }[][] }[];
}

/** Posiciones de todo el catálogo para un instante y lugar: se calcula una vez, no por cuadro. */
export function precalcular(location: SkyLocation, datetimeISO: string): Precalculo {
  const m = matrizHorizonte(location, datetimeISO);
  const h = ([ar, dec]: Punto) => aHorizonte(m, ar, dec);
  return {
    estrellas: catalogo.estrellas.map(([ar, dec, mag, bv], i) => {
      const [r, g, b] = colorEstrella(bv);
      return { ...aHorizonte(m, ar, dec), mag, color: `${r}, ${g}, ${b}`, fase: (i * 2.399) % (2 * Math.PI), velocidad: 0.6 + ((i * 7) % 13) / 10 };
    }),
    lineas: catalogo.constelaciones.flatMap((c) => c.lineas.map((linea) => linea.map(h))),
    etiquetas: catalogo.constelaciones.map((c) => ({ nombre: c.nombre, ...h(c.etiqueta) })),
    viaLactea: catalogo.viaLactea.map((n) => ({ nivel: n.nivel, poligonos: n.poligonos.map((p) => p.map(h)) })),
  };
}

export const prefiereMenosMovimiento = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Escena {
  pre: Precalculo;
  cam: Camara;
  /** Altura del Sol en grados: decide el color del cielo y cuánto se ven las estrellas. */
  solAlt: number;
  /** Y en píxeles del horizonte en el centro de la vista. */
  horizonteY: number;
  /** Tiempo del cuadro en ms (para el titileo). */
  t: number;
  /** Sin titileo (movimiento reducido). */
  quieto: boolean;
  fuente: string;
  /** Nombres de las constelaciones. */
  conNombres: boolean;
}

/**
 * Pinta el cielo calculado: color según el Sol, Vía Láctea, constelaciones y estrellas.
 * Devuelve la oscuridad (0 de día, 1 de noche cerrada) para lo que se dibuje encima.
 */
export function pintarFirmamento(ctx: CanvasRenderingContext2D, s: Escena): number {
  const { cam } = s;
  const { ancho, alto } = cam;
  const oscuro = oscuridad(s.solAlt);

  // 1. Cielo: color calculado según la altura del Sol.
  const { cenit, horizonte } = coloresCielo(s.solAlt);
  const fondo = ctx.createLinearGradient(0, 0, 0, Math.max(1, s.horizonteY));
  fondo.addColorStop(0, cenit);
  fondo.addColorStop(1, horizonte);
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, ancho, alto);

  if (oscuro <= 0) return oscuro;

  // 2. Vía Láctea: capas apenas visibles que se suman donde es más densa.
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

  // 3. Constelaciones: líneas y nombres tenues.
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

  if (s.conNombres) {
    ctx.font = `500 10px ${s.fuente}`;
    ctx.textAlign = "center";
    ctx.fillStyle = `rgba(${SKY}, ${0.5 * oscuro})`;
    for (const e of s.pre.etiquetas) {
      if (e.alt < 4) continue;
      const q = proyectar(cam, e.alt, e.az);
      if (q && q.x > -40 && q.x < ancho + 40 && q.y > 0 && q.y < s.horizonteY) ctx.fillText(e.nombre.toUpperCase(), q.x, q.y);
    }
  }

  // 4. Estrellas: posición, brillo y color reales; titileo suave (más cerca del horizonte).
  const tt = s.t / 1000;
  for (const e of s.pre.estrellas) {
    if (e.alt < 0) continue;
    const q = proyectar(cam, e.alt, e.az);
    if (!q || q.x < -4 || q.x > ancho + 4 || q.y < -4 || q.y > alto + 4) continue;
    const amplitud = s.quieto ? 0 : 0.08 + 0.22 * (1 - Math.min(1, e.alt / 45));
    const titileo = 1 - amplitud * (0.5 + 0.5 * Math.sin(tt * e.velocidad * 2.2 + e.fase));
    const brillo = Math.min(1, Math.max(0.18, 1.15 - e.mag * 0.17)) * oscuro * titileo;
    ctx.fillStyle = `rgba(${e.color}, ${brillo})`;
    ctx.beginPath();
    ctx.arc(q.x, q.y, radioEstrella(e.mag), 0, Math.PI * 2);
    ctx.fill();
  }

  return oscuro;
}
