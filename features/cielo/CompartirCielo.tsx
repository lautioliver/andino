"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLang } from "@/shared/i18n/lang";
import { leyendaPostal, type LugarPostal, nombreArchivoPostal, textoPostal } from "./postal";
import { armarPostal, type CieloDeLaPostal, familiaDeTitulos } from "./postalLienzo";

const textos = {
  es: {
    boton: "Compartir este cielo",
    armando: "Armando la imagen…",
    lista: "Postal lista.",
    compartida: "Postal lista y compartida.",
    descargada: "Postal lista: la imagen se descargó.",
    pendiente: "La postal está lista. Tocá «Compartir este cielo» otra vez para enviarla.",
    error: "No se pudo armar la postal. Probá de nuevo.",
  },
  en: {
    boton: "Share this sky",
    armando: "Making the image…",
    lista: "Postcard ready.",
    compartida: "Postcard ready and shared.",
    descargada: "Postcard ready: the image was downloaded.",
    pendiente: "The postcard is ready. Tap «Share this sky» again to send it.",
    error: "The postcard couldn't be made. Try again.",
  },
};

/** `lista`: la imagen ya está y el menú de compartir del teléfono está abierto. `pendiente`: está, y espera otro toque. */
type Estado = "reposo" | "armando" | "lista" | "compartida" | "descargada" | "pendiente" | "error";

interface Postal {
  /** De qué cielo es: si la pantalla cambió, una postal que quedó esperando ya no sirve. */
  clave: string;
  archivo: File;
  titulo: string;
  texto: string;
}

function descargar(archivo: File) {
  const url = URL.createObjectURL(archivo);
  const a = document.createElement("a");
  a.href = url;
  a.download = archivo.name;
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  // El navegador necesita la URL un momento más para empezar la descarga.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const nombreDelError = (e: unknown) => (typeof e === "object" && e !== null && "name" in e ? String(e.name) : "");

/**
 * «Compartir este cielo»: arma la postal del cielo que se está viendo (lugar, instante y dirección de la
 * mirada) y abre el menú de compartir del teléfono con la imagen y el enlace a ese cielo. Donde el navegador
 * no comparte archivos, la descarga. Todo pasa en el teléfono: no pide datos ni usa la cámara.
 */
export function CompartirCielo({ cielo, iso, lugar }: { cielo: CieloDeLaPostal; iso: string; lugar: LugarPostal }) {
  const lang = useLang();
  const t = textos[lang];
  const [estado, setEstado] = useState<Estado>("reposo");
  const ocupado = useRef(false);
  /** Una postal ya armada que el navegador no dejó compartir sin un toque nuevo. */
  const pendiente = useRef<Postal | null>(null);
  /** Cambia cada vez que la pantalla se oculta: una postal que se estaba armando ya no se entrega. */
  const turno = useRef(0);

  // La tipografía se pide al mostrar el botón: cuando lo toquen, ya está.
  useEffect(() => {
    void familiaDeTitulos();
  }, []);

  // Con Cache Components, al navegar la página queda oculta sin desmontarse: al volver, el botón arranca de cero.
  useLayoutEffect(
    () => () => {
      turno.current++;
      pendiente.current = null;
      setEstado("reposo");
    },
    [],
  );

  const clave = [lugar.nombre, lugar.placeId, iso, lang, cielo.az.toFixed(1), cielo.alt.toFixed(1), cielo.yacana].join("|");

  /** `conToque`: se llama dentro del toque, sin esperas antes; si aun así el navegador se niega, no es por eso. */
  async function entregar(postal: Postal, conToque: boolean) {
    const datos = { files: [postal.archivo], title: postal.titulo, text: postal.texto };
    if (typeof navigator.share !== "function" || !navigator.canShare?.({ files: datos.files })) {
      descargar(postal.archivo);
      setEstado("descargada");
      return;
    }
    try {
      setEstado("lista");
      await navigator.share(datos);
      setEstado("compartida");
    } catch (e) {
      const nombre = nombreDelError(e);
      // Cerrar el menú sin elegir nada no es un error.
      if (nombre === "AbortError") setEstado("reposo");
      // Armar la imagen tardó más de lo que el navegador espera después de un toque: queda lista para el próximo.
      else if (nombre === "NotAllowedError" && !conToque) {
        pendiente.current = postal;
        setEstado("pendiente");
      } else {
        descargar(postal.archivo);
        setEstado("descargada");
      }
    }
  }

  async function compartir() {
    if (ocupado.current) return;
    ocupado.current = true;
    const esteTurno = turno.current;
    try {
      const lista = pendiente.current;
      pendiente.current = null;
      if (lista?.clave === clave) {
        await entregar(lista, true);
        return;
      }
      setEstado("armando");
      const archivo = await armarPostal({ cielo, leyenda: leyendaPostal(lugar, iso, lang), lang, nombreArchivo: nombreArchivoPostal(lugar, iso) });
      // Si mientras tanto la persona se fue de la pantalla, no se le abre un menú de compartir en otra.
      if (esteTurno !== turno.current) return;
      await entregar({ clave, archivo, ...textoPostal(lugar, iso, lang, window.location.origin) }, false);
    } catch {
      if (esteTurno === turno.current) setEstado("error");
    } finally {
      ocupado.current = false;
    }
  }

  const mensaje = estado === "reposo" ? "" : t[estado];
  return (
    <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 md:px-6">
      <button
        type="button"
        onClick={compartir}
        aria-disabled={estado === "armando"}
        aria-busy={estado === "armando"}
        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-control border border-border bg-surface px-3 text-sm font-semibold text-violeta-ink shadow-sm transition-colors hover:bg-surface-subtle aria-disabled:opacity-60"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
          <path d="m16 6-4-4-4 4" />
          <path d="M12 2v13" />
        </svg>
        {t.boton}
      </button>
      <p role="status" className={`min-w-0 text-sm ${estado === "error" ? "text-puna-ink" : "text-text-muted"}`}>
        {mensaje}
      </p>
    </div>
  );
}
