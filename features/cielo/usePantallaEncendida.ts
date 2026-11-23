"use client";

import { useEffect } from "react";

/**
 * Mantiene la pantalla encendida mientras `activa` (se está apuntando al cielo), si el navegador tiene
 * Wake Lock. El sistema lo suelta cuando la pestaña se oculta: se vuelve a pedir al volver. Si lo niega
 * (batería baja, modo ahorro), no pasa nada: la pantalla se apaga como siempre.
 */
export function usePantallaEncendida(activa: boolean) {
  useEffect(() => {
    if (!activa || !("wakeLock" in navigator)) return;
    let centinela: WakeLockSentinel | null = null;
    let pidiendo = false;
    let terminado = false;

    const pedir = async () => {
      if (pidiendo || document.visibilityState !== "visible" || (centinela && !centinela.released)) return;
      pidiendo = true;
      try {
        const nuevo = await navigator.wakeLock.request("screen");
        if (terminado) nuevo.release().catch(() => {});
        else centinela = nuevo;
      } catch {
        // Sin Wake Lock esta vez.
      } finally {
        pidiendo = false;
      }
    };

    pedir();
    document.addEventListener("visibilitychange", pedir);
    return () => {
      terminado = true;
      document.removeEventListener("visibilitychange", pedir);
      centinela?.release().catch(() => {});
    };
  }, [activa]);
}
