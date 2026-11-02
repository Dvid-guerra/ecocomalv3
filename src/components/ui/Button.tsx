"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/* ─────────────────────────────────────────────
   Variantes disponibles
───────────────────────────────────────────── */
type Variante = "primary" | "secondary" | "ghost" | "danger";
type Tamano   = "sm" | "md" | "lg";

/* ─────────────────────────────────────────────
   Mapa de estilos por variante
───────────────────────────────────────────── */
const VARIANTE_CLASES: Record<Variante, string> = {
  primary: `
    bg-slate-900 text-white
    hover:bg-slate-800
    ring-1 ring-white/10
    shadow-sm
    active:scale-[0.98]
  `,
  secondary: `
    bg-white/80 text-slate-700
    hover:bg-slate-100
    ring-1 ring-slate-200/60
    active:scale-[0.98]
  `,
  ghost: `
    bg-transparent text-slate-600
    hover:bg-slate-100 hover:text-slate-800
    ring-1 ring-transparent hover:ring-slate-200/60
    active:scale-[0.98]
  `,
  danger: `
    bg-red-50 text-red-600
    hover:bg-red-100
    ring-1 ring-red-200/60
    active:scale-[0.98]
  `,
};

/* ─────────────────────────────────────────────
   Mapa de tamaños
───────────────────────────────────────────── */
const TAMANO_CLASES: Record<Tamano, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2   text-sm",
  lg: "px-5 py-2.5 text-sm",
};

/* ─────────────────────────────────────────────
   Componente Button
───────────────────────────────────────────── */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  /** Ícono a la izquierda del label */
  iconLeft?: ReactNode;
  /** Ícono a la derecha del label */
  iconRight?: ReactNode;
  /** Muestra un spinner de carga y deshabilita el botón */
  cargando?: boolean;
  children: ReactNode;
}

export function Button({
  variante = "primary",
  tamano = "md",
  iconLeft,
  iconRight,
  cargando = false,
  children,
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  const estaDeshabilitado = disabled || cargando;

  return (
    <button
      {...rest}
      disabled={estaDeshabilitado}
      aria-busy={cargando}
      className={`
        inline-flex items-center justify-center gap-2
        font-medium rounded-xl
        transition-all duration-150
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        ${VARIANTE_CLASES[variante]}
        ${TAMANO_CLASES[tamano]}
        ${className}
      `}
    >
      {cargando ? (
        <svg
          className="animate-spin w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12" cy="12" r="10"
            stroke="currentColor" strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
      ) : (
        iconLeft && (
          <span className="shrink-0" aria-hidden="true">
            {iconLeft}
          </span>
        )
      )}

      <span>{children}</span>

      {!cargando && iconRight && (
        <span className="shrink-0" aria-hidden="true">
          {iconRight}
        </span>
      )}
    </button>
  );
}
