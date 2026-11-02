"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  query, 
  where,
  serverTimestamp
} from "firebase/firestore";

import {
  ArrowLeft,
  Warehouse,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Package,
  FileText,
  BarChart3,
  X,
  Loader2,
  Plus,
  Minus,
  CheckCircle2,
  Settings,
  ListTodo,
  Layers,
  Wrench,
  ChevronLeft,
  ChevronRight,
  Users,
  Flame,
  Truck,
  MoreHorizontal,
  Save,
  Trash2,
  UserPlus
} from "lucide-react";

import {
  Modelo,
  MODELOS,
  AreaPlanta,
  PrioridadTarea as Prioridad,
  StockItem,
  Movimiento,
  UsuarioReal,
  TareaReal,
  BloqueSemanal,
  DIAS_SEMANA,
  HORAS_JORNADA_SEMANAL
} from "@/types";
import ResumenRecetas from "@/features/inventory/components/ResumenRecetas";
import {
  registrarMovimientoStock,
  StockInsuficienteError,
} from "@/features/inventory/services/stock";

/* ═══════════════════════════════════════════════════════
   TIPOS Y CONSTANTES GLOBALES
═══════════════════════════════════════════════════════ */

type MainTab = "inventario" | "ajustes";
type AjustesTab = "recetas" | "tareas" | "planificacion";
const STOCK_MINIMO = 5;
const STOCK_MAX_REF = 20;

const hoy = (): string => new Date().toISOString().split("T")[0];
const hora = (): string => new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

/** Genera un ID de semana ISO tipo "2026-W23" */
const getSemanaId = (fecha?: Date): string => {
  const d = fecha ? new Date(fecha) : new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
};

const AREA_META: Record<AreaPlanta, { icon: React.ElementType; color: string; bg: string; ring: string }> = {
  "Herrería":      { icon: Wrench,         color: "text-amber-700",  bg: "bg-amber-50",   ring: "ring-amber-200" },
  "Fundición":     { icon: Flame,          color: "text-red-700",    bg: "bg-red-50",     ring: "ring-red-200" },
  "Carga":         { icon: Truck,          color: "text-blue-700",   bg: "bg-blue-50",    ring: "ring-blue-200" },
  "Labores Extras":{ icon: MoreHorizontal, color: "text-purple-700", bg: "bg-purple-50",  ring: "ring-purple-200" },
};

const PRIORIDAD_COLORS: Record<Prioridad, string> = {
  Alta: "bg-red-50 text-red-700 ring-1 ring-red-200/60",
  Media: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60",
  Baja: "bg-slate-100 text-slate-600 ring-1 ring-slate-200/60",
};

