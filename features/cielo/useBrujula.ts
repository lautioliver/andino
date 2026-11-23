"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { alphaAbsoluto, type Pose, poseDeLaCamara, suavizarPose, type Vista, vistaDePose } from "./orientacion";

export type EstadoBrujula = "apagada" | "pidiendo" | "activa" | "sin-brujula" | "denegada";

type EventoOrientacion = DeviceOrientationEvent & { webkitCompassHeading?: number };
type ConPermiso = { requestPermission?: () => Promise<"granted" | "denied"> };

const sinSuscripcion = () => () => {};

/** Si en este tiempo no llega una lectura con norte, el teléfono no tiene brújula utilizable. */
const ESPERA_MS = 2000;

/** Cuánto rotó el contenido de la pantalla respecto del teléfono parado, en grados. */
function anguloDePantalla(): number {
  const angulo = window.screen?.orientation?.angle;
  if (typeof angulo === "number") return angulo;
  // Safari de iPhone anterior a 16.4 no tiene screen.orientation: informa lo mismo en window.orientation (90, −90, 180).
  return typeof window.orientation === "number" ? window.orientation : 0;
}

/**
 * «Apuntá»: mueve el cielo según hacia dónde apunta la cámara de atrás, con su inclinación lateral.
 * Nunca simula la orientación: si el teléfono no informa el norte, queda en «sin-brujula» y se
 * sigue girando con el dedo. `encender` tiene que llamarse desde un toque (iOS pide permiso) y avisa
 * si quedó encendida. Mientras `enPausa` (hay otro aviso de permiso a la vista) no corre el plazo de espera.
 * `leyendo` avisa que ya llegó una lectura con norte: recién ahí el cielo está donde apunta el teléfono.
 */
export function useBrujula(alMover: (v: Vista) => void, enPausa = false) {
  const [estado, setEstado] = useState<EstadoBrujula>("apagada");
  const [leyendo, setLeyendo] = useState(false);
  const alMoverRef = useRef(alMover);
  useEffect(() => {
    alMoverRef.current = alMover;
  }, [alMover]);
  const huboLectura = useRef(false);

  // En el servidor no hay sensores: se decide al hidratar, sin desajuste.
  const disponible = useSyncExternalStore(
    sinSuscripcion,
    () => "DeviceOrientationEvent" in window,
    () => false,
  );

  const encender = useCallback(async (): Promise<boolean> => {
    if (!disponible) {
      setEstado("sin-brujula");
      return false;
    }
    // Se llama como método de la clase: suelta, Safari la rechaza por perder el `this`.
    const conPermiso = DeviceOrientationEvent as unknown as ConPermiso;
    if (typeof conPermiso.requestPermission === "function") {
      setEstado("pidiendo");
      try {
        if ((await conPermiso.requestPermission()) !== "granted") {
          setEstado("denegada");
          return false;
        }
      } catch {
        setEstado("denegada");
        return false;
      }
    }
    setEstado("activa");
    return true;
  }, [disponible]);

  const apagar = useCallback(() => {
    setEstado("apagada");
    setLeyendo(false);
  }, []);

  useEffect(() => {
    if (estado !== "activa") return;
    // Android/Chrome entrega el norte en «deviceorientationabsolute»; iOS, en webkitCompassHeading.
    const tipo = "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation";
    let pose: Pose | null = null;
    let raf = 0;
    huboLectura.current = false;

    const alLeer = (ev: Event) => {
      const e = ev as EventoOrientacion;
      const alpha = alphaAbsoluto({ alpha: e.alpha, absolute: e.absolute || tipo === "deviceorientationabsolute", webkitCompassHeading: e.webkitCompassHeading });
      if (alpha === null || e.beta === null || e.gamma === null) return;
      if (!huboLectura.current) {
        huboLectura.current = true;
        setLeyendo(true);
      }
      pose = suavizarPose(pose, poseDeLaCamara(alpha, e.beta, e.gamma, anguloDePantalla()));
      // Las lecturas llegan más seguido que los cuadros: se entrega una por cuadro.
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (pose) alMoverRef.current(vistaDePose(pose));
        });
      }
    };

    window.addEventListener(tipo, alLeer);
    return () => {
      window.removeEventListener(tipo, alLeer);
      cancelAnimationFrame(raf);
    };
  }, [estado]);

  // El plazo va aparte del oyente: al salir de la pausa vuelve a contar entero.
  useEffect(() => {
    if (estado !== "activa" || enPausa) return;
    const espera = window.setTimeout(() => {
      if (!huboLectura.current) setEstado("sin-brujula");
    }, ESPERA_MS);
    return () => window.clearTimeout(espera);
  }, [estado, enPausa]);

  return { estado, leyendo, disponible, encender, apagar };
}
