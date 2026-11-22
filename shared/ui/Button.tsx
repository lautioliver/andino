import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "earth" | "sky" | "ghost";

// Editorial: bloques sólidos de esquina mínima para la acción principal; texto con flecha para lo secundario.
const solid = "inline-flex min-h-12 items-center justify-center gap-3 rounded-[4px] px-6 text-[15px] font-semibold tracking-wide transition-colors disabled:opacity-50";
const variants: Record<Variant, string> = {
  earth: `${solid} bg-earth text-bg hover:bg-sand`,
  sky: `${solid} bg-sky text-bg hover:bg-text`,
  ghost: "link-arrow text-text disabled:opacity-50",
};

export function buttonClass(variant: Variant = "earth", extra = "") {
  return `${variants[variant]} ${extra}`;
}

export function Button({ variant = "earth", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />;
}

export function LinkButton({ variant = "earth", className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
