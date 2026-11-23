"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/shared/i18n/lang";
import type { PlaceId } from "@/shared/types";
import { estadoDelCielo, type EstadoDelCielo, type NubesHorarias } from "./cuando";

/** `sin`: el pronóstico no llegó (sin conexión, Open-Meteo caído). La app sigue, eligiendo solo por la oscuridad. */
export type Pronostico = { estado: "cargando" | "sin"; nubes: null } | { estado: "listo"; nubes: NubesHorarias };

const ESPERA_MS = 8_000;

/** El pronóstico de nubes del lugar, pedido a /api/nubes una vez por lugar. */
export function useNubes(placeId: PlaceId): Pronostico {
  // Se guarda para qué lugar es la respuesta: al cambiar de lugar vuelve a «cargando» sin esperar al efecto.
  const [respuesta, setRespuesta] = useState<{ placeId: PlaceId; nubes: NubesHorarias | null } | null>(null);

  useEffect(() => {
    let vigente = true;
    const ctrl = new AbortController();
    const espera = setTimeout(() => ctrl.abort(), ESPERA_MS);
    fetch(`/api/nubes?placeId=${placeId}`, { signal: ctrl.signal })
      .then(async (r) => {
        const body: unknown = r.ok ? await r.json() : null;
        const nubes = body && typeof body === "object" && "porHora" in body ? (body as NubesHorarias) : null;
        if (vigente) setRespuesta({ placeId, nubes });
      })
      .catch(() => {
        if (vigente) setRespuesta({ placeId, nubes: null });
      })
      .finally(() => clearTimeout(espera));
    return () => {
      vigente = false;
      clearTimeout(espera);
      ctrl.abort();
    };
  }, [placeId]);

  if (respuesta?.placeId !== placeId) return { estado: "cargando", nubes: null };
  return respuesta.nubes ? { estado: "listo", nubes: respuesta.nubes } : { estado: "sin", nubes: null };
}

const PALABRAS: Record<EstadoDelCielo, { es: string; en: string }> = {
  despejado: { es: "despejado", en: "clear" },
  "algo-nublado": { es: "algo nublado", en: "partly cloudy" },
  nublado: { es: "nublado", en: "cloudy" },
};

/** La nubosidad (%) en palabras: «despejado», «algo nublado» o «nublado». */
export function palabraDeNubes(nubes: number, en: boolean): string {
  return PALABRAS[estadoDelCielo(nubes)][en ? "en" : "es"];
}

/** «85 %» en español (con espacio que no corta la línea) y «85%» en inglés. */
export function porciento(n: number, en: boolean): string {
  return en ? `${n}%` : `${n}\u00a0%`;
}

/** Atribución que pide Open-Meteo (CC BY 4.0). */
export function CreditoOpenMeteo({ className = "" }: { className?: string }) {
  const en = useLang() === "en";
  return (
    <a
      href="https://open-meteo.com/"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-11 items-center text-sm text-text-muted underline decoration-border underline-offset-4 hover:decoration-violeta ${className}`}
    >
      {en ? "Forecast: Open-Meteo" : "Pronóstico: Open-Meteo"}
    </a>
  );
}
