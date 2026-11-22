"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Inicio" },
  { href: "/explorar", label: "Explorar" },
  { href: "/cielo", label: "Cielo" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function TopNav() {
  const pathname = usePathname();
  return (
    <ul className="hidden items-center gap-8 md:flex">
      {nav.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
            className="eyebrow text-text-muted transition-colors hover:text-text aria-[current=page]:text-text"
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
              className={`eyebrow flex min-h-14 items-center justify-center border-t-2 ${active ? "border-earth text-text" : "border-transparent text-text-muted"}`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
