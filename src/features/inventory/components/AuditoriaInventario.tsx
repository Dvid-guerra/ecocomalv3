"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import { ArrowLeft, CheckCircle2, ClipboardList, Circle } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import type { Material } from "@/types";
import { mesAuditoria, nombreMes, resumirAuditoria, type ResumenAuditoria } from "../domain/auditoria";
import {
  cancelarAuditoria,
  cerrarAuditoria,
  fechaCorta,
  iniciarAuditoria,
  quetzales,
  registrarConteo,
  suscribirAuditorias,
  type Auditoria,
} from "../services/auditorias";
import BuscadorMaterial from "./BuscadorMaterial";

const mensaje = (e: unknown) => (e instanceof Error ? e.message : "Ocurrió un error.");

export default function AuditoriaInventario() {
  const [auditorias, setAuditorias] = useState<Auditoria[]>([]);
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubs = [
      suscribirAuditorias(a => {
        setAuditorias(a);
        setCargando(false);
      }, () => setError("No se pudieron cargar las auditorías.")),
      onSnapshot(collection(db, "materiales"), snap => setMateriales(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Material))),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const enCurso = auditorias.find(a => a.estado === "en_curso");

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <header className="flex items-center gap-3">
        <Link href="/dashboard/inventario" className="p-3 rounded-2xl bg-white ring-1 ring-slate-200 text-slate-600" aria-label="Volver a Inventario">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Auditoría de inventario</h1>
          <p className="text-sm text-slate-500">Conteo físico mensual de todo el catálogo</p>
        </div>
      </header>

      {error && <p className="rounded-2xl bg-red-50 ring-1 ring-red-200 text-red-700 px-5 py-4">{error}</p>}
      {cargando ? <p className="text-slate-400">Cargando…</p> : enCurso
        ? <AuditoriaEnCurso auditoria={enCurso} materiales={materiales} />
        : <SinAuditoria auditorias={auditorias} />}
    </div>
  );
}

/* ── Sin auditoría abierta: iniciar + historial ── */

