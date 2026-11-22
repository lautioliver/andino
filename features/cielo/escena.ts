// Escena de Cielo: cielo con atmósfera. La luz sale de cosas reales (estrellas, Luna, Sol bajo el
// horizonte), nunca de la interfaz. Reusa la matemática de firmamento.ts y el precálculo de lienzo.ts.
// Propiedad: jehp23.
import { desenfocarAlfa } from "./desenfoque";
import { aPantalla, type Camara, coloresCielo, enCamara, oscuridad, proyectar, radioEstrella, recortarPoligono } from "./firmamento";
import { MUTED, type Precalculo, SAND, SKY, TEXT } from "./lienzo";

/** Color de la Vía Láctea (blanco azulado tenue). */
const VIA: readonly [number, number, number] = [214, 222, 240];
/** La Vía Láctea se dibuja a 1/K de resolución, se desenfoca y se amplía. */
const K = 8;

export interface Astro {
  id: string;
  name: string;
  kind: string;
  alt: number;
  az: number;
  visible: boolean;
}
export interface LunaInfo {
  /** Fracción iluminada, 0 a 1. */
  fraccion: number;
  /** Posición del Sol, para orientar el lado iluminado. */
  solAlt: number;
  solAz: number;
}

interface Escena {
  pre: Precalculo;
  cam: Camara;
  az: number;
  fov: number;
  solAlt: number;
  t: number;
  quieto: boolean;
  fuente: string;
  astros: Astro[];
  luna: LunaInfo;
  selectedId: string | null;
  /** Cambia cuando cambia la vista o el instante: decide si hay que rehacer la Vía Láctea. */
  claveVista: string;
}

// La Vía Láctea solo depende de la vista y el instante: se rehace cuando cambian, no en cada cuadro.
let lienzoVia: HTMLCanvasElement | null = null;
let claveVia = "";

function viaLactea(s: Escena, oscuro: number): HTMLCanvasElement | null {
  const { cam } = s;
  const w = Math.max(1, Math.ceil(cam.ancho / K));
  const h = Math.max(1, Math.ceil(cam.alto / K));
  const clave = `${s.claveVista}|${w}x${h}|${oscuro.toFixed(2)}`;
  if (lienzoVia && clave === claveVia) return lienzoVia;
  lienzoVia ??= document.createElement("canvas");
  if (lienzoVia.width !== w) lienzoVia.width = w;
  if (lienzoVia.height !== h) lienzoVia.height = h;
  const v = lienzoVia.getContext("2d", { willReadFrequently: true });
  if (!v) return null;
  v.clearRect(0, 0, w, h);
  for (const nivel of s.pre.viaLactea) {
    v.fillStyle = `rgba(${VIA.join(", ")}, ${0.085 * oscuro})`;
    v.beginPath();
    for (const poligono of nivel.poligonos) {
      const recortado = recortarPoligono(poligono.map((p) => enCamara(cam, p.alt, p.az)));
      if (recortado.length < 3) continue;
      recortado.forEach((p, i) => {
        const q = aPantalla(cam, p);
        if (!q) return;
        if (i === 0) v.moveTo(q.x / K, q.y / K);
        else v.lineTo(q.x / K, q.y / K);
      });
      v.closePath();
    }
    v.fill("evenodd");
  }
  // Los contornos del catálogo son escalones: el desenfoque los vuelve nube.
  const img = v.getImageData(0, 0, w, h);
  img.data.set(desenfocarAlfa(img.data, w, h, 2, VIA));
  v.putImageData(img, 0, 0);
  claveVia = clave;
  return lienzoVia;
}

