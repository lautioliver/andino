"use client";

import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { type Lang, useT } from "@/shared/i18n/lang";
import { buttonClass } from "@/shared/ui/Button";

/** En qué está el visor: esperando permisos, mostrando la cámara, o detenido por algo que la persona puede resolver. */
export type EstadoVisor = "pidiendo" | "listo" | "sin-movimiento" | "sin-brujula" | "camara-denegada" | "sin-camara";

/** Lo que quedó en la mira. Con `alAbrir`, tiene ficha y la píldora es un botón. */
export interface EnMira {
  clase: string;
  nombre: string;
  alAbrir?: () => void;
}

interface Props {
  estado: EstadoVisor;
  /** Hacia dónde apunta el teléfono, en corto: «Norte · 35°». */
  rumbo: string;
  enMira: EnMira | null;
  /** El teléfono apunta por debajo del horizonte: ahí no hay nada que nombrar. */
  haciaElSuelo: boolean;
  /** La ficha del objeto elegido, o `null` si está cerrada. */
  ficha: ReactNode;
  onCerrarFicha: () => void;
  /** Un toque corto sobre la imagen, en píxeles de la ventana. Arrastrar no hace nada. */
  onTocar: (x: number, y: number) => void;
  onSalir: () => void;
  onReintentar: () => void;
  /** El área que ocupan la cámara y el dibujo: SkyCanvas la mide. */
  escenaRef: RefObject<HTMLDivElement | null>;
  /** El `<video>` de la cámara y el lienzo del cielo. */
  children: ReactNode;
}

type Detenido = Exclude<EstadoVisor, "listo">;

const textos: Record<
  Lang,
  {
    nombre: string;
    salir: string;
    ayuda: string;
    aproximada: string;
    privada: string;
    buscar: string;
    suelo: string;
    abrirFicha: (nombre: string) => string;
    cerrarFicha: string;
    reintentar: string;
    volver: string;
    estados: Record<Detenido, { titulo: string; texto: string }>;
  }
> = {
  es: {
    nombre: "El cielo con la cámara",
    salir: "Salir de la cámara",
    ayuda: "Cómo funciona",
    aproximada: "Coincidencia aproximada: depende de la brújula y de la cámara de cada teléfono.",
    privada: "La imagen no se guarda ni se envía.",
    buscar: "Mové el teléfono para buscar",
    suelo: "Levantá el teléfono hacia el cielo",
    abrirFicha: (nombre) => `Abrir la ficha de ${nombre}`,
    cerrarFicha: "Cerrar la ficha",
    reintentar: "Reintentar",
    volver: "Volver al cielo",
    estados: {
      pidiendo: { titulo: "Pidiendo permisos…", texto: "Si el teléfono lo pide, permití el movimiento y la cámara." },
      "sin-movimiento": {
        titulo: "Falta el permiso de movimiento",
        texto: "Sin él no sabemos hacia dónde apunta el teléfono. Tocá «Reintentar» y aceptá el aviso; si no aparece, cerrá el navegador y volvé a abrir ANDINO.",
      },
      "sin-brujula": {
        titulo: "Este dispositivo no informa dónde está el norte",
        texto: "Sin brújula no podemos alinear el cielo con la cámara. Volvé al cielo y giralo con el dedo.",
      },
      "camara-denegada": {
        titulo: "Falta el permiso de la cámara",
        texto: "Permitila para este sitio en la configuración del navegador y tocá «Reintentar». La imagen no se guarda ni se envía.",
      },
      "sin-camara": {
        titulo: "No pudimos usar la cámara",
        texto: "Puede que la esté usando otra aplicación o que este dispositivo no tenga cámara de atrás. Cerrá la otra aplicación y tocá «Reintentar».",
      },
    },
  },
  en: {
    nombre: "The sky with the camera",
    salir: "Exit the camera",
    ayuda: "How it works",
    aproximada: "Approximate match: it depends on each phone's compass and camera.",
    privada: "The image is not saved or sent.",
    buscar: "Move your phone to look around",
    suelo: "Raise your phone to the sky",
    abrirFicha: (nombre) => `Open the card for ${nombre}`,
    cerrarFicha: "Close the card",
    reintentar: "Try again",
    volver: "Back to the sky",
    estados: {
      pidiendo: { titulo: "Asking for permissions…", texto: "If your phone asks, allow motion and camera access." },
      "sin-movimiento": {
        titulo: "Motion permission is missing",
        texto: "Without it we can't tell where your phone is pointing. Tap «Try again» and accept the prompt; if it doesn't show up, close the browser and open ANDINO again.",
      },
      "sin-brujula": {
        titulo: "This device doesn't report where north is",
        texto: "Without a compass we can't line the sky up with the camera. Go back to the sky and turn it with your finger.",
      },
      "camara-denegada": {
        titulo: "Camera permission is missing",
        texto: "Allow it for this site in your browser settings, then tap «Try again». The image is not saved or sent.",
      },
      "sin-camara": {
        titulo: "We couldn't use the camera",
        texto: "Another app may be using it, or this device may have no rear camera. Close the other app and tap «Try again».",
      },
    },
  },
};

