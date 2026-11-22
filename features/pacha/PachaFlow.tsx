"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getPlace, places } from "@/data/places";
import type { PlaceId } from "@/shared/types";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { PhotoCredit } from "@/shared/ui/PhotoCredit";
import { SourceList } from "@/shared/ui/SourceList";
import { StatusMessage } from "@/shared/ui/StatusMessage";
import { EstaNoche } from "./EstaNoche";
import { fichas } from "./fichas";
import { Preguntas } from "./Preguntas";
import { reconocer, type Reconocimiento } from "./reconocer";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_MB = 10;

interface Photo {
  url: string;
  isDemo: boolean;
  isObjectUrl: boolean;
}

export function PachaFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const place = getPlace(params.get("placeId"));
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
    reconocer(file, ctrl.signal)
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
      setError("Ese archivo no es una imagen compatible. Probá con JPG, PNG o WebP.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`La imagen pesa más de ${MAX_MB} MB. Probá con otra o sacá una nueva foto.`);
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
    const ficha = fichas[place.id];
    const shown = photo ?? { url: ficha.photo.src, isDemo: false, isObjectUrl: false };
    const isUserPhoto = photo && !photo.isDemo;
    const ia = isUserPhoto && reco?.estado === "listo" && reco.result.candidatePlaceId === place.id ? reco.result : null;
    return (
      <article>
        {inputs}
        <header className="bleed relative flex min-h-[min(72svh,620px)] items-end md:min-h-[min(78svh,760px)]">
          <Image
            src={shown.url}
            alt={isUserPhoto ? "Tu foto" : ficha.photo.alt}
            fill
            sizes="100vw"
            className="object-cover"
            unoptimized={shown.isObjectUrl}
            priority
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" />
          <div className="relative mx-auto w-full max-w-[1120px] px-4 pb-8 md:px-6 md:pb-12">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Badge tone="earth">De día</Badge>
              {photo?.isDemo && <Badge>Ejemplo precargado</Badge>}
            </div>
            <h1 className="display mt-4 text-[clamp(3.25rem,12vw,7.5rem)]">{place.name}</h1>
            <p className="mt-3 text-text/85">{ficha.region}</p>
          </div>
        </header>

        <div className="grid gap-12 py-10 md:py-16 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-20">
          <div className="max-w-[65ch]">
            <p className="eyebrow text-text-muted">
              {isUserPhoto ? "Tu foto · no se guarda" : <PhotoCredit credit={ficha.photo.credit} url={ficha.photo.creditUrl} />}
            </p>
            {ia && (
              <p className="mt-6 border-l-2 border-earth pl-4 text-text/85">
                <span className="eyebrow block text-earth">En tu foto · IA, confianza {ia.confidenceLabel}</span>
                <span className="mt-2 block">{ia.summary}</span>
              </p>
            )}
            <p className="headline mt-6 text-[1.625rem] leading-[1.3] md:text-[2rem]">{ficha.summary}</p>
            <details className="group mt-8 rule pt-4">
              <summary className="link-arrow cursor-pointer list-none text-earth [&::-webkit-details-marker]:hidden">
                Conocer más
              </summary>
              <div className="lead mt-4 space-y-5 text-text/85">
                {ficha.more.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            </details>

            <Preguntas key={place.id} place={place} sugerencias={ia?.followUpSuggestions} />

            <EstaNoche place={place} />

            <Button variant="ghost" className="mt-6" onClick={() => router.push("/explorar")}>
              No es este lugar
            </Button>
          </div>

          <aside className="space-y-8 lg:pt-14">
            <div className="rule pt-4">
              <p className="eyebrow text-text-muted">Cómo lo sabemos</p>
              <p className="mt-3 text-sm leading-6 text-text-muted">
                {ia
                  ? "Reconocimos el lugar con IA y lo confirmaste vos. La nota sobre tu foto la escribió la IA; la ficha sale de las fuentes de abajo y está en revisión editorial."
                  : "Elegiste el lugar vos. El texto sale de las fuentes de abajo y está en revisión editorial: no es una respuesta generada por IA."}
              </p>
            </div>
            <SourceList sources={ficha.sources} />
            <Button variant="ghost" onClick={reset}>
              Explorar otro paisaje
            </Button>
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
        <Badge tone="earth">De día</Badge>
        <h1 className="display mt-5 text-[clamp(3rem,10vw,6.5rem)]">¿Qué estás viendo?</h1>
      </header>
      <p className="lead mt-6 max-w-[45ch] text-text-muted">
        Sacá una foto del paisaje o elegí un destino para conocer su historia, con fuentes.
      </p>

      {error && (
        <div className="mt-8">
          <StatusMessage tone="error" title="No pudimos usar esa imagen">
            {error}
          </StatusMessage>
        </div>
      )}

      {hasUserPhoto ? (
        <div className="mt-10 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end md:gap-12">
          <div className="relative aspect-[3/2] w-full overflow-hidden md:aspect-[4/3]">
            <Image src={photo.url} alt="Vista previa de tu foto" fill className="object-cover" unoptimized />
          </div>
          <div className="order-first space-y-4 md:order-none">
            <Sugerencia reco={reco} onConfirm={choosePlace} />
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>
              Cambiar imagen
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-2">
          <Button onClick={() => cameraRef.current?.click()}>Tomar una foto</Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            Subir imagen
          </Button>
        </div>
      )}

      <section aria-labelledby="destinos" className="mt-16 md:mt-24">
        <div className="rule flex items-baseline justify-between pt-4">
          <h2 id="destinos" className="headline text-3xl md:text-4xl">
            {hasUserPhoto ? "Elegí el lugar" : "O elegí un destino"}
          </h2>
          <p className="eyebrow hidden text-text-muted sm:block">{places.length} lugares</p>
        </div>
        <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6">
          {places.map((p, i) => (
            <li key={p.id} className={i === 0 ? "col-span-2 md:col-span-1" : ""}>
              <button type="button" onClick={() => choosePlace(p.id)} className="group block w-full text-left">
                <div className={`relative overflow-hidden ${i === 0 ? "aspect-[16/10] md:aspect-[4/5]" : "aspect-[4/5]"}`}>
                  <Image
                    src={fichas[p.id].photo.src}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 50vw, 360px"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <span className="headline mt-3 block text-xl group-hover:text-earth md:text-2xl">{p.name}</span>
                <span className="mt-1 block text-sm text-text-muted">{fichas[p.id].region.split(" · ")[1]}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {!photo && (
        <section aria-labelledby="ejemplos" className="mt-16 md:mt-24">
          <div className="rule pt-4">
            <h2 id="ejemplos" className="eyebrow text-text-muted">
              Para la demo · Ejemplos precargados
            </h2>
            <p className="mt-2 max-w-[55ch] text-sm text-text-muted">Funcionan sin conexión y se marcan como ejemplo en el resultado.</p>
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-1">
            {places.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => pickDemo(p.id)} className="link-arrow text-sand">
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

function Sugerencia({ reco, onConfirm }: { reco: Reconocimiento | null; onConfirm: (id: PlaceId) => void }) {
  if (!reco || reco.estado === "analizando") {
    return <StatusMessage title="Mirando tu foto…">Buscamos qué lugar de la Quebrada es. Tarda unos segundos.</StatusMessage>;
  }
  if (reco.estado === "error") {
    return (
      <StatusMessage title="No pudimos reconocer el lugar">
        {reco.mensaje} Elegí abajo el lugar de tu foto para continuar.
      </StatusMessage>
    );
  }
  const { result } = reco;
  const candidato = getPlace(result.candidatePlaceId);
  if (!candidato) {
    return (
      <StatusMessage title="No reconocimos un lugar del recorrido">
        {result.summary} Si sabés dónde la sacaste, elegilo abajo.
      </StatusMessage>
    );
  }
  return (
    <div className="space-y-4">
      <div className="border-l-2 border-earth py-1 pl-4" role="status">
        <p className="eyebrow text-earth">IA · confianza {result.confidenceLabel}</p>
        <p className="headline mt-2 text-3xl">¿Es {candidato.name}?</p>
        <p className="mt-2 text-sm leading-6 text-text-muted">{result.summary}</p>
      </div>
      <Button onClick={() => onConfirm(candidato.id)}>Sí, es {candidato.name}</Button>
      <p className="text-sm text-text-muted">Si no es, elegí el lugar abajo.</p>
    </div>
  );
}
