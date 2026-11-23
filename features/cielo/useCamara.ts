"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { esCamaraDeAtras, type FalloDeCamara, falloDeCamara, type Tamanio } from "./camaraTrasera";

export type EstadoCamara = "apagada" | "pidiendo" | "activa" | FalloDeCamara;

const sinSuscripcion = () => () => {};

/**
 * «Cámara»: la cámara de atrás como fondo del cielo mientras se apunta (`permitida`).
 * La imagen solo se muestra en el `<video>` de `videoRef`: no se guarda ni se envía.
 * Se apaga sola (stop de cada pista) al dejar de apuntar, al salir de la página, al desmontar y con la
 * pestaña oculta; para volver a verla hay que tocar «Cámara» otra vez. `encender` va en un toque.
 */
export function useCamara(permitida: boolean) {
  const [estado, setEstado] = useState<EstadoCamara>("apagada");
  /** Tamaño real del video, para calcular qué campo visual queda a la vista. */
  const [imagen, setImagen] = useState<Tamanio | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Cada pedido lleva su número: si mientras el teléfono pregunta por el permiso se apagó, el stream que llega se descarta.
  const pedido = useRef(0);

  // En el servidor no hay cámara: se decide al hidratar. Sin HTTPS, `mediaDevices` no existe.
  const disponible = useSyncExternalStore(
    sinSuscripcion,
    () => typeof navigator.mediaDevices?.getUserMedia === "function",
    () => false,
  );

  const apagar = useCallback(() => {
    pedido.current++;
    streamRef.current?.getTracks().forEach((pista) => pista.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setImagen(null);
    setEstado("apagada");
  }, []);

  const encender = useCallback(async () => {
    if (!disponible || !permitida) return;
    const mio = ++pedido.current;
    setEstado("pidiendo");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      const soltar = () => stream.getTracks().forEach((pista) => pista.stop());
      if (mio !== pedido.current) return soltar();
      const [pista] = stream.getVideoTracks();
      if (!pista || !esCamaraDeAtras(pista.getSettings().facingMode)) {
        soltar();
        setEstado("sin-camara");
        return;
      }
      streamRef.current = stream;
      // Si el sistema corta la cámara (otra app, permiso revocado), se vuelve al cielo dibujado.
      pista.addEventListener("ended", () => {
        if (streamRef.current === stream) apagar();
      });
      setEstado("activa");
    } catch (error) {
      if (mio === pedido.current) setEstado(falloDeCamara(error));
    }
  }, [disponible, permitida, apagar]);

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
      if (document.hidden) apagar();
    };
    document.addEventListener("visibilitychange", alOcultar);
    window.addEventListener("pagehide", apagar);
    return () => {
      document.removeEventListener("visibilitychange", alOcultar);
      window.removeEventListener("pagehide", apagar);
      apagar();
    };
  }, [permitida, apagar]);

  const alMedir = useCallback((e: { currentTarget: HTMLVideoElement }) => {
    const { videoWidth: ancho, videoHeight: alto } = e.currentTarget;
    setImagen(ancho > 0 && alto > 0 ? { ancho, alto } : null);
  }, []);

  return { estado, disponible, imagen, videoRef, encender, apagar, alMedir };
}
