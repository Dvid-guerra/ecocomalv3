"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variante = "primary" | "secondary" | "ghost" | "danger";
type Tamano = "sm" | "md" | "lg";

/**
 * La acción primaria es grafito, no verde: el verde del sistema está
 * reservado a los estados (ok / warn / risk), así que un botón verde
 * leería como "correcto" en lugar de "acción".
 */
const VARIANTE_CLASES: Record<Variante, string> = {
  primary: "bg-action text-white hover:bg-action-hover shadow-card",
  secondary: "bg-surface text-ink-body ring-1 ring-line hover:bg-sunken hover:ring-line-strong",
  ghost: "text-ink-muted hover:bg-sunken hover:text-ink",
  danger: "bg-risk-surface text-risk ring-1 ring-risk-line hover:bg-risk-line/40",
};

/**
 * 44px de alto en celular — el taller se opera con el pulgar y guantes —
 * que se compacta a 36px donde hay puntero.
 */
const TAMANO_CLASES: Record<Tamano, string> = {
  sm: "touch sm:min-h-8 px-3 text-xs gap-1.5",
  md: "touch sm:min-h-9 px-4 text-sm gap-2",
  lg: "touch sm:min-h-11 px-5 text-sm gap-2",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  /** Muestra el spinner, deshabilita y anuncia el estado a lectores. */
  cargando?: boolean;
  /** Ocupa todo el ancho disponible. Útil en formularios de celular. */
  ancho?: boolean;
  children: ReactNode;
}

export function Button({
  variante = "primary",
  tamano = "md",
  iconLeft,
  iconRight,
  cargando = false,
  ancho = false,
  children,
  className = "",
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const estaDeshabilitado = disabled || cargando;

  return (
    <button
      {...rest}
      type={type}
      disabled={estaDeshabilitado}
      aria-busy={cargando || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-control font-semibold",
        "transition-[background-color,box-shadow,color] duration-150",
        "active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
        VARIANTE_CLASES[variante],
        TAMANO_CLASES[tamano],
        ancho && "w-full",
        className,
      )}
    >
      {cargando ? (
        <Loader2 className="w-4 h-4 shrink-0 animate-spin" strokeWidth={2} aria-hidden="true" />
      ) : (
        iconLeft && <span className="shrink-0" aria-hidden="true">{iconLeft}</span>
      )}

      <span className="truncate">{children}</span>

      {!cargando && iconRight && (
        <span className="shrink-0" aria-hidden="true">{iconRight}</span>
      )}
    </button>
  );
}
