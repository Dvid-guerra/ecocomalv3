import "server-only";
import { APICallError, defaultSettingsMiddleware, wrapLanguageModel } from "ai";
import { google, type GoogleLanguageModelOptions } from "@ai-sdk/google";

/**
 * Único lugar donde se elige el proveedor y los modelos de IA.
 * Para cambiar a otro proveedor: instala su paquete (@ai-sdk/anthropic, @ai-sdk/openai…)
 * y reemplaza las llamadas a `google(...)`.
 */

type Modelo = ReturnType<typeof wrapLanguageModel>;
type NivelRazonamiento = NonNullable<NonNullable<GoogleLanguageModelOptions["thinkingConfig"]>["thinkingLevel"]>;

const NIVELES: readonly NivelRazonamiento[] = ["minimal", "low", "medium", "high"];
const nivelEnv = process.env.AGENTE_RAZONAMIENTO as NivelRazonamiento;

/**
 * Principal y respaldo deben ser de la MISMA familia: Gemini 3+ firma las llamadas a
 * herramientas y un modelo 2.5 rechaza ese historial a mitad de una respuesta.
 * Se usa 2.5 por estabilidad (menos saturación) y porque no requiere razonamiento.
 */
export const MODELO_AGENTE = process.env.AGENTE_MODELO || "gemini-2.5-flash";
export const MODELO_RESPALDO = process.env.AGENTE_MODELO_RESPALDO || "gemini-2.5-flash-lite";

/**
 * Solo aplica a Gemini 3+. "low" es el nivel más bajo que aceptan todos
 * ("minimal" no lo soportan algunos). Gemini 2.5 corre sin razonamiento.
 */
const RAZONAMIENTO: NivelRazonamiento = NIVELES.includes(nivelEnv) ? nivelEnv : "low";

/** Gemini 2.5 usa thinkingBudget (0 = sin razonamiento); Gemini 3+ usa thinkingLevel. */
function opcionesRazonamiento(modelId: string): GoogleLanguageModelOptions {
  return modelId.startsWith("gemini-2.")
    ? { thinkingConfig: { thinkingBudget: 0, includeThoughts: false } }
    : { thinkingConfig: { thinkingLevel: RAZONAMIENTO, includeThoughts: false } };
}

function conOpciones(modelId: string): Modelo {
  return wrapLanguageModel({
    model: google(modelId),
    middleware: defaultSettingsMiddleware({ settings: { providerOptions: { google: opcionesRazonamiento(modelId) } } }),
  });
}

/**
 * Errores en los que conviene intentar con otro modelo: saturación, límite, falla del
 * servidor, o que el modelo no acepte la configuración de razonamiento.
 */
function esErrorTemporal(error: unknown) {
  if (!APICallError.isInstance(error)) return false;
  if (error.isRetryable || error.statusCode === 429 || (error.statusCode ?? 0) >= 500) return true;
  return error.statusCode === 400 && /thinking/i.test(error.message);
}

/** Usa `principal` y, si responde con un error temporal, reintenta con cada respaldo en orden. */
function conRespaldo(principal: Modelo, respaldos: { id: string; modelo: Modelo }[]): Modelo {
  async function intentar<T>(primero: () => PromiseLike<T>, siguiente: (m: Modelo) => PromiseLike<T>) {
    try {
      return await primero();
    } catch (error) {
      if (!esErrorTemporal(error)) throw error;
      let ultimo = error;
      for (const r of respaldos) {
        console.warn(`[agente] ${principal.modelId} falló (${(error as Error).message.slice(0, 80)}); usando respaldo ${r.id}`);
        try {
          return await siguiente(r.modelo);
        } catch (e) {
          if (!esErrorTemporal(e)) throw e;
          ultimo = e;
        }
      }
      throw ultimo;
    }
  }

  return wrapLanguageModel({
    model: principal,
    middleware: {
      specificationVersion: "v4",
      wrapGenerate: ({ doGenerate, params }) => intentar(doGenerate, m => m.doGenerate(params)),
      wrapStream: ({ doStream, params }) => intentar(doStream, m => m.doStream(params)),
    },
  });
}

let instancia: Modelo | null = null;

export function modeloAgente(): Modelo {
  instancia ??= conRespaldo(conOpciones(MODELO_AGENTE), [
    { id: MODELO_RESPALDO, modelo: conOpciones(MODELO_RESPALDO) },
  ]);
  return instancia;
}

export function iaConfigurada() {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
}
