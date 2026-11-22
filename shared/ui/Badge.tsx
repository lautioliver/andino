import type { ReactNode } from "react";

export function Badge({ children, tone = "sand" }: { children: ReactNode; tone?: "sand" | "sky" | "earth" }) {
  const color = { sand: "border-sand text-sand", sky: "border-sky text-sky", earth: "border-earth text-earth" }[tone];
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${color}`}>{children}</span>;
}
