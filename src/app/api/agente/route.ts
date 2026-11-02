import { NextResponse, type NextRequest } from "next/server";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  validateUIMessages,
  type UIMessage,
} from "ai";
import { autenticar, ErrorApi, ROLES_OPERATIVOS, verificarMismoOrigen } from "@/lib/api-auth";
import { iaConfigurada, MODELO_AGENTE, modeloAgente } from "@/lib/ai";
import { toolsInventario } from "@/features/agente/tools-inventario";
import { instruccionesInventario } from "@/features/agente/instrucciones";
import { describirErrorIA } from "@/features/agente/errores";

export const maxDuration = 60;

const MAX_BODY_BYTES = 200 * 1024;
const MAX_MENSAJES = 20;

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    verificarMismoOrigen(request);
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
      return jsonError("La conversación es demasiado larga. Inicia una nueva.", 413);
    }

    const usuario = await autenticar(request, ROLES_OPERATIVOS);
    if (!iaConfigurada()) {
      return jsonError("El asistente no está configurado (falta GOOGLE_GENERATIVE_AI_API_KEY).", 503);
    }

    const body = (await request.json().catch(() => null)) as { messages?: unknown } | null;
    if (!body || !Array.isArray(body.messages)) return jsonError("Solicitud inválida.", 400);

    const mensajes = await validateUIMessages<UIMessage>({ messages: body.messages });
    // Solo los últimos mensajes, empezando por uno del usuario, para acotar costo y contexto.
    let recientes = mensajes.slice(-MAX_MENSAJES);
    const primeroUsuario = recientes.findIndex(m => m.role === "user");
    recientes = primeroUsuario >= 0 ? recientes.slice(primeroUsuario) : recientes;

    const inicio = Date.now();
    let pasos = 0;
    const result = streamText({
      model: modeloAgente(),
      // El respaldo de modelo ya reintenta; un solo reintento extra evita esperas largas.
      maxRetries: 1,
      instructions: instruccionesInventario(usuario),
      messages: await convertToModelMessages(recientes),
      tools: toolsInventario,
      stopWhen: isStepCount(6),
      onStepFinish: () => { pasos++; },
      onFinish: ({ totalUsage }) => {
        console.info(
          `[agente] ${MODELO_AGENTE} · ${((Date.now() - inicio) / 1000).toFixed(1)}s · ${pasos} pasos · ` +
          `${totalUsage.inputTokens ?? "?"} tokens entrada / ${totalUsage.outputTokens ?? "?"} salida`,
        );
      },
      onError: ({ error }) => console.error("[agente] Error del modelo:", error),
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        onError: error => {
          console.error("[agente] Error en la respuesta:", error);
          return describirErrorIA(error);
        },
      }),
    });
  } catch (error) {
    if (error instanceof ErrorApi) return jsonError(error.message, error.status);
    console.error("[agente] Error:", error);
    return jsonError("Ocurrió un error en el asistente.", 500);
  }
}
