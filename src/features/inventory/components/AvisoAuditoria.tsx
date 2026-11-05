"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { mesAuditoria, nombreMes } from "../domain/auditoria";
import { fechaCorta, suscribirAuditorias, type Auditoria } from "../services/auditorias";

/** Recordatorio de la auditoría mensual en la pantalla de Inventario. */
export default function AvisoAuditoria() {
  const [auditorias, setAuditorias] = useState<Auditoria[] | null>(null);
  useEffect(() => suscribirAuditorias(setAuditorias, () => setAuditorias([]), 6), []);
  if (!auditorias) return null;

  const enCurso = auditorias.find(a => a.estado === "en_curso");
  const ultima = auditorias.find(a => a.estado === "cerrada");
  const mes = mesAuditoria();

  if (enCurso) {
    const contados = Object.keys(enCurso.conteos ?? {}).length;
    return (
      <Aviso tono="info" texto={`Auditoría de ${nombreMes(enCurso.mes)} en curso: ${contados} de ${enCurso.totalMateriales} contados.`} accion="Continuar" />
    );
  }
  if (ultima?.mes === mes) return null;
  return (
    <Aviso
      tono="pendiente"
      texto={`Falta la auditoría de ${nombreMes(mes)}. Última: ${ultima ? `${nombreMes(ultima.mes)} (cerrada el ${fechaCorta(ultima.cerradaEn)})` : "ninguna"}.`}
      accion="Ir a auditoría"
    />
  );
}

function Aviso({ tono, texto, accion }: { tono: "info" | "pendiente"; texto: string; accion: string }) {
  const estilo = tono === "info" ? "bg-sky-50 ring-sky-200 text-sky-900" : "bg-amber-50 ring-amber-200 text-amber-900";
  return (
    <div className={`print:hidden flex flex-wrap items-center justify-between gap-3 rounded-2xl ring-1 px-5 py-3 ${estilo}`}>
      <p className="flex items-center gap-2 text-sm font-medium">
        <ClipboardList className="w-5 h-5 shrink-0" /> {texto}
      </p>
      <Link href="/dashboard/inventario/auditoria" className="px-4 py-2 rounded-xl bg-white ring-1 ring-current/20 text-sm font-bold">
        {accion}
      </Link>
    </div>
  );
}
