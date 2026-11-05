"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import type { Rol } from "@/types";

const OPERATIVOS: Rol[] = ["Gerente", "Subgerente", "Supervisor"];

/** Solo cuentas operativas (la tablet del furgón usa una cuenta de Supervisor). */
export default function AccesoOperativo({ children }: { children: ReactNode }) {
  const { sesion } = useAuth();
  if (!sesion || !OPERATIVOS.includes(sesion.rol)) {
    return <div className="p-8 text-center text-slate-500">Esta pantalla requiere una cuenta de Supervisor o Gerencia.</div>;
  }
  return <>{children}</>;
}
