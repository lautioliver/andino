import Image from "next/image";
import type { AndinoPlace } from "@/shared/types";
import { fichas } from "./fichas";

export function PlaceCard({ place, onSelect, label }: { place: AndinoPlace; onSelect: () => void; label?: string }) {
  const ficha = fichas[place.id];
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex w-full items-center gap-3 rounded-card border border-border bg-surface p-3 text-left hover:border-earth"
    >
      <Image
        src={ficha.photo.src}
        alt=""
        width={72}
        height={72}
        className="size-[72px] shrink-0 rounded-control object-cover"
      />
      <span className="min-w-0">
        <span className="block font-display font-bold">{place.name}</span>
        <span className="block truncate text-sm text-text-muted">{label ?? ficha.region}</span>
      </span>
    </button>
  );
}
