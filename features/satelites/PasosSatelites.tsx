"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { describirAltura, queryCielo, rumbo } from "@/features/cielo/cielo";
import { type Lang, useLang, useT } from "@/shared/i18n/lang";
import type { PlaceId } from "@/shared/types";
import { LinkButton } from "@/shared/ui/Button";
import { StatusMessage } from "@/shared/ui/StatusMessage";
import type { PasosDeLaNoche, PasoVisible } from "./pasos";
import { type Candidato, cuentaRegresiva, type Fuente, leerPasos, momentoLocal, proximoPaso } from "./proximo";

const hora = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Jujuy",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const h = (iso: string) => hora.format(new Date(iso));
const dia = (lang: Lang) => new Intl.DateTimeFormat(lang === "en" ? "en-US" : "es-AR", { timeZone: "America/Argentina/Jujuy", day: "numeric", month: "long" });

/** Debajo de esta altura un paso se ve, pero un cerro cercano puede taparlo. */
const BAJO_DEG = 20;

type Motivo = "conexion" | "orbitas" | "otro";
type Estado = { estado: "cargando" } | { estado: "listo"; pasos: PasosDeLaNoche } | { estado: "error"; motivo: Motivo };
const CARGANDO: Estado = { estado: "cargando" };

const textos = {
  es: {
    estacion: "Estación Espacial Internacional",
    starlink: "Satélites Starlink",
    satelites: "Satélites",
    tren: (n: number) => `Tren de ${n} Starlink`,
    enFila: (n: number) => `${n} Starlink en fila`,
    casiJuntos: "casi juntos",
    unoCada: (min: number) => `uno cada ~${min} min`,
    reciente: " · lanzamiento reciente, suelen verse más",
    bajo: " · bajo: un cerro cercano puede taparlo",
    calculando: "Calculando los pasos de esta noche…",
    proximo: "Próximo paso visible",
    faltan: "Faltan",
    ahora: "Está pasando ahora",
    cuando: "Hora",
    mirar: "Hacia dónde mirar",
    alturaMaxima: "Altura máxima",
    lapso: (desde: string, hasta: string) => (desde === hasta ? desde : `de ${desde} a ${hasta}`),
    rumbos: (uno: boolean, desde: string, hasta: string) =>
      desde === hasta ? `por el ${desde}` : `${uno ? "sale" : "salen"} del ${desde} y ${uno ? "va" : "van"} hacia el ${hasta}`,
    altura: (grados: number, como: string, cuando: string) => `${grados}°, ${como}, a las ${cuando}`,
    aproximados: "Horarios aproximados.",
    sinEstacion: "Sin contar la Estación Espacial Internacional: su órbita no está disponible ahora.",
    sinStarlink: "Sin contar Starlink: sus órbitas no están disponibles ahora.",
    verCielo: "Ver el cielo a esa hora",
    verCieloAhora: "Ver el cielo ahora",
    yaPasaron: "Los pasos visibles de esta noche ya pasaron.",
    ninguno: (desde: string, hasta: string) => `Esta noche no hay pasos visibles entre las ${desde} y las ${hasta}.`,
    ningunoEstacion: "Esta noche no hay pasos visibles de la Estación Espacial Internacional.",
    ningunoStarlink: "Esta noche no hay pasos altos de Starlink al terminar el crepúsculo.",
    notaEstacion: (desde: string, hasta: string, actualizada: string) =>
      `Buscamos pasos sobre 10° entre las ${desde}, cuando termina el crepúsculo, y las ${hasta}; los horarios son aproximados. Órbita pública de CelesTrak, actualizada el ${actualizada}.`,
    comoSeVe: "Se ve como un punto brillante que avanza sin parpadear. ",
    notaStarlink: (desde: string, hasta: string, total: number, actualizadas: string) =>
      `Desde las ${desde}, cuando termina el crepúsculo, hay ${total} pasos de Starlink sobre 10° hasta las ${hasta}. Se ven como puntos que avanzan sin parpadear; la mayoría son tenues y hace falta un cielo oscuro y sin Luna brillante. Órbitas públicas de CelesTrak, actualizadas el ${actualizadas}.`,
    cruza: (uno: boolean, desde: string, hasta: string, grados: number) =>
      `${uno ? "Cruza" : "Cruzan"} ${desde === hasta ? `por el ${desde}` : `del ${desde} al ${hasta}`}, hasta ${grados}° de altura`,
    falloTitulo: {
      estacion: "No pudimos calcular los pasos de la Estación Espacial",
      starlink: "No pudimos calcular los pasos de Starlink",
      todo: "No pudimos calcular los pasos de satélites de esta noche",
    },
    fallo: {
      conexion: "No hay conexión. Probá de nuevo cuando tengas señal; el resto de la página sigue funcionando.",
      orbitas: "Las órbitas públicas de CelesTrak no están disponibles ahora. Probá de nuevo más tarde; el resto de la página sigue funcionando.",
      otro: "No están disponibles ahora. Probá de nuevo más tarde; el resto de la página sigue funcionando.",
    },
  },
  en: {
    estacion: "International Space Station",
    starlink: "Starlink satellites",
    satelites: "Satellites",
    tren: (n: number) => `Train of ${n} Starlink`,
    enFila: (n: number) => `${n} Starlink in a row`,
    casiJuntos: "almost together",
    unoCada: (min: number) => `one every ~${min} min`,
    reciente: " · recent launch, usually easier to see",
    bajo: " · low: a nearby mountain may hide it",
    calculando: "Calculating tonight’s passes…",
    proximo: "Next visible pass",
    faltan: "Starts in",
    ahora: "Passing right now",
    cuando: "Time",
    mirar: "Where to look",
    alturaMaxima: "Maximum height",
    lapso: (desde: string, hasta: string) => (desde === hasta ? desde : `${desde} to ${hasta}`),
    rumbos: (uno: boolean, desde: string, hasta: string) =>
      desde === hasta ? `in the ${desde}` : `${uno ? "rises" : "rise"} in the ${desde} and ${uno ? "heads" : "head"} ${hasta}`,
    altura: (grados: number, como: string, cuando: string) => `${grados}°, ${como}, at ${cuando}`,
    aproximados: "Times are approximate.",
    sinEstacion: "Not counting the International Space Station: its orbit isn’t available right now.",
    sinStarlink: "Not counting Starlink: its orbits aren’t available right now.",
    verCielo: "See the sky at that time",
    verCieloAhora: "See the sky now",
    yaPasaron: "Tonight’s visible passes are already over.",
    ninguno: (desde: string, hasta: string) => `No visible passes tonight between ${desde} and ${hasta}.`,
    ningunoEstacion: "No visible passes of the International Space Station tonight.",
    ningunoStarlink: "No high Starlink passes tonight after twilight.",
    notaEstacion: (desde: string, hasta: string, actualizada: string) =>
      `We look for passes above 10° between ${desde}, when twilight ends, and ${hasta}; times are approximate. Public orbit from CelesTrak, updated on ${actualizada}.`,
    comoSeVe: "It looks like a bright point moving steadily without blinking. ",
    notaStarlink: (desde: string, hasta: string, total: number, actualizadas: string) =>
      `From ${desde}, when twilight ends, there are ${total} Starlink passes above 10° until ${hasta}. They look like points moving without blinking; most are faint and need a dark sky without a bright Moon. Public orbits from CelesTrak, updated on ${actualizadas}.`,
    cruza: (uno: boolean, desde: string, hasta: string, grados: number) =>
      `${uno ? "Crosses" : "They cross"} ${desde === hasta ? `through the ${desde}` : `from ${desde} to ${hasta}`}, up to ${grados}° high`,
    falloTitulo: {
      estacion: "We couldn’t calculate the Space Station passes",
      starlink: "We couldn’t calculate the Starlink passes",
      todo: "We couldn’t calculate tonight’s satellite passes",
    },
    fallo: {
      conexion: "There’s no connection. Try again when you have signal; the rest of the page still works.",
      orbitas: "CelesTrak’s public orbits aren’t available right now. Try again later; the rest of the page still works.",
      otro: "They aren’t available right now. Try again later; the rest of the page still works.",
    },
  },
};
type Textos = (typeof textos)["es"];

