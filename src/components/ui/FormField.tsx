"use client";

import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";

/* ─────────────────────────────────────────────
   FormField wrapper
───────────────────────────────────────────── */
interface FormFieldProps {
  label: string;
  htmlFor: string;
  /** Mensaje de error opcional */
  error?: string;
  /** Clases adicionales para el wrapper del campo */
  className?: string;
  children: ReactNode;
}

export function FormField({ label, htmlFor, error, className = "", children }: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label
        htmlFor={htmlFor}
        className="text-xs font-semibold text-slate-500 tracking-wide uppercase"
      >
        {label}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-500 font-medium">{error}</p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Input refinado estilo "empotrado"
───────────────────────────────────────────── */
interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  /** Ícono izquierdo opcional (ReactNode lucide-react) */
  iconLeft?: ReactNode;
}

export function TextInput({ id, iconLeft, className = "", ...rest }: TextInputProps) {
  return (
    <div className="relative">
      {iconLeft && (
        <span className="
          absolute left-3 top-1/2 -translate-y-1/2
          text-slate-400 pointer-events-none
        ">
          {iconLeft}
        </span>
      )}
      <input
        id={id}
        {...rest}
        className={`
          w-full
          bg-slate-100/60 border-0
          ring-1 ring-slate-200/80
          rounded-xl px-4 py-2 text-sm text-slate-800 placeholder:text-slate-400
          shadow-inner
          focus:bg-white focus:ring-2 focus:ring-slate-900/80 focus:outline-none
          transition-all duration-150
          disabled:opacity-50 disabled:cursor-not-allowed
          ${iconLeft ? "pl-9" : ""}
          ${className}
        `}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Select refinado
───────────────────────────────────────────── */
interface SelectInputProps extends SelectHTMLAttributes<HTMLSelectElement> {
  id: string;
  children: ReactNode;
}

export function SelectInput({ id, children, className = "", ...rest }: SelectInputProps) {
  return (
    <select
      id={id}
      {...rest}
      className={`
        w-full appearance-none
        bg-slate-100/60 border-0
        ring-1 ring-slate-200/80
        rounded-xl px-4 py-2 pr-9 text-sm text-slate-800
        shadow-inner
        focus:bg-white focus:ring-2 focus:ring-slate-900/80 focus:outline-none
        transition-all duration-150
        disabled:opacity-50 disabled:cursor-not-allowed
        cursor-pointer
        ${className}
      `}
    >
      {children}
    </select>
  );
}
