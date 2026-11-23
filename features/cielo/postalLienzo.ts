// «Postal de tu noche»: el dibujo. Arma en el teléfono un PNG vertical con el cielo calculado (el mismo
// dibujo de la pantalla, dibujo.ts), la leyenda y la marca. No sube nada a ningún servidor ni pide archivos:
// el isotipo se traza desde postal.ts y la tipografía es la que la página ya cargó.
import { dibujarCielo, type EscenaCielo } from "./dibujo";
import { oscuridad } from "./firmamento";
import { ISOTIPO, LEMA, type Leyenda, notaPostal, POSTAL, SITIO, tamanioQueEntra } from "./postal";

// Los tokens de Abra (docs/design.md §2); el pie de la postal es un bloque .oscuro.
const NOCHE = "#0f172a";
const NUBE = "#fffaf7";
const PUNA = "#ff7a45";
const PUNA_TINTA = "#ff9a6e"; // --puna-ink (oscuro)
const TENUE = "#cbd5e1"; // --text-muted (oscuro)

const SISTEMA = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
/** Los pesos de Space Grotesk que usa la postal (app/layout.tsx carga 500, 600 y 700). */
const PESOS = [500, 700];
const ESPERA_FUENTE_MS = 3000;

/** La familia de los títulos tal como la declara next/font en <html>: «"Space Grotesk", "Space Grotesk Fallback"». */
function familiaDeclarada(): string {
  return getComputedStyle(document.documentElement).getPropertyValue("--font-space-grotesk").trim();
}

/**
 * Pide Space Grotesk y espera a que esté. Devuelve la familia para el lienzo o, si no hay o no llega a
 * tiempo (sin señal, por ejemplo), la del sistema: la postal se arma igual.
 */
export async function familiaDeTitulos(muestra = "ANDINO"): Promise<string> {
  const declarada = familiaDeclarada();
  if (!declarada || !("fonts" in document)) return SISTEMA;
  // Solo la primera familia: la segunda es el reemplazo local de next/font, que siempre «carga».
  const primera = declarada.split(",")[0].trim();
  try {
    const cargas = Promise.all(PESOS.map((peso) => document.fonts.load(`${peso} 48px ${primera}`, muestra)));
    const caras = await Promise.race([cargas, new Promise<null>((ok) => setTimeout(() => ok(null), ESPERA_FUENTE_MS))]);
    if (caras && caras.every((c) => c.length > 0)) return `${declarada}, ${SISTEMA}`;
  } catch {
    // Una fuente que no carga no es motivo para quedarse sin postal.
  }
  return SISTEMA;
}

/** Lo que la postal toma de la pantalla: el cielo calculado para ese lugar e instante y hacia dónde se mira. */
export type CieloDeLaPostal = Pick<EscenaCielo, "pre" | "az" | "alt" | "solAlt" | "objetos" | "yacana">;

export interface PedidoPostal {
  cielo: CieloDeLaPostal;
  leyenda: Leyenda;
  lang: "es" | "en";
  nombreArchivo: string;
}

interface Estilo {
  fuente: string;
  color: string;
  alinear?: CanvasTextAlign;
  /** Separación entre letras, en píxeles (solo donde el lienzo la admite). */
  espaciado?: number;
}

