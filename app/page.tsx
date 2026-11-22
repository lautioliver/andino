import Link from "next/link";

export default function Home() {
  return (
    <section className="rounded-hero border border-border bg-surface p-6 md:p-10">
      <p className="text-sm text-sand">Jujuy, de la Tierra al universo.</p>
      <h1 className="mt-2 font-display text-4xl leading-10 font-bold">
        Explorá la Tierra.
        <br />
        Descubrí el universo.
      </h1>
      <p className="mt-4 max-w-[65ch] text-text-muted">
        Fotografiá un paisaje para conocer su historia con fuentes, y mirá qué objetos del cielo se calculan desde ese
        mismo lugar.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/explorar"
          className="inline-flex min-h-12 items-center justify-center rounded-control bg-earth px-5 font-medium text-bg"
        >
          Explorar un paisaje
        </Link>
        <Link
          href="/cielo"
          className="inline-flex min-h-12 items-center justify-center rounded-control border border-sky px-5 font-medium text-sky"
        >
          Descubrir el cielo
        </Link>
      </div>
    </section>
  );
}
