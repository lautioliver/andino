import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "earth" | "sky" | "ghost";

const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-5 font-medium transition-colors disabled:opacity-50";
const variants: Record<Variant, string> = {
  earth: "bg-earth text-bg hover:bg-sand",
  sky: "border border-sky text-sky hover:bg-surface-raised",
  ghost: "border border-border text-text hover:bg-surface-raised",
};

export function buttonClass(variant: Variant = "earth", extra = "") {
  return `${base} ${variants[variant]} ${extra}`;
}

export function Button({ variant = "earth", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />;
}

export function LinkButton({ variant = "earth", className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
