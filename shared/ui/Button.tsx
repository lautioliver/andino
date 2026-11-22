import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "puna" | "violeta" | "ghost";

// Abra: radio 8px. Primario en Puna con texto Noche (6.9:1) y glow; secundario con borde Violeta; lo terciario, texto con flecha.
const base =
  "inline-flex min-h-12 items-center justify-center gap-3 rounded-control px-6 text-[15px] font-semibold transition-[background-color,box-shadow,transform] active:translate-y-px disabled:opacity-50";
const variants: Record<Variant, string> = {
  puna: `${base} bg-puna text-noche shadow-glow-puna hover:bg-puna-hover`,
  violeta: `${base} border border-violeta bg-surface text-violeta-ink shadow-sm hover:bg-arena hover:text-noche`,
  ghost: "link-arrow text-text disabled:opacity-50",
};

export function buttonClass(variant: Variant = "puna", extra = "") {
  return `${variants[variant]} ${extra}`;
}

export function Button({ variant = "puna", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />;
}

export function LinkButton({ variant = "puna", className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
