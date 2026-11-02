"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import { Bot, Loader2, Mic, MicOff, RotateCcw, Send, Sparkles, Square, X } from "lucide-react";
import { useDictado } from "./useDictado";

const ETIQUETA_TOOL: Record<string, string> = {
  consultar_stock: "Consultando stock",
  materiales_bajo_minimo: "Revisando materiales bajo mínimo",
  capacidad_produccion: "Calculando capacidad de producción",
  faltantes_para_producir: "Calculando faltantes",
  historial_movimientos: "Revisando historial",
  stock_estufas: "Revisando estufas en bodega",
};

const SUGERENCIAS = [
  "¿Qué materiales hay que comprar?",
  "¿Cuántas estufas puedo fabricar con lo que hay?",
  "¿Qué me falta para hacer 10 EcoPlancha Superior?",
  "¿Qué salidas hubo esta semana?",
];

export default function AsistenteInventario() {
  const [abierto, setAbierto] = useState(false);
  const [input, setInput] = useState("");
  const finRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error, stop, setMessages, clearError } = useChat({
    transport: new DefaultChatTransport({ api: "/api/agente" }),
  });

  const ocupado = status === "submitted" || status === "streaming";
  const ultimo = messages.at(-1);
  const ultimoTieneTexto = ultimo?.role === "assistant" && ultimo.parts.some(p => p.type === "text" && p.text.length > 0);

  const enviar = useCallback((texto: string) => {
    const limpio = texto.trim();
    if (!limpio || ocupado) return;
    sendMessage({ text: limpio });
    setInput("");
  }, [ocupado, sendMessage]);

  const dictado = useDictado(useCallback((texto: string, final: boolean) => {
    setInput(texto);
    if (final) enviar(texto);
  }, [enviar]));

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="print:hidden fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg hover:bg-indigo-700 transition-colors"
      >
        <Sparkles className="w-5 h-5" /> Asistente
      </button>
    );
  }

  return (
    <aside className="print:hidden fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-40 sm:w-[420px] sm:h-[600px] flex flex-col bg-white sm:rounded-3xl shadow-2xl ring-1 ring-slate-200 overflow-hidden">
      <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-indigo-600 text-white">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <div>
            <p className="font-bold leading-tight">Asistente de Inventario</p>
            <p className="text-[11px] text-indigo-100">Solo consulta · no modifica datos</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button onClick={() => { stop(); setMessages([]); clearError(); }} title="Nueva conversación" className="p-2 rounded-lg hover:bg-indigo-500">
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => setAbierto(false)} title="Cerrar" className="p-2 rounded-lg hover:bg-indigo-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-slate-500 px-1">Pregúntame por el inventario del taller. Puedes escribir o hablar.</p>
            {SUGERENCIAS.map(s => (
              <button
                key={s}
                onClick={() => enviar(s)}
                className="block w-full text-left text-sm px-4 py-2.5 rounded-xl bg-white ring-1 ring-slate-200 text-slate-700 hover:ring-indigo-300 hover:text-indigo-700 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[88%] space-y-1.5 rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user" ? "bg-indigo-600 text-white" : "bg-white ring-1 ring-slate-200 text-slate-800"
              }`}
            >
              {m.parts.map((part, i) => {
                if (part.type === "text") {
                  return <p key={i} className="whitespace-pre-wrap leading-relaxed">{part.text}</p>;
                }
                if (isToolUIPart(part)) {
                  const nombre = getToolName(part);
                  const terminado = part.state === "output-available";
                  const fallo = part.state === "output-error";
                  return (
                    <p key={i} className={`flex items-center gap-1.5 text-xs ${fallo ? "text-red-600" : "text-slate-400"}`}>
                      {!terminado && !fallo && <Loader2 className="w-3 h-3 animate-spin" />}
                      {ETIQUETA_TOOL[nombre] ?? nombre}{fallo ? " — error" : terminado ? " ✓" : "…"}
                    </p>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}

        {(status === "submitted" || (status === "streaming" && !ultimoTieneTexto)) && (
          <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Pensando…
          </div>
        )}
        {error && (
          <p className="text-xs text-red-600 bg-red-50 ring-1 ring-red-200 rounded-xl px-3 py-2 whitespace-pre-wrap break-words">
            {mensajeError(error)}
          </p>
        )}
        <div ref={finRef} />
      </div>

      <form
        onSubmit={e => { e.preventDefault(); enviar(input); }}
        className="flex items-center gap-2 p-3 border-t border-slate-100 bg-white"
      >
        {dictado.soportado && (
          <button
            type="button"
            onClick={dictado.escuchando ? dictado.detener : dictado.iniciar}
            disabled={ocupado}
            title={dictado.escuchando ? "Detener" : "Hablar"}
            className={`p-2.5 rounded-xl transition-colors ${dictado.escuchando ? "bg-red-600 text-white animate-pulse" : "bg-slate-100 text-slate-600 hover:bg-slate-200"} disabled:opacity-50`}
          >
            {dictado.escuchando ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        )}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={dictado.escuchando ? "Escuchando…" : "Escribe tu pregunta…"}
          className="flex-1 rounded-xl border-slate-200 text-sm focus:ring-indigo-500 focus:border-indigo-500"
        />
        {ocupado ? (
          <button type="button" onClick={stop} title="Detener" className="p-2.5 rounded-xl bg-slate-800 text-white">
            <Square className="w-4 h-4" />
          </button>
        ) : (
          <button type="submit" disabled={!input.trim()} title="Enviar" className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40">
            <Send className="w-4 h-4" />
          </button>
        )}
      </form>
      {dictado.error && <p className="px-4 pb-2 text-xs text-red-600 bg-white">{dictado.error}</p>}
    </aside>
  );
}

/** El servidor responde JSON {error}; useChat lo entrega como texto en error.message. */
function mensajeError(error: Error) {
  try {
    const parsed = JSON.parse(error.message) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch { /* no era JSON: es el mensaje que envía el servidor en el stream */ }
  return error.message?.trim() || "No se pudo obtener respuesta. Intenta de nuevo.";
}
