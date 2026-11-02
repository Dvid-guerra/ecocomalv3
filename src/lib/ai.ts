import "server-only";
import { google, type GoogleLanguageModelOptions } from "@ai-sdk/google";

/**
 * Único lugar donde se elige el proveedor y modelo de IA.
 * Para cambiar a otro proveedor: instala su paquete (@ai-sdk/anthropic, @ai-sdk/openai…)
 * y reemplaza `google(...)` y `opcionesProveedor()`.
 */
export const MODELO_AGENTE = process.env.AGENTE_MODELO || "gemini-flash-latest";

type NivelRazonamiento = NonNullable<NonNullable<GoogleLanguageModelOptions["thinkingConfig"]>["thinkingLevel"]>;
const NIVELES: readonly NivelRazonamiento[] = ["minimal", "low", "medium", "high"];

/**
 * Cuánto "piensa" el modelo antes de responder. Para consultar inventario basta con
 * "minimal": responde mucho más rápido y cuesta menos. Se puede subir con AGENTE_RAZONAMIENTO.
 */
const RAZONAMIENTO: NivelRazonamiento = NIVELES.includes(process.env.AGENTE_RAZONAMIENTO as NivelRazonamiento)
  ? (process.env.AGENTE_RAZONAMIENTO as NivelRazonamiento)
  : "minimal";

export function modeloAgente() {
  return google(MODELO_AGENTE);
}

export function opcionesProveedor() {
  return {
    google: {
      thinkingConfig: { thinkingLevel: RAZONAMIENTO, includeThoughts: false },
    } satisfies GoogleLanguageModelOptions,
  };
}

export function iaConfigurada() {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
}
