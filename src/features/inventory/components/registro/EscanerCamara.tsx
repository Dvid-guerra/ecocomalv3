"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

// BarcodeDetector aún no está en lib.dom de TypeScript.
interface CodigoDetectado { rawValue: string }
interface DetectorCodigos { detect(fuente: HTMLVideoElement): Promise<CodigoDetectado[]> }
type ConstructorDetector = new (opciones: { formats: string[] }) => DetectorCodigos;

function obtenerDetector(): ConstructorDetector | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { BarcodeDetector?: ConstructorDetector }).BarcodeDetector ?? null;
}

/** Chrome en Android y escritorio lo soportan; Safari y Firefox no (ahí se usa el lector o la búsqueda). */
export function camaraDisponible() {
  return obtenerDetector() !== null && Boolean(navigator.mediaDevices?.getUserMedia);
}

interface Props {
  onCodigo: (texto: string) => void;
  onClose: () => void;
}

export default function EscanerCamara({ onCodigo, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const Detector = obtenerDetector();
    if (!Detector) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let activo = true;
    const detector = new Detector({ formats: ["qr_code"] });

    const buscar = async () => {
      const video = videoRef.current;
      if (!activo || !video) return;
      try {
        if (video.readyState >= 2) {
          const [codigo] = await detector.detect(video);
          if (codigo?.rawValue && activo) {
            activo = false;
            navigator.vibrate?.(80);
            onCodigo(codigo.rawValue);
            return;
          }
        }
      } catch {
        // Un cuadro fallido no detiene el escaneo.
      }
      timer = setTimeout(buscar, 250);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(s => {
        stream = s;
        if (!activo) return s.getTracks().forEach(t => t.stop());
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play();
        }
        void buscar();
      })
      .catch(() => setError("No se pudo abrir la cámara. Revisa el permiso del navegador."));

    return () => {
      activo = false;
      clearTimeout(timer);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [onCodigo]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 text-white">
        <p className="font-bold">Apunta al QR de la gaveta</p>
        <button onClick={onClose} className="p-2 rounded-full bg-white/10" aria-label="Cerrar cámara">
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        <div className="relative w-64 h-64 rounded-3xl ring-4 ring-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        {error && <p className="absolute bottom-8 left-4 right-4 text-center text-white bg-red-600 rounded-xl p-3">{error}</p>}
      </div>
    </div>
  );
}
