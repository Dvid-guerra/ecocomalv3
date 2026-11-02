"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
  MODELOS,
  SALARIO_DIARIO_DEFAULT,
  type AreaPlanta,
  type Modelo,
  type RegistroProduccion,
  type Asistencia,
  type Material,
  type ProductoReceta,
} from "@/types";
import { suscribirRecetas } from "@/features/inventory/services/recetas";
import { calcularCostoUnitario } from "@/features/inventory/domain/recetas";
import {
  ArrowLeft,
  FileText,
  BarChart3,
  CheckCircle2,
  Loader2,
  Activity,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Wallet,
  AlertCircle,
  Settings,
  Calculator,
  Save,
} from "lucide-react";

/* ─── Utilidades de formato ──────────────────────────────────── */
const Q = (n: number) =>
  new Intl.NumberFormat("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const N = (n: number, dec = 1) =>
  new Intl.NumberFormat("es-GT", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(n);

/* ─── Helper: ISO Week ID ────────────────────────────────────── */
function getSemanaId(fecha: string): string {
  // Returns "YYYY-WNN" per ISO 8601
  const d = new Date(fecha + "T12:00:00"); // noon to avoid TZ off-by-one
  const day = d.getDay() === 0 ? 7 : d.getDay(); // ISO: Mon=1 … Sun=7
  const thursday = new Date(d);
  thursday.setDate(d.getDate() - day + 4); // nearest thursday
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const weekNum = Math.ceil(
    ((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  const year = thursday.getFullYear();
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}

function getCurrentWeekId(): string {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return getSemanaId(`${yyyy}-${mm}-${dd}`);
}

function getCurrentMonthPrefix(): string {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function todayString(): string {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* ─── Colores por área ───────────────────────────────────────── */
const AREA_COLOR: Record<AreaPlanta, string> = {
  "Herrería":       "bg-blue-500",
  "Fundición":      "bg-orange-500",
  "Carga":          "bg-emerald-500",
  "Labores Extras": "bg-slate-400",
};
const AREA_TEXT_COLOR: Record<AreaPlanta, string> = {
  "Herrería":       "text-blue-700",
  "Fundición":      "text-orange-600",
  "Carga":          "text-emerald-700",
  "Labores Extras": "text-slate-600",
};
const AREAS: AreaPlanta[] = ["Herrería", "Fundición", "Carga", "Labores Extras"];

/* ─── Tipos Factura ──────────────────────────────────────────── */
interface Factura {
  id:             string;
  nit:            string;
  razonSocial:    string;
  direccion:      string;
  item:           string;
  cantidad:       number;
  precioUnitario: number;
  subtotal:       number;
  iva:            number;
  total:          number;
  uuid_fel?:      string;
  url_pdf?:       string;
}

interface FormState {
  nit:            string;
  razonSocial:    string;
  direccion:      string;
  item:           string;
  cantidad:       string;
  precioUnitario: string;
}

const FORM_INICIAL: FormState = {
  nit:            "",
  razonSocial:    "",
  direccion:      "",
  item:           "Estufa Ecológica Modelo Familiar",
  cantidad:       "",
  precioUnitario: "",
};

const ITEMS = [
  "Estufa Ecológica Modelo Familiar",
  "Estufa Ecológica Modelo Comunitario",
  "Mantenimiento / Repuestos",
];

/* ─── Skeleton ───────────────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="min-h-screen bg-stone-50 animate-pulse">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <div className="h-8 w-48 bg-stone-200 rounded-2xl" />
        <div className="h-4 w-64 bg-stone-100 rounded-xl" />
        <div className="grid grid-cols-3 gap-4 mt-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-white rounded-3xl border border-stone-200/60" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── KPI Card ───────────────────────────────────────────────── */
function KpiCard({
  titulo, valor, descripcion, barras, colorBarra,
}: {
  titulo: string; valor: string; descripcion: string;
  barras: number[]; colorBarra: string;
}) {
  const max = Math.max(...barras, 1);
  return (
    <div className="bg-white rounded-3xl border border-stone-200/60 shadow-sm p-6 flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold text-stone-400 tracking-wider uppercase">{titulo}</p>
        <p className="text-2xl font-bold text-stone-900 mt-1">{valor}</p>
        <p className="text-xs text-stone-400 mt-0.5">{descripcion}</p>
      </div>
      <div className="flex items-end gap-1 h-12">
        {barras.map((v, i) => (
          <div
            key={i}
            className={`flex-1 rounded-sm ${colorBarra} transition-all duration-500`}
            style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Panel de Control ───────────────────────────────────────── */
function PanelControl({ facturas }: { facturas: Factura[] }) {
  const ingresos = useMemo(() => facturas.reduce((a, f) => a + f.total, 0), [facturas]);
  const ivaTotal = useMemo(() => facturas.reduce((a, f) => a + f.iva, 0), [facturas]);
  const subtotal = useMemo(() => facturas.reduce((a, f) => a + f.subtotal, 0), [facturas]);

  const totalesPorMes = useMemo(() => {
    const map: Record<number, number> = {};
    facturas.forEach((f) => {
      const mes = new Date().getMonth();
      map[mes] = (map[mes] ?? 0) + f.total;
    });
    return Array.from({ length: 6 }, (_, i) => map[i] ?? 0);
  }, [facturas]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          titulo="Ingresos Totales"
          valor={`Q. ${Q(ingresos)}`}
          descripcion={`${facturas.length} facturas emitidas`}
          barras={totalesPorMes}
          colorBarra="bg-emerald-500"
        />
        <KpiCard
          titulo="IVA Retenido (12%)"
          valor={`Q. ${Q(ivaTotal)}`}
          descripcion="Impuesto al valor agregado"
          barras={totalesPorMes.map((v) => v * 0.12)}
          colorBarra="bg-orange-400"
        />
        <KpiCard
          titulo="Subtotal Neto"
          valor={`Q. ${Q(subtotal)}`}
          descripcion="Base imponible acumulada"
          barras={totalesPorMes.map((v) => v / 1.12)}
          colorBarra="bg-slate-400"
        />
      </div>

      {/* Tabla de facturas recientes */}
      <div className="bg-white rounded-3xl border border-stone-200/60 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100">
          <h2 className="text-sm font-semibold text-stone-700">Facturas Recientes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-100">
                {["NIT", "Razón Social", "Producto", "Total", "IVA", "Documento"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-stone-400 tracking-wider uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {facturas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-stone-400">
                    No hay facturas emitidas aún.
                  </td>
                </tr>
              ) : (
                facturas.slice(0, 10).map((f) => (
                  <tr key={f.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="px-5 py-3 text-sm font-mono text-stone-600">{f.nit}</td>
                    <td className="px-5 py-3 text-sm text-stone-800 font-medium">{f.razonSocial}</td>
                    <td className="px-5 py-3 text-xs text-stone-500">{f.item}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-emerald-700">Q. {Q(f.total)}</td>
                    <td className="px-5 py-3 text-sm text-orange-600">Q. {Q(f.iva)}</td>
                    <td className="px-5 py-3 text-sm">
                      {f.url_pdf ? (
                        <a
                          href={f.url_pdf}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-medium transition-colors bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200"
                        >
                          <FileText className="w-4 h-4" /> PDF
                        </a>
                      ) : (
                        <span className="text-stone-400 text-xs italic">Interno</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Formulario de Facturación ──────────────────────────────── */
function FormularioFactura({ sesionUid }: { sesionUid: string }) {
  const [form,       setForm]       = useState<FormState>(FORM_INICIAL);
  const [enviando,   setEnviando]   = useState(false);
  const [exitoso,    setExitoso]    = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  const cantidad       = parseFloat(form.cantidad)       || 0;
  const precioUnitario = parseFloat(form.precioUnitario) || 0;
  const total          = cantidad * precioUnitario;
  const subtotal       = total / 1.12;
  const iva            = total - subtotal;

  const campo = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleCF = () =>
    setForm((prev) => ({ ...prev, nit: "CF", razonSocial: "Consumidor Final", direccion: "Ciudad" }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (total <= 0) { setErrorEnvio("El total debe ser mayor a Q. 0.00"); return; }
    setErrorEnvio(null);
    setEnviando(true);
    try {
      const resFel = await fetch("/api/fel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nit:            form.nit.trim(),
          razonSocial:    form.razonSocial.trim(),
          direccion:      form.direccion.trim(),
          item:           form.item,
          cantidad,
          precioUnitario,
          subtotal:       parseFloat(subtotal.toFixed(2)),
          iva:            parseFloat(iva.toFixed(2)),
          total:          parseFloat(total.toFixed(2)),
        }),
      });

      const felData = await resFel.json();

      if (!resFel.ok || !felData.success) {
        throw new Error(felData.error || "Falló la certificación de la factura.");
      }

      const { uuid, url_pdf, subtotal: subtotalValidado, iva: ivaValidado, total: totalValidado } = felData.data;

      await addDoc(collection(db, "facturas"), {
        nit:            form.nit.trim(),
        razonSocial:    form.razonSocial.trim(),
        direccion:      form.direccion.trim(),
        item:           form.item,
        cantidad,
        precioUnitario,
        subtotal:       subtotalValidado,
        iva:            ivaValidado,
        total:          totalValidado,
        emitidoEn:      serverTimestamp(),
        emitidoPor:     sesionUid,
        uuid_fel:       uuid,
        url_pdf:        url_pdf,
      });
      setForm(FORM_INICIAL);
      setExitoso(true);
      setTimeout(() => setExitoso(false), 5000);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Error al emitir la factura. Verifica tu conexión.";
      setErrorEnvio(msg);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {exitoso && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl px-5 py-4">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">Factura emitida y registrada correctamente en Firestore.</p>
        </div>
      )}

      {/* Sección A — Datos del Cliente */}
      <div className="bg-white rounded-3xl border border-stone-200/60 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-bold text-stone-700 uppercase tracking-wider">
          A — Datos del Cliente
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <label htmlFor="nit" className="block text-xs font-semibold text-stone-500 mb-1 uppercase tracking-wider">
              NIT
            </label>
            <div className="flex gap-2">
              <input
                id="nit"
                type="text"
                required
                value={form.nit}
                onChange={campo("nit")}
                placeholder="12345678-9"
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-stone-200 bg-stone-50
                  text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
              <button
                type="button"
                onClick={handleCF}
                className="px-3 py-2 text-xs font-semibold bg-stone-100 hover:bg-stone-200
                  text-stone-600 rounded-xl transition-colors border border-stone-200 shrink-0"
              >
                CF
              </button>
            </div>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="razonSocial" className="block text-xs font-semibold text-stone-500 mb-1 uppercase tracking-wider">
              Razón Social
            </label>
            <input
              id="razonSocial"
              type="text"
              required
              value={form.razonSocial}
              onChange={campo("razonSocial")}
              placeholder="Nombre completo del contribuyente"
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 bg-stone-50
                text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            />
          </div>
        </div>

        <div>
          <label htmlFor="direccion" className="block text-xs font-semibold text-stone-500 mb-1 uppercase tracking-wider">
            Dirección Fiscal
          </label>
          <input
            id="direccion"
            type="text"
            required
            value={form.direccion}
            onChange={campo("direccion")}
            placeholder="Dirección completa del contribuyente"
            className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 bg-stone-50
              text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
          />
        </div>
      </div>

      {/* Sección B — Detalle de Venta */}
      <div className="bg-white rounded-3xl border border-stone-200/60 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-bold text-stone-700 uppercase tracking-wider">
          B — Detalle de Venta
        </h2>

        <div>
          <label htmlFor="item" className="block text-xs font-semibold text-stone-500 mb-1 uppercase tracking-wider">
            Producto / Servicio
          </label>
          <select
            id="item"
            value={form.item}
            onChange={campo("item")}
            className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 bg-stone-50
              text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition cursor-pointer"
          >
            {ITEMS.map((it) => <option key={it} value={it}>{it}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="cantidad" className="block text-xs font-semibold text-stone-500 mb-1 uppercase tracking-wider">
              Cantidad
            </label>
            <input
              id="cantidad"
              type="number"
              min="1"
              step="1"
              required
              value={form.cantidad}
              onChange={campo("cantidad")}
              placeholder="0"
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 bg-stone-50
                text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            />
          </div>
          <div>
            <label htmlFor="precioUnitario" className="block text-xs font-semibold text-stone-500 mb-1 uppercase tracking-wider">
              Precio Unitario (Q.)
            </label>
            <input
              id="precioUnitario"
              type="number"
              min="0"
              step="0.01"
              required
              value={form.precioUnitario}
              onChange={campo("precioUnitario")}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 bg-stone-50
                text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            />
          </div>
        </div>

        {/* Desglose de impuestos */}
        <div className="bg-stone-50 rounded-2xl border border-stone-200/60 p-4 space-y-2">
          <div className="flex justify-between text-sm text-stone-500">
            <span>Subtotal (base imponible)</span>
            <span className="font-mono">Q. {Q(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-orange-600">
            <span>IVA (12% incluido)</span>
            <span className="font-mono">Q. {Q(iva)}</span>
          </div>
          <div className="border-t border-stone-200 pt-2 flex justify-between text-base font-bold text-stone-900">
            <span>Total</span>
            <span className="font-mono text-emerald-700">Q. {Q(total)}</span>
          </div>
        </div>

        {errorEnvio && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
            {errorEnvio}
          </p>
        )}

        <button
          id="btn-emitir-factura"
          type="submit"
          disabled={enviando || total <= 0}
          className="w-full flex items-center justify-center gap-2 bg-emerald-800 hover:bg-emerald-700
            disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold
            py-3 rounded-2xl transition-colors duration-200 text-sm"
        >
          {enviando ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Procesando…</>
          ) : (
            <><FileText className="w-4 h-4" /> Emitir y Firmar Factura</>
          )}
        </button>
      </div>
    </form>
  );
}

/* ─── Formulario de Registro de Jornada ──────────────────────── */
interface FormJornada {
  fecha:                   string;
  area:                    AreaPlanta;
  modelo:                  Modelo;
  unidadesProducidas:      string;
  horasTrabajadas:         string;
  nColaboradores:          string;
  salarioDiarioPorPersona: string;
}

const FORM_JORNADA_INICIAL: FormJornada = {
  fecha:                   todayString(),
  area:                    "Herrería",
  modelo:                  "Ecocina",
  unidadesProducidas:      "",
  horasTrabajadas:         "8",
  nColaboradores:          "1",
  salarioDiarioPorPersona: String(SALARIO_DIARIO_DEFAULT),
};

function FormRegistroJornada({ sesionUid }: { sesionUid: string }) {
  const [abierto,  setAbierto]  = useState(false);
  const [form,     setForm]     = useState<FormJornada>(FORM_JORNADA_INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [exitoso,  setExitoso]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const unidades = parseInt(form.unidadesProducidas)       || 0;
  const horas    = parseFloat(form.horasTrabajadas)         || 0;
  const nColab   = parseInt(form.nColaboradores)            || 1;
  const salario  = parseFloat(form.salarioDiarioPorPersona) || SALARIO_DIARIO_DEFAULT;

  const costoManoObra = salario * nColab;
  const costoUnitario = unidades > 0 ? costoManoObra / unidades : 0;

  const campo = (key: keyof FormJornada) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (unidades <= 0) { setError("Debe ingresar al menos 1 unidad producida."); return; }
    if (horas   <= 0)  { setError("Las horas trabajadas deben ser mayores a 0."); return; }
    setError(null);
    setEnviando(true);
    try {
      await addDoc(collection(db, "registros_produccion"), {
        fecha:                   form.fecha,
        semanaId:                getSemanaId(form.fecha),
        area:                    form.area,
        modelo:                  form.modelo,
        unidadesProducidas:      unidades,
        horasTrabajadas:         horas,
        costoManoObra:           parseFloat(costoManoObra.toFixed(2)),
        costoUnitario:           parseFloat(costoUnitario.toFixed(4)),
        nColaboradores:          nColab,
        salarioDiarioPorPersona: salario,
        empleadoIds:             [],
        registradoPor:           sesionUid,
        creadoEn:                serverTimestamp(),
      });
      setForm({ ...FORM_JORNADA_INICIAL, fecha: todayString() });
      setExitoso(true);
      setAbierto(false);
      setTimeout(() => setExitoso(false), 5000);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Error al guardar el registro.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-stone-200/60 shadow-sm overflow-hidden">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-stone-50/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          <PlusCircle className="w-4 h-4 text-emerald-700" />
          <span className="text-sm font-semibold text-stone-700">Registrar Jornada de Producción</span>
        </div>
        {abierto
          ? <ChevronUp className="w-4 h-4 text-stone-400" />
          : <ChevronDown className="w-4 h-4 text-stone-400" />}
      </button>

      {exitoso && (
        <div className="mx-6 mb-4 flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl px-5 py-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <p className="text-sm font-medium">Jornada registrada correctamente.</p>
        </div>
      )}

      {abierto && (
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-5 border-t border-stone-100 pt-5">

          {/* Fila 1: Fecha + Área */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1 uppercase tracking-wider">Fecha</label>
              <input
                type="date"
                required
                value={form.fecha}
                onChange={campo("fecha")}
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 bg-stone-50
                  text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1 uppercase tracking-wider">Área</label>
              <select
                required
                value={form.area}
                onChange={campo("area")}
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 bg-stone-50
                  text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition cursor-pointer"
              >
                {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {/* Fila 2: Modelo */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1 uppercase tracking-wider">Modelo Producido</label>
            <select
              required
              value={form.modelo}
              onChange={campo("modelo")}
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 bg-stone-50
                text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition cursor-pointer"
            >
              {MODELOS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Fila 3: Unidades + Horas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1 uppercase tracking-wider">
                Unidades Producidas
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={form.unidadesProducidas}
                onChange={campo("unidadesProducidas")}
                placeholder="0"
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 bg-stone-50
                  text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1 uppercase tracking-wider">
                Horas Trabajadas
              </label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                required
                value={form.horasTrabajadas}
                onChange={campo("horasTrabajadas")}
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 bg-stone-50
                  text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>
          </div>

          {/* Fila 4: Colaboradores + Salario */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1 uppercase tracking-wider">
                N° de Colaboradores
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={form.nColaboradores}
                onChange={campo("nColaboradores")}
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 bg-stone-50
                  text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1 uppercase tracking-wider">
                Salario/Día por Persona (Q.)
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                required
                value={form.salarioDiarioPorPersona}
                onChange={campo("salarioDiarioPorPersona")}
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 bg-stone-50
                  text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>
          </div>

          {/* Preview de cálculos */}
          <div className="bg-stone-50 rounded-2xl border border-stone-200/60 p-4 space-y-2">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Vista Previa</p>
            <div className="flex justify-between text-sm text-stone-600">
              <span>Costo de mano de obra</span>
              <span className="font-mono font-semibold text-stone-800">Q. {Q(costoManoObra)}</span>
            </div>
            <div className="flex justify-between text-sm text-stone-600">
              <span>Costo unitario</span>
              <span className={`font-mono font-semibold ${costoUnitario > 0 ? "text-emerald-700" : "text-stone-400"}`}>
                {costoUnitario > 0 ? `Q. ${Q(costoUnitario)}` : "—"}
              </span>
            </div>
            <div className="flex justify-between text-sm text-stone-600">
              <span>Semana ID</span>
              <span className="font-mono text-stone-500 text-xs">{form.fecha ? getSemanaId(form.fecha) : "—"}</span>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setAbierto(false); setError(null); }}
              className="flex-1 py-3 text-sm font-semibold rounded-2xl border border-stone-200 text-stone-600
                hover:bg-stone-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-800 hover:bg-emerald-700
                disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold
                py-3 rounded-2xl transition-colors text-sm"
            >
              {enviando ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> Guardar Jornada</>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ─── Análisis de Producción ─────────────────────────────────── */
function AnalisisProduccion({
  sesionUid,
}: {
  sesionUid: string;
}) {
  const [registros, setRegistros] = useState<RegistroProduccion[]>([]);
  const [cargando,  setCargando]  = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "registros_produccion"),
      orderBy("fecha", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setRegistros(
        snap.docs.map((d) => ({
          id:                 d.id,
          fecha:              d.data().fecha              ?? "",
          semanaId:           d.data().semanaId           ?? "",
          area:               d.data().area               ?? "Herrería",
          empleadoIds:        d.data().empleadoIds        ?? [],
          modelo:             d.data().modelo             ?? "Ecocina",
          unidadesProducidas: d.data().unidadesProducidas ?? 0,
          horasTrabajadas:    d.data().horasTrabajadas    ?? 0,
          costoManoObra:      d.data().costoManoObra      ?? 0,
          costoUnitario:      d.data().costoUnitario      ?? 0,
          registradoPor:      d.data().registradoPor      ?? "",
        }))
      );
      setCargando(false);
    });
    return () => unsub();
  }, []);

  const semanaActual = getCurrentWeekId();
  const mesActual    = getCurrentMonthPrefix();

  const registrosSemana = useMemo(
    () => registros.filter((r) => r.semanaId === semanaActual),
    [registros, semanaActual]
  );

  const registrosMes = useMemo(
    () => registros.filter((r) => r.fecha.startsWith(mesActual)),
    [registros, mesActual]
  );

  /* KPIs */
  const totalUnidadesSemana = useMemo(
    () => registrosSemana.reduce((a, r) => a + r.unidadesProducidas, 0),
    [registrosSemana]
  );
  const totalHorasSemana = useMemo(
    () => registrosSemana.reduce((a, r) => a + r.horasTrabajadas, 0),
    [registrosSemana]
  );
  const avgCostoUnitario = useMemo(() => {
    if (registrosSemana.length === 0) return 0;
    return registrosSemana.reduce((a, r) => a + r.costoUnitario, 0) / registrosSemana.length;
  }, [registrosSemana]);

  const eficiencia = totalHorasSemana > 0 ? totalUnidadesSemana / totalHorasSemana : 0;

  /* Bar chart: producción por día de la semana actual */
  const todayDate = new Date();
  const dayOfWeek = todayDate.getDay() === 0 ? 7 : todayDate.getDay();
  const monday = new Date(todayDate);
  monday.setDate(todayDate.getDate() - dayOfWeek + 1);

  const diasSemana = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, "0");
    const dd   = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const diasLabels = ["Lun", "Mar", "Mié", "Jue", "Vie"];

  type DiaData = {
    fecha:   string;
    label:   string;
    total:   number;
    porArea: Partial<Record<AreaPlanta, number>>;
  };

  const produccionPorDia: DiaData[] = useMemo(
    () =>
      diasSemana.map((fecha, i) => {
        const dayRegs = registrosSemana.filter((r) => r.fecha === fecha);
        const porArea: Partial<Record<AreaPlanta, number>> = {};
        let total = 0;
        dayRegs.forEach((r) => {
          porArea[r.area] = (porArea[r.area] ?? 0) + r.unidadesProducidas;
          total += r.unidadesProducidas;
        });
        return { fecha, label: diasLabels[i], total, porArea };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registrosSemana]
  );

  const maxDayTotal = Math.max(...produccionPorDia.map((d) => d.total), 1);

  /* Ranking por área */
  const rankingAreas = useMemo(() => {
    const map: Record<string, {
      area:     AreaPlanta;
      unidades: number;
      horas:    number;
      costos:   number[];
      count:    number;
    }> = {};
    registrosSemana.forEach((r) => {
      if (!map[r.area]) map[r.area] = { area: r.area, unidades: 0, horas: 0, costos: [], count: 0 };
      map[r.area].unidades += r.unidadesProducidas;
      map[r.area].horas    += r.horasTrabajadas;
      map[r.area].costos.push(r.costoUnitario);
      map[r.area].count++;
    });
    return Object.values(map)
      .sort((a, b) => b.unidades - a.unidades)
      .map((v) => ({
        ...v,
        avgCosto: v.costos.length > 0
          ? v.costos.reduce((s, c) => s + c, 0) / v.costos.length
          : 0,
      }));
  }, [registrosSemana]);

  /* KPI sparklines: last 7 days total units */
  const sparkline = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const fecha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return registros
        .filter((r) => r.fecha === fecha)
        .reduce((a, r) => a + r.unidadesProducidas, 0);
    });
  }, [registros]);

  if (cargando) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white rounded-3xl border border-stone-200/60" />
          ))}
        </div>
        <div className="h-64 bg-white rounded-3xl border border-stone-200/60" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          titulo="Costo x Unidad"
          valor={avgCostoUnitario > 0 ? `Q. ${Q(avgCostoUnitario)}` : "—"}
          descripcion="Promedio semana actual"
          barras={sparkline}
          colorBarra="bg-blue-500"
        />
        <KpiCard
          titulo="Unidades esta semana"
          valor={N(totalUnidadesSemana, 0)}
          descripcion={`${registrosSemana.length} registros`}
          barras={produccionPorDia.map((d) => d.total)}
          colorBarra="bg-emerald-500"
        />
        <KpiCard
          titulo="Eficiencia"
          valor={eficiencia > 0 ? `${N(eficiencia)} uds/h` : "—"}
          descripcion="Unidades por hora trabajada"
          barras={sparkline}
          colorBarra="bg-orange-400"
        />
        <KpiCard
          titulo="Registros este mes"
          valor={String(registrosMes.length)}
          descripcion={mesActual}
          barras={sparkline}
          colorBarra="bg-slate-400"
        />
      </div>

      {/* Gráfico de barras: Producción Diaria */}
      <div className="bg-white rounded-3xl border border-stone-200/60 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-sm font-semibold text-stone-700">Producción Diaria — Semana Actual</h2>
          <div className="flex flex-wrap gap-3">
            {AREAS.map((a) => (
              <span key={a} className="flex items-center gap-1.5 text-xs text-stone-500">
                <span className={`w-2.5 h-2.5 rounded-full ${AREA_COLOR[a]}`} />
                {a}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {produccionPorDia.map((dia) => (
            <div key={dia.fecha} className="flex items-center gap-3">
              <span className="w-8 text-xs font-semibold text-stone-500 shrink-0">{dia.label}</span>
              <div className="flex-1 flex items-center gap-0.5 h-7 rounded-lg overflow-hidden bg-stone-100">
                {dia.total === 0 ? (
                  <div className="h-full w-full bg-stone-100 rounded-lg" />
                ) : (
                  AREAS.map((area) => {
                    const uds = dia.porArea[area] ?? 0;
                    const pct = (uds / maxDayTotal) * 100;
                    if (pct === 0) return null;
                    return (
                      <div
                        key={area}
                        title={`${area}: ${uds} uds`}
                        className={`h-full ${AREA_COLOR[area]} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    );
                  })
                )}
              </div>
              <span className="w-14 text-right text-xs font-mono text-stone-500 shrink-0">
                {dia.total > 0 ? `${dia.total} uds` : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Ranking por área */}
      <div className="bg-white rounded-3xl border border-stone-200/60 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100">
          <h2 className="text-sm font-semibold text-stone-700">Productividad por Área — Semana Actual</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-100">
                {["Área", "Unidades", "Horas", "Costo Unitario Prom.", "Tendencia"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-stone-400 tracking-wider uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {rankingAreas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-stone-400">
                    No hay registros esta semana.
                  </td>
                </tr>
              ) : (
                rankingAreas.map((r, idx) => {
                  /* mini sparkline per area from last 7 days */
                  const today = new Date();
                  const areaSparkline = Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(today);
                    d.setDate(today.getDate() - (6 - i));
                    const fecha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                    return registros
                      .filter((reg) => reg.fecha === fecha && reg.area === r.area)
                      .reduce((a, reg) => a + reg.unidadesProducidas, 0);
                  });
                  const sparkMax = Math.max(...areaSparkline, 1);

                  return (
                    <tr key={r.area} className="hover:bg-stone-50/80 transition-colors">
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-2 text-sm font-semibold ${AREA_TEXT_COLOR[r.area]}`}>
                          <span className={`w-2.5 h-2.5 rounded-full ${AREA_COLOR[r.area]}`} />
                          {idx === 0 && <span className="text-xs">🏆</span>}
                          {r.area}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm font-bold text-stone-800">{r.unidades}</td>
                      <td className="px-5 py-3 text-sm text-stone-600">{N(r.horas)} h</td>
                      <td className="px-5 py-3 text-sm font-mono text-stone-700">
                        {r.avgCosto > 0 ? `Q. ${Q(r.avgCosto)}` : "—"}
                      </td>
                      <td className="px-5 py-3">
                        {/* CSS-only sparkline */}
                        <div className="flex items-end gap-0.5 h-8 w-20">
                          {areaSparkline.map((v, i) => (
                            <div
                              key={i}
                              className={`flex-1 rounded-sm ${AREA_COLOR[r.area]} opacity-80`}
                              style={{ height: `${Math.max(4, (v / sparkMax) * 100)}%` }}
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Formulario de registro de jornada (Gerente y Subgerente) */}
      <FormRegistroJornada sesionUid={sesionUid} />
    </div>
  );
}

/* ─── Panel de Planillas ─────────────────────────────────────── */
function calcularHoras(entrada: string, salida: string | null) {
  if (!salida) return { ordinarias: 0, extra: 0 };
  const parseTime = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h + (m || 0) / 60;
  };
  const start = parseTime(entrada);
  const end = parseTime(salida);
  let total = end - start;
  if (total < 0) total += 24;
  
  const ordinarias = Math.min(total, 8);
  const extra = Math.max(total - 8, 0);
  return { ordinarias, extra };
}

type EmpleadoResumen = {
  usuarioId: string;
  nombre: string;
  diasTrabajados: number;
  horasOrdinarias: number;
  horasExtra: number;
};

function PlanillasPanel({ sesionUid }: { sesionUid: string }) {
  const [quincena, setQuincena] = useState<string>(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const q = today.getDate() <= 15 ? "Q1" : "Q2";
    return `${today.getFullYear()}-${mm}-${q}`;
  });
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ajustesExtra, setAjustesExtra] = useState<Record<string, number>>({});
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const quincenaOptions = useMemo(() => {
    const opts = [];
    const d = new Date();
    for (let i = 0; i < 6; i++) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const q = d.getDate() <= 15 ? "Q1" : "Q2";
      opts.push(`${yyyy}-${mm}-${q}`);
      if (q === "Q2") {
        d.setDate(10);
      } else {
        d.setDate(0);
      }
    }
    return opts;
  }, []);

  useEffect(() => {
    const [yyyy, mm, qPeriod] = quincena.split("-");
    const prefix = `${yyyy}-${mm}`;
    const startDate = `${prefix}-${qPeriod === "Q1" ? "01" : "16"}`;
    const endDate = `${prefix}-${qPeriod === "Q1" ? "15" : "31"}`;
    
    const dbQ = query(collection(db, "asistencias"), orderBy("fecha", "asc"));
    const unsub = onSnapshot(dbQ, (snap) => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Asistencia))
        .filter(a => a.fecha >= startDate && a.fecha <= endDate);
      setAsistencias(data);
      setCargando(false);
    });
    return () => unsub();
  }, [quincena]);

  const resumen = useMemo(() => {
    const map: Record<string, EmpleadoResumen> = {};
    asistencias.forEach(a => {
      if (!map[a.usuarioId]) {
        map[a.usuarioId] = {
          usuarioId: a.usuarioId,
          nombre: a.nombre,
          diasTrabajados: 0,
          horasOrdinarias: 0,
          horasExtra: 0,
        };
      }
      map[a.usuarioId].diasTrabajados++;
      if (a.entrada && a.salida) {
        const h = calcularHoras(a.entrada, a.salida);
        map[a.usuarioId].horasOrdinarias += h.ordinarias;
        map[a.usuarioId].horasExtra += h.extra;
      }
    });
    return Object.values(map);
  }, [asistencias]);

  const handleAprobar = async () => {
    setGuardando(true);
    setMensaje("");
    try {
      for (const r of resumen) {
        await addDoc(collection(db, "planillas"), {
          quincenaId: quincena,
          empleadoId: r.usuarioId,
          empleadoNombre: r.nombre,
          diasTrabajados: r.diasTrabajados,
          horasOrdinarias: parseFloat(r.horasOrdinarias.toFixed(2)),
          horasExtra: parseFloat(r.horasExtra.toFixed(2)),
          horasDeficit: 0,
          horasAprobadasExtra: parseFloat((ajustesExtra[r.usuarioId] ?? r.horasExtra).toFixed(2)),
          estado: "Aprobada",
          aprobadoEn: serverTimestamp(),
          aprobadoPor: sesionUid
        });
      }
      setMensaje("Planilla aprobada y guardada exitosamente.");
    } catch (err) {
      console.error(err);
      setMensaje("Error al aprobar planilla.");
    } finally {
      setGuardando(false);
    }
  };

  const isNear = useMemo(() => {
    const today = new Date();
    const date = today.getDate();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return (date >= 12 && date <= 15) || (date >= lastDay - 3 && date <= lastDay);
  }, []);

  return (
    <div className="space-y-6">
      {isNear && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 rounded-2xl px-5 py-4">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">Recordatorio: Debe aprobar la planilla de la quincena pronto.</p>
        </div>
      )}

      {mensaje && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl px-5 py-4">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{mensaje}</p>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-stone-200/60 shadow-sm p-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-stone-700 uppercase tracking-wider">Gestión de Planillas</h2>
            <p className="text-xs text-stone-500 mt-1">Seleccione la quincena para revisar asistencias y horas extra.</p>
          </div>
          <select
            value={quincena}
            onChange={(e) => setQuincena(e.target.value)}
            className="px-4 py-2 text-sm rounded-xl border border-stone-200 bg-stone-50 text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition cursor-pointer"
          >
            {quincenaOptions.map(q => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </div>

        {cargando ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
          </div>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="w-full">
              <thead>
                <tr className="border-b border-stone-100">
                  {["Colaborador", "Días Trabajados", "H. Ordinarias", "H. Extra Calculadas", "Ajustar H. Extra"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-stone-400 tracking-wider uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {resumen.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-stone-400">
                      No hay registros de asistencia para esta quincena.
                    </td>
                  </tr>
                ) : (
                  resumen.map((r) => (
                    <tr key={r.usuarioId} className="hover:bg-stone-50/80 transition-colors">
                      <td className="px-5 py-3 text-sm font-semibold text-stone-800">{r.nombre}</td>
                      <td className="px-5 py-3 text-sm text-stone-600">{r.diasTrabajados} días</td>
                      <td className="px-5 py-3 text-sm text-stone-600">{r.horasOrdinarias.toFixed(2)} h</td>
                      <td className="px-5 py-3 text-sm text-stone-600">{r.horasExtra.toFixed(2)} h</td>
                      <td className="px-5 py-3 text-sm">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={ajustesExtra[r.usuarioId] ?? Number(r.horasExtra.toFixed(2))}
                          onChange={(e) => setAjustesExtra(prev => ({ ...prev, [r.usuarioId]: parseFloat(e.target.value) || 0 }))}
                          className="w-24 px-3 py-1.5 text-sm rounded-lg border border-stone-200 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {resumen.length > 0 && (
          <div className="pt-4 flex justify-end">
            <button
              onClick={handleAprobar}
              disabled={guardando}
              className="flex items-center gap-2 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm"
            >
              {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
              Aprobar Planilla
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Configuración Financiera ────────────────────────────────── */
function ConfiguracionFinanciera() {
  const [costosFijos, setCostosFijos] = useState<string>("28240");
  const [precioVenta, setPrecioVenta] = useState<string>("1400");
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [recetas, setRecetas] = useState<ProductoReceta[]>([]);
  const [modeloSel, setModeloSel] = useState<string>("Todos");
  
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const unsubConf = onSnapshot(doc(db, "configuracion", "parametros_financieros"), (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        if (d.costosFijosMensuales !== undefined) setCostosFijos(String(d.costosFijosMensuales));
        if (d.precioVentaPromedio !== undefined) setPrecioVenta(String(d.precioVentaPromedio));
      } else {
        // Inicializar con los números reales solicitados por el usuario
        setDoc(doc(db, "configuracion", "parametros_financieros"), {
          costosFijosMensuales: 28240,
          precioVentaPromedio: 1400,
          actualizadoEn: serverTimestamp()
        });
      }
    });
    const unsubMat = onSnapshot(collection(db, "materiales"), (snap) => {
      setMateriales(snap.docs.map(d => ({ id: d.id, ...d.data() } as Material)));
    });
    const unsubRec = suscribirRecetas(setRecetas);

    return () => { unsubConf(); unsubMat(); unsubRec(); };
  }, []);

  const calcularCostoVariable = useCallback((modelo: string) => {
    const receta = recetas.find(r => r.modelo === modelo);
    if (!receta) return 0;
    const precios = new Map(materiales.map(m => [m.id, Number(m.precioEstimado) || 0]));
    return calcularCostoUnitario(receta, precios);
  }, [materiales, recetas]);

  const costosPorModelo = useMemo(() => {
    const obj: Record<string, number> = {};
    MODELOS.forEach(m => {
      obj[m] = calcularCostoVariable(m);
    });
    return obj;
  }, [calcularCostoVariable]);

  const costoVariableUsado = useMemo(() => {
    if (modeloSel === "Todos") {
      const costs = Object.values(costosPorModelo).filter(c => c > 0);
      if (costs.length === 0) return 0;
      return costs.reduce((a, b) => a + b, 0) / costs.length;
    }
    return costosPorModelo[modeloSel] || 0;
  }, [modeloSel, costosPorModelo]);

  const cFijosNum = parseFloat(costosFijos) || 0;
  const pVentaNum = parseFloat(precioVenta) || 0;

  const puntoEquilibrio = useMemo(() => {
    if (cFijosNum === 0 || pVentaNum === 0 || pVentaNum <= costoVariableUsado) return 0;
    return cFijosNum / (pVentaNum - costoVariableUsado);
  }, [cFijosNum, pVentaNum, costoVariableUsado]);

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await setDoc(doc(db, "configuracion", "parametros_financieros"), {
        costosFijosMensuales: parseFloat(costosFijos) || 0,
        precioVentaPromedio: parseFloat(precioVenta) || 0,
        actualizadoEn: serverTimestamp()
      }, { merge: true });
      setMensaje("Parámetros guardados correctamente.");
      setTimeout(() => setMensaje(""), 4000);
    } catch (err) {
      console.error(err);
      setMensaje("Error al guardar.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {mensaje && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl px-5 py-4">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{mensaje}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Formulario */}
        <form onSubmit={handleGuardar} className="bg-white rounded-3xl border border-stone-200/60 shadow-sm p-6 flex flex-col gap-6">
          <div>
            <h2 className="text-sm font-bold text-stone-700 uppercase tracking-wider mb-1">
              Parámetros Financieros
            </h2>
            <p className="text-xs text-stone-500">
              Configure los costos fijos y el precio de venta para el análisis de punto de equilibrio.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1 uppercase tracking-wider">
                Costos Fijos Mensuales (Q)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-semibold">Q.</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={costosFijos}
                  onChange={(e) => setCostosFijos(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-stone-200 bg-stone-50 text-stone-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition font-mono font-medium"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1 uppercase tracking-wider">
                Precio Venta Promedio (Q)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-semibold">Q.</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={precioVenta}
                  onChange={(e) => setPrecioVenta(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-stone-200 bg-stone-50 text-stone-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition font-mono font-medium"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={guardando}
            className="mt-auto w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors shadow-sm text-sm"
          >
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar Configuración
          </button>
        </form>

        {/* KPI Punto Equilibrio */}
        <div className="bg-white rounded-3xl border border-stone-200/60 shadow-sm p-6 flex flex-col gap-6 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-indigo-50 rounded-full blur-3xl group-hover:bg-indigo-100 transition-colors duration-500" />
          
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <h2 className="text-sm font-bold text-stone-700 uppercase tracking-wider mb-1 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-indigo-500" /> Punto de Equilibrio
              </h2>
              <p className="text-xs text-stone-500">Unidades necesarias para cubrir costos</p>
            </div>
            
            <select
              value={modeloSel}
              onChange={e => setModeloSel(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-200 bg-stone-50 text-stone-700 focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm"
            >
              <option value="Todos">Promedio Global</option>
              {MODELOS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="relative z-10 flex-1 flex flex-col items-center justify-center py-6">
            <span className="text-[56px] font-black text-indigo-950 tracking-tighter leading-none drop-shadow-sm">
              {puntoEquilibrio > 0 ? N(Math.ceil(puntoEquilibrio), 0) : "—"}
            </span>
            <span className="text-sm font-bold text-indigo-600 uppercase tracking-widest mt-2">
              Unidades / Mes
            </span>
          </div>

          <div className="relative z-10 grid grid-cols-2 gap-4 pt-4 border-t border-stone-100">
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Margen de Contribución</p>
              <p className="text-sm font-mono font-bold text-emerald-700 mt-1">
                Q. {Q(Math.max(0, pVentaNum - costoVariableUsado))}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Costo Variable Unitario</p>
              <p className="text-sm font-mono font-bold text-orange-600 mt-1">
                Q. {Q(costoVariableUsado)}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Listado de Costos Variables por Modelo */}
      <div className="bg-white rounded-3xl border border-stone-200/60 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100">
          <h2 className="text-sm font-semibold text-stone-700">Costos Variables por Modelo (Basado en Recetas)</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-stone-100">
          {MODELOS.map(m => (
            <div key={m} className="p-6 flex flex-col items-center justify-center text-center hover:bg-stone-50 transition-colors">
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">{m}</span>
              <span className="text-xl font-mono font-bold text-stone-800">Q. {Q(costosPorModelo[m] || 0)}</span>
              {(!costosPorModelo[m] || costosPorModelo[m] === 0) && (
                <span className="text-[10px] text-orange-500 mt-2 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Falta receta o precios
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Página Principal ───────────────────────────────────────── */
export default function FinanzasPage() {
  const { sesion, cargando } = useAuth();
  const router = useRouter();
  const [pestana, setPestana] = useState<"panel" | "factura" | "analisis" | "planillas" | "configuracion">("panel");
  const [facturas, setFacturas] = useState<Factura[]>([]);

  useEffect(() => {
    if (cargando) return;
    if (!sesion) { router.replace("/login"); return; }
    if (sesion.rol !== "Gerente" && sesion.rol !== "Subgerente") {
      router.replace("/dashboard?acceso=denegado");
    }
  }, [cargando, sesion, router]);

  useEffect(() => {
    if (!sesion) return;
    if (sesion.rol !== "Gerente" && sesion.rol !== "Subgerente") return;
    const q = query(collection(db, "facturas"), orderBy("emitidoEn", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setFacturas(
        snap.docs.map((d) => ({
          id:             d.id,
          nit:            d.data().nit            ?? "",
          razonSocial:    d.data().razonSocial    ?? "",
          direccion:      d.data().direccion      ?? "",
          item:           d.data().item           ?? "",
          cantidad:       d.data().cantidad       ?? 0,
          precioUnitario: d.data().precioUnitario ?? 0,
          subtotal:       d.data().subtotal       ?? 0,
          iva:            d.data().iva            ?? 0,
          total:          d.data().total          ?? 0,
          uuid_fel:       d.data().uuid_fel,
          url_pdf:        d.data().url_pdf,
        }))
      );
    });
    return () => unsub();
  }, [sesion]);

  if (cargando) return <Skeleton />;
  if (!sesion) return null;
  if (sesion.rol !== "Gerente" && sesion.rol !== "Subgerente") return null;

  const esGerente = sesion.rol === "Gerente";

  type TabId = "panel" | "factura" | "analisis" | "planillas" | "configuracion";
  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "panel",    label: "Panel de Control",         icon: <BarChart3 className="w-4 h-4" /> },
    ...(esGerente
      ? [
          { id: "factura" as TabId, label: "Emisión de Facturas", icon: <FileText className="w-4 h-4" /> },
          { id: "configuracion" as TabId, label: "Configuración Financiera", icon: <Settings className="w-4 h-4" /> }
        ]
      : []
    ),
    { id: "analisis", label: "Análisis de Producción",   icon: <Activity className="w-4 h-4" /> },
    { id: "planillas", label: "Planillas",               icon: <Wallet className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">

        {/* Encabezado */}
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-emerald-700
              transition-colors mb-3 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Volver al Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Finanzas</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Panel financiero y análisis de producción
            {esGerente ? " — acceso exclusivo Gerencia." : " — vista Subgerencia."}
          </p>
        </div>

        {/* Pestañas */}
        <div className="inline-flex bg-white border border-stone-200/60 rounded-2xl p-1 gap-1 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setPestana(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
                ${pestana === t.id
                  ? "bg-emerald-800 text-white shadow-sm"
                  : "text-stone-500 hover:text-stone-700 hover:bg-stone-50"}`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        {pestana === "panel" && <PanelControl facturas={facturas} />}
        {pestana === "factura" && esGerente && <FormularioFactura sesionUid={sesion.uid} />}
        {pestana === "configuracion" && esGerente && <ConfiguracionFinanciera />}
        {pestana === "analisis" && (
          <AnalisisProduccion sesionUid={sesion.uid} />
        )}
        {pestana === "planillas" && <PlanillasPanel sesionUid={sesion.uid} />}
      </div>
    </div>
  );
}
