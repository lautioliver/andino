"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getPlace, places } from "@/data/places";
import type { PlaceId } from "@/shared/types";
import { Badge } from "@/shared/ui/Badge";
import { Button, LinkButton } from "@/shared/ui/Button";
import { PhotoCredit } from "@/shared/ui/PhotoCredit";
import { SourceList } from "@/shared/ui/SourceList";
import { StatusMessage } from "@/shared/ui/StatusMessage";
import { fichas } from "./fichas";
import { PlaceCard } from "./PlaceCard";

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
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (photo?.isObjectUrl) URL.revokeObjectURL(photo.url);
    };
  }, [photo]);

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
    if (place) router.push("/explorar");
  }

  function pickDemo(id: PlaceId) {
    setError(null);
    setPhoto({ url: fichas[id].photo.src, isDemo: true, isObjectUrl: false });
    choosePlace(id);
  }

  function reset() {
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
    return (
      <article className="space-y-6">
        {inputs}
        <div className="overflow-hidden rounded-hero border border-border bg-surface">
          <div className="relative aspect-[4/3] w-full">
            <Image
              src={shown.url}
              alt={isUserPhoto ? "Tu foto" : ficha.photo.alt}
              fill
              sizes="(max-width: 1120px) 100vw, 1120px"
              className="object-cover"
              unoptimized={shown.isObjectUrl}
              priority
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
            {isUserPhoto ? <span className="text-xs text-text-muted">Tu foto (no se guarda)</span> : <PhotoCredit credit={ficha.photo.credit} url={ficha.photo.creditUrl} />}
            {photo?.isDemo && <Badge>Ejemplo precargado</Badge>}
          </div>
        </div>

        <header className="space-y-2">
          <p className="text-sm text-sand">{ficha.region}</p>
          <h1 className="font-display text-[28px] leading-[34px] font-bold">{place.name}</h1>
          <div className="flex flex-wrap gap-2">
            <Badge tone="earth">Lugar elegido por vos</Badge>
            <Badge>Contenido curado · en revisión</Badge>
          </div>
        </header>

        <p className="max-w-[65ch] text-base leading-6">{ficha.summary}</p>

        <details className="max-w-[65ch] rounded-card border border-border bg-surface p-4">
          <summary className="cursor-pointer font-medium">Conocer más</summary>
          <div className="mt-3 space-y-3 text-text-muted">
            {ficha.more.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </details>

        <SourceList sources={ficha.sources} />

        <div className="flex flex-col gap-3 sm:flex-row">
          <LinkButton variant="sky" href={`/cielo?placeId=${place.id}`}>
            Ver el cielo desde acá
          </LinkButton>
          <Button variant="ghost" onClick={() => router.push("/explorar")}>
            No es este lugar
          </Button>
          <Button variant="ghost" onClick={reset}>
            Explorar otro paisaje
          </Button>
        </div>
      </article>
    );
  }

  // ---------- Captura / confirmación ----------
  return (
    <section className="space-y-6">
      {inputs}
      <header className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-medium text-earth">
          <Image src="/brand/pacha-mark.svg" alt="" width={24} height={24} />
          Pacha
        </p>
        <h1 className="font-display text-[28px] leading-[34px] font-bold">¿Qué estás viendo?</h1>
        <p className="max-w-[65ch] text-text-muted">Sacá una foto del paisaje o elegí un destino para conocer su historia, con fuentes.</p>
      </header>

      {error && (
        <StatusMessage tone="error" title="No pudimos usar esa imagen">
          {error}
        </StatusMessage>
      )}

      {photo && !photo.isDemo ? (
        <div className="space-y-4">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-hero border border-border bg-surface">
            <Image src={photo.url} alt="Vista previa de tu foto" fill className="object-cover" unoptimized />
          </div>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            Cambiar imagen
          </Button>
          <StatusMessage title="¿Qué lugar es?">
            El reconocimiento automático todavía no está activo. Elegí el lugar de tu foto para continuar.
          </StatusMessage>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={() => cameraRef.current?.click()}>Tomar una foto</Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            Subir imagen
          </Button>
        </div>
      )}

      <section aria-labelledby="destinos" className="space-y-3">
        <h2 id="destinos" className="font-display text-[22px] leading-7 font-bold">
          {photo ? "Elegí el lugar" : "O elegí un destino"}
        </h2>
        <ul className="grid gap-3 md:grid-cols-3">
          {places.map((p) => (
            <li key={p.id}>
              <PlaceCard place={p} onSelect={() => choosePlace(p.id)} />
            </li>
          ))}
        </ul>
      </section>

      {!photo && (
        <section aria-labelledby="ejemplos" className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 id="ejemplos" className="font-display text-lg font-bold">
              Ejemplos para la demo
            </h2>
            <Badge>Ejemplo precargado</Badge>
          </div>
          <ul className="grid grid-cols-3 gap-3">
            {places.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => pickDemo(p.id)}
                  className="relative block aspect-square w-full overflow-hidden rounded-card border border-border hover:border-earth"
                >
                  <Image src={fichas[p.id].photo.src} alt={`Ejemplo: ${p.name}`} fill sizes="33vw" className="object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-bg/80 px-2 py-1 text-xs">{p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
