// Motor de cálculo de Cielo Andino (AND-07).
// Las posiciones salen de astronomy-engine 2.1.19 (efemérides VSOP87 y modelo lunar de ELP),
// nunca de la IA. Los textos educativos viven aparte, en data/astronomy.ts.
// Propiedad: jehp23.
import { Body, DefineStar, Equator, Horizon, MakeTime, Observer } from "astronomy-engine";
import type { SkyObject } from "@/shared/types";

export type SkyObjectId = "luna" | "jupiter" | "saturno" | "sirio" | "acrux";

interface CatalogEntry {
  id: SkyObjectId;
  name: string;
  body: Body;
}

// Estrellas: coordenadas J2000 del catálogo Hipparcos (ICRS); astronomy-engine aplica la
// precesión y la nutación a la fecha pedida.
DefineStar(Body.Star1, 6.752477, -16.716116, 8.6); // Sirio (α CMa), HIP 32349
DefineStar(Body.Star2, 12.443311, -63.099093, 321); // Acrux (α Cru), HIP 60718

export const SKY_CATALOG: readonly CatalogEntry[] = [
  { id: "luna", name: "Luna", body: Body.Moon },
  { id: "jupiter", name: "Júpiter", body: Body.Jupiter },
  { id: "saturno", name: "Saturno", body: Body.Saturn },
  { id: "sirio", name: "Sirio", body: Body.Star1 },
  { id: "acrux", name: "Acrux (Cruz del Sur)", body: Body.Star2 },
];

export interface SkyLocation {
  latitude: number;
  longitude: number;
  heightMeters?: number;
}

// Fecha y hora con zona explícita: "2026-11-22T22:00:00-03:00" o "...Z".
// Sin zona, el resultado dependería del huso horario de quien corre el código.
const ISO_CON_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

export function parseDatetimeISO(datetimeISO: string): Date {
  if (!ISO_CON_ZONA.test(datetimeISO)) {
    throw new RangeError(`Fecha sin zona horaria explícita: "${datetimeISO}"`);
  }
  const date = new Date(datetimeISO);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Fecha inválida: "${datetimeISO}"`);
  }
  return date;
}

const redondear = (valor: number, decimales = 2) => Math.round(valor * 10 ** decimales) / 10 ** decimales;

/**
 * Altitud y acimut de los objetos del catálogo vistos desde un lugar en un instante.
 * - Acimut en grados desde el norte geográfico, en sentido horario (E = 90°).
 * - Altitud aparente, con refracción atmosférica estándar.
 * - `isAboveHorizon` es geométrico: no considera relieve, nubes ni luz.
 */
export function computeSky(location: SkyLocation, datetimeISO: string): SkyObject[] {
  const time = MakeTime(parseDatetimeISO(datetimeISO));
  const observer = new Observer(location.latitude, location.longitude, location.heightMeters ?? 0);

  return SKY_CATALOG.map(({ id, name, body }) => {
    const eq = Equator(body, time, observer, true, true);
    // Refracción solo cerca o sobre el horizonte: astronomy-engine, bajo -1°, sigue sumando
    // ~0,5° como si el objeto estuviera en -1°, y eso aleja la altitud de la geométrica.
    const geometrica = Horizon(time, observer, eq.ra, eq.dec);
    const hor = geometrica.altitude < -1 ? geometrica : Horizon(time, observer, eq.ra, eq.dec, "normal");
    return {
      id,
      name,
      altitudeDeg: redondear(hor.altitude),
      azimuthDeg: redondear(hor.azimuth),
      isAboveHorizon: hor.altitude > 0,
    };
  });
}