function halo(ctx: CanvasRenderingContext2D, x: number, y: number, radio: number, color: string, alfa: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radio);
  g.addColorStop(0, `rgba(${color}, ${alfa})`);
  g.addColorStop(0.35, `rgba(${color}, ${alfa * 0.28})`);
  g.addColorStop(1, `rgba(${color}, 0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radio, 0, Math.PI * 2);
  ctx.fill();
}

/** Devuelve dónde quedó cada astro en pantalla, para poder tocarlo. */
export function pintarEscena(ctx: CanvasRenderingContext2D, s: Escena): { id: string; x: number; y: number }[] {
  const { cam } = s;
  const { ancho, alto } = cam;
  const oscuro = oscuridad(s.solAlt);
  const horizonteY = proyectar(cam, 0, s.az)?.y ?? alto;

  // 1. Cielo según la altura del Sol, con un resplandor bajo sobre el horizonte.
  const { cenit, horizonte } = coloresCielo(s.solAlt);
  const fondo = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizonteY));
  fondo.addColorStop(0, cenit);
  fondo.addColorStop(0.55, cenit);
  fondo.addColorStop(1, horizonte);
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, ancho, alto);

  if (oscuro > 0) {
    // 2. Vía Láctea difusa.
    const via = viaLactea(s, oscuro);
    if (via) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(via, 0, 0, via.width, via.height, 0, 0, via.width * K, via.height * K);
    }

    // 3. Constelaciones: trazo fino; los nombres, chicos y espaciados.
    ctx.strokeStyle = `rgba(${SKY}, ${0.13 * oscuro})`;
    ctx.lineWidth = 0.75;
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
    ctx.font = `500 9px ${s.fuente}`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "1.6px";
    ctx.textAlign = "center";
    ctx.fillStyle = `rgba(${SKY}, ${0.38 * oscuro})`;
    for (const e of s.pre.etiquetas) {
      if (e.alt < 6) continue;
      const q = proyectar(cam, e.alt, e.az);
      if (q && q.x > -40 && q.x < ancho + 40 && q.y > 0 && q.y < horizonteY) ctx.fillText(e.nombre.toUpperCase(), q.x, q.y);
    }
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

    // 4. Estrellas: las brillantes tienen halo, como se ven a ojo; el resto, puntos nítidos.
    const tt = s.t / 1000;
    for (const e of s.pre.estrellas) {
      if (e.alt < 0) continue;
      const q = proyectar(cam, e.alt, e.az);
      if (!q || q.x < -20 || q.x > ancho + 20 || q.y < -20 || q.y > alto + 20) continue;
      const amplitud = s.quieto ? 0 : 0.08 + 0.22 * (1 - Math.min(1, e.alt / 45));
      const titileo = 1 - amplitud * (0.5 + 0.5 * Math.sin(tt * e.velocidad * 2.2 + e.fase));
      // La atmósfera apaga las estrellas cerca del horizonte.
      const extincion = Math.min(1, 0.35 + e.alt / 22);
      const brillo = Math.min(1, Math.max(0.16, 1.15 - e.mag * 0.17)) * oscuro * titileo * extincion;
      const r = radioEstrella(e.mag);
      if (e.mag < 2.6) halo(ctx, q.x, q.y, r * (7 - e.mag * 1.4), e.color, 0.3 * brillo);
      ctx.fillStyle = `rgba(${e.color}, ${brillo})`;
      ctx.beginPath();
      ctx.arc(q.x, q.y, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 5. Astros destacados (antes del suelo: lo que está bajo el horizonte queda tapado).
  const tocables: { id: string; x: number; y: number }[] = [];
  const etiquetas: { x: number; y: number; texto: string; elegido: boolean }[] = [];
  for (const o of s.astros) {
    if (!o.visible) continue;
    const q = proyectar(cam, o.alt, o.az);
    if (!q || q.x < -30 || q.x > ancho + 30 || q.y < -30 || q.y > alto + 30) continue;
    tocables.push({ id: o.id, x: q.x, y: q.y });
    const elegido = o.id === s.selectedId;
    let radio = 3;
    if (o.kind === "satélite") {
      radio = 11;
      halo(ctx, q.x, q.y, radio * (3 + 5 * s.luna.fraccion), SAND, 0.2 + 0.25 * s.luna.fraccion * Math.max(0.3, oscuro));
      // Lado iluminado: apunta hacia el Sol.
      const haciaSol = proyectarHacia(cam, o, s.luna);
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(haciaSol);
      ctx.fillStyle = "rgb(38, 44, 60)";
      ctx.beginPath();
      ctx.arc(0, 0, radio, 0, Math.PI * 2);
      ctx.fill();
      const a = radio * Math.abs(2 * s.luna.fraccion - 1);
      ctx.fillStyle = "rgb(246, 238, 220)";
      ctx.beginPath();
      ctx.arc(0, 0, radio, -Math.PI / 2, Math.PI / 2);
      ctx.ellipse(0, 0, a, radio, 0, Math.PI / 2, (3 * Math.PI) / 2, s.luna.fraccion < 0.5);
      ctx.fill();
      ctx.restore();
    } else {
      const color = o.kind === "planeta" ? "255, 232, 196" : "226, 236, 255";
      const fuerza = Math.max(0.45, oscuro);
      halo(ctx, q.x, q.y, o.kind === "planeta" ? 20 : 16, color, 0.42 * fuerza);
      ctx.fillStyle = `rgba(${color}, ${Math.max(0.7, oscuro)})`;
      ctx.beginPath();
      ctx.arc(q.x, q.y, radio, 0, Math.PI * 2);
      ctx.fill();
    }
    if (elegido) {
      ctx.strokeStyle = `rgba(${TEXT}, 0.75)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(q.x, q.y, radio + 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    etiquetas.push({ x: q.x + radio + (elegido ? 14 : 8), y: q.y + 4, texto: o.name.replace(/ \(.*\)$/, ""), elegido });
  }

  // 6. Suelo: silueta oscura; de noche apenas se distingue del cielo, en el crepúsculo se recorta.
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
  suelo.addColorStop(0, "rgb(11, 14, 26)");
  suelo.addColorStop(1, "rgb(5, 7, 14)");
  ctx.fillStyle = suelo;
  ctx.fill();
  ctx.strokeStyle = `rgba(${SAND}, 0.22)`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Rumbos sobre el suelo.
  ctx.textAlign = "center";
  for (const [label, azc] of [["N", 0], ["NE", 45], ["E", 90], ["SE", 135], ["S", 180], ["SO", 225], ["O", 270], ["NO", 315]] as const) {
    const q = proyectar(cam, -3.5, azc);
    if (!q || q.x < 0 || q.x > ancho) continue;
    const principal = label.length === 1;
    ctx.font = `${principal ? 600 : 500} ${principal ? 12 : 10}px ${s.fuente}`;
    ctx.fillStyle = `rgba(${principal ? SAND : MUTED}, ${principal ? 0.9 : 0.45})`;
    ctx.fillText(label, q.x, q.y + 6);
  }

  // Nombres de los astros, por encima de todo.
  ctx.textAlign = "left";
  for (const e of etiquetas) {
    ctx.font = `${e.elegido ? 600 : 500} 12px ${s.fuente}`;
    ctx.fillStyle = `rgba(${TEXT}, ${e.elegido ? 1 : 0.82})`;
    ctx.fillText(e.texto, e.x, e.y);
  }
  return tocables;
}

/** Ángulo en pantalla desde la Luna hacia el Sol. */
function proyectarHacia(cam: Camara, luna: Astro, sol: LunaInfo): number {
  const R = Math.PI / 180;
  const v = (alt: number, az: number) => [Math.cos(alt * R) * Math.sin(az * R), Math.cos(alt * R) * Math.cos(az * R), Math.sin(alt * R)];
  const m = v(luna.alt, luna.az);
  const sv = v(sol.solAlt, sol.solAz);
  const p = m.map((c, i) => c * 0.97 + sv[i] * 0.03);
  const n = Math.hypot(p[0], p[1], p[2]);
  const alt = Math.asin(p[2] / n) / R;
  const az = Math.atan2(p[0], p[1]) / R;
  const a = proyectar(cam, luna.alt, luna.az);
  const b = proyectar(cam, alt, az);
  return a && b ? Math.atan2(b.y - a.y, b.x - a.x) : 0;
}
