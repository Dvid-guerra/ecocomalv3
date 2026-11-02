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

/** Modelo principal (Gemini 3+). Acepta thinkingLevel. */
export const MODELO_AGENTE = process.env.AGENTE_MODELO || "gemini-flash-latest";
/** Respaldo estable (Gemini 2.5) para cuando el principal está saturado. */
export const MODELO_RESPALDO = process.env.AGENTE_MODELO_RESPALDO || "gemini-2.5-flash";

/**
 * Cuánto "piensa" el modelo principal. Para consultas de inventario basta "minimal":
 * responde más rápido y cuesta menos.
 */
const RAZONAMIENTO: NivelRazonamiento = NIVELES.includes(nivelEnv) ? nivelEnv : "minimal";

function conOpciones(modelId: string, google_: GoogleLanguageModelOptions): Modelo {
  return wrapLanguageModel({
    model: google(modelId),
    middleware: defaultSettingsMiddleware({ settings: { providerOptions: { google: google_ } } }),
  });
}

/** Errores en los que conviene intentar con otro modelo: saturación, límite o falla del servidor. */
function esErrorTemporal(error: unknown) {
  if (!APICallError.isInstance(error)) return false;
  return error.isRetryable || error.statusCode === 429 || (error.statusCode ?? 0) >= 500;
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
        console.warn(`[agente] ${principal.modelId} no disponible; usando respaldo ${r.id}`);
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
  instancia ??= conRespaldo(
    conOpciones(MODELO_AGENTE, { thinkingConfig: { thinkingLevel: RAZONAMIENTO, includeThoughts: false } }),
    // Gemini 2.5 usa thinkingBudget (0 = sin razonamiento) en lugar de thinkingLevel.
    [{ id: MODELO_RESPALDO, modelo: conOpciones(MODELO_RESPALDO, { thinkingConfig: { thinkingBudget: 0, includeThoughts: false } }) }],
  );
  return instancia;
}

export function iaConfigurada() {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
}
