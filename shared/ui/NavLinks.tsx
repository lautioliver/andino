"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/shared/i18n/lang";

// Íconos del dock: trazo de 24 px en currentColor, como los de Abra, dibujados acá para no sumar una librería.
const nav = [
  {
    href: "/",
    label: { es: "Inicio", en: "Home" },
    icono: (
      <>
        <path d="M4 10.2 12 3.5l8 6.7v9.3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
        <path d="M9.5 20.5V14h5v6.5" />
      </>
    ),
  },
  {
    href: "/explorar",
    label: { es: "De día", en: "By day" },
    icono: (
      <>
        <circle cx="17.5" cy="6" r="2.5" />
        <path d="M2.5 20 9 9.5l3.6 5.8 2.4-3.3 6.5 8z" />
      </>
    ),
  },
  {
    href: "/cielo",
    label: { es: "De noche", en: "At night" },
    icono: (
      <>
        <path d="M19.5 14.6A8.3 8.3 0 1 1 9.4 4.5a6.6 6.6 0 0 0 10.1 10.1z" />
        <path d="M17.5 3v4M15.5 5h4" />
      </>
    ),
  },
];

export function Pie() {
  const lang = useLang();
  return (
    <p className="rule pt-4">
      {lang === "en" ? "ANDINO · Cursor Hackathon Jujuy · Not affiliated with SpaceX." : "ANDINO · Cursor Hackathon Jujuy · Sin afiliación con SpaceX."}
    </p>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function TopNav() {
  const pathname = usePathname();
  const lang = useLang();
  return (
    <ul className="hidden items-center gap-1 md:flex">
      {nav.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
            className="flex min-h-11 items-center rounded-control px-3 text-sm font-medium text-text-muted transition-colors hover:bg-arena hover:text-text aria-[current=page]:bg-arena aria-[current=page]:text-violeta-ink"
          >
            {item.label[lang]}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Teléfono: el dock de Abra Tickets, una píldora oscura que flota sobre la página (estilos en app/globals.css). */
export function Dock() {
  const pathname = usePathname();
  const lang = useLang();
  return (
    <nav aria-label={lang === "en" ? "Main, mobile" : "Principal móvil"} className="dock md:hidden">
      <ul className="flex gap-1">
        {nav.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="dock-item flex h-[52px] flex-col items-center justify-center gap-[3px] rounded-[20px] text-[11px] font-semibold transition-[background,scale] duration-200 active:scale-[0.92] motion-reduce:active:scale-100 aria-[current=page]:font-bold"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={active ? 2.25 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {item.icono}
                </svg>
                {item.label[lang]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
