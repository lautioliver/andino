import Image from "next/image";
import Link from "next/link";
import { getPlace, places } from "@/data/places";
import { fichas } from "@/features/pacha/fichas";
import { HORA_NOCHE } from "@/features/pacha/noche";
import { CieloDePortada, NocheEnLinea } from "@/features/pacha/Portada";
import { LinkButton } from "@/shared/ui/Button";

const lugarPortada = getPlace("purmamarca")!;

/** Primera frase del resumen: el dato propio de cada destino. */
function primeraFrase(texto: string) {
  return texto.split(/(?<=\.)\s/)[0];
}

export default function Home() {
  return (
    <>
      {/* Portada: el cielo calculado de esta noche, no una foto. */}
      <section className="bleed relative flex min-h-[min(92svh,820px)] items-end overflow-hidden bg-bg">
        <div className="absolute inset-0">
          <CieloDePortada place={lugarPortada} />
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg via-bg/70 via-35% to-transparent" />
        <div className="relative mx-auto w-full max-w-[1120px] px-4 pb-12 md:px-6 md:pb-20">
          <p className="eyebrow text-sand">
            Esta noche · {lugarPortada.name} · {HORA_NOCHE}
          </p>
          <h1 className="display mt-4 max-w-[11ch] text-[clamp(3rem,10.5vw,7.5rem)]">
            Tu mejor <em className="text-sky">noche de cielo</em> en Jujuy.
          </h1>
          <p className="lead mt-6 max-w-[38ch] text-text/85">Cuándo salir, adónde mirar y qué estás viendo, calculado para el lugar donde estás.</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-2">
            <LinkButton href="/explorar">Elegí un lugar</LinkButton>
            <LinkButton variant="ghost" href={`/cielo?placeId=${lugarPortada.id}`}>
              Explorar este cielo
            </LinkButton>
          </div>
          <p className="mt-10 text-xs text-text-muted">El fondo no es una foto: es el cielo calculado para hoy a las {HORA_NOCHE} desde {lugarPortada.name}.</p>
        </div>
      </section>

      {/* La noche, de la puesta del sol al alba */}
      <section aria-labelledby="la-noche" className="py-16 md:py-28">
        <h2 id="la-noche" className="eyebrow text-sky">
          La noche en {lugarPortada.name}
        </h2>
        <div className="mt-4">
          <NocheEnLinea place={lugarPortada} />
        </div>
      </section>

      {/* Destinos: la foto protagoniza; el texto, un dato propio de cada lugar */}
      <section aria-labelledby="destinos" className="rule pt-6 pb-8">
        <div className="flex items-baseline justify-between">
          <h2 id="destinos" className="headline text-4xl md:text-5xl">
            Desde dónde mirar
          </h2>
          <p className="eyebrow hidden text-text-muted sm:block">Quebrada de Humahuaca</p>
        </div>
        <ul className="mt-10 grid gap-14 md:grid-cols-12 md:gap-x-6 md:gap-y-16">
          {places.map((p, i) => {
            const f = fichas[p.id];
            const grande = i === 0;
            return (
              <li key={p.id} className={grande ? "md:col-span-12" : "md:col-span-6"}>
                <Link href={`/explorar?placeId=${p.id}`} className={`group block ${grande ? "lg:grid lg:grid-cols-12 lg:items-end lg:gap-6" : ""}`}>
                  <div className={`bleed relative overflow-hidden md:mx-0 md:w-auto ${grande ? "aspect-[4/3] md:aspect-[16/9] lg:col-span-8 lg:aspect-[16/10]" : "aspect-[4/3] md:aspect-[5/4]"}`}>
                    <Image
                      src={f.photo.src}
                      alt={f.photo.alt}
                      fill
                      sizes={grande ? "(max-width: 768px) 100vw, 740px" : "(max-width: 768px) 100vw, 550px"}
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                    />
                  </div>
                  <div className={grande ? "lg:col-span-4 lg:pb-2" : ""}>
                    <p className="eyebrow mt-5 text-text-muted">
                      {String(i + 1).padStart(2, "0")} · {f.region.split(" · ")[1]}
                    </p>
                    <h3 className={`display mt-2 group-hover:text-earth ${grande ? "text-5xl lg:text-6xl" : "text-4xl lg:text-5xl"}`}>{p.name}</h3>
                    <p className="mt-3 max-w-[48ch] leading-7 text-text-muted">{primeraFrase(f.summary)}</p>
                    <span className="link-arrow mt-2 text-earth">Ver el lugar</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
