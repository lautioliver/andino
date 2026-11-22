// "Esta noche en…": el puente de la ficha de un lugar hacia su cielo.
// Las posiciones salen del motor de Cielo (features/cielo, de jehp23); acá solo se resumen
// para la ficha y el Inicio. Nada se inventa: si un objeto está bajo el horizonte, no se nombra.
import { Body, Illumination, MakeTime, MoonPhase, Observer, SearchRiseSet } from "astronomy-engine";
import type { AndinoPlace } from "@/shared/types";
import { buildDatetimeISO, describirAltura, fechaArgentina, HORA_EJEMPLO, queryCielo, rumbo } from "@/features/cielo/cielo";
import { computeSky } from "@/features/cielo/motor";

/** Hora de la noche que mostramos: la misma que Cielo usa de ejemplo. */
export const HORA_NOCHE = HORA_EJEMPLO;

export interface ObjetoVisible {
  id: string;
  name: string;
  donde: string; // "hacia el noreste, a media altura"
}

export interface Noche {
  fecha: string; // YYYY-MM-DD de la tarde en que empieza la noche
  hora: string;
  puestaDeSol: string | null; // "19:52"; null si no se pudo calcular
  luna: { fase: string; iluminada: number; visible: boolean };
  visibles: ObjetoVisible[]; // sin la Luna, ordenados de más alto a más bajo
  href: string; // /cielo con lugar, fecha y hora: abre exactamente este cielo
}

/** Hasta las 6 de la mañana seguimos en la noche que empezó la tarde anterior. */
export function fechaDeLaNoche(ahora: Date): string {
  return fechaArgentina(new Date(ahora.getTime() - 6 * 3600 * 1000));
}

const horaArgentina = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Jujuy",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function fase(grados: number): string {
  const nombres = [
    "Luna nueva",
    "Luna creciente",
    "Cuarto creciente",
    "Luna gibosa creciente",
    "Luna llena",
    "Luna gibosa menguante",
    "Cuarto menguante",
    "Luna menguante",
  ];
  return nombres[Math.round((((grados % 360) + 360) % 360) / 45) % 8];
}

export function nocheEn(place: AndinoPlace, fecha: string): Noche {
  const location = { latitude: place.latitude, longitude: place.longitude };
  const datetimeISO = buildDatetimeISO(fecha, HORA_NOCHE);
  const time = MakeTime(new Date(datetimeISO));

  const observer = new Observer(place.latitude, place.longitude, 0);
  const mediodia = MakeTime(new Date(buildDatetimeISO(fecha, "12:00")));
  const puesta = SearchRiseSet(Body.Sun, observer, -1, mediodia, 1);

  const sky = computeSky(location, datetimeISO);
  const luna = sky.find((o) => o.id === "luna");
  const visibles = sky
    .filter((o) => o.id !== "luna" && o.isAboveHorizon)
    .sort((a, b) => b.altitudeDeg - a.altitudeDeg)
    .map((o) => ({ id: o.id, name: o.name, donde: `hacia el ${rumbo(o.azimuthDeg)}, ${describirAltura(o.altitudeDeg)}` }));

  return {
    fecha,
    hora: HORA_NOCHE,
    puestaDeSol: puesta ? horaArgentina.format(puesta.date) : null,
    luna: {
      fase: fase(MoonPhase(time)),
      iluminada: Math.round(Illumination(Body.Moon, time).phase_fraction * 100),
      visible: luna?.isAboveHorizon ?? false,
    },
    visibles,
    href: `/cielo${queryCielo(place.id, { fecha, hora: HORA_NOCHE })}`,
  };
}