function escribir(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, { fuente, color, alinear = "left", espaciado = 0 }: Estilo) {
  ctx.font = fuente;
  ctx.fillStyle = color;
  ctx.textAlign = alinear;
  ctx.textBaseline = "alphabetic";
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${espaciado}px`;
  ctx.fillText(texto, x, y);
}

/** El isotipo sin su fondo (el pie ya es Noche), en un cuadrado de `lado` píxeles. */
function dibujarIsotipo(ctx: CanvasRenderingContext2D, x: number, y: number, lado: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(lado / ISOTIPO.caja, lado / ISOTIPO.caja);
  ctx.lineCap = "round";
  ctx.lineWidth = ISOTIPO.orbita.grosor;
  ctx.strokeStyle = ISOTIPO.orbita.color;
  ctx.stroke(new Path2D(ISOTIPO.orbita.d));
  ctx.fillStyle = ISOTIPO.estrella.color;
  ctx.fill(new Path2D(ISOTIPO.estrella.d));
  ctx.fillStyle = ISOTIPO.cumbres.color;
  ctx.fill(new Path2D(ISOTIPO.cumbres.d));
  ctx.restore();
}

function dibujarPostal(ctx: CanvasRenderingContext2D, { cielo: escena, leyenda, lang }: PedidoPostal, titulos: string, cuerpo: string) {
  const { ancho, alto, margen, cielo, escalaCielo: k, filete, pie } = POSTAL;
  const derecha = ancho - margen;

  ctx.fillStyle = NOCHE;
  ctx.fillRect(0, 0, ancho, alto);

  // El cielo: el dibujo de la pantalla, ampliado. Quieto (sin titileo) y sin el anillo del objeto elegido, que
  // es de la interfaz. Con luz, las figuras van marcadas tenues como al apuntar: si no, la postal de día
  // sería un cielo vacío.
  const marco = { ancho: cielo.ancho / k, alto: cielo.alto / k };
  ctx.save();
  ctx.beginPath();
  ctx.rect(cielo.x, cielo.y, cielo.ancho, cielo.alto);
  ctx.clip();
  ctx.setTransform(k, 0, 0, k, cielo.x, cielo.y);
  dibujarCielo(
    ctx,
    { ...escena, fov: POSTAL.campoCielo, giro: 0, selectedId: null, apuntando: true, conCamara: false },
    { ...marco, t: 0, quieto: true, fuente: cuerpo, lang },
  );
  ctx.restore();

  ctx.fillStyle = PUNA;
  ctx.fillRect(0, filete.y, ancho, filete.alto);
  ctx.fillStyle = NOCHE;
  ctx.fillRect(0, pie.y, ancho, pie.alto);

  // La leyenda: de dónde y de cuándo es este cielo.
  escribir(ctx, leyenda.rotulo.toUpperCase(), margen, POSTAL.rotulo.y, { fuente: `600 ${POSTAL.rotulo.tamanio}px ${cuerpo}`, color: PUNA_TINTA, espaciado: 3 });
  // Un nombre largo se achica hasta entrar.
  ctx.font = `700 ${POSTAL.lugar.tamanio}px ${titulos}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = "-2px";
  const tamanioLugar = tamanioQueEntra(ctx.measureText(leyenda.lugar).width, POSTAL.lugar.tamanio, derecha - margen, POSTAL.lugar.minimo);
  escribir(ctx, leyenda.lugar, margen, POSTAL.lugar.y, { fuente: `700 ${tamanioLugar}px ${titulos}`, color: NUBE, espaciado: -2 });
  escribir(ctx, leyenda.momento, margen, POSTAL.momento.y, { fuente: `500 ${POSTAL.momento.tamanio}px ${titulos}`, color: TENUE });

  // La marca: isotipo, nombre y sitio a la izquierda; el lema enfrente.
  const xMarca = margen + POSTAL.isotipo.lado + 16;
  dibujarIsotipo(ctx, margen, POSTAL.isotipo.y, POSTAL.isotipo.lado);
  escribir(ctx, "ANDINO", xMarca, POSTAL.marca.y, { fuente: `700 ${POSTAL.marca.tamanio}px ${titulos}`, color: NUBE, espaciado: -1 });
  escribir(ctx, SITIO, xMarca, POSTAL.sitio.y, { fuente: `600 ${POSTAL.sitio.tamanio}px ${cuerpo}`, color: NUBE });
  escribir(ctx, LEMA[lang], derecha, POSTAL.lema.y, { fuente: `500 ${POSTAL.lema.tamanio}px ${cuerpo}`, color: TENUE, alinear: "right" });
  escribir(ctx, notaPostal(oscuridad(escena.solAlt) === 0, lang), margen, POSTAL.nota.y, { fuente: `500 ${POSTAL.nota.tamanio}px ${cuerpo}`, color: TENUE });
}

/** Arma la postal y la devuelve como archivo PNG. */
export async function armarPostal(pedido: PedidoPostal): Promise<File> {
  const titulos = await familiaDeTitulos(`ANDINO ${pedido.leyenda.lugar} ${pedido.leyenda.momento}`);
  const cuerpo = getComputedStyle(document.body).fontFamily || SISTEMA;
  const lienzo = document.createElement("canvas");
  lienzo.width = POSTAL.ancho;
  lienzo.height = POSTAL.alto;
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("Este navegador no dibuja en un lienzo");
  try {
    dibujarPostal(ctx, pedido, titulos, cuerpo);
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/png"));
    if (!blob) throw new Error("El navegador no pudo codificar la imagen");
    return new File([blob], pedido.nombreArchivo, { type: "image/png" });
  } finally {
    // Suelta la memoria del lienzo ya: en el teléfono es escasa.
    lienzo.width = 0;
    lienzo.height = 0;
  }
}
