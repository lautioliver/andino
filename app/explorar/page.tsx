import { Suspense } from "react";
import { PachaFlow } from "@/features/pacha/PachaFlow";

// Propiedad: lautioliver (features/pacha).
export default function ExplorarPage() {
  return (
    <Suspense fallback={<p className="text-text-muted">Cargando Pacha…</p>}>
      <PachaFlow />
    </Suspense>
  );
}