function nombre(fuente: Fuente, p: PasoVisible, t: Textos): string {
  if (fuente === "estacion") return t.estacion;
  if (p.satelites === 1) return p.nombre;
  return p.intervaloSeg <= 90 ? t.tren(p.satelites) : t.enFila(p.satelites);
}

/** El nombre y, si son varios en fila, cada cuánto pasa uno. */
function nombreCompleto(fuente: Fuente, p: PasoVisible, t: Textos): string {
  if (p.satelites === 1) return nombre(fuente, p, t);
  const cada = p.intervaloSeg <= 90 ? t.casiJuntos : t.unoCada(Math.max(1, Math.round(p.intervaloSeg / 60)));
  return `${nombre(fuente, p, t)}, ${cada}`;
}

/** Un satélite solo se anuncia por la hora de su punto más alto; una fila, del primero que aparece al último que se pierde. */
const horaDeLista = (p: PasoVisible) => (p.satelites === 1 ? p.maximo : p.inicio);
/** «20:41–20:46», o una sola hora si empieza y termina en el mismo minuto. */
const lapso = (p: PasoVisible) => [...new Set([h(p.inicio), h(p.termina)])].join("–");
const tituloStarlink = (p: PasoVisible, t: Textos) => `${p.satelites === 1 ? h(p.maximo) : lapso(p)} · ${nombreCompleto("starlink", p, t)}`;
const enOrden = (pasos: PasoVisible[]) => [...pasos].sort((a, b) => horaDeLista(a).localeCompare(horaDeLista(b)));