function SinAuditoria({ auditorias }: { auditorias: Auditoria[] }) {
  const [iniciando, setIniciando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const mes = mesAuditoria();
  const cerradas = auditorias.filter(a => a.estado === "cerrada");
  const hecha = cerradas.find(a => a.mes === mes);

  const iniciar = async () => {
    setIniciando(true);
    setError(null);
    try {
      await iniciarAuditoria();
    } catch (e) {
      setError(mensaje(e));
    } finally {
      setIniciando(false);
    }
  };

  return (
    <>
      <section className="bg-white rounded-3xl ring-1 ring-slate-200 p-6 space-y-4">
        <div className="flex items-start gap-4">
          <ClipboardList className={`w-10 h-10 shrink-0 ${hecha ? "text-emerald-600" : "text-amber-500"}`} />
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-900">{nombreMes(mes)}</h2>
            <p className="text-sm text-slate-500">
              {hecha ? `Hecha el ${fechaCorta(hecha.cerradaEn)} por ${hecha.cerradaPorNombre}.` : "Pendiente este mes."}
            </p>
          </div>
        </div>
        <ul className="text-sm text-slate-600 space-y-1 list-disc pl-5">
          <li>Se cuenta cada material sin ver lo que dice el sistema.</li>
          <li>Se puede seguir sacando material mientras se cuenta: lo que salga después de contar se respeta.</li>
          <li>Al cerrar, el stock se ajusta a lo contado y queda el reporte de diferencias.</li>
        </ul>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={iniciar} disabled={iniciando} className="w-full h-14 rounded-2xl bg-emerald-600 text-white text-lg font-bold disabled:opacity-50">
          {iniciando ? "Iniciando…" : hecha ? "Iniciar otra auditoría" : "Iniciar auditoría"}
        </button>
      </section>

      {cerradas.length > 0 && (
        <section className="bg-white rounded-3xl ring-1 ring-slate-200 p-6 space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Historial</h2>
          <ul className="divide-y divide-slate-100">
            {cerradas.map(a => (
              <li key={a.id} className="py-3">
                <button onClick={() => setAbierta(abierta === a.id ? null : a.id)} className="w-full flex flex-wrap items-center justify-between gap-2 text-left">
                  <span>
                    <span className="font-bold text-slate-800">{nombreMes(a.mes)}</span>
                    <span className="block text-xs text-slate-500">
                      {fechaCorta(a.cerradaEn)} · {a.resumen?.totales.contados ?? 0} de {a.totalMateriales} contados · {a.cerradaPorNombre}
                    </span>
                  </span>
                  <span className="text-right text-sm">
                    <span className="block font-mono font-bold text-red-600">{quetzales(a.resumen?.totales.valorFaltante ?? 0)}</span>
                    <span className="block text-xs text-slate-500">{a.resumen?.totales.conDiferencia ?? 0} con diferencia</span>
                  </span>
                </button>
                {abierta === a.id && a.resumen && <TablaDiferencias resumen={a.resumen} soloDiferencias />}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/* ── Auditoría abierta: contar y cerrar ── */

type Filtro = "pendientes" | "contados" | "todos";

function AuditoriaEnCurso({ auditoria, materiales }: { auditoria: Auditoria; materiales: Material[] }) {
  const { sesion } = useAuth();
  const [vista, setVista] = useState<"contar" | "revisar">("contar");
  const [filtro, setFiltro] = useState<Filtro>("pendientes");
  const [seleccionado, setSeleccionado] = useState<Material | null>(null);

  const conteos = auditoria.conteos ?? {};
  const contados = materiales.filter(m => conteos[m.id]).length;
  const total = Math.max(materiales.length, 1);

  return (
    <>
      <section className="bg-white rounded-3xl ring-1 ring-slate-200 p-5 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">{nombreMes(auditoria.mes)}</h2>
          <p className="text-sm text-slate-500"><b className="text-slate-900">{contados}</b> de {materiales.length} contados</p>
        </div>
        <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(contados / total) * 100}%` }} />
        </div>
        <p className="text-xs text-slate-400">Iniciada el {fechaCorta(auditoria.iniciadaEn)} por {auditoria.iniciadaPorNombre}</p>
        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
          {(["contar", "revisar"] as const).map(v => (
            <button key={v} onClick={() => setVista(v)} className={`py-3 rounded-xl text-sm font-bold ${vista === v ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>
              {v === "contar" ? "Contar" : "Revisar y cerrar"}
            </button>
          ))}
        </div>
      </section>

      {vista === "contar" && (
        seleccionado ? (
          <TarjetaConteo
            key={seleccionado.id}
            auditoriaId={auditoria.id}
            material={seleccionado}
            previo={conteos[seleccionado.id]}
            onListo={() => setSeleccionado(null)}
          />
        ) : (
          <section className="space-y-3">
            <div className="flex gap-2">
              {(["pendientes", "contados", "todos"] as const).map(f => (
                <button key={f} onClick={() => setFiltro(f)} className={`px-4 py-2 rounded-xl text-sm font-bold ring-1 ${filtro === f ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-200"}`}>
                  {f === "pendientes" ? `Pendientes (${materiales.length - contados})` : f === "contados" ? `Contados (${contados})` : "Todos"}
                </button>
              ))}
            </div>
            <BuscadorMaterial
              materiales={materiales}
              mostrar={filtro === "todos" ? undefined : m => (filtro === "contados") === Boolean(conteos[m.id])}
              onElegir={setSeleccionado}
              maxResultados={200}
              detalle={m => conteos[m.id]
                ? <span className="flex items-center gap-1 font-mono font-bold text-emerald-700"><CheckCircle2 className="w-5 h-5" /> {conteos[m.id].contado}</span>
                : <Circle className="w-5 h-5 text-slate-300" />}
            />
          </section>
        )
      )}

      {vista === "revisar" && (
        <Revision auditoria={auditoria} materiales={materiales} puedeCancelar={sesion?.rol === "Gerente" || sesion?.rol === "Subgerente"} />
      )}
    </>
  );
}

function TarjetaConteo({ auditoriaId, material, previo, onListo }: {
  auditoriaId: string;
  material: Material;
  previo?: Auditoria["conteos"][string];
  onListo: () => void;
}) {
  const [cantidad, setCantidad] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cantidad === "") return;
    setGuardando(true);
    setError(null);
    try {
      await registrarConteo(auditoriaId, material.id, Number(cantidad));
      navigator.vibrate?.(60);
      onListo();
    } catch (err) {
      setError(mensaje(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={guardar} className="bg-white rounded-3xl ring-1 ring-slate-200 p-5 space-y-4">
      <div>
        <p className="text-2xl font-bold text-slate-900 leading-tight">{material.nombre}</p>
        <p className="text-sm text-slate-500 font-mono">{material.ubicacion ?? "Sin ubicación"} · {material.unidadMedida}</p>
      </div>
      {previo && (
        <p className="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 text-emerald-800 px-4 py-2 text-sm">
          Ya contado: <b>{previo.contado}</b> por {previo.contadoPorNombre}. Guardar de nuevo lo corrige.
        </p>
      )}
      <label className="block space-y-1">
        <span className="text-sm font-bold text-slate-500 uppercase">Cantidad contada ({material.unidadMedida})</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          autoFocus
          required
          value={cantidad}
          onChange={e => setCantidad(e.target.value)}
          className="w-full h-20 text-center text-5xl font-mono font-bold rounded-2xl border-slate-200 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </label>
      {error && <p className="rounded-xl bg-red-600 text-white px-4 py-3 font-bold">{error}</p>}
      <div className="grid grid-cols-3 gap-3">
        <button type="button" onClick={onListo} className="h-16 rounded-2xl bg-slate-100 text-slate-700 font-bold">Atrás</button>
        <button type="submit" disabled={guardando || cantidad === ""} className="col-span-2 h-16 rounded-2xl bg-emerald-600 text-white text-xl font-bold disabled:opacity-40">
          {guardando ? "Guardando…" : "Guardar conteo"}
        </button>
      </div>
    </form>
  );
}

function Revision({ auditoria, materiales, puedeCancelar }: { auditoria: Auditoria; materiales: Material[]; puedeCancelar: boolean }) {
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vista previa con los mismos cálculos que hará el servidor al cerrar.
  const resumen = useMemo(() => resumirAuditoria(
    materiales.map(m => ({
      id: m.id,
      nombre: m.nombre,
      unidad: m.unidadMedida,
      precio: Number(m.precioEstimado) || 0,
      stockActual: Number(m.stockActual ?? 0),
    })),
    auditoria.conteos ?? {},
  ), [materiales, auditoria.conteos]);

  const ejecutar = async (fn: () => Promise<unknown>, confirmacion: string) => {
    if (!confirm(confirmacion)) return;
    setProcesando(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(mensaje(e));
    } finally {
      setProcesando(false);
    }
  };

  const { totales } = resumen;
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Dato titulo="Contados" valor={`${totales.contados}`} />
        <Dato titulo="Con diferencia" valor={`${totales.conDiferencia}`} />
        <Dato titulo="Faltante" valor={quetzales(totales.valorFaltante)} tono="text-red-600" />
        <Dato titulo="Sobrante" valor={quetzales(totales.valorSobrante)} tono="text-emerald-600" />
      </div>

      {resumen.noContados.length > 0 && (
        <p className="rounded-2xl bg-amber-50 ring-1 ring-amber-200 text-amber-800 px-5 py-3 text-sm">
          <b>{resumen.noContados.length} sin contar</b> (no se ajustan): {resumen.noContados.slice(0, 8).map(n => n.nombre).join(", ")}
          {resumen.noContados.length > 8 && "…"}
        </p>
      )}

      <div className="bg-white rounded-3xl ring-1 ring-slate-200 p-4">
        <TablaDiferencias resumen={resumen} />
      </div>

      {error && <p className="rounded-2xl bg-red-600 text-white px-5 py-3 font-bold">{error}</p>}

      <button
        onClick={() => ejecutar(() => cerrarAuditoria(auditoria.id), `Se ajustará el stock de ${totales.contados} materiales a lo contado. ¿Cerrar la auditoría?`)}
        disabled={procesando || totales.contados === 0}
        className="w-full h-16 rounded-2xl bg-emerald-600 text-white text-lg font-bold disabled:opacity-40"
      >
        {procesando ? "Procesando…" : "Cerrar auditoría y ajustar stock"}
      </button>
      {puedeCancelar && (
        <button
          onClick={() => ejecutar(() => cancelarAuditoria(auditoria.id), "¿Cancelar la auditoría? Los conteos se descartan y el stock no cambia.")}
          disabled={procesando}
          className="w-full py-3 rounded-2xl text-sm font-bold text-red-600 hover:bg-red-50"
        >
          Cancelar auditoría
        </button>
      )}
    </section>
  );
}

function Dato({ titulo, valor, tono = "text-slate-900" }: { titulo: string; valor: string; tono?: string }) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-4">
      <p className="text-xs font-bold text-slate-500 uppercase">{titulo}</p>
      <p className={`text-xl font-mono font-bold ${tono}`}>{valor}</p>
    </div>
  );
}

function TablaDiferencias({ resumen, soloDiferencias = false }: { resumen: ResumenAuditoria; soloDiferencias?: boolean }) {
  const lineas = soloDiferencias ? resumen.lineas.filter(l => l.diferencia !== 0) : resumen.lineas;
  if (lineas.length === 0) {
    return <p className="text-sm text-slate-400 py-3">{soloDiferencias ? "Sin diferencias: todo cuadró." : "Todavía no hay conteos."}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-slate-500">
          <tr>
            <th className="text-left py-2 pr-2">Material</th>
            <th className="text-right px-2">Sistema</th>
            <th className="text-right px-2">Contado</th>
            <th className="text-right px-2">Dif.</th>
            <th className="text-right pl-2">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lineas.map(l => (
            <tr key={l.materialId}>
              <td className="py-2 pr-2 text-slate-800">{l.nombre}<span className="block text-xs text-slate-400">{l.unidad}</span></td>
              <td className="text-right px-2 font-mono text-slate-500">{l.sistema}</td>
              <td className="text-right px-2 font-mono font-bold">{l.contado}</td>
              <td className={`text-right px-2 font-mono font-bold ${l.diferencia < 0 ? "text-red-600" : l.diferencia > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                {l.diferencia > 0 ? "+" : ""}{l.diferencia}
              </td>
              <td className={`text-right pl-2 font-mono whitespace-nowrap ${l.valorDiferencia < 0 ? "text-red-600" : "text-slate-600"}`}>{quetzales(l.valorDiferencia)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
