import type { ReactNode } from "react";

type Tone = "info" | "error" | "success";
const toneClass: Record<Tone, string> = {
  info: "border-border",
  error: "border-danger",
  success: "border-success",
};

export function StatusMessage({ title, children, tone = "info" }: { title: string; children?: ReactNode; tone?: Tone }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-card border bg-surface p-4 ${toneClass[tone]}`}>
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-sm text-text-muted">{children}</div>}
    </div>
  );
}
