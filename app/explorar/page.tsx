import { StatusMessage } from "@/shared/ui/StatusMessage";

// Propiedad: lautioliver (features/pacha).
export default function ExplorarPage() {
  return (
    <section className="space-y-4">
      <h1 className="font-display text-[28px] leading-[34px] font-bold">¿Qué estás viendo?</h1>
      <StatusMessage title="Pacha en construcción">Captura de imagen y análisis llegan en AND-02 y AND-04.</StatusMessage>
    </section>
  );
}
