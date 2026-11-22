import Image from "next/image";
import { fichas } from "@/features/pacha/fichas";
import { LinkButton } from "@/shared/ui/Button";
import { PhotoCredit } from "@/shared/ui/PhotoCredit";

const hero = fichas.purmamarca.photo;

export default function Home() {
  return (
    <div className="space-y-3">
      <section className="relative overflow-hidden rounded-hero border border-border">
        <Image src={hero.src} alt={hero.alt} fill priority sizes="(max-width: 1120px) 100vw, 1120px" className="object-cover" />
        <div className="absolute inset-0 bg-bg/70" />
        <div className="relative p-6 pt-40 md:p-10 md:pt-56">
          <p className="text-sm text-sand">Jujuy, de la Tierra al universo.</p>
          <h1 className="mt-2 font-display text-4xl leading-10 font-bold">
            Explorá la Tierra.
            <br />
            Descubrí el universo.
          </h1>
          <p className="mt-4 max-w-[65ch] text-text">
            Fotografiá un paisaje para conocer su historia con fuentes, y mirá qué objetos del cielo se calculan desde ese
            mismo lugar.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <LinkButton href="/explorar">Explorar un paisaje</LinkButton>
            <LinkButton href="/cielo" variant="sky" className="bg-bg/60">
              Descubrir el cielo
            </LinkButton>
          </div>
        </div>
      </section>
      <PhotoCredit credit={`${hero.credit} — Cerro de los Siete Colores, Purmamarca`} url={hero.creditUrl} />
    </div>
  );
}
