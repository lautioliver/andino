"use client";

import { useLang } from "@/shared/i18n/lang";

export function PhotoCredit({ credit, url }: { credit: string; url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-text-muted underline-offset-2 hover:underline">
      {useLang() === "en" ? "Photo" : "Foto"}: {credit}
    </a>
  );
}
