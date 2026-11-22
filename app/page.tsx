import Image from "next/image";
import Link from "next/link";
import { places } from "@/data/places";
import { fichas } from "@/features/pacha/fichas";
import { LinkButton } from "@/shared/ui/Button";
import { PhotoCredit } from "@/shared/ui/PhotoCredit";

const hero = fichas.purmamarca.photo;

export default function Home() {
  return (
    <>
      {/* Portada */}
      <section className="bleed relative flex min-h-[min(88svh,760px)] items-end md:min-h-[min(82svh,860px)]">
        <Image src={hero.src} alt={hero.alt} fill priority sizes="100vw" className="object-cover" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-bg via-bg/55 to-bg/10" />
        <div className="relative mx-auto w-full max-w-[1120px] px-4 pb-10 md:px-6 md:pb-16">
          <p className="eyebrow text-sand">Jujuy · Quebrada de Humahuaca</p>
          <h1 className="display mt-4 max-w-[12ch] text-[clamp(3rem,11vw,7rem)]">
            Explorá la Tierra. <em className="text-sky">Descubrí el universo.</em>
          </h1>
          <p className="lead mt-6 max-w-[42ch] text-text/90">
            Fotografiá un paisaje para conocer su historia, con fuentes. Después mirá qué hay en el cielo desde ese mismo
            lugar.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-2">
            <LinkButton href="/explorar">Explorar un paisaje</LinkButton>
            <LinkButton href="/cielo" variant="ghost">
              Descubrir el cielo
            </LinkButton>
          </div>
          <div className="mt-8">
            <PhotoCredit credit={`${hero.credit} — Cerro de los Siete Colores`} url={hero.creditUrl} />
          </div>
        </div>
      </section>

      {/* Dos capítulos */}
      <section className="grid gap-12 py-16 md:grid-cols-2 md:gap-16 md:py-24">
        <article className="rule pt-6">
          <p className="eyebrow text-earth">01 · Pacha</p>
          <h2 className="headline mt-4 text-4xl md:text-5xl">La Tierra</h2>
          <p className="mt-4 max-w-[45ch] text-text-muted">
            Sacá una foto o elegí un destino. Te contamos qué estás viendo con información curada y la fuente de cada dato.
          </p>
          <Link href="/explorar" className="link-arrow mt-4 text-earth">
            ¿Qué estás viendo?
          </Link>
        </article>
        <article className="rule pt-6">
          <p className="eyebrow text-sky">02 · Cielo Andino</p>
          <h2 className="headline mt-4 text-4xl md:text-5xl">El universo</h2>
          <p className="mt-4 max-w-[45ch] text-text-muted">
            Elegí un lugar, una fecha y una hora. Calculamos la posición real de la Luna, los planetas y algunas estrellas.
          </p>
          <Link href="/cielo" className="link-arrow mt-4 text-sky">
            Ver el cielo
          </Link>
        </article>
      </section>

      {/* Destinos */}
      <section aria-labelledby="destinos" className="pb-8">
        <div className="flex items-baseline justify-between">
          <h2 id="destinos" className="headline text-3xl md:text-4xl">
            Destinos
          </h2>
          <p className="eyebrow text-text-muted">{places.length} lugares</p>
        </div>
        <ul className="bleed mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:w-auto md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0">
          {places.map((p, i) => {
            const f = fichas[p.id];
            return (
              <li key={p.id} className="w-[78%] shrink-0 snap-start md:w-auto">
                <Link href={`/explorar?placeId=${p.id}`} className="group block">
                  <div className="relative aspect-[4/5] overflow-hidden">
                    <Image
                      src={f.photo.src}
                      alt={f.photo.alt}
                      fill
                      sizes="(max-width: 768px) 78vw, 360px"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  </div>
                  <p className="eyebrow mt-4 text-text-muted">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="headline mt-1 text-2xl group-hover:text-earth">{p.name}</h3>
                  <p className="mt-1 text-sm text-text-muted">{f.region}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
