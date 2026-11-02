import { APICallError } from "ai";

/** Traduce errores del proveedor de IA a mensajes útiles para el usuario. */
export function describirErrorIA(error: unknown): string {
  const status = APICallError.isInstance(error) ? error.statusCode : undefined;
  const crudo = error instanceof Error ? error.message : String(error);
  const texto = crudo.toLowerCase();

  let mensaje = "El asistente no pudo responder.";
  if (texto.includes("api key") || texto.includes("api_key") || status === 401 || status === 403) {
    mensaje = "La API key de Gemini no es válida o no tiene permisos. Revisa GOOGLE_GENERATIVE_AI_API_KEY.";
  } else if (status === 429 || texto.includes("quota") || texto.includes("resource_exhausted")) {
    mensaje = "Se alcanzó el límite de uso de Gemini. Espera un momento o revisa la cuota en Google AI Studio.";
  } else if (status === 404 || texto.includes("not found")) {
    mensaje = "El modelo configurado no existe o no está disponible. Revisa AGENTE_MODELO.";
  } else if (texto.includes("thinking")) {
    mensaje = "El modelo no acepta ese nivel de razonamiento. Revisa AGENTE_RAZONAMIENTO.";
  } else if (status && status >= 500) {
    mensaje = "Gemini tuvo un problema temporal. Intenta de nuevo.";
  }

  // En desarrollo se agrega el detalle técnico para depurar.
  return process.env.NODE_ENV === "development" ? `${mensaje}\n\nDetalle: ${crudo.slice(0, 400)}` : mensaje;
}
