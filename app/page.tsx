"use client";

import Image from "next/image";
import Link from "next/link";
import { getPlace, places } from "@/data/places";
import { NocheDePortada } from "@/features/cuando/NocheDePortada";
import { fichaEn, fichas } from "@/features/pacha/fichas";
import { HORA_NOCHE } from "@/features/pacha/noche";
import { CieloDePortada } from "@/features/pacha/Portada";
import { useLang, useT } from "@/shared/i18n/lang";
import { LinkButton } from "@/shared/ui/Button";

const lugarPortada = getPlace("purmamarca")!;

/** Primera frase del resumen: el dato propio de cada destino. */
function primeraFrase(texto: string) {
  return texto.split(/(?<=\.)\s/)[0];
}

const textos = {
  es: {
    estaNoche: "Esta noche",
    titulo1: "Tu mejor",
    tituloAcento: "noche de cielo",
    titulo2: "en Jujuy.",
    bajada: "Qué estás viendo por la ventana y qué hay en el cielo, en cada parada del recorrido. Sacá una foto y te contamos el lugar.",
    cta: "Reconocer un lugar",
    explorar: "Explorar este cielo",
    fondo: (h: string, l: string) => `El fondo no es una foto: es el cielo calculado para hoy a las ${h} desde ${l}.`,
    laNoche: "La noche en",
    destinos: "Las paradas del recorrido",
    tren: "Tren Solar de la Quebrada",
    ver: "Ver el lugar",
  },
  en: {
    estaNoche: "Tonight",
    titulo1: "Your best",
    tituloAcento: "night under the sky",
    titulo2: "in Jujuy.",
    bajada: "What you're seeing out the window and what's in the sky, at every stop along the route. Take a photo and we'll tell you about the place.",
    cta: "Recognize a place",
    explorar: "Explore this sky",
    fondo: (h: string, l: string) => `The background isn't a photo: it's the sky calculated for today at ${h} from ${l}.`,
    laNoche: "The night in",
    destinos: "The stops along the route",
    tren: "Tren Solar de la Quebrada",
    ver: "See the place",
  },
};

export default function Home() {
  const t = useT(textos);
  const lang = useLang();
  return (
    <>
      {/* Portada: el cielo calculado de esta noche, no una foto. */}
      <section className="oscuro bleed relative flex min-h-[min(92svh,820px)] items-end overflow-hidden">
        <div className="absolute inset-0">
          <CieloDePortada place={lugarPortada} />
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg via-bg/70 via-35% to-transparent" />
        <div className="relative mx-auto w-full max-w-[1120px] px-4 pb-12 md:px-6 md:pb-20">
          <p className="eyebrow text-puna-ink">
            {t.estaNoche} · {lugarPortada.name} · {HORA_NOCHE}
          </p>
          <h1 className="display mt-4 max-w-[12ch] text-[clamp(2.75rem,9.5vw,7rem)]">
            {t.titulo1} <em className="acento">{t.tituloAcento}</em> {t.titulo2}
          </h1>
          <p className="lead mt-6 max-w-[38ch] text-text/85">{t.bajada}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-2">
            <LinkButton href="/explorar">{t.cta}</LinkButton>
            <LinkButton variant="ghost" href={`/cielo?placeId=${lugarPortada.id}`}>
              {t.explorar}
            </LinkButton>
          </div>
          <p className="mt-10 text-xs text-text-muted">{t.fondo(HORA_NOCHE, lugarPortada.name)}</p>
        </div>
      </section>

      {/* La noche, de la puesta del sol al alba, con las nubes previstas y el recordatorio */}
      <section aria-labelledby="la-noche" className="py-16 md:py-28">
        <h2 id="la-noche" className="eyebrow text-violeta-ink">
          {t.laNoche} {lugarPortada.name}
        </h2>
        <div className="mt-4">
          <NocheDePortada place={lugarPortada} />
        </div>
      </section>

      {/* Destinos: la foto protagoniza; el texto, un dato propio de cada lugar */}
      <section aria-labelledby="destinos" className="rule pt-6 pb-8">
        <div className="flex items-baseline justify-between">
          <h2 id="destinos" className="headline text-4xl md:text-5xl">
            {t.destinos}
          </h2>
          <p className="eyebrow hidden text-text-muted sm:block">{t.tren}</p>
        </div>
        <ol className="mt-10 grid gap-12 sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-3 lg:gap-y-14">
          {places.map((p, i) => {
            const f = fichaEn(fichas[p.id], lang);
            return (
              <li key={p.id}>
                <Link href={`/explorar?placeId=${p.id}`} className="group block">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-card">
                    <Image
                      src={f.photo.src}
                      alt={f.photo.alt}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                    />
                  </div>
                  <p className="eyebrow mt-5 text-text-muted">
                    {String(i + 1).padStart(2, "0")} · {f.region.split(" · ")[1]}
                  </p>
                  <h3 className="display mt-2 text-3xl group-hover:text-puna-ink lg:text-4xl">{p.name}</h3>
                  <p className="mt-3 max-w-[48ch] leading-7 text-text-muted">{primeraFrase(f.summary)}</p>
                  <span className="link-arrow mt-2 text-puna-ink">{t.ver}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
