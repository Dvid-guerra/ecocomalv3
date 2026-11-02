"use client";

import type { ReactNode } from "react";

/* ─────────────────────────────────────────────
   Card base: aplica todos los tokens Soft Corporate
───────────────────────────────────────────── */
interface CardProps {
  children: ReactNode;
  className?: string;
  /** Si true, aplica hover/active micro-interacciones */
  interactivo?: boolean;
  /** ID único para accesibilidad y testing */
  id?: string;
}

export function Card({ children, className = "", interactivo = false, id }: CardProps) {
  return (
    <div
      id={id}
      className={`
        bg-gradient-to-b from-white to-slate-50/50
        rounded-2xl
        ring-1 ring-slate-200/60
        shadow-xs shadow-inner shadow-slate-100/40
        ${interactivo
          ? "transition-all duration-200 hover:-translate-y-0.5 hover:ring-slate-300/80 hover:shadow-sm hover:from-white hover:to-white active:scale-[0.99] cursor-pointer"
          : ""
        }
        ${className}
      `}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   CardHeader: zona de encabezado con separador
───────────────────────────────────────────── */
interface CardHeaderProps {
  titulo: string;
  subtitulo?: string;
  accion?: ReactNode;
}

export function CardHeader({ titulo, subtitulo, accion }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-100/80">
      <div>
        <h2 className="text-sm font-semibold text-slate-800 tracking-tight">{titulo}</h2>
        {subtitulo && (
          <p className="text-xs text-slate-400 mt-0.5">{subtitulo}</p>
        )}
      </div>
      {accion && <div className="shrink-0 ml-4">{accion}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   CardBody: zona de contenido con padding estándar
───────────────────────────────────────────── */
interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

export function CardBody({ children, className = "" }: CardBodyProps) {
  return (
    <div className={`px-5 py-4 ${className}`}>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   CardFooter: zona de acciones inferior
───────────────────────────────────────────── */
interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className = "" }: CardFooterProps) {
  return (
    <div className={`
      px-5 py-3
      border-t border-slate-100/80
      flex items-center justify-end gap-2
      ${className}
    `}>
      {children}
    </div>
  );
}
