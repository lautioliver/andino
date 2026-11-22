import { analizarFoto } from "@/features/pacha/analizar";
import { errorDeIA, errorJSON as error } from "@/features/pacha/errorDeIA";

export const maxDuration = 30;

// El cliente reduce la foto antes de mandarla; esto es solo la guarda del servidor.
const MAX_BYTES = 4 * 1024 * 1024;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error(400, "No llegó ninguna imagen.");
  }
  const archivo = form.get("image");
  if (!(archivo instanceof File)) return error(400, "No llegó ninguna imagen.");
  if (!TIPOS.includes(archivo.type)) return error(415, "Formato no compatible. Probá con JPG, PNG o WebP.");
  if (archivo.size === 0 || archivo.size > MAX_BYTES) return error(413, "La imagen es demasiado grande.");

  try {
    const imagen = new Uint8Array(await archivo.arrayBuffer());
    const lang = form.get("lang") === "en" ? "en" : "es";
    const result = await analizarFoto(imagen, archivo.type, lang, request.signal);
    return Response.json(result);
  } catch (e) {
    return errorDeIA("pacha/analyze", e);
  }
}