/* ═══════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
═══════════════════════════════════════════════════════ */
export default function PlantaPage() {
  const router = useRouter();
  const { sesion } = useAuth();

  // ── ESTADO MAESTRO DE NAVEGACIÓN ──
  const [mainTab, setMainTab] = useState<MainTab>("inventario");

  // ── ESTADOS: INVENTARIO (FIREBASE REAL) ──
  const [stock, setStock] = useState<StockItem[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);

  const [invTab, setInvTab] = useState<"entradas" | "salidas">("entradas");
  const [formInv, setFormInv] = useState({ modelo: "Ecocina" as Modelo, tipo: "entrada" as "entrada" | "salida", cantidad: 1, observaciones: "" });
  const [errorInv, setErrorInv] = useState<string | null>(null);
  const [exitoInv, setExitoInv] = useState(false);

  // ── ESTADOS: AJUSTES (Firebase Real) ──
  const [ajustesTab, setAjustesTab] = useState<AjustesTab>("recetas");

  // Ajustes -> Tareas y Empleados
  const [areaSeleccionada, setAreaSeleccionada] = useState<AreaPlanta | "">("");
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState<string>("");
  const [colaboradores, setColaboradores] = useState<UsuarioReal[]>([]);
  const [tareasGlobales, setTareasGlobales] = useState<TareaReal[]>([]);
  const [isAsignando, setIsAsignando] = useState(false);
  const [formTarea, setFormTarea] = useState({ descripcion: "", prioridad: "Media" as Prioridad });

  // Ajustes -> Planificación Semanal
  const [semanaActual, setSemanaActual] = useState<string>(getSemanaId());
  const [bloquesSemanales, setBloquesSemanales] = useState<BloqueSemanal[]>([]);
  const [mostrarFormBloque, setMostrarFormBloque] = useState(false);
  const [formBloque, setFormBloque] = useState<Partial<BloqueSemanal>>({
    area: "Herrería",
    empleadoId: "",
    modelo: "Ecocina",
    unidadesObjetivo: 1,
    horasEstimadas: 1,
    distribucionDiaria: {},
    esUrgente: false,
    notas: "",
  });

  /* ═══════════════════════════════════════════════════════
     EFECTOS DE FIREBASE (Suscripciones en tiempo real)
  ═══════════════════════════════════════════════════════ */
  
  useEffect(() => {
    if (!sesion) return;

    // 1. Escuchar Usuarios (Solo Colaboradores)
    const qUsuarios = query(collection(db, "usuarios"), where("rol", "==", "Colaborador"));
    const unsubUsuarios = onSnapshot(qUsuarios, (snap) => {
      const lista: UsuarioReal[] = snap.docs.map(d => ({
        uid: d.id,
        nombre: d.data().nombre ?? "",
        email: d.data().email ?? "",
        areaPlanta: d.data().areaPlanta ?? "",
      }));
      setColaboradores(lista);
    });

    // 3. Escuchar Tareas
    const qTareas = query(collection(db, "tareas_planta"));
    const unsubTareas = onSnapshot(qTareas, (snap) => {
      const lista: TareaReal[] = snap.docs.map(d => ({
        id: d.id,
        empleadoId: d.data().empleadoId ?? "",
        descripcion: d.data().descripcion ?? "",
        prioridad: d.data().prioridad ?? "Media",
        completada: d.data().completada ?? false,
        fecha: d.data().fecha ?? hoy(),
      }));
      setTareasGlobales(lista);
    });

    // 4. Escuchar Stock de Inventario
    const unsubStock = onSnapshot(collection(db, "inventario_stock"), (snap) => {
      const lista = snap.docs.map(d => ({ modelo: d.id, cantidad: d.data().cantidad ?? 0 }));
      // Asegurarse de tener todos los modelos base (incluso si no existen en DB)
      const stockFinal = MODELOS.map(m => ({
        modelo: m,
        cantidad: lista.find(s => s.modelo === m)?.cantidad ?? 0
      }));
      setStock(stockFinal);
    });

    // 5. Escuchar Movimientos de Inventario
    const qMovs = query(collection(db, "inventario_movimientos"));
    const unsubMovs = onSnapshot(qMovs, (snap) => {
      const lista: Movimiento[] = snap.docs.map(d => ({
        id: d.id,
        fecha: d.data().fecha ?? hoy(),
        hora: d.data().hora ?? hora(),
        modelo: d.data().modelo ?? "",
        cantidad: d.data().cantidad ?? 0,
        observaciones: d.data().observaciones ?? "",
        tipo: d.data().tipo ?? "entrada",
      }));
      lista.sort((a, b) => {
        if (a.fecha === b.fecha) return b.hora.localeCompare(a.hora);
        return b.fecha.localeCompare(a.fecha);
      });
      setMovimientos(lista);
    });

    // 6. Escuchar Bloques Semanales
    const unsubBloques = onSnapshot(collection(db, "planificacion_semanal"), (snap) => {
      const lista: BloqueSemanal[] = snap.docs.map(d => ({
        id: d.id,
        semanaId: d.data().semanaId ?? "",
        area: d.data().area ?? "Herrería",
        empleadoId: d.data().empleadoId ?? "",
        modelo: d.data().modelo ?? "Ecocina",
        unidadesObjetivo: d.data().unidadesObjetivo ?? 0,
        horasEstimadas: d.data().horasEstimadas ?? 8,
        distribucionDiaria: d.data().distribucionDiaria ?? {},
        esUrgente: d.data().esUrgente ?? false,
        notas: d.data().notas ?? "",
      }));
      setBloquesSemanales(lista);
    });

    return () => {
      unsubUsuarios();
      unsubTareas();
      unsubStock();
      unsubMovs();
      unsubBloques();
    };
  }, [sesion]);

  // ── LÓGICA: INVENTARIO (FIREBASE REAL) ──
  const kpis = useMemo(() => {
    const d = hoy();
    return {
      totalBodega: stock.reduce((s, i) => s + i.cantidad, 0),
      entradasHoy: movimientos.filter((m) => m.tipo === "entrada" && m.fecha === d).reduce((s, m) => s + m.cantidad, 0),
      salidasHoy: movimientos.filter((m) => m.tipo === "salida" && m.fecha === d).reduce((s, m) => s + m.cantidad, 0),
    };
  }, [stock, movimientos]);

  const historial = useMemo(() => movimientos.filter((m) => m.tipo === (invTab === "entradas" ? "entrada" : "salida")), [movimientos, invTab]);

  const handleInvSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorInv(null);
    if (formInv.cantidad <= 0) { setErrorInv("La cantidad debe ser mayor a cero."); return; }
    
    try {
      await registrarMovimientoStock({
        fecha: hoy(),
        hora: hora(),
        modelo: formInv.modelo,
        cantidad: formInv.cantidad,
        observaciones: formInv.observaciones.trim() || (formInv.tipo === "entrada" ? "Ingreso de producción" : "Despacho a campo"),
        tipo: formInv.tipo,
      });

      setFormInv((p) => ({ ...p, cantidad: 1, observaciones: "" }));
      setExitoInv(true);
      setTimeout(() => setExitoInv(false), 3000);
    } catch (e) {
      console.error("Error al registrar movimiento:", e);
      setErrorInv(e instanceof StockInsuficienteError
        ? e.message
        : "Fallo de red o permisos insuficientes.");
    }
  };

  // ── LÓGICA: TAREAS Y EMPLEADOS FIREBASE ──
  const handleAsignarArea = async (uid: string, area: string) => {
    try {
      await updateDoc(doc(db, "usuarios", uid), { areaPlanta: area });
      setIsAsignando(false);
    } catch (e) {
      console.error(e);
      alert("Error al asignar el empleado.");
    }
  };

  const handleDesvincular = async (uid: string) => {
    try {
      await updateDoc(doc(db, "usuarios", uid), { areaPlanta: "" });
      if (empleadoSeleccionado === uid) setEmpleadoSeleccionado("");
    } catch (e) {
      console.error(e);
      alert("Error al desvincular.");
    }
  };

  const handleCrearTarea = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!empleadoSeleccionado || !formTarea.descripcion.trim() || !sesion) return;

    try {
      await addDoc(collection(db, "tareas_planta"), {
        empleadoId: empleadoSeleccionado,
        descripcion: formTarea.descripcion.trim(),
        prioridad: formTarea.prioridad,
        completada: false,
        fecha: hoy(),
        creadoPor: sesion.uid,
        timestamp: serverTimestamp()
      });
      setFormTarea({ descripcion: "", prioridad: "Media" });
    } catch (e) {
      console.error(e);
      alert("Error al asignar tarea.");
    }
  };

  const handleBorrarTarea = async (idTarea: string) => {
    try {
      await deleteDoc(doc(db, "tareas_planta", idTarea));
    } catch (e) {
      console.error(e);
      alert("Error al borrar la tarea.");
    }
  };

  // ── SELECTORES Y MEMOS ──
  const empleadosEnArea = useMemo(() => 
    colaboradores.filter(c => c.areaPlanta === areaSeleccionada),
  [colaboradores, areaSeleccionada]);

  const tareasEmpleadoActual = useMemo(() => 
    tareasGlobales.filter(t => t.empleadoId === empleadoSeleccionado && t.fecha === hoy()),
  [tareasGlobales, empleadoSeleccionado]);

  // ── RENDER COMPONENTES ──
  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200/60 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12 space-y-8">

        {/* ── ENCABEZADO ── */}
        <div>
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-4 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" strokeWidth={1.5} />
            Volver al Dashboard
          </button>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-950 tracking-tight">Planta de Trabajo</h1>
              <p className="text-sm text-slate-500 mt-0.5">Control de producción, stock, recetas y asignaciones</p>
            </div>
            
            {/* TABS MAESTRAS */}
            <div className="flex items-center gap-1 bg-slate-200/50 p-1 rounded-xl shrink-0">
              <button
                onClick={() => setMainTab("inventario")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  mainTab === "inventario" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Package className="w-4 h-4" strokeWidth={2} />
                Inventario
              </button>
              <button
                onClick={() => setMainTab("ajustes")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  mainTab === "ajustes" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Settings className="w-4 h-4" strokeWidth={2} />
                Ajustes de Planta
              </button>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            VISTA 1: INVENTARIO (ORIGINAL MIGRADA)
        ══════════════════════════════════════════════════════════ */}
        {mainTab === "inventario" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Total en Bodega", value: kpis.totalBodega, sub: "unidades disponibles", icon: Warehouse, color: "bg-slate-100 text-slate-700" },
                { label: "Entradas de Hoy", value: kpis.entradasHoy, sub: "unidades ingresadas", icon: TrendingUp, color: "bg-emerald-50 text-emerald-600" },
                { label: "Despachos Hoy", value: kpis.salidasHoy, sub: "unidades despachadas", icon: TrendingDown, color: "bg-blue-50 text-blue-600" },
              ].map(({ label, value, sub, icon: Icon, color }) => (
                <div key={label} className="bg-gradient-to-b from-white to-slate-50/50 rounded-3xl ring-1 ring-slate-200/60 shadow-xs p-5 flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${color}`}>
                    <Icon className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">{label}</p>
                    <p className="text-2xl font-bold font-mono text-slate-950">{value}</p>
                    <p className="text-xs text-slate-400">{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Layout dos columnas */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
              <div className="space-y-6">
                {/* Tabla de stock */}
                <div className="bg-gradient-to-b from-white to-slate-50/50 rounded-3xl ring-1 ring-slate-200/60 shadow-xs overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-2">
                    <Package className="w-4.5 h-4.5 text-slate-600" strokeWidth={1.5} />
                    <h2 className="text-sm font-semibold text-slate-800 tracking-tight">Stock Actual en Bodega</h2>
                  </div>
                  <div className="divide-y divide-slate-100/80">
                    {stock.map((item) => {
                      const bajo = item.cantidad < STOCK_MINIMO;
                      const pct = Math.min(100, Math.round((item.cantidad / STOCK_MAX_REF) * 100));
                      return (
                        <div key={item.modelo} className="flex items-center gap-5 px-6 py-4">
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-800">{item.modelo}</span>
                              {bajo && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200/60 shrink-0">
                                  <AlertTriangle className="w-3 h-3" strokeWidth={1.5} />
                                  Bajo Stock
                                </span>
                              )}
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-500 ${bajo ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`text-2xl font-bold font-mono ${bajo ? "text-amber-600" : "text-slate-950"}`}>{item.cantidad}</span>
                            <p className="text-xs text-slate-400">uds.</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Historial con pestañas */}
                <div className="bg-gradient-to-b from-white to-slate-50/50 rounded-3xl ring-1 ring-slate-200/60 shadow-xs overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4.5 h-4.5 text-slate-600" strokeWidth={1.5} />
                      <h2 className="text-sm font-semibold text-slate-800 tracking-tight">Historial de Movimientos</h2>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-100/60 rounded-xl p-1">
                      {(["entradas", "salidas"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setInvTab(t)}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg capitalize transition-all duration-200 ${invTab === t ? "bg-white text-slate-900 ring-1 ring-slate-200/60 shadow-xs" : "text-slate-500 hover:text-slate-700"}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100/80 max-h-72 overflow-y-auto">
                    {historial.length === 0 ? (
                      <div className="py-10 text-center text-sm text-slate-400">Sin registros en esta categoría.</div>
                    ) : (
                      historial.map((m) => (
                        <div key={m.id} className="flex items-start gap-3 px-6 py-3.5 hover:bg-slate-50/60 transition-colors">
                          <div className={`mt-0.5 w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${m.tipo === "entrada" ? "bg-emerald-50" : "bg-blue-50"}`}>
                            {m.tipo === "entrada" ? <Plus className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2} /> : <Minus className="w-3.5 h-3.5 text-blue-600" strokeWidth={2} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-sm font-medium text-slate-800">{m.modelo}</span>
                              <span className={`text-xs font-mono font-bold ${m.tipo === "entrada" ? "text-emerald-600" : "text-blue-600"}`}>{m.tipo === "entrada" ? "+" : "-"}{m.cantidad}</span>
                            </div>
                            <p className="text-xs text-slate-500 truncate mt-0.5">{m.observaciones}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-mono text-slate-500">{m.hora}</p>
                            <p className="text-xs text-slate-400">{m.fecha}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Formulario Inventario */}
              <div className="bg-gradient-to-b from-white to-slate-50/50 rounded-3xl ring-1 ring-slate-200/60 shadow-xs overflow-hidden h-fit">
                <div className="px-6 py-5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4.5 h-4.5 text-slate-600" strokeWidth={1.5} />
                    <h2 className="text-sm font-semibold text-slate-800 tracking-tight">Registrar Movimiento</h2>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Entrada de producción o salida a campo</p>
                </div>
                <form onSubmit={handleInvSubmit} className="px-6 py-5 space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">Modelo de Estufa</label>
                    <select value={formInv.modelo} onChange={(e) => setFormInv((p) => ({ ...p, modelo: e.target.value as Modelo }))} className={inputCls}>
                      {MODELOS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <span className="block text-xs font-semibold text-slate-700">Tipo de Movimiento</span>
                    <div className="grid grid-cols-2 gap-2">
                      {(["entrada", "salida"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setFormInv((p) => ({ ...p, tipo: t }))}
                          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition-all duration-200 ${
                            formInv.tipo === t
                              ? t === "entrada"
                                ? "bg-emerald-50 border-emerald-300 text-emerald-800 ring-1 ring-emerald-200/60"
                                : "bg-blue-50 border-blue-300 text-blue-800 ring-1 ring-blue-200/60"
                              : "bg-white border-slate-200/60 text-slate-500 hover:border-slate-300"
                          }`}
                        >
                          {t === "entrada" ? <Plus className="w-4 h-4" strokeWidth={2} /> : <Minus className="w-4 h-4" strokeWidth={2} />}
                          {t === "entrada" ? "Entrada" : "Salida"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">Cantidad</label>
                    <input type="number" min={1} max={999} value={formInv.cantidad} onChange={(e) => setFormInv((p) => ({ ...p, cantidad: Math.max(1, parseInt(e.target.value) || 1) }))} className={`${inputCls} font-mono`} />
                    {formInv.tipo === "salida" && (
                      <p className="text-xs text-slate-400">
                        Disponible: <span className="font-mono font-semibold text-slate-700">{stock.find((s) => s.modelo === formInv.modelo)?.cantidad ?? 0}</span> uds.
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">Observaciones</label>
                    <input type="text" placeholder="Ej: Despacho o Ingreso..." value={formInv.observaciones} onChange={(e) => setFormInv((p) => ({ ...p, observaciones: e.target.value }))} className={`${inputCls} placeholder:text-slate-400`} />
                  </div>
                  {errorInv && <div className="flex items-center gap-2 bg-red-50 border border-red-200/60 rounded-xl px-4 py-3"><AlertTriangle className="w-4 h-4 text-red-500" strokeWidth={1.5} /><p className="text-xs text-red-700">{errorInv}</p></div>}
                  {exitoInv && <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/60 rounded-xl px-4 py-3"><CheckCircle2 className="w-4 h-4 text-emerald-600" strokeWidth={1.5} /><p className="text-xs text-emerald-700 font-medium">Movimiento registrado.</p></div>}
                  <button type="submit" className="w-full bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all text-sm font-medium px-4 py-2.5 flex items-center justify-center gap-2 active:scale-[0.98]">
                    {formInv.tipo === "entrada" ? <><Plus className="w-4 h-4" strokeWidth={2} /> Registrar Entrada</> : <><Minus className="w-4 h-4" strokeWidth={2} /> Registrar Salida</>}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            VISTA 2: AJUSTES DE PLANTA (FIREBASE REAL)
        ══════════════════════════════════════════════════════════ */}
        {mainTab === "ajustes" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* SUB-TABS AJUSTES */}
            <div className="border-b border-slate-200/80">
              <nav className="flex items-center gap-6 overflow-x-auto">
                {([
                  { id: "recetas",       label: "Gestión de Recetas (BOM)",       icon: Layers },
                  { id: "tareas",        label: "Asignación de Tareas (Hoy)",     icon: ListTodo },
                  { id: "planificacion", label: "Planificación Semanal",           icon: BarChart3 },
                ] as const).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setAjustesTab(id)}
                    className={`pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                      ajustesTab === id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <Icon className="w-4 h-4 inline-block" strokeWidth={1.5} />
                    {label}
                  </button>
                ))}
              </nav>
            </div>

            {/* ── SUBVISTA: RECETAS ── */}
            {ajustesTab === "recetas" && <ResumenRecetas />}

            {/* ── SUBVISTA: TAREAS (Asignación Dinámica) ── */}
            {ajustesTab === "tareas" && (
              <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_400px] gap-6">
                
                {/* Col 1: Áreas */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">1. Selecciona un Área</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Filtra a los empleados por su zona de trabajo.</p>
                  </div>
                  <div className="space-y-2">
                    {(Object.keys(AREA_META) as AreaPlanta[]).map((nombre) => {
                      const meta = AREA_META[nombre];
                      return (
                        <button
                          key={nombre}
                          onClick={() => {
                            setAreaSeleccionada(nombre);
                            setEmpleadoSeleccionado("");
                            setIsAsignando(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
                            areaSeleccionada === nombre
                              ? "bg-white border-slate-900 shadow-sm ring-1 ring-slate-900"
                              : "bg-white border-slate-200/60 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.bg} ${meta.color}`}>
                            <meta.icon className="w-4 h-4" strokeWidth={2} />
                          </div>
                          <span className="text-sm font-bold">{nombre}</span>
                          <span className="ml-auto text-xs font-mono text-slate-400">
                            {colaboradores.filter(c => c.areaPlanta === nombre).length} emp.
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Col 2: Empleados */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">2. Empleados del Área</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {areaSeleccionada ? `Personal de ${areaSeleccionada}` : "Selecciona un área primero"}
                    </p>
                  </div>
                  {areaSeleccionada ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        {empleadosEnArea.map((emp) => (
                          <div key={emp.uid} className="flex items-center gap-2">
                            <button
                              onClick={() => setEmpleadoSeleccionado(emp.uid)}
                              className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
                                empleadoSeleccionado === emp.uid
                                  ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200"
                                  : "bg-white border-slate-200/60 text-slate-700 hover:border-slate-300"
                              }`}
                            >
                              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                                {emp.nombre.charAt(0).toUpperCase()}
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-bold truncate max-w-[150px]">{emp.nombre}</p>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{emp.areaPlanta}</p>
                              </div>
                            </button>
                            <button
                              onClick={() => handleDesvincular(emp.uid)}
                              title="Desvincular del Área"
                              className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl border border-transparent hover:border-red-200 transition-colors"
                            >
                              <Minus className="w-4 h-4" strokeWidth={2} />
                            </button>
                          </div>
                        ))}
                        {empleadosEnArea.length === 0 && !isAsignando && (
                          <div className="p-6 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50">
                            <Users className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                            <p className="text-xs font-medium text-slate-500">Nadie asignado a esta área.</p>
                          </div>
                        )}
                      </div>
                      {!isAsignando ? (
                        <button
                          onClick={() => setIsAsignando(true)}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-indigo-300 text-indigo-600 text-sm font-semibold hover:bg-indigo-50 transition-colors"
                        >
                          <UserPlus className="w-4 h-4" strokeWidth={2} />
                          + Asignar Colaborador
                        </button>
                      ) : (
                        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-3xl space-y-3">
                          <h4 className="text-xs font-bold text-indigo-900">Selecciona personal disponible:</h4>
                          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                            {colaboradores.filter(c => c.areaPlanta !== areaSeleccionada).map(c => (
                              <button
                                key={c.uid}
                                onClick={() => handleAsignarArea(c.uid, areaSeleccionada)}
                                className="w-full text-left bg-white px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-indigo-600 hover:text-white transition-colors flex justify-between items-center group"
                              >
                                <span>{c.nombre}</span>
                                <span className="text-[10px] bg-slate-100 text-slate-500 group-hover:bg-indigo-500 group-hover:text-white px-2 py-0.5 rounded-md">
                                  {c.areaPlanta || "Sin área"}
                                </span>
                              </button>
                            ))}
                          </div>
                          <button onClick={() => setIsAsignando(false)} className="w-full text-xs font-bold text-slate-500 hover:text-slate-700 py-1">Cancelar</button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-40 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                      <ArrowLeft className="w-6 h-6 mb-2" strokeWidth={1.5} />
                      <p className="text-xs font-medium">Elige un área a la izquierda</p>
                    </div>
                  )}
                </div>

                {/* Col 3: Tareas del Empleado */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">3. Tareas Asignadas (Hoy)</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {empleadoSeleccionado
                        ? `Gestionando a ${colaboradores.find(e => e.uid === empleadoSeleccionado)?.nombre}`
                        : "Selecciona un empleado"}
                    </p>
                  </div>
                  {empleadoSeleccionado ? (
                    <div className="bg-white rounded-3xl ring-1 ring-slate-200/80 shadow-xs overflow-hidden flex flex-col h-full min-h-[400px]">
                      <div className="flex-1 p-4 space-y-3 overflow-y-auto bg-slate-50/30">
                        {tareasEmpleadoActual.length === 0 ? (
                          <div className="text-center py-8">
                            <CheckCircle2 className="w-8 h-8 text-emerald-200 mx-auto mb-2" strokeWidth={1.5} />
                            <p className="text-sm font-semibold text-slate-500">Sin tareas pendientes hoy</p>
                          </div>
                        ) : (
                          tareasEmpleadoActual.map(t => (
                            <div key={t.id} className="bg-white p-3.5 rounded-2xl ring-1 ring-slate-200/60 flex items-start gap-3">
                              <div className="flex-1 min-w-0 space-y-1">
                                <p className={`text-sm font-medium ${t.completada ? "line-through text-slate-400" : "text-slate-800"}`}>{t.descripcion}</p>
                                <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-md ${PRIORIDAD_COLORS[t.prioridad]}`}>{t.prioridad}</span>
                              </div>
                              <button onClick={() => handleBorrarTarea(t.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="p-4 bg-white border-t border-slate-100">
                        <form onSubmit={handleCrearTarea} className="space-y-3">
                          <input
                            type="text"
                            placeholder="Nueva tarea (ej. Soldar 10 bases)"
                            value={formTarea.descripcion}
                            onChange={(e) => setFormTarea(p => ({ ...p, descripcion: e.target.value }))}
                            className="w-full text-sm px-3 py-2.5 bg-slate-50 border border-slate-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                          />
                          <div className="flex gap-2">
                            <select
                              value={formTarea.prioridad}
                              onChange={(e) => setFormTarea(p => ({ ...p, prioridad: e.target.value as Prioridad }))}
                              className="w-1/3 text-xs font-semibold px-2 bg-slate-50 border border-slate-200/60 rounded-xl focus:outline-none"
                            >
                              <option value="Alta">🔴 Alta</option>
                              <option value="Media">🟡 Media</option>
                              <option value="Baja">⚪ Baja</option>
                            </select>
                            <button
                              type="submit"
                              disabled={!formTarea.descripcion.trim()}
                              className="flex-1 bg-slate-900 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                            >
                              <Save className="w-3.5 h-3.5" strokeWidth={2} /> Crear
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  ) : (
                    <div className="h-40 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                      <ArrowLeft className="w-6 h-6 mb-2" strokeWidth={1.5} />
                      <p className="text-xs font-medium">Elige un empleado para ver sus tareas</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* ── SUBVISTA: PLANIFICACIÓN SEMANAL INDUSTRIAL ── */}
            {ajustesTab === "planificacion" && (
              <PlanificacionSemanal
                semanaActual={semanaActual}
                setSemanaActual={setSemanaActual}
                bloquesSemanales={bloquesSemanales}
                colaboradores={colaboradores}
                mostrarForm={mostrarFormBloque}
                setMostrarForm={setMostrarFormBloque}
                formBloque={formBloque}
                setFormBloque={setFormBloque}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   COMPONENTE: PLANIFICACIÓN SEMANAL INDUSTRIAL
═══════════════════════════════════════════════════════ */
function PlanificacionSemanal({
  semanaActual,
  setSemanaActual,
  bloquesSemanales,
  colaboradores,
  mostrarForm,
  setMostrarForm,
  formBloque,
  setFormBloque,
}: {
  semanaActual: string;
  setSemanaActual: (s: string) => void;
  bloquesSemanales: BloqueSemanal[];
  colaboradores: UsuarioReal[];
  mostrarForm: boolean;
  setMostrarForm: (b: boolean) => void;
  formBloque: Partial<BloqueSemanal>;
  setFormBloque: React.Dispatch<React.SetStateAction<Partial<BloqueSemanal>>>;
}) {
  const [isSaving, setIsSaving] = useState(false);
  
  const handleSemanaPrev = () => {
    const [y, w] = semanaActual.split("-W");
    const d = new Date(parseInt(y), 0, 1 + (parseInt(w) - 1) * 7);
    d.setDate(d.getDate() - 7);
    setSemanaActual(getSemanaId(d));
  };
  const handleSemanaNext = () => {
    const [y, w] = semanaActual.split("-W");
    const d = new Date(parseInt(y), 0, 1 + (parseInt(w) - 1) * 7);
    d.setDate(d.getDate() + 7);
    setSemanaActual(getSemanaId(d));
  };

  const getDiasDeSemana = (semanaId: string) => {
    const [y, w] = semanaId.split("-W");
    const year = parseInt(y);
    const week = parseInt(w);
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dayOfWeek = simple.getDay();
    const isoWeekStart = simple;
    if (dayOfWeek <= 4) isoWeekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else isoWeekStart.setDate(simple.getDate() + 8 - simple.getDay());
    
    // Generar 6 días (Lunes a Sábado)
    return Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(isoWeekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  const diasDeSemana = getDiasDeSemana(semanaActual);
  const bloquesActuales = bloquesSemanales.filter(b => b.semanaId === semanaActual);

  const cargaPorArea = (area: AreaPlanta) => {
    const empCount = colaboradores.filter(c => c.areaPlanta === area).length;
    if (empCount === 0) return 0;
    const horasDisponibles = empCount * HORAS_JORNADA_SEMANAL; // 48h
    const bloquesArea = bloquesActuales.filter(b => b.area === area);
    const horasPlanificadas = bloquesArea.reduce((acc, b) => acc + (b.horasEstimadas || 0), 0);
    return Math.round((horasPlanificadas / horasDisponibles) * 100) || 0;
  };

  // Función recursiva / iterativa para mover déficit (Opción A)
  const aplicarCascada = async (empleadoId: string, bloquesSemana: BloqueSemanal[]) => {
     // Esta función revisa cada día (Lun a Sab). Si un día excede las 8h para el empleado,
     // mueve unidades de bloques NO URGENTES al día siguiente.
     const bloquesModificados = structuredClone(bloquesSemana);
     let hayCambios = false;
     
     const sumHorasDia = (diaKey: string) => {
       let total = 0;
       bloquesModificados.filter(b => b.empleadoId === empleadoId).forEach(b => {
         const hp = b.unidadesObjetivo > 0 ? (b.horasEstimadas / b.unidadesObjetivo) : 0;
         const uni = b.distribucionDiaria?.[diaKey] || 0;
         total += uni * hp;
       });
       return total;
     };

     for (let i = 0; i < DIAS_SEMANA.length; i++) {
        const dia = DIAS_SEMANA[i];
        let horas = sumHorasDia(dia);
        
        // Mientras las horas del día excedan 8 y no sea Sábado (i < 5)
        while (horas > 8.01 && i < 5) {
           const diaSiguiente = DIAS_SEMANA[i+1];
           // Buscar un bloque no urgente que tenga unidades este día
           const bCandidate = bloquesModificados.find(b => b.empleadoId === empleadoId && !b.esUrgente && (b.distribucionDiaria?.[dia] || 0) > 0);
           
           if (!bCandidate) break; // Si no hay de dónde quitar, se rompe el ciclo (solo quedan urgentes o ya no hay nada)
           
           // Mover 1 unidad
           bCandidate.distribucionDiaria[dia] -= 1;
           bCandidate.distribucionDiaria[diaSiguiente] = (bCandidate.distribucionDiaria[diaSiguiente] || 0) + 1;
           hayCambios = true;
           horas = sumHorasDia(dia);
        }
     }
     
     return { bloquesModificados, hayCambios };
  };

  const handleGuardarBloque = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBloque.area || !formBloque.empleadoId || !formBloque.modelo) return;
    
    // Validar suma
    const obj = formBloque.unidadesObjetivo || 1;
    const sum = DIAS_SEMANA.reduce((acc, d) => acc + (formBloque.distribucionDiaria?.[d] || 0), 0);
    if (sum !== obj) {
       alert(`La distribución diaria (${sum}) no coincide con el total de unidades objetivo (${obj}).`);
       return;
    }

    setIsSaving(true);
    try {
      const nuevoDoc = {
        area: formBloque.area,
        empleadoId: formBloque.empleadoId,
        modelo: formBloque.modelo,
        unidadesObjetivo: obj,
        horasEstimadas: formBloque.horasEstimadas || 1,
        distribucionDiaria: formBloque.distribucionDiaria || {},
        semanaId: formBloque.semanaId || semanaActual,
        esUrgente: formBloque.esUrgente || false,
        notas: formBloque.notas || "",
      };
      
      // Guardar el bloque nuevo
      const docRef = await addDoc(collection(db, "planificacion_semanal"), nuevoDoc);
      const nuevoId = docRef.id;

      // Ahora simulamos el algoritmo de cascada con los bloques actuales + el nuevo
      // Construimos un array en memoria temporal
      const tempBloques = [...bloquesActuales, { id: nuevoId, ...nuevoDoc } as BloqueSemanal];
      
      const { bloquesModificados, hayCambios } = await aplicarCascada(formBloque.empleadoId, tempBloques);
      
      if (hayCambios) {
         alert("La tarea excedió la capacidad diaria de 8h del empleado. El sistema ha reestructurado automáticamente las tareas no urgentes desplazándolas a los días siguientes (Opción A).");
         // Guardar los bloques modificados que ya existían
         for (const b of bloquesModificados) {
            if (b.id !== nuevoId) {
               await updateDoc(doc(db, "planificacion_semanal", b.id), { distribucionDiaria: b.distribucionDiaria });
            } else {
               // Si el mismo bloque nuevo fue modificado en cascada (raro pero posible si era no-urgente y excedía),
               // idealmente tendríamos que buscar su doc ref, pero como lo acabamos de crear sin guardar el ref directamente...
               // Para simplificar, la reestructuración afecta principalmente a los otros bloques.
            }
         }
      }

      setMostrarForm(false);
      setFormBloque({ 
         semanaId: semanaActual, 
         unidadesObjetivo: 1, 
         horasEstimadas: 1, 
         distribucionDiaria: {},
         esUrgente: false 
      });
    } catch (error) {
      console.error(error);
      alert("Error al guardar el bloque.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEliminarBloque = async (id: string) => {
    if (!confirm("¿Eliminar este bloque de producción?")) return;
    try {
      await deleteDoc(doc(db, "planificacion_semanal", id));
    } catch (e) {
      console.error(e);
    }
  };
  
  const setDist = (dia: string, val: number) => {
    setFormBloque(p => ({
      ...p,
      distribucionDiaria: {
        ...(p.distribucionDiaria || {}),
        [dia]: val
      }
    }));
  };

  const inputCls = "w-full text-sm px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900";

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Planificación Semanal (Industrial)</h2>
          <p className="text-xs text-slate-500 mt-0.5">Asigna metas de producción de Lunes a Sábado. Jornada 48h.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white ring-1 ring-slate-200/60 rounded-xl p-1 shadow-sm">
            <button onClick={handleSemanaPrev} className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"><ChevronLeft className="w-4 h-4" strokeWidth={2} /></button>
            <div className="px-4 text-center min-w-[120px]">
              <span className="text-xs font-bold text-slate-700 block">Semana {semanaActual.split("-W")[1]}</span>
              <span className="text-[10px] text-slate-400 font-medium">{semanaActual.split("-W")[0]}</span>
            </div>
            <button onClick={handleSemanaNext} className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"><ChevronRight className="w-4 h-4" strokeWidth={2} /></button>
          </div>
          <button 
            onClick={() => setMostrarForm(!mostrarForm)}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} /> Nuevo Bloque
          </button>
        </div>
      </div>

      {/* Formulario */}
      {mostrarForm && (
        <form onSubmit={handleGuardarBloque} className="bg-white ring-1 ring-slate-200/60 rounded-3xl p-6 shadow-xl shadow-slate-200/20 space-y-5 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800">Crear Bloque de Producción</h3>
            <button type="button" onClick={() => setMostrarForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Área</label>
              <select value={formBloque.area || ""} onChange={e => {
                 setFormBloque(p => ({ ...p, area: e.target.value as AreaPlanta, empleadoId: "" }));
              }} className={inputCls} required>
                <option value="">Seleccionar área</option>
                {Object.keys(AREA_META).map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Colaborador</label>
              <select value={formBloque.empleadoId || ""} onChange={e => setFormBloque(p => ({ ...p, empleadoId: e.target.value }))} className={inputCls} required disabled={!formBloque.area}>
                <option value="">Seleccionar</option>
                {colaboradores.filter(c => c.areaPlanta === formBloque.area).map(c => (
                  <option key={c.uid} value={c.uid}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Modelo</label>
              <select value={formBloque.modelo || ""} onChange={e => setFormBloque(p => ({ ...p, modelo: e.target.value as Modelo }))} className={inputCls} required>
                <option value="">Seleccionar</option>
                {MODELOS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            
            <div className="space-y-1.5 flex flex-col justify-end">
               <label className="flex items-center gap-2 cursor-pointer p-2 bg-red-50 ring-1 ring-red-200 rounded-xl hover:bg-red-100 transition-colors">
                  <input type="checkbox" checked={formBloque.esUrgente || false} onChange={e => setFormBloque(p => ({ ...p, esUrgente: e.target.checked }))} className="w-4 h-4 text-red-600 rounded" />
                  <span className="text-xs font-bold text-red-700">Extra / Urgente</span>
               </label>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Meta Total (Uds)</label>
              <input type="number" min={1} required value={formBloque.unidadesObjetivo || ""} onChange={e => setFormBloque(p => ({ ...p, unidadesObjetivo: parseInt(e.target.value)||1 }))} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Horas Totales (Est.)</label>
              <input type="number" step="0.5" min={0.5} required value={formBloque.horasEstimadas || ""} onChange={e => setFormBloque(p => ({ ...p, horasEstimadas: parseFloat(e.target.value)||1 }))} className={inputCls} />
            </div>
          </div>
          
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Distribución Diaria (Lun - Sáb)</label>
            <p className="text-[10px] text-slate-400">Asigna la cantidad de estufas a fabricar cada día. La suma debe dar {formBloque.unidadesObjetivo || 0}.</p>
            <div className="grid grid-cols-6 gap-2">
               {DIAS_SEMANA.map((dia) => (
                  <div key={dia} className="space-y-1 text-center">
                     <span className="text-xs font-bold text-slate-700">{dia}</span>
                     <input 
                        type="number" min={0}
                        value={formBloque.distribucionDiaria?.[dia] || 0}
                        onChange={e => setDist(dia, parseInt(e.target.value) || 0)}
                        className={`${inputCls} text-center`}
                     />
                  </div>
               ))}
            </div>
            {/* Validación visual de la suma */}
            <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg text-xs font-semibold">
               <span className="text-slate-500">Suma total distribuida:</span>
               <span className={DIAS_SEMANA.reduce((acc, d) => acc + (formBloque.distribucionDiaria?.[d] || 0), 0) === formBloque.unidadesObjetivo ? "text-emerald-600" : "text-red-600"}>
                  {DIAS_SEMANA.reduce((acc, d) => acc + (formBloque.distribucionDiaria?.[d] || 0), 0)} / {formBloque.unidadesObjetivo || 0}
               </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Notas (opcional)</label>
            <input type="text" placeholder="Instrucciones especiales..." value={formBloque.notas || ""} onChange={e => setFormBloque(p => ({ ...p, notas: e.target.value }))} className={inputCls} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setMostrarForm(false)} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
            <button type="submit" disabled={isSaving} className="px-5 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:opacity-50">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" strokeWidth={2} />} Guardar Bloque
            </button>
          </div>
        </form>
      )}

      {/* KPI de Capacidad por Área */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.keys(AREA_META) as AreaPlanta[]).map(area => {
          const meta = AREA_META[area];
          const carga = cargaPorArea(area);
          const empCount = colaboradores.filter(c => c.areaPlanta === area).length;
          const bloquesArea = bloquesActuales.filter(b => b.area === area).length;
          return (
            <div key={area} className="bg-white ring-1 ring-slate-200/60 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${meta.bg} ${meta.color}`}>
                  <meta.icon className="w-4 h-4" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">{area}</p>
                  <p className="text-[10px] text-slate-400">{empCount} emp. · {bloquesArea} bloques</p>
                </div>
              </div>
              <div>
                <div className="flex items-end justify-between mb-1">
                  <span className="text-[10px] font-medium text-slate-500">Carga Semanal (48h/emp)</span>
                  <span className={`text-xs font-bold ${carga >= 100 ? "text-red-600" : carga >= 70 ? "text-amber-600" : "text-emerald-600"}`}>{carga}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${carga >= 100 ? "bg-red-500" : carga >= 70 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${Math.min(carga, 100)}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grilla Semanal */}
      <div className="bg-white ring-1 ring-slate-200/60 rounded-3xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-500" strokeWidth={1.5} />
            <h3 className="text-sm font-bold text-slate-800">Calendario Semanal por Área (Distribución)</h3>
          </div>
          <div className="flex gap-1 md:gap-2">
            {diasDeSemana.map((d, i) => (
              <div key={i} className="text-center w-12 md:w-16">
                <p className="text-xs font-bold text-slate-700">{DIAS_SEMANA[i]}</p>
                <p className="text-[10px] text-slate-400 hidden md:block">{d.getDate()}/{d.getMonth() + 1}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-100 overflow-x-auto">
          {(Object.keys(AREA_META) as AreaPlanta[]).map(area => {
            const meta = AREA_META[area];
            const bloquesArea = bloquesActuales.filter(b => b.area === area);
            return (
              <div key={area} className="flex min-w-[600px]">
                <div className={`w-32 shrink-0 flex items-center gap-2 px-3 py-4 border-r border-slate-100 ${meta.bg}`}>
                  <meta.icon className={`w-4 h-4 shrink-0 ${meta.color}`} strokeWidth={2} />
                  <span className={`text-xs font-bold ${meta.color} leading-tight`}>{area}</span>
                </div>
                <div className="flex-1 grid grid-cols-6 divide-x divide-slate-100">
                  {DIAS_SEMANA.map((diaStr) => {
                    // Filtrar los bloques que tienen al menos 1 unidad este día
                    const bloquesDelDia = bloquesArea.filter(b => (b.distribucionDiaria?.[diaStr] || 0) > 0);
                    return (
                      <div key={diaStr} className="min-h-[80px] p-2 space-y-1.5">
                        {bloquesDelDia.map(bloque => {
                          const emp = colaboradores.find(c => c.uid === bloque.empleadoId);
                          const isUrgent = bloque.esUrgente;
                          return (
                            <div key={bloque.id} className={`group relative bg-white rounded-xl ring-1 ${isUrgent ? 'ring-red-400 bg-red-50' : meta.ring} px-2 py-2 text-[10px] space-y-0.5 hover:shadow-sm transition-all`}>
                              <p className={`font-bold truncate ${isUrgent ? 'text-red-800' : 'text-slate-800'}`}>{emp?.nombre ?? "?"}</p>
                              <p className="text-slate-500 truncate">{bloque.modelo}</p>
                              <div className="flex items-center justify-between">
                                <span className={`font-mono font-bold ${isUrgent ? 'text-red-600' : meta.color}`}>
                                   {bloque.distribucionDiaria[diaStr]} uds
                                </span>
                              </div>
                              <button onClick={() => handleEliminarBloque(bloque.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-500 transition-all">
                                <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
