import type { ReactNode } from "react";

type Tone = "info" | "error" | "success";
// Colores semánticos de Abra: fondo pastel, texto oscuro del mismo tono.
const toneClass: Record<Tone, { box: string; title: string }> = {
  info: { box: "bg-info-bg border-info/20", title: "text-info" },
  error: { box: "bg-danger-bg border-danger/20", title: "text-danger" },
  success: { box: "bg-success-bg border-success/20", title: "text-success" },
};

export function StatusMessage({ title, children, tone = "info" }: { title: string; children?: ReactNode; tone?: Tone }) {
  const t = toneClass[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`max-w-[65ch] rounded-control border px-4 py-3 ${t.box}`}>
      <p className={`font-semibold ${t.title}`}>{title}</p>
      {children && <div className="mt-1 text-sm leading-6 text-[#334155]">{children}</div>}
    </div>
  );
}
