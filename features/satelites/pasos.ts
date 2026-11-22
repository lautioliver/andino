// Pasos visibles de satélites Starlink sobre un lugar, calculados con los TLE públicos de CelesTrak (SGP4).
// Módulo aparte para poder enchufarlo al mapa de Cielo: la función pura es `calcularPasos`.
//
// Un satélite se ve a simple vista cuando el observador ya está a oscuras y el satélite, muy arriba,
// todavía refleja la luz del Sol. Eso pasa en las primeras horas después del crepúsculo.
import { Body, Observer, SearchAltitude, MakeTime } from "astronomy-engine";
import * as sat from "satellite.js";

export interface PasoVisible {
  nombre: string; // "STARLINK-1008" o "Tren de 24 Starlink"
  satelites: number; // 1 o cuántos pasan en fila
  intervaloSeg: number; // en una fila, cada cuánto pasa uno (0 si es uno solo)
  fin: string; // ISO del punto más alto del último de la fila
  inicio: string; // ISO
  maximo: string; // ISO del punto más alto
  alturaMaxDeg: number;
  desdeAzDeg: number;
  hastaAzDeg: number;
  recienLanzado: boolean; // de uno de los últimos lanzamientos: todavía en órbita baja y más brillante
}

export interface PasosDeLaNoche {
  desde: string; // ISO: fin del crepúsculo civil
  hasta: string; // ISO
  totalPasos: number; // pasos iluminados de más de 10°
  destacados: PasoVisible[];
  tleActualizado: string; // ISO, época más reciente del set
}

const ALTURA_MIN = (10 * Math.PI) / 180;
const PASO_MS = 30_000;
const VENTANA_MS = 4 * 3600_000;
const LANZAMIENTOS_RECIENTES = 3;
const MIN_FILA = 3;
const ALTURA_DESTACADO = 20;

interface Tle {
  nombre: string;
  rec: sat.SatRec;
  lanzamiento: string; // designador internacional sin la pieza: "19074"
}

export function leerTle(texto: string): Tle[] {
  const l = texto.split(/\r?\n/);
  const out: Tle[] = [];
  for (let i = 0; i + 2 < l.length; i += 3) {
    const [n, l1, l2] = [l[i]?.trim(), l[i + 1], l[i + 2]];
    if (!n || !l1?.startsWith("1 ") || !l2?.startsWith("2 ")) continue;
    try {
      const rec = sat.twoline2satrec(l1, l2);
      out.push({ nombre: n, rec, lanzamiento: l1.slice(9, 14).trim() });
    } catch {
      // TLE mal formado: se saltea
    }
  }
  return out;
}

/** Fin del crepúsculo civil (Sol a −6°) de la tarde de `fechaISO` local. */
function finDelCrepusculo(lat: number, lon: number, mediodiaISO: string): Date | null {
  const r = SearchAltitude(Body.Sun, new Observer(lat, lon, 0), -1, MakeTime(new Date(mediodiaISO)), 1, -6);
  return r?.date ?? null;
}

interface Crudo {
  tle: Tle;
  inicio: number;
  maximo: number;
  alt: number;
  desde: number;
  hasta: number;
}

