"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Eleva la tarjeta en hover. Solo para tarjetas que son enlaces o botones. */
  interactivo?: boolean;
  /** `panel` es el contenedor de nivel de página; `card` es la pieza interior. */
  nivel?: "card" | "panel";
  id?: string;
}

export function Card({
  children,
  className = "",
  interactivo = false,
  nivel = "card",
  id,
}: CardProps) {
  return (
    <div
      id={id}
      className={cn(
        "surface-card ring-1 ring-line shadow-card",
        nivel === "panel" ? "rounded-panel" : "rounded-card",
        interactivo &&
          "transition-[box-shadow,transform,--tw-ring-color] duration-200 ease-out hover:-translate-y-0.5 hover:ring-line-strong hover:shadow-raised active:translate-y-0 cursor-pointer",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  titulo: string;
  subtitulo?: string;
  /** Ícono a la izquierda del título, al mismo peso que el resto del cromo. */
  icono?: ReactNode;
  accion?: ReactNode;
}

export function CardHeader({ titulo, subtitulo, icono, accion }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-line">
      <div className="flex items-start gap-2.5 min-w-0">
        {icono && (
          <span className="text-ink-muted shrink-0 mt-px" aria-hidden="true">
            {icono}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{titulo}</h2>
          {subtitulo && <p className="text-xs text-ink-muted mt-1">{subtitulo}</p>}
        </div>
      </div>
      {accion && <div className="shrink-0">{accion}</div>}
    </div>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

export function CardFooter({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-5 py-3 border-t border-line flex items-center justify-end gap-2",
        className,
      )}
    >
      {children}
    </div>
  );
}
