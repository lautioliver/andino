import Image from "next/image";
import Link from "next/link";
import { places } from "@/data/places";
import { NocheBreve } from "@/features/pacha/EstaNoche";
import { fichas } from "@/features/pacha/fichas";
import { LinkButton } from "@/shared/ui/Button";
import { PhotoCredit } from "@/shared/ui/PhotoCredit";

const hero = fichas.purmamarca.photo;

const pasos = [
  {
    momento: "De día",
    titulo: "Elegí desde dónde mirar",
    texto: "Un pueblo de la Quebrada o una foto que sacaste en el camino.",
    tono: "text-earth",
  },
  {
    momento: "Al caer el sol",
    titulo: "Sabé cuándo salir",
    texto: "A qué hora se pone el sol, cómo está la Luna y qué satélites pasan esta noche.",
    tono: "text-sand",
  },
  {
    momento: "De noche",
    titulo: "Entendé lo que ves",
    texto: "El cielo real desde ese lugar: la Luna, los planetas, las estrellas y sus constelaciones.",
    tono: "text-sky",
  },
];

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
            Tu mejor <em className="text-sky">noche de cielo</em> en Jujuy.
          </h1>
          <p className="lead mt-6 max-w-[42ch] text-text/90">
            A qué hora oscurece, cómo está la Luna y qué estás viendo, calculado para el lugar donde estás.
          </p>
          <div className="mt-8">
            <LinkButton href="/explorar">Elegí un lugar</LinkButton>
          </div>
          <div className="mt-8">
            <PhotoCredit credit={`${hero.credit} — Cerro de los Siete Colores`} url={hero.creditUrl} />
          </div>
        </div>
      </section>

      {/* Un recorrido: el lugar de día y de noche */}
      <section aria-labelledby="recorrido" className="py-16 md:py-24">
        <h2 id="recorrido" className="headline max-w-[18ch] text-4xl md:text-5xl">
          Tu noche, en tres pasos
        </h2>
        <ol className="mt-10 grid gap-10 md:grid-cols-3 md:gap-12">
          {pasos.map((paso, i) => (
            <li key={paso.titulo} className="rule pt-6">
              <p className={`eyebrow ${paso.tono}`}>
                {String(i + 1).padStart(2, "0")} · {paso.momento}
              </p>
              <h3 className="headline mt-4 text-2xl md:text-3xl">{paso.titulo}</h3>
              <p className="mt-3 max-w-[40ch] text-text-muted">{paso.texto}</p>
            </li>
          ))}
        </ol>
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
                  <NocheBreve place={p} />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
