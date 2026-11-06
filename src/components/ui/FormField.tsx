"use client";

import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/* ─────────────────────────────────────────────
   Campos comunes
───────────────────────────────────────────── */

/**
 * El campo se ve hundido en reposo y blanco al enfocarse. El anillo de
 * foco lo pone :focus-visible global, uno solo para toda la plataforma.
 */
const CAMPO_BASE =
  "w-full bg-sunken border-0 ring-1 ring-line rounded-control " +
  "text-sm text-ink-body placeholder:text-ink-muted " +
  "touch sm:min-h-9 px-3.5 " +
  "transition-[background-color,box-shadow] duration-150 " +
  "hover:ring-line-strong focus:bg-surface " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const CAMPO_ERROR = "ring-risk-line bg-risk-surface";

/* ─────────────────────────────────────────────
   FormField
───────────────────────────────────────────── */

interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  /** Pista permanente bajo el label. Para unidades o formato esperado. */
  pista?: string;
  className?: string;
  children: ReactNode;
}

export function FormField({
  label,
  htmlFor,
  error,
  pista,
  className = "",
  children,
}: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-semibold text-ink-body">
        {label}
      </label>
      {pista && !error && <p className="text-xs text-ink-muted -mt-1">{pista}</p>}
      {children}
      {error && (
        <p id={`${htmlFor}-error`} className="text-xs font-medium text-risk">
          {error}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   TextInput
───────────────────────────────────────────── */

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  iconLeft?: ReactNode;
  error?: boolean;
  /** Cifras de ancho fijo. Para cantidades, precios y horas. */
  numerico?: boolean;
}

export function TextInput({
  id,
  iconLeft,
  error = false,
  numerico = false,
  className = "",
  ...rest
}: TextInputProps) {
  return (
    <div className="relative">
      {iconLeft && (
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
          aria-hidden="true"
        >
          {iconLeft}
        </span>
      )}
      <input
        id={id}
        {...rest}
        aria-invalid={error || undefined}
        aria-describedby={error ? `${id}-error` : rest["aria-describedby"]}
        className={cn(
          CAMPO_BASE,
          error && CAMPO_ERROR,
          !!iconLeft && "pl-10",
          numerico && "nums",
          className,
        )}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   SelectInput
───────────────────────────────────────────── */

interface SelectInputProps extends SelectHTMLAttributes<HTMLSelectElement> {
  id: string;
  iconLeft?: ReactNode;
  error?: boolean;
  children: ReactNode;
}

export function SelectInput({
  id,
  iconLeft,
  error = false,
  children,
  className = "",
  ...rest
}: SelectInputProps) {
  return (
    <div className="relative">
      {iconLeft && (
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none z-10"
          aria-hidden="true"
        >
          {iconLeft}
        </span>
      )}
      <select
        id={id}
        {...rest}
        aria-invalid={error || undefined}
        className={cn(
          CAMPO_BASE,
          "appearance-none cursor-pointer pr-10",
          error && CAMPO_ERROR,
          !!iconLeft && "pl-10",
          className,
        )}
      >
        {children}
      </select>
      {/* El select nativo pinta su propia flecha con el gris del sistema
          operativo; esta la reemplaza con el gris del sistema de diseño. */}
      <ChevronDown
        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none"
        strokeWidth={2}
        aria-hidden="true"
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   TextArea
───────────────────────────────────────────── */

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  error?: boolean;
}

export function TextArea({ id, error = false, className = "", ...rest }: TextAreaProps) {
  return (
    <textarea
      id={id}
      {...rest}
      aria-invalid={error || undefined}
      className={cn(
        CAMPO_BASE,
        "py-2.5 leading-relaxed resize-y min-h-20",
        error && CAMPO_ERROR,
        className,
      )}
    />
  );
}
