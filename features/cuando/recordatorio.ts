// «Avisame esta noche»: el evento de calendario de una noche en un lugar, con el mismo motor que «Cuándo».
// El tren pasa de día y el cielo se ve de noche: el recordatorio suena cuando está por empezar.
// De acá salen los datos del evento; ics.ts y google.ts los escriben, cada uno en su formato.
import { queryCielo } from "@/features/cielo/cielo";
import type { AndinoPlace } from "@/shared/types";
import { ALARMA_MIN, faseDeLaLuna, hora, inicioDelCielo, nocheDeCielo, RECORDATORIO_MIN } from "./cuando";
import type { EventoDeCalendario } from "./evento";

type Lang = "es" | "en";

// En el orden de faseDeLaLuna: octavos del ciclo desde la Luna nueva.
const FASES: Record<Lang, string[]> = {
  es: ["Luna nueva", "Luna creciente", "Cuarto creciente", "Luna gibosa creciente", "Luna llena", "Luna gibosa menguante", "Cuarto menguante", "Luna menguante"],
  en: ["New Moon", "Waxing crescent Moon", "First quarter Moon", "Waxing gibbous Moon", "Full Moon", "Waning gibbous Moon", "Last quarter Moon", "Waning crescent Moon"],
};

/**
 * El evento de la noche de `fecha` en `place`: empieza con el cielo oscuro (o, si la Luna no deja franja
 * oscura, al cerrarse la noche, y lo dice). `origen` es el del pedido, para el enlace a /cielo.
 * null si esa noche no llega a oscurecer.
 */
export function recordatorio(place: AndinoPlace, fecha: string, lang: Lang, origen: string, ahoraMs: number): EventoDeCalendario | null {
  const noche = nocheDeCielo(place, fecha);
  const inicio = inicioDelCielo(noche);
  if (!inicio) return null;

  const en = lang === "en";
  // La fecha y la hora de ese momento en Argentina: el ISO ya viene con offset −03:00.
  const url = `${origen}/cielo${queryCielo(place.id, { fecha: inicio.slice(0, 10), hora: inicio.slice(11, 16) })}`;
  const luna = FASES[lang][faseDeLaLuna(fecha)];
  const iluminada = Math.round(noche.lunaIluminada * 100);

  let titulo: string;
  let cielo: string;
  if (noche.franja) {
    const [desde, hasta] = [hora(noche.franja.desde), hora(noche.franja.hasta)];
    titulo = en ? `Dark sky in ${place.name}` : `Cielo oscuro en ${place.name}`;
    cielo = en
      ? `Dark sky with no Moon from ${desde} to ${hasta} (Argentina time).`
      : `Cielo oscuro y sin Luna de ${desde} a ${hasta} (hora de Argentina).`;
  } else {
    const [desde, hasta] = [hora(noche.nocheCerrada!), hora(noche.alba!)];
    titulo = en ? `Moonlit night in ${place.name}` : `Noche con Luna en ${place.name}`;
    cielo = en
      ? `That night the Moon is up the whole time the sky is dark (${desde} to ${hasta}, Argentina time): good for seeing the moonlit mountains, not so much the Milky Way.`
      : `Esa noche la Luna está arriba todo el tiempo que el cielo está oscuro (de ${desde} a ${hasta}, hora de Argentina): buena para ver los cerros iluminados, no tanto la Vía Láctea.`;
  }

  const descripcion = [
    cielo,
    en ? `That night: ${luna}, ${iluminada}% lit.` : `Esa noche: ${luna}, iluminada al ${iluminada} %.`,
    en ? "Clouds can change: check the forecast before heading out." : "Las nubes pueden cambiar: mirá el pronóstico antes de salir.",
    en ? `The sky at that moment: ${url}` : `El cielo de ese momento: ${url}`,
  ].join("\n");

  const inicioMs = new Date(inicio).getTime();
  return {
    uid: `cielo-${fecha}-${place.id}@${new URL(origen).hostname}`,
    creado: ahoraMs,
    inicio: inicioMs,
    fin: inicioMs + RECORDATORIO_MIN * 60_000,
    alarmaMin: ALARMA_MIN,
    titulo,
    descripcion,
    lugar: `${place.name}, Jujuy, Argentina`,
    geo: { latitude: place.latitude, longitude: place.longitude },
    url,
  };
}
