"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getPlace, places } from "@/data/places";
import { type Lang, useLang } from "@/shared/i18n/lang";
import type { PlaceId } from "@/shared/types";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { PhotoCredit } from "@/shared/ui/PhotoCredit";
import { SourceList } from "@/shared/ui/SourceList";
import { StatusMessage } from "@/shared/ui/StatusMessage";
import { EstaNoche } from "./EstaNoche";
import { fichaEn, fichas } from "./fichas";
import { Preguntas } from "./Preguntas";
import { reconocer, type Reconocimiento } from "./reconocer";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_MB = 10;

const textos = {
  es: {
    formato: "Ese archivo no es una imagen compatible. Probá con JPG, PNG o WebP.",
    pesada: (mb: number) => `La imagen pesa más de ${mb} MB. Probá con otra o sacá una nueva foto.`,
    tuFoto: "Tu foto",
    deDia: "De día",
    ejemplo: "Ejemplo precargado",
    tuFotoNoSeGuarda: "Tu foto · no se guarda",
    enTuFoto: (c: string) => `En tu foto · IA, confianza ${c}`,
    conocerMas: "Conocer más",
    comoLoSabemos: "Cómo lo sabemos",
    conIA: "Reconocimos el lugar con IA y lo confirmaste vos. La nota sobre tu foto la escribió la IA; la ficha sale de las fuentes de abajo y está en revisión editorial.",
    sinIA: "Elegiste el lugar vos. El texto sale de las fuentes de abajo y está en revisión editorial: no es una respuesta generada por IA.",
    noEsEste: "No es este lugar",
    otro: "Explorar otro paisaje",
    titulo: "¿Qué estás viendo?",
    bajada: "Sacá una foto por la ventana del Tren Solar o en una parada, o elegí una parada, y te contamos qué es el lugar y su historia.",
    noPudimos: "No pudimos usar esa imagen",
    vistaPrevia: "Vista previa de tu foto",
    cambiar: "Cambiar imagen",
    sacar: "Tomar una foto",
    subir: "Subir imagen",
    elegiLugar: "Elegí la parada",
    oElegi: "O elegí una parada",
    paradas: (n: number) => `${n} paradas · Tren Solar`,
    demo: "Para la demo · Ejemplos precargados",
    demoTexto: "Funcionan sin conexión y se marcan como ejemplo en el resultado.",
    mirando: "Mirando tu foto…",
    mirandoTexto: "Buscamos qué parada del recorrido es. Tarda unos segundos.",
    noReconocimos: "No pudimos reconocer el lugar",
    elegiAbajo: "Elegí abajo el lugar de tu foto para continuar.",
    fueraDelRecorrido: "No reconocimos una parada del recorrido",
    siSabes: "Si sabés dónde la sacaste, elegila abajo.",
    confianza: (c: string) => `IA · confianza ${c}`,
    es: (n: string) => `¿Es ${n}?`,
    si: (n: string) => `Sí, es ${n}`,
    siNo: "Si no es, elegí la parada abajo.",
  },
  en: {
    formato: "That file isn't a supported image. Try JPG, PNG or WebP.",
    pesada: (mb: number) => `The image is larger than ${mb} MB. Try another one or take a new photo.`,
    tuFoto: "Your photo",
    deDia: "By day",
    ejemplo: "Preloaded example",
    tuFotoNoSeGuarda: "Your photo · not stored",
    enTuFoto: (c: string) => `In your photo · AI, ${c} confidence`,
    conocerMas: "Learn more",
    comoLoSabemos: "How we know",
    conIA: "We recognized the place with AI and you confirmed it. The note about your photo was written by the AI; the card comes from the sources below and is under editorial review.",
    sinIA: "You chose the place yourself. The text comes from the sources below and is under editorial review: it is not an AI-generated answer.",
    noEsEste: "This isn't the place",
    otro: "Explore another landscape",
    titulo: "What are you looking at?",
    bajada: "Take a photo from the Tren Solar window or at a stop, or choose a stop, and we'll tell you what the place is and its history.",
    noPudimos: "We couldn't use that image",
    vistaPrevia: "Preview of your photo",
    cambiar: "Change image",
    sacar: "Take a photo",
    subir: "Upload image",
    elegiLugar: "Choose the stop",
    oElegi: "Or choose a stop",
    paradas: (n: number) => `${n} stops · Tren Solar`,
    demo: "For the demo · Preloaded examples",
    demoTexto: "They work offline and are marked as examples in the result.",
    mirando: "Looking at your photo…",
    mirandoTexto: "We're finding which stop on the route it is. It takes a few seconds.",
    noReconocimos: "We couldn't recognize the place",
    elegiAbajo: "Choose the place of your photo below to continue.",
    fueraDelRecorrido: "We didn't recognize a stop on the route",
    siSabes: "If you know where you took it, choose it below.",
    confianza: (c: string) => `AI · ${c} confidence`,
    es: (n: string) => `Is it ${n}?`,
    si: (n: string) => `Yes, it's ${n}`,
    siNo: "If it isn't, choose the stop below.",
  },
};