/** Cuánto queda a la vista la ayuda al entrar. */
const AYUDA_MS = 7000;

// El vidrio oscuro del dock de la app (shared/ui/NavLinks.tsx): translúcido, borde fino y desenfoque.
const vidrio =
  "border border-white/15 bg-surface/70 text-text shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_14px_32px_-14px_rgb(0_0_0/0.7)] backdrop-blur-xl backdrop-saturate-150";
const redondo = `pointer-events-auto grid size-11 place-items-center rounded-full ${vidrio}`;

function Icono({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

/**
 * «Ver con la cámara»: la capa a pantalla completa. Arriba, salir y hacia dónde apunta el teléfono; en el
 * centro, la mira; abajo, qué quedó en ella. Nada más sobre la imagen: la advertencia va en una ayuda que
 * se va sola. Solo se sale con el botón, con Escape o con «atrás» (de eso se ocupa SkyCanvas).
 */
export function VisorCamara({ estado, rumbo, enMira, haciaElSuelo, ficha, onCerrarFicha, onTocar, onSalir, onReintentar, escenaRef, children }: Props) {
  const t = useT(textos);
  const raizRef = useRef<HTMLDivElement>(null);
  const salirRef = useRef<HTMLButtonElement>(null);
  const cerrarFichaRef = useRef<HTMLButtonElement>(null);
  const [ayuda, setAyuda] = useState(true);
  const listo = estado === "listo";
  const hayFicha = ficha !== null && ficha !== undefined && ficha !== false;
  const ayudaVisible = listo && ayuda && !hayFicha;

  // La página de atrás no se desplaza mientras el visor está abierto.
  useEffect(() => {
    const raiz = document.documentElement;
    const antes = raiz.style.overflow;
    raiz.style.overflow = "hidden";
    return () => {
      raiz.style.overflow = antes;
    };
  }, []);

  // La ayuda aparece al entrar y se va sola; vuelve con el botón de información.
  useEffect(() => {
    if (!ayudaVisible) return;
    const id = window.setTimeout(() => setAyuda(false), AYUDA_MS);
    return () => window.clearTimeout(id);
  }, [ayudaVisible]);

  // El foco queda dentro de la capa: al abrir, en «Salir»; con la ficha abierta, en su botón de cierre.
  useEffect(() => {
    (hayFicha ? cerrarFichaRef : salirRef).current?.focus({ preventScroll: true });
  }, [hayFicha]);

  // Escape cierra primero la ficha y después el visor. Tab no sale de la capa: la página de atrás no se ve.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (hayFicha) onCerrarFicha();
        else onSalir();
        return;
      }
      if (e.key !== "Tab") return;
      const focos = [...(raizRef.current?.querySelectorAll<HTMLElement>("button, a[href]") ?? [])];
      if (focos.length === 0) return;
      const actual = focos.indexOf(document.activeElement as HTMLElement);
      const siguiente = e.shiftKey ? (actual <= 0 ? focos.length - 1 : actual - 1) : actual === focos.length - 1 ? 0 : actual + 1;
      e.preventDefault();
      focos[siguiente].focus({ preventScroll: true });
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [hayFicha, onCerrarFicha, onSalir]);

  // Un toque corto elige; arrastrar el dedo no hace nada (ni apaga la brújula ni la cámara).
  const toque = useRef<{ x: number; y: number } | null>(null);
  function alSoltar(e: React.PointerEvent) {
    const inicio = toque.current;
    toque.current = null;
    if (!inicio || Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > 10) return;
    if (ayuda) setAyuda(false);
    if (listo) onTocar(e.clientX, e.clientY);
  }

  return (
    <div
      ref={raizRef}
      role="dialog"
      aria-modal="true"
      aria-label={t.nombre}
      className="oscuro fixed inset-0 z-[1000] h-dvh w-full touch-none overflow-hidden select-none"
    >
      <div
        ref={escenaRef}
        className="absolute inset-0"
        onPointerDown={(e) => {
          toque.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={alSoltar}
        onPointerCancel={() => {
          toque.current = null;
        }}
      >
        {children}
      </div>

      {listo ? (
        // La mira: discreta, con un borde oscuro para que se lea también sobre el cielo de día. Las marcas van
        // en diagonal para no pisar el nombre que el lienzo escribe a la derecha de cada objeto.
        <svg aria-hidden viewBox="0 0 48 48" className="pointer-events-none absolute top-1/2 left-1/2 size-12 -translate-x-1/2 -translate-y-1/2" fill="none" strokeLinecap="round">
          <g stroke="rgb(15 23 42 / 0.45)" strokeWidth="3.5">
            <circle cx="24" cy="24" r="14" />
            <path d="m35.5 12.5 4-4M12.5 12.5l-4-4M35.5 35.5l4 4M12.5 35.5l-4 4" />
          </g>
          <g stroke="rgb(248 250 252 / 0.92)" strokeWidth="1.5">
            <circle cx="24" cy="24" r="14" />
            <path d="m35.5 12.5 4-4M12.5 12.5l-4-4M35.5 35.5l4 4M12.5 35.5l-4 4" />
          </g>
          <circle cx="24" cy="24" r="1.25" fill="rgb(248 250 252 / 0.92)" />
        </svg>
      ) : (
        <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-noche/75 px-5 pt-[calc(4.5rem+env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div role={estado === "pidiendo" ? "status" : "alert"} className={`w-full max-w-sm rounded-hero px-6 py-7 text-center ${vidrio}`}>
            <h2 className="headline text-2xl text-balance">{t.estados[estado].titulo}</h2>
            <p className="mt-3 text-[15px] leading-6 text-text-muted">{t.estados[estado].texto}</p>
            {estado !== "pidiendo" ? (
              <div className="mt-6 flex flex-col gap-1">
                <button type="button" onClick={onReintentar} className={buttonClass("puna", "w-full")}>
                  {t.reintentar}
                </button>
                <button type="button" onClick={onSalir} className="min-h-12 rounded-control text-[15px] font-semibold text-text">
                  {t.volver}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Arriba: salir, hacia dónde apunta el teléfono y la ayuda. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))]">
        <button ref={salirRef} type="button" onClick={onSalir} aria-label={t.salir} className={redondo}>
          <Icono>
            <path d="M6 6l12 12M18 6 6 18" />
          </Icono>
        </button>
        {listo ? (
          <>
            <p className={`inline-flex h-11 max-w-full items-center justify-self-center rounded-full px-5 text-[15px] font-semibold whitespace-nowrap tabular-nums ${vidrio}`}>{rumbo}</p>
            <button type="button" onClick={() => setAyuda(!ayuda)} aria-label={t.ayuda} aria-expanded={ayudaVisible} className={redondo}>
              <Icono>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v6M12 7.5v.01" />
              </Icono>
            </button>
          </>
        ) : null}
      </div>

      {/* Abajo: qué quedó en la mira y, al entrar, la ayuda. */}
      {listo && !hayFicha ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))]">
          {ayudaVisible ? (
            <div role="note" onClick={() => setAyuda(false)} className={`pointer-events-auto max-w-[21rem] rounded-card px-4 py-3 text-center text-sm leading-5 ${vidrio}`}>
              <p>{t.aproximada}</p>
              <p className="mt-1 text-text-muted">{t.privada}</p>
            </div>
          ) : null}
          <div aria-live="polite" className="flex max-w-full justify-center">
            {enMira?.alAbrir ? (
              <button
                type="button"
                onClick={() => {
                  setAyuda(false);
                  enMira.alAbrir?.();
                }}
                aria-label={`${enMira.clase}: ${enMira.nombre}. ${t.abrirFicha(enMira.nombre)}`}
                className={`pointer-events-auto flex min-h-14 max-w-full items-center gap-4 rounded-full py-2 pr-2.5 pl-6 text-left ${vidrio}`}
              >
                <Rotulo clase={enMira.clase} nombre={enMira.nombre} />
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-violeta-ink/15 text-violeta-ink">
                  <Icono>
                    <path d="m6 15 6-6 6 6" />
                  </Icono>
                </span>
              </button>
            ) : enMira ? (
              <p className={`flex min-h-14 max-w-full items-center rounded-full px-6 py-2 ${vidrio}`}>
                <Rotulo clase={enMira.clase} nombre={enMira.nombre} />
              </p>
            ) : (
              <p className={`flex min-h-11 items-center rounded-full px-5 text-sm text-text-muted ${vidrio}`}>{haciaElSuelo ? t.suelo : t.buscar}</p>
            )}
          </div>
        </div>
      ) : null}

      {/* La ficha del objeto elegido: una tarjeta que flota abajo y deja ver el cielo arriba. */}
      {listo && hayFicha ? (
        <div className="absolute inset-x-0 bottom-0 pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))]">
          <div className="relative mx-auto max-w-md">
            <div className="max-h-[62dvh] touch-pan-y overflow-y-auto overscroll-contain rounded-card shadow-[0_18px_40px_-12px_rgb(0_0_0/0.8)] select-text">{ficha}</div>
            <button ref={cerrarFichaRef} type="button" onClick={onCerrarFicha} aria-label={t.cerrarFicha} className="absolute top-2 right-2 grid size-11 place-items-center rounded-full text-text-muted hover:text-text">
              <Icono>
                <path d="M6 6l12 12M18 6 6 18" />
              </Icono>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Rotulo({ clase, nombre }: EnMira) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="eyebrow text-violeta-ink">{clase}</span>
      <span className="truncate font-display text-lg leading-6 font-bold tracking-tight">{nombre}</span>
    </span>
  );
}
