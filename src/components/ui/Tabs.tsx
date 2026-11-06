"use client";

import type { ElementType } from "react";
import { cn } from "@/lib/cn";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: ElementType;
  /** Contador opcional a la derecha del label (tareas pendientes, etc.). */
  conteo?: number;
}

interface TabsProps<T extends string> {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Nombre del grupo para lectores de pantalla. */
  etiqueta: string;
  /** Reparte las pestañas a lo ancho. Para barras de 2–3 pestañas. */
  completo?: boolean;
  className?: string;
}

/**
 * Control segmentado. En celular desborda en scroll horizontal con la
 * barra oculta en lugar de apretujar o envolver las pestañas, que es
 * lo que hacían las seis pestañas del portal en una pantalla de 360px.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  etiqueta,
  completo = false,
  className = "",
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={etiqueta}
      className={cn(
        "flex items-center gap-1 p-1 bg-sunken rounded-control ring-1 ring-line",
        "overflow-x-auto scrollbar-hide",
        className,
      )}
    >
      {items.map(({ id, label, icon: Icon, conteo }) => {
        const activa = id === value;
        return (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={activa}
            onClick={() => onChange(id)}
            className={cn(
              "inline-flex items-center justify-center gap-2 shrink-0",
              "touch sm:min-h-8 px-3 rounded-[calc(var(--radius-control)-0.25rem)]",
              "text-sm font-semibold transition-[background-color,color,box-shadow] duration-150",
              completo && "flex-1",
              activa
                ? "bg-surface text-ink shadow-card ring-1 ring-line"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {Icon && <Icon className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden="true" />}
            {label}
            {conteo !== undefined && conteo > 0 && (
              <span
                className={cn(
                  "nums text-xs font-bold px-1.5 rounded-full",
                  activa ? "bg-action text-white" : "bg-line text-ink-body",
                )}
              >
                {conteo}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