/** La confianza viene del servidor en español; en inglés se muestra traducida. */
const CONFIANZA_EN: Record<string, string> = { alta: "high", media: "medium", insuficiente: "insufficient" };
const confianza = (c: string, lang: Lang) => (lang === "en" ? (CONFIANZA_EN[c] ?? c) : c);

interface Photo {
  url: string;
  isDemo: boolean;
  isObjectUrl: boolean;
}

export function PachaFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const place = getPlace(params.get("placeId"));
  const lang = useLang();
  const t = textos[lang];
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reco, setReco] = useState<Reconocimiento | null>(null);
  const recoAbort = useRef<AbortController | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (photo?.isObjectUrl) URL.revokeObjectURL(photo.url);
    };
  }, [photo]);

  useEffect(() => () => recoAbort.current?.abort(), []);

  function analizar(file: File) {
    recoAbort.current?.abort();
    const ctrl = new AbortController();
    recoAbort.current = ctrl;
    setReco({ estado: "analizando" });
    reconocer(file, ctrl.signal, lang)
      .then((r) => {
        if (!ctrl.signal.aborted) setReco(r);
      })
      .catch(() => {});
  }

  function choosePlace(id: PlaceId) {
    router.push(`/explorar?placeId=${id}`, { scroll: true });
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError(t.formato);
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(t.pesada(MAX_MB));
      return;
    }
    setError(null);
    setPhoto({ url: URL.createObjectURL(file), isDemo: false, isObjectUrl: true });
    analizar(file);
    if (place) router.push("/explorar");
  }

  function pickDemo(id: PlaceId) {
    recoAbort.current?.abort();
    setReco(null);
    setError(null);
    setPhoto({ url: fichas[id].photo.src, isDemo: true, isObjectUrl: false });
    choosePlace(id);
  }

  function reset() {
    recoAbort.current?.abort();
    setReco(null);
    setPhoto(null);
    setError(null);
    router.push("/explorar");
  }

  const inputs = (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={onFile} tabIndex={-1} aria-hidden />
      <input ref={fileRef} type="file" accept={ACCEPTED.join(",")} className="sr-only" onChange={onFile} tabIndex={-1} aria-hidden />
    </>
  );

  // ---------- Resultado ----------
  if (place) {
    const ficha = fichaEn(fichas[place.id], lang);
    const shown = photo ?? { url: ficha.photo.src, isDemo: false, isObjectUrl: false };
    const isUserPhoto = photo && !photo.isDemo;
    const ia = isUserPhoto && reco?.estado === "listo" && reco.result.candidatePlaceId === place.id ? reco.result : null;
    return (
      <article>
        {inputs}
        <header className="bleed relative flex min-h-[min(72svh,620px)] items-end md:min-h-[min(78svh,760px)]">
          <Image
            src={shown.url}
            alt={isUserPhoto ? t.tuFoto : ficha.photo.alt}
            fill
            sizes="100vw"
            className="object-cover"
            unoptimized={shown.isObjectUrl}
            priority
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" />
          <div className="relative mx-auto w-full max-w-[1120px] px-4 pb-8 md:px-6 md:pb-12">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Badge tone="puna">{t.deDia}</Badge>
              {photo?.isDemo && <Badge>{t.ejemplo}</Badge>}
            </div>
            <h1 className="display mt-4 text-[clamp(3.25rem,12vw,7.5rem)]">{place.name}</h1>
            <p className="mt-3 text-text/85">{ficha.region}</p>
          </div>
        </header>

        <div className="grid gap-12 py-10 md:py-16 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-20">
          <div className="max-w-[65ch]">
            <p className="eyebrow text-text-muted">
              {isUserPhoto ? t.tuFotoNoSeGuarda : <PhotoCredit credit={ficha.photo.credit} url={ficha.photo.creditUrl} />}
            </p>
            {ia && (
              <p className="mt-6 border-l-2 border-puna pl-4 text-text/85">
                <span className="eyebrow block text-puna-ink">{t.enTuFoto(confianza(ia.confidenceLabel, lang))}</span>
                <span className="mt-2 block">{ia.summary}</span>
              </p>
            )}
            <p className="headline mt-6 text-[1.625rem] leading-[1.3] md:text-[2rem]">{ficha.summary}</p>
            <details className="group mt-8 rule pt-4">
              <summary className="link-arrow cursor-pointer list-none text-puna-ink [&::-webkit-details-marker]:hidden">
                {t.conocerMas}
              </summary>
              <div className="lead mt-4 space-y-5 text-text/85">
                {ficha.more.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            </details>

            <EstaNoche place={place} />

            <Preguntas key={place.id} place={place} sugerencias={ia?.followUpSuggestions} />
          </div>

          <aside className="space-y-8 lg:pt-14">
            <div className="rule pt-4">
              <p className="eyebrow text-text-muted">{t.comoLoSabemos}</p>
              <p className="mt-3 text-sm leading-6 text-text-muted">
                {ia ? t.conIA : t.sinIA}
              </p>
            </div>
            <SourceList sources={ficha.sources} />
            <div className="rule flex flex-col items-start pt-2">
              {isUserPhoto && (
                <Button variant="ghost" onClick={() => router.push("/explorar")}>
                  {t.noEsEste}
                </Button>
              )}
              <Button variant="ghost" onClick={reset}>
                {t.otro}
              </Button>
            </div>
          </aside>
        </div>
      </article>
    );
  }

  // ---------- Captura / confirmación ----------
  const hasUserPhoto = photo && !photo.isDemo;
  return (
    <section className="pt-8 md:pt-16">
      {inputs}
      <header className="max-w-[18ch]">
        <Badge tone="puna">{t.deDia}</Badge>
        <h1 className="display mt-5 text-[clamp(3rem,10vw,6.5rem)]">{t.titulo}</h1>
      </header>
      <p className="lead mt-6 max-w-[45ch] text-text-muted">
        {t.bajada}
      </p>

      {error && (
        <div className="mt-8">
          <StatusMessage tone="error" title={t.noPudimos}>
            {error}
          </StatusMessage>
        </div>
      )}

      {hasUserPhoto ? (
        <div className="mt-10 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end md:gap-12">
          <div className="relative aspect-[3/2] w-full overflow-hidden md:aspect-[4/3]">
            <Image src={photo.url} alt={t.vistaPrevia} fill className="object-cover" unoptimized />
          </div>
          <div className="order-first space-y-4 md:order-none">
            <Sugerencia reco={reco} onConfirm={choosePlace} lang={lang} />
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>
              {t.cambiar}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-2">
          <Button onClick={() => cameraRef.current?.click()}>{t.sacar}</Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            {t.subir}
          </Button>
        </div>
      )}

      <section aria-labelledby="destinos" className="mt-16 md:mt-24">
        <div className="rule flex items-baseline justify-between pt-4">
          <h2 id="destinos" className="headline text-3xl md:text-4xl">
            {hasUserPhoto ? t.elegiLugar : t.oElegi}
          </h2>
          <p className="eyebrow hidden text-text-muted sm:block">{t.paradas(places.length)}</p>
        </div>
        <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6">
          {places.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => choosePlace(p.id)} className="group block w-full text-left">
                <div className="relative aspect-[4/5] overflow-hidden rounded-card">
                  <Image
                    src={fichas[p.id].photo.src}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 50vw, 360px"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <span className="headline mt-3 block text-xl group-hover:text-puna-ink md:text-2xl">{p.name}</span>
                <span className="mt-1 block text-sm text-text-muted">{fichaEn(fichas[p.id], lang).region.split(" · ")[1]}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {!photo && (
        <section aria-labelledby="ejemplos" className="mt-16 md:mt-24">
          <div className="rule pt-4">
            <h2 id="ejemplos" className="eyebrow text-text-muted">
              {t.demo}
            </h2>
            <p className="mt-2 max-w-[55ch] text-sm text-text-muted">{t.demoTexto}</p>
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-1">
            {places.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => pickDemo(p.id)} className="link-arrow text-puna-ink">
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

function Sugerencia({ reco, onConfirm, lang }: { reco: Reconocimiento | null; onConfirm: (id: PlaceId) => void; lang: Lang }) {
  const t = textos[lang];
  if (!reco || reco.estado === "analizando") {
    return <StatusMessage title={t.mirando}>{t.mirandoTexto}</StatusMessage>;
  }
  if (reco.estado === "error") {
    return (
      <StatusMessage title={t.noReconocimos}>
        {reco.mensaje} {t.elegiAbajo}
      </StatusMessage>
    );
  }
  const { result } = reco;
  const candidato = getPlace(result.candidatePlaceId);
  if (!candidato) {
    return (
      <StatusMessage title={t.fueraDelRecorrido}>
        {result.summary} {t.siSabes}
      </StatusMessage>
    );
  }
  return (
    <div className="space-y-4">
      <div className="border-l-2 border-puna py-1 pl-4" role="status">
        <p className="eyebrow text-puna-ink">{t.confianza(confianza(result.confidenceLabel, lang))}</p>
        <p className="headline mt-2 text-3xl">{t.es(candidato.name)}</p>
        <p className="mt-2 text-sm leading-6 text-text-muted">{result.summary}</p>
      </div>
      <Button onClick={() => onConfirm(candidato.id)}>{t.si(candidato.name)}</Button>
      <p className="text-sm text-text-muted">{t.siNo}</p>
    </div>
  );
}
