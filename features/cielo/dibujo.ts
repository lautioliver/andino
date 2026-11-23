// El dibujo del cielo sobre un lienzo 2D: lo mismo para la pantalla de /cielo (SkyCanvas), para «Ver con la
// cámara» y para la postal que se comparte (postalLienzo.ts). Todo lo que se dibuja está calculado para el
// lugar y el instante; nada es decorativo.
import catalogoJSON from "@/data/cielo/catalogo.json";
import { nombreObjeto, type SkyObjectKind } from "@/data/astronomy";
import type { SkyObject } from "@/shared/types";
import { YACANA } from "./andino";
import {
  aHorizonte,
  type Camara,
  camara,
  colorEstrella,
  coloresCielo,
  matrizHorizonte,
  oscuridad,
  proyectar,
  radioEstrella,
  tiraLocal,
  trazarRegion,
} from "./firmamento";
import type { SkyLocation } from "./motor";

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

export const CARDINALES = [
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
export const cardinalEn = (label: string) => label.replace("O", "W");

export type Objeto = SkyObject & { kind: SkyObjectKind };

export interface Precalculo {
  estrellas: { alt: number; az: number; mag: number; color: string; fase: number; velocidad: number }[];
  lineas: { alt: number; az: number }[][];
  etiquetas: { id: string; nombre: string; alt: number; az: number }[];
  /** Por nivel, sus anillos: de cada vértice, el vector unitario este-norte-arriba (x, y, z seguidos). */
  viaLactea: { nivel: number; anillos: Float64Array[] }[];
  yacana: { ojos: { alt: number; az: number }[]; etiqueta: { alt: number; az: number } };
}

/** Posiciones de todo el catálogo para un instante y lugar: se calcula una vez, no por cuadro. */
export function precalcular(location: SkyLocation, datetimeISO: string): Precalculo {
  const m = matrizHorizonte(location, datetimeISO);
  const h = ([ar, dec]: readonly [number, number]) => aHorizonte(m, ar, dec);
  return {
    estrellas: catalogo.estrellas.map(([ar, dec, mag, bv], i) => {
      const [r, g, b] = colorEstrella(bv);
      return { ...aHorizonte(m, ar, dec), mag, color: `${r}, ${g}, ${b}`, fase: (i * 2.399) % (2 * Math.PI), velocidad: 0.6 + ((i * 7) % 13) / 10 };
    }),
    lineas: catalogo.constelaciones.flatMap((c) => c.lineas.map((linea) => linea.map(h))),
    etiquetas: catalogo.constelaciones.map((c) => ({ id: c.id, nombre: c.nombre, ...h(c.etiqueta) })),
    viaLactea: catalogo.viaLactea.map((n) => ({ nivel: n.nivel, anillos: n.poligonos.map((p) => tiraLocal(m, p)) })),
    yacana: { ojos: YACANA.ojos.map(h), etiqueta: h(YACANA.etiqueta) },
  };
}

/** Lo que se dibuja: el cielo ya calculado y hacia dónde se mira. */
export interface EscenaCielo {
  pre: Precalculo;
  /** Rumbo y altura del centro de la vista, campo visual horizontal e inclinación lateral, en grados. */
  az: number;
  alt: number;
  fov: number;
  giro: number;
  solAlt: number;
  objetos: Objeto[];
  selectedId: string | null;
  yacana: boolean;
  /** Apuntando con luz, las figuras se marcan tenues aunque no se vean. */
  apuntando: boolean;
  /** Con la imagen de la cámara detrás: lienzo transparente, sin suelo y con más peso en el trazo. */
  conCamara: boolean;
}

/** Dónde se dibuja: medidas en las unidades del lienzo (la transformación ya está puesta), reloj e idioma. */
export interface MarcoCielo {
  ancho: number;
  alto: number;
  /** Milisegundos del reloj de animación: mueve el titileo. */
  t: number;
  /** Sin titileo (movimiento reducido, o una imagen fija). */
  quieto: boolean;
  /** Familia tipográfica de los rótulos. */
  fuente: string;
  lang: "es" | "en";
}

/** Dibuja la escena y devuelve dónde quedaron los objetos tocables (Luna, planetas, estrellas destacadas). */
export function dibujarCielo(ctx: CanvasRenderingContext2D, s: EscenaCielo, { ancho, alto, t, quieto, fuente, lang }: MarcoCielo): { id: string; x: number; y: number }[] {
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
      if (trazarRegion(ctx, cam, nivel.anillos)) ctx.fill("evenodd");
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
      ctx.fillText(lang === "en" ? "eyes of the Yacana" : "ojos de la Yacana", (a.x + b.x) / 2, Math.min(a.y, b.y) - 14);
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
    ctx.fillText(lang === "en" ? cardinalEn(c.label) : c.label, q.x, q.y + 6);
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
    ctx.fillText(nombreObjeto(o.id, o.name, lang), q.x + radio + (elegido ? 11 : 6), q.y + 4);
  }
  sombra(false);
  return nuevos;
}