const cruza = (p: PasoVisible, t: Textos, lang: Lang) => t.cruza(p.satelites === 1, rumbo(p.desdeAzDeg, lang), rumbo(p.hastaAzDeg, lang), p.alturaMaxDeg);

/** Los pasos de una fuente para el lugar y la noche. Mientras llega la respuesta de otra noche u otro lugar, «cargando». */
function usePasos(fuente: Fuente, placeId: PlaceId, fecha: string): Estado {
  const clave = `${fuente}|${placeId}|${fecha}`;
  const [s, setS] = useState<{ clave: string; estado: Estado } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const q = new URLSearchParams({ placeId, fecha });
    fetch(`/api/satelites/${fuente}?${q}`, { signal: ctrl.signal })
      .then(async (r) => {
        const pasos = r.ok ? leerPasos(await r.json().catch(() => null)) : null;
        setS({ clave, estado: pasos ? { estado: "listo", pasos } : { estado: "error", motivo: r.status === 502 ? "orbitas" : "otro" } });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setS({ clave, estado: { estado: "error", motivo: "conexion" } });
      });
    return () => ctrl.abort();
  }, [clave, fuente, placeId, fecha]);

  return s?.clave === clave ? s.estado : CARGANDO;
}

// El reloj del teléfono, segundo a segundo. En el servidor no hay «ahora».
function cadaSegundo(avisar: () => void) {
  const id = window.setInterval(avisar, 1000);
  document.addEventListener("visibilitychange", avisar);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", avisar);
  };
}
const segundoActual = () => Math.floor(Date.now() / 1000);
const sinReloj = () => null;

