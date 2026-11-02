"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// Tipos mínimos de Web Speech API (no vienen en lib.dom de TypeScript).
interface ResultadoVoz { 0: { transcript: string }; isFinal: boolean }
interface EventoVoz { resultIndex: number; results: ArrayLike<ResultadoVoz> }
interface Reconocedor {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: EventoVoz) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}
type ConstructorReconocedor = new () => Reconocedor;

function obtenerReconocedor(): ConstructorReconocedor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: ConstructorReconocedor; webkitSpeechRecognition?: ConstructorReconocedor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const sinSuscripcion = () => () => {};

/** Dictado por voz en español (Chrome/Edge/Android). Gratis: corre en el navegador. */
export function useDictado(onTexto: (texto: string, final: boolean) => void) {
  const [escuchando, setEscuchando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconocedor = useRef<Reconocedor | null>(null);
  const callback = useRef(onTexto);

  useEffect(() => { callback.current = onTexto; }, [onTexto]);
  // En el servidor no hay window: false. En el cliente se detecta sin setState en un efecto.
  const soportado = useSyncExternalStore(sinSuscripcion, () => obtenerReconocedor() !== null, () => false);
  useEffect(() => () => reconocedor.current?.stop(), []);

  const iniciar = useCallback(() => {
    const Ctor = obtenerReconocedor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "es-GT";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = e => {
      let texto = "";
      let final = false;
      for (let i = 0; i < e.results.length; i++) {
        texto += e.results[i][0].transcript;
        if (e.results[i].isFinal) final = true;
      }
      callback.current(texto.trim(), final);
    };
    r.onerror = e => {
      setError(e.error === "not-allowed" ? "Permite el micrófono en el navegador." : "No se pudo escuchar. Intenta de nuevo.");
    };
    r.onend = () => setEscuchando(false);
    reconocedor.current = r;
    setError(null);
    setEscuchando(true);
    r.start();
  }, []);

  const detener = useCallback(() => reconocedor.current?.stop(), []);

  return { soportado, escuchando, error, iniciar, detener };
}
