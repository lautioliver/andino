// Traducción común de errores del modelo a respuestas HTTP para las rutas de Pacha.
import { APICallError } from "ai";

export function errorJSON(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

export function errorDeIA(ruta: string, e: unknown) {
  const nombre = e instanceof Error ? e.name : "";
  if (nombre === "AbortError" || nombre === "TimeoutError" || /timeout/i.test(String(e))) {
    return errorJSON(504, "La IA tardó demasiado en responder.");
  }
  console.error(`[${ruta}]`, APICallError.isInstance(e) ? `${e.statusCode} ${e.message}` : e);
  return errorJSON(502, "La IA no está disponible ahora.");
}
