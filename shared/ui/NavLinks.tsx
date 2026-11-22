"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/shared/i18n/lang";

const nav = [
  { href: "/", label: { es: "Inicio", en: "Home" } },
  { href: "/explorar", label: { es: "De día", en: "By day" } },
  { href: "/cielo", label: { es: "De noche", en: "At night" } },
] as const;

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

export function BottomNav() {
  const pathname = usePathname();
  const lang = useLang();
  return (
    <ul className="grid grid-cols-3">
      {nav.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`eyebrow flex min-h-14 items-center justify-center border-t-2 ${active ? "border-puna text-text" : "border-transparent text-text-muted"}`}
            >
              {item.label[lang]}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
