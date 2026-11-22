// Cliente del reconocimiento: achica la foto en el navegador y la manda a /api/pacha/analyze.
import type { PachaResult } from "@/shared/types";

const LADO_MAX = 1280;
const TIMEOUT_MS = 30_000;

/** JPEG de hasta 1280 px por lado: alcanza para reconocer y queda lejos del límite de 4,5 MB de Vercel. */
async function reducir(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file); // falla con HEIC en navegadores que no lo decodifican
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.82),
  );
}

export type Reconocimiento =
  | { estado: "analizando" }
  | { estado: "listo"; result: PachaResult }
  | { estado: "error"; mensaje: string };

export async function reconocer(file: File, signal: AbortSignal): Promise<Reconocimiento> {
  let imagen: Blob;
  try {
    imagen = await reducir(file);
  } catch {
    return { estado: "error", mensaje: "No pudimos leer esa foto en este navegador." };
  }

  const form = new FormData();
  form.append("image", imagen, "foto.jpg");
  try {
    const res = await fetch("/api/pacha/analyze", {
      method: "POST",
      body: form,
      signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) return { estado: "error", mensaje: body?.error ?? "El reconocimiento no está disponible ahora." };
    return { estado: "listo", result: body as PachaResult };
  } catch (e) {
    if (signal.aborted) throw e;
    const timeout = e instanceof DOMException && e.name === "TimeoutError";
    return {
      estado: "error",
      mensaje: timeout ? "El reconocimiento tardó demasiado." : "Sin conexión con el reconocimiento.",
    };
  }
}
