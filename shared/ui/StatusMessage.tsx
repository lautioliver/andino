import type { ReactNode } from "react";

type Tone = "info" | "error" | "success";
const toneClass: Record<Tone, string> = {
  info: "border-sand",
  error: "border-danger",
  success: "border-success",
};

// Nota al margen: filete lateral, sin caja.
export function StatusMessage({ title, children, tone = "info" }: { title: string; children?: ReactNode; tone?: Tone }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`max-w-[65ch] border-l-2 py-1 pl-4 ${toneClass[tone]}`}>
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-sm leading-6 text-text-muted">{children}</div>}
    </div>
  );
}
