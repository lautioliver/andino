"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { alphaAbsoluto, suavizar, type Vista, vistaDeLaCamara } from "./orientacion";

export type EstadoBrujula = "apagada" | "pidiendo" | "activa" | "sin-brujula" | "denegada";

type EventoOrientacion = DeviceOrientationEvent & { webkitCompassHeading?: number };
type ConPermiso = { requestPermission?: () => Promise<"granted" | "denied"> };

const sinSuscripcion = () => () => {};

/** Si en este tiempo no llega una lectura con norte, el teléfono no tiene brújula utilizable. */
const ESPERA_MS = 2000;

/**
 * «Apuntá»: mueve el cielo según hacia dónde apunta la cámara de atrás.
 * Nunca simula la orientación: si el teléfono no informa el norte, queda en «sin-brujula» y se
 * sigue girando con el dedo. `encender` tiene que llamarse desde un toque (iOS pide permiso).
 */
export function useBrujula(alMover: (v: Vista) => void) {
  const [estado, setEstado] = useState<EstadoBrujula>("apagada");
  const alMoverRef = useRef(alMover);
  useEffect(() => {
    alMoverRef.current = alMover;
  }, [alMover]);

  // En el servidor no hay sensores: se decide al hidratar, sin desajuste.
  const disponible = useSyncExternalStore(
    sinSuscripcion,
    () => "DeviceOrientationEvent" in window,
    () => false,
  );

  const encender = useCallback(async () => {
    if (!disponible) {
      setEstado("sin-brujula");
      return;
    }
    // Se llama como método de la clase: suelta, Safari la rechaza por perder el `this`.
    const conPermiso = DeviceOrientationEvent as unknown as ConPermiso;
    if (typeof conPermiso.requestPermission === "function") {
      setEstado("pidiendo");
      try {
        if ((await conPermiso.requestPermission()) !== "granted") {
          setEstado("denegada");
          return;
        }
      } catch {
        setEstado("denegada");
        return;
      }
    }
    setEstado("activa");
  }, [disponible]);

  const apagar = useCallback(() => setEstado("apagada"), []);

  useEffect(() => {
    if (estado !== "activa") return;
    // Android/Chrome entrega el norte en «deviceorientationabsolute»; iOS, en webkitCompassHeading.
    const tipo = "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation";
    let vista: Vista | null = null;
    let raf = 0;
    const espera = window.setTimeout(() => setEstado("sin-brujula"), ESPERA_MS);

    const alLeer = (ev: Event) => {
      const e = ev as EventoOrientacion;
      const alpha = alphaAbsoluto({ alpha: e.alpha, absolute: e.absolute || tipo === "deviceorientationabsolute", webkitCompassHeading: e.webkitCompassHeading });
      if (alpha === null || e.beta === null || e.gamma === null) return;
      window.clearTimeout(espera);
      vista = suavizar(vista, vistaDeLaCamara(alpha, e.beta, e.gamma));
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (vista) alMoverRef.current(vista);
        });
      }
    };

    window.addEventListener(tipo, alLeer);
    return () => {
      window.removeEventListener(tipo, alLeer);
      window.clearTimeout(espera);
      cancelAnimationFrame(raf);
    };
  }, [estado]);

  return { estado, disponible, encender, apagar };
}
