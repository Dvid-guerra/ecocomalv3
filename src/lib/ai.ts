import "server-only";
import { google } from "@ai-sdk/google";

/**
 * Único lugar donde se elige el proveedor y modelo de IA.
 * Para cambiar a otro proveedor: instala su paquete (@ai-sdk/anthropic, @ai-sdk/openai…)
 * y reemplaza `google(...)` por el nuevo proveedor.
 */
export const MODELO_AGENTE = process.env.AGENTE_MODELO || "gemini-flash-latest";

export function modeloAgente() {
  return google(MODELO_AGENTE);
}

export function iaConfigurada() {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
}
