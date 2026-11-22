import { Suspense } from "react";
import { CieloEscena } from "@/features/cielo/CieloEscena";

// Propiedad: jehp23 (features/cielo).
// CieloEscena lee ?placeId=&fecha=&hora= y la hora del teléfono: se dibuja en el cliente, dentro de Suspense.
export default function CieloPage() {
  return (
    <Suspense fallback={<p className="text-text-muted">Calculando el cielo…</p>}>
      <CieloEscena />
    </Suspense>
  );
}
