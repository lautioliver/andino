"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useT } from "@/shared/i18n/lang";

// Sin señal: registra el service worker (public/sw.js, que guarda la app para cuando el tren se queda
// sin conexión) y avisa mientras el teléfono dice que no tiene red.

const textos = {
  es: "Sin señal: mostrando lo guardado",
  en: "No signal: showing saved content",
};

function suscribir(avisar: () => void) {
  window.addEventListener("online", avisar);
  window.addEventListener("offline", avisar);
  return () => {
    window.removeEventListener("online", avisar);
    window.removeEventListener("offline", avisar);
  };
}

export function SinSenal() {
  const texto = useT(textos);
  // En el servidor siempre hay señal: el aviso aparece al hidratar, sin desajuste.
  const sinSenal = useSyncExternalStore(
    suscribir,
    () => !navigator.onLine,
    () => false,
  );

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    if (process.env.NODE_ENV !== "production") {
      // En desarrollo no se registra. Y si en este puerto quedó uno de un `next start`, se da de baja:
      // serviría archivos guardados en vez de los que se están editando.
      navigator.serviceWorker
        .getRegistrations()
        .then((registros) => registros.forEach((r) => r.unregister()))
        .catch(() => {});
      return;
    }
    // Después de la carga, para no competir con la página por la señal. updateViaCache "none": en cada visita
    // el navegador revisa /sw.js contra la red y no contra su caché, así un cambio (o el interruptor) llega solo.
    const registrar = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    };
    if (document.readyState === "complete") registrar();
    else window.addEventListener("load", registrar, { once: true });
    return () => window.removeEventListener("load", registrar);
  }, []);

  // El contenedor está siempre, para que el lector de pantalla anuncie el aviso cuando aparece.
  // Va pegado debajo del encabezado (3.5rem) y no recibe toques: no tapa ningún control.
  return (
    <p role="status" className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4" style={{ top: "calc(env(safe-area-inset-top) + 3.75rem)" }}>
      {sinSenal && <span className="rounded-full bg-noche px-3 py-1.5 text-xs font-semibold text-white shadow-md">{texto}</span>}
    </p>
  );
}