/** «Próximo paso visible»: cuenta regresiva hasta el paso que viene, de la Estación o de Starlink. */
function ProximoPaso({ placeId, estacion, starlink }: { placeId: PlaceId; estacion: Estado; starlink: Estado }) {
  const lang = useLang();
  const t = useT(textos);
  const segundo = useSyncExternalStore(cadaSegundo, segundoActual, sinReloj);

  const caja = "card mt-4 p-5 md:p-6";
  const titulo = <p className="eyebrow text-text-muted">{t.proximo}</p>;
  if (segundo === null || estacion.estado === "cargando" || starlink.estado === "cargando") {
    return (
      <div className={caja}>
        {titulo}
        <p className="mt-3 text-sm text-text-muted">{t.calculando}</p>
      </div>
    );
  }

  const candidatos: Candidato[] = [
    ...(estacion.estado === "listo" ? estacion.pasos.destacados.map((paso) => ({ fuente: "estacion" as const, paso })) : []),
    ...(starlink.estado === "listo" ? starlink.pasos.destacados.map((paso) => ({ fuente: "starlink" as const, paso })) : []),
  ];
  const proximo = proximoPaso(candidatos, segundo * 1000);
  const ventana = estacion.estado === "listo" ? estacion.pasos : starlink.estado === "listo" ? starlink.pasos : null;
  const falta = estacion.estado === "error" ? t.sinEstacion : starlink.estado === "error" ? t.sinStarlink : null;
  const aclaracion = falta ? <p className="mt-3 text-sm leading-6 text-text-muted">{falta}</p> : null;

  if (!ventana) return null; // las dos fuentes fallaron: el aviso lo muestra la sección
  if (proximo.estado === "ninguno" || proximo.estado === "pasaron") {
    return (
      <div className={caja}>
        {titulo}
        <p className="lead mt-3 text-text/85">{proximo.estado === "pasaron" ? t.yaPasaron : t.ninguno(h(ventana.desde), h(ventana.hasta))}</p>
        {aclaracion}
      </div>
    );
  }

  const { paso, fuente } = proximo;
  // Por venir: /cielo en el momento en que aparece. En curso: /cielo sin fecha ni hora, que es el de ahora.
  const porVenir = proximo.estado === "por-venir";
  const momento = porVenir ? momentoLocal(paso.inicio) : null;
  return (
    <div className={caja}>
      {titulo}
      <p className="headline mt-3 text-2xl">{nombreCompleto(fuente, paso, t)}</p>
      {porVenir ? (
        <p className="mt-4">
          <span className="block text-sm text-text-muted">{t.faltan}</span>
          {/* role="timer" no se anuncia solo: cambia cada segundo. */}
          <span role="timer" className="headline block text-4xl tabular-nums text-violeta-ink">
            {cuentaRegresiva(proximo.faltanMs)}
          </span>
        </p>
      ) : (
        <p className="headline mt-4 text-3xl text-violeta-ink">{t.ahora}</p>
      )}
      <dl className="mt-5">
        {[
          [t.cuando, t.lapso(h(paso.inicio), h(paso.termina))],
          [t.mirar, t.rumbos(paso.satelites === 1, rumbo(paso.desdeAzDeg, lang), rumbo(paso.hastaAzDeg, lang))],
          [t.alturaMaxima, t.altura(paso.alturaMaxDeg, describirAltura(paso.alturaMaxDeg, lang), h(paso.maximo))],
        ].map(([clave, valor]) => (
          <div key={clave} className="rule flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
            <dt className="text-sm text-text-muted">{clave}</dt>
            <dd className="font-medium sm:text-right">{valor}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-1 text-sm leading-6 text-text-muted">{t.aproximados}</p>
      {aclaracion}
      {momento || !porVenir ? (
        <LinkButton variant="ghost" href={`/cielo${queryCielo(placeId, momento)}`} className="mt-2">
          {porVenir ? t.verCielo : t.verCieloAhora}
        </LinkButton>
      ) : null}
    </div>
  );
}

function Aviso({ de, motivo }: { de: Fuente | "todo"; motivo: Motivo }) {
  const t = useT(textos);
  return (
    <div className="mt-3">
      <StatusMessage title={t.falloTitulo[de]}>{t.fallo[motivo]}</StatusMessage>
    </div>
  );
}

/**
 * Satélites de esta noche, para la sección «Esta noche» de la ficha: el próximo paso visible con su
 * cuenta regresiva, los pasos de la Estación Espacial Internacional y los de Starlink.
 */
export function PasosSatelites({ placeId, fecha }: { placeId: PlaceId; fecha: string }) {
  const lang = useLang();
  const t = useT(textos);
  const estacion = usePasos("estacion", placeId, fecha);
  const starlink = usePasos("starlink", placeId, fecha);

  if (estacion.estado === "error" && starlink.estado === "error") {
    return (
      <div className="mt-10">
        <p className="eyebrow text-violeta-ink">{t.satelites}</p>
        <Aviso de="todo" motivo={estacion.motivo === starlink.motivo ? estacion.motivo : "otro"} />
      </div>
    );
  }

  return (
    <div className="mt-10">
      <p className="eyebrow text-violeta-ink">{t.satelites}</p>
      <ProximoPaso placeId={placeId} estacion={estacion} starlink={starlink} />

      <p className="eyebrow mt-10 text-violeta-ink">{t.estacion}</p>
      {estacion.estado === "cargando" ? (
        <p className="mt-3 text-sm text-text-muted">{t.calculando}</p>
      ) : estacion.estado === "error" ? (
        <Aviso de="estacion" motivo={estacion.motivo} />
      ) : (
        <>
          {estacion.pasos.destacados.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">{t.ningunoEstacion}</p>
          ) : (
            <ul className="mt-2">
              {estacion.pasos.destacados.map((p) => (
                <li key={p.inicio} className="rule flex flex-col gap-1 py-4">
                  <span className="headline text-xl">{lapso(p)}</span>
                  <span className="text-sm text-text-muted">
                    {cruza(p, t, lang)}
                    {p.alturaMaxDeg < BAJO_DEG ? t.bajo : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-sm leading-6 text-text-muted">
            {estacion.pasos.destacados.length > 0 ? t.comoSeVe : ""}
            {t.notaEstacion(h(estacion.pasos.desde), h(estacion.pasos.hasta), dia(lang).format(new Date(estacion.pasos.tleActualizado)))}
          </p>
        </>
      )}

      <p className="eyebrow mt-10 text-violeta-ink">{t.starlink}</p>
      {starlink.estado === "cargando" ? (
        <p className="mt-3 text-sm text-text-muted">{t.calculando}</p>
      ) : starlink.estado === "error" ? (
        <Aviso de="starlink" motivo={starlink.motivo} />
      ) : starlink.pasos.destacados.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">{t.ningunoStarlink}</p>
      ) : (
        <>
          <ul className="mt-2">
            {enOrden(starlink.pasos.destacados).map((p) => (
              <li key={`${p.nombre}-${p.maximo}`} className="rule flex flex-col gap-1 py-4">
                <span className="headline text-xl">{tituloStarlink(p, t)}</span>
                <span className="text-sm text-text-muted">
                  {cruza(p, t, lang)}
                  {p.recienLanzado ? t.reciente : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-6 text-text-muted">
            {t.notaStarlink(h(starlink.pasos.desde), h(starlink.pasos.hasta), starlink.pasos.totalPasos, dia(lang).format(new Date(starlink.pasos.tleActualizado)))}
          </p>
        </>
      )}
    </div>
  );
}
