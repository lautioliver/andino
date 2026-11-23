"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { esCamaraDeAtras, type FalloDeCamara, falloDeCamara, type Tamanio } from "./camaraTrasera";

export type EstadoCamara = "apagada" | "pidiendo" | "activa" | FalloDeCamara;

const sinSuscripcion = () => () => {};

/**
 * «Ver con la cámara»: la cámara de atrás como fondo del cielo mientras el visor está abierto (`permitida`).
 * La imagen solo se muestra en el `<video>` de `videoRef`: no se guarda ni se envía.
 * Se apaga sola (stop de cada pista) cuando deja de estar permitida, al salir de la página, al desmontar y
 * con la pestaña oculta. Si se apaga sin que nadie lo pida (pestaña oculta, o el sistema la corta), avisa
 * con `alCortarse`. `encender` va en un toque.
 */
export function useCamara(permitida: boolean, alCortarse?: () => void) {
  const [estado, setEstado] = useState<EstadoCamara>("apagada");
  /** Tamaño real del video, para calcular qué campo visual queda a la vista. */
  const [imagen, setImagen] = useState<Tamanio | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Cada pedido lleva su número: si mientras el teléfono pregunta por el permiso se apagó, el stream que llega se descarta.
  const pedido = useRef(0);
  const pidiendo = useRef(false);
  const alCortarseRef = useRef(alCortarse);
  useEffect(() => {
    alCortarseRef.current = alCortarse;
  }, [alCortarse]);

  // En el servidor no hay cámara: se decide al hidratar. Sin HTTPS, `mediaDevices` no existe.
  const disponible = useSyncExternalStore(
    sinSuscripcion,
    () => typeof navigator.mediaDevices?.getUserMedia === "function",
    () => false,
  );

  const apagar = useCallback(() => {
    pedido.current++;
    pidiendo.current = false;
    streamRef.current?.getTracks().forEach((pista) => pista.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setImagen(null);
    setEstado("apagada");
  }, []);

  /** La cámara se apaga sin que nadie lo pida: si estaba encendida o por encenderse, se avisa. */
  const cortar = useCallback(() => {
    const habia = streamRef.current !== null || pidiendo.current;
    apagar();
    if (habia) alCortarseRef.current?.();
  }, [apagar]);

  // No mira `permitida`: se llama en el mismo toque que abre el visor, antes de que React lo vuelva a dibujar.
  // Si el visor se cierra mientras el teléfono pregunta, `apagar` descarta el stream que llegue.
  const encender = useCallback(async () => {
    if (!disponible) return;
    const mio = ++pedido.current;
    pidiendo.current = true;
    setEstado("pidiendo");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      const soltar = () => stream.getTracks().forEach((pista) => pista.stop());
      if (mio !== pedido.current) return soltar();
      pidiendo.current = false;
      const [pista] = stream.getVideoTracks();
      if (!pista || !esCamaraDeAtras(pista.getSettings().facingMode)) {
        soltar();
        setEstado("sin-camara");
        return;
      }
      streamRef.current = stream;
      // Si el sistema corta la cámara (otra app, permiso revocado), se vuelve al cielo dibujado.
      // `stop()` no dispara «ended»: esto solo corre cuando la corta otro.
      pista.addEventListener("ended", () => {
        if (streamRef.current === stream) cortar();
      });
      setEstado("activa");
    } catch (error) {
      if (mio !== pedido.current) return;
      pidiendo.current = false;
      setEstado(falloDeCamara(error));
    }
  }, [disponible, cortar]);

  // El video se conecta cuando ya está a la vista: oculto, en iPhone podría no arrancar.
  useEffect(() => {
    const video = videoRef.current;
    if (estado !== "activa" || !video || !streamRef.current) return;
    video.srcObject = streamRef.current;
    video.play().catch(() => {});
  }, [estado]);

  // Con Cache Components, al navegar la página queda oculta sin desmontarse: esta limpieza corre igual
  // y deja el estado en «apagada», así no se vuelve a encender sola al regresar.
  useLayoutEffect(() => {
    if (!permitida) return;
    const alOcultar = () => {
      if (document.hidden) cortar();
    };
    document.addEventListener("visibilitychange", alOcultar);
    window.addEventListener("pagehide", apagar);
    return () => {
      document.removeEventListener("visibilitychange", alOcultar);
      window.removeEventListener("pagehide", apagar);
      apagar();
    };
  }, [permitida, apagar, cortar]);

  const alMedir = useCallback((e: { currentTarget: HTMLVideoElement }) => {
    const { videoWidth: ancho, videoHeight: alto } = e.currentTarget;
    setImagen(ancho > 0 && alto > 0 ? { ancho, alto } : null);
  }, []);

  return { estado, disponible, imagen, videoRef, encender, apagar, alMedir };
}
