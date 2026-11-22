import { StatusMessage } from "@/shared/ui/StatusMessage";

// Propiedad: jehp23 (features/cielo).
export default function CieloPage() {
  return (
    <section className="space-y-4">
      <h1 className="font-display text-[28px] leading-[34px] font-bold">Descubrí el cielo desde este lugar.</h1>
      <StatusMessage title="Cielo Andino en construcción">
        Selector de lugar, fecha/hora y mapa celeste llegan en AND-06 a AND-08.
      </StatusMessage>
    </section>
  );
}
