// Base del lienzo del cielo: colores y precálculo del catálogo (estrellas, constelaciones, Vía Láctea).
// La usa la escena de Cielo (CieloEscena, escena.ts). Propiedad: jehp23.
import catalogoJSON from "@/data/cielo/catalogo.json";
import { aHorizonte, colorEstrella, matrizHorizonte } from "./firmamento";
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
