"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Inicio" },
  { href: "/explorar", label: "De día" },
  { href: "/cielo", label: "De noche" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function TopNav() {
  const pathname = usePathname();
  return (
    <ul className="hidden items-center gap-1 md:flex">
      {nav.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
            className="flex min-h-11 items-center rounded-control px-3 text-sm font-medium text-text-muted transition-colors hover:bg-arena hover:text-text aria-[current=page]:bg-arena aria-[current=page]:text-violeta-ink"
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function BottomNav() {
  const pathname = usePathname();
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
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