export function calcularPasos(
  tles: Tle[],
  lugar: { latitude: number; longitude: number },
  mediodiaISO: string,
  maxDestacados = 6,
): PasosDeLaNoche | null {
  const desde = finDelCrepusculo(lugar.latitude, lugar.longitude, mediodiaISO);
  if (!desde) return null;
  const t0 = desde.getTime();
  const obs = { latitude: sat.degreesToRadians(lugar.latitude), longitude: sat.degreesToRadians(lugar.longitude), height: 2 };

  const abiertos = new Map<Tle, Crudo>();
  const pasos: Crudo[] = [];
  for (let t = t0; t <= t0 + VENTANA_MS; t += PASO_MS) {
    const d = new Date(t);
    const g = sat.gstime(d);
    const sol = sat.sunPos(sat.jday(d)).rsun;
    for (const tle of tles) {
      const p = sat.propagate(tle.rec, d);
      const pos = p?.position;
      if (!pos || typeof pos === "boolean") continue;
      const la = sat.ecfToLookAngles(obs, sat.eciToEcf(pos, g));
      const az = sat.radiansToDegrees(la.azimuth);
      const visible = la.elevation >= ALTURA_MIN && sat.shadowFraction(sol, pos) < 0.5;
      const a = abiertos.get(tle);
      if (visible) {
        if (!a) abiertos.set(tle, { tle, inicio: t, maximo: t, alt: la.elevation, desde: az, hasta: az });
        else {
          a.hasta = az;
          if (la.elevation > a.alt) Object.assign(a, { alt: la.elevation, maximo: t });
        }
      } else if (a) {
        pasos.push(a);
        abiertos.delete(tle);
      }
    }
  }
  pasos.push(...abiertos.values());

  // Lanzamientos recientes: los designadores internacionales más altos (año + número de lanzamiento).
  const recientes = new Set([...new Set(tles.map((t) => t.lanzamiento))].sort().slice(-LANZAMIENTOS_RECIENTES));

  // Satélites de un lanzamiento reciente viajan todavía en fila por la misma órbita: se agrupan si llegan
  // a su punto más alto con menos de 6 min entre uno y el siguiente. Menos de 90 s de media es un "tren".
  const porLanzamiento = new Map<string, Crudo[]>();
  for (const p of pasos) porLanzamiento.set(p.tle.lanzamiento, [...(porLanzamiento.get(p.tle.lanzamiento) ?? []), p]);
  const grupos: Crudo[][] = [];
  for (const [lanz, ps] of porLanzamiento) {
    ps.sort((a, b) => a.maximo - b.maximo);
    let actual: Crudo[] = [];
    for (const p of ps) {
      if (actual.length && (!recientes.has(lanz) || p.maximo - actual.at(-1)!.maximo > 6 * 60_000)) {
        grupos.push(actual);
        actual = [];
      }
      actual.push(p);
    }
    if (actual.length) grupos.push(actual);
  }

  const aPaso = (g: Crudo[]): PasoVisible => {
    const p = g.reduce((m, x) => (x.alt > m.alt ? x : m));
    const n = new Set(g.map((x) => x.tle)).size; // un satélite en penumbra puede cortarse en dos pasos
    const fila = n >= MIN_FILA;
    const intervalo = fila ? (g.at(-1)!.maximo - g[0].maximo) / (n - 1) : 0;
    return {
      nombre: !fila ? p.tle.nombre.replace(/\s*\[.*\]$/, "") : intervalo <= 90_000 ? `Tren de ${n} Starlink` : `${n} Starlink en fila`,
      satelites: fila ? n : 1,
      intervaloSeg: Math.round(intervalo / 1000),
      fin: new Date(Math.max(...g.map((x) => x.maximo))).toISOString(),
      inicio: new Date(Math.min(...g.map((x) => x.inicio))).toISOString(),
      maximo: new Date(p.maximo).toISOString(),
      alturaMaxDeg: Math.round(sat.radiansToDegrees(p.alt)),
      desdeAzDeg: Math.round(p.desde),
      hastaAzDeg: Math.round(p.hasta),
      recienLanzado: recientes.has(p.tle.lanzamiento),
    };
  };
  const candidatos = grupos.flatMap((g) => (new Set(g.map((x) => x.tle)).size >= MIN_FILA ? [aPaso(g)] : g.map((p) => aPaso([p]))));

  // Primero lo que más se ve: trenes y recién lanzados, después los pasos más altos.
  const peso = (p: PasoVisible) => (p.satelites > 1 ? 1000 + p.satelites : 0) + (p.recienLanzado ? 500 : 0) + p.alturaMaxDeg;
  const destacados = candidatos.filter((p) => p.alturaMaxDeg >= ALTURA_DESTACADO).sort((a, b) => peso(b) - peso(a)).slice(0, maxDestacados);
  destacados.sort((a, b) => a.maximo.localeCompare(b.maximo));

  const epoca = Math.max(...tles.map((t) => t.rec.jdsatepoch));
  return {
    desde: desde.toISOString(),
    hasta: new Date(t0 + VENTANA_MS).toISOString(),
    totalPasos: pasos.length,
    destacados,
    tleActualizado: new Date((epoca - 2440587.5) * 86400_000).toISOString(),
  };
}
