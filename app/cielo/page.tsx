import { Suspense } from "react";
import { CieloExplorer } from "@/features/cielo/CieloExplorer";

// Escrito por jehp23 (features/cielo).
// CieloExplorer lee ?placeId= y la hora del teléfono: se dibuja en el cliente, dentro de Suspense.
export default function CieloPage() {
  return (
    <Suspense fallback={<p className="text-text-muted">Calculando el cielo…</p>}>
      <CieloExplorer />
    </Suspense>
  );
}
