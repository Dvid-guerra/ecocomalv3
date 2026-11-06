"use client";

import { useState, useMemo, useEffect } from "react";
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
  Warehouse,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Package,
  FileText,
  BarChart3,
  X,
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
import {
  PageHeader,
  Card,
  CardHeader,
  KpiCard,
  Button,
  Badge,
  Tabs,
  FormField,
  TextInput,
  SelectInput,
  EmptyState,
  Aviso,
  type Tono,
} from "@/components/ui";
import { cn } from "@/lib/cn";

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

/**
 * Las cuatro áreas se distinguen por su ícono, no por un color propio.
 * Antes cada una traía su hue (ámbar, rojo, azul, morado) y en la grilla
 * semanal competían con el rojo de "urgente", que sí significa algo.
 */
const AREA_META: Record<AreaPlanta, { icon: React.ElementType }> = {
  "Herrería":       { icon: Wrench },
  "Fundición":      { icon: Flame },
  "Carga":          { icon: Truck },
  "Labores Extras": { icon: MoreHorizontal },
};

const PRIORIDAD_TONO: Record<Prioridad, Tono> = {
  Alta: "risk",
  Media: "warn",
  Baja: "neutral",
};

/* ═══════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
═══════════════════════════════════════════════════════ */
export default function PlantaPage() {
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

  // ── RENDER ──
  /* El layout del dashboard ya aporta el fondo, el ancho máximo y el
     padding vertical; este módulo los duplicaba. */
  return (
    <div className="space-y-8">

        {/* ── ENCABEZADO ── */}
        <PageHeader
          titulo="Planta de Trabajo"
          descripcion="Control de producción, stock, recetas y asignaciones"
          icono={Warehouse}
          volverHref="/dashboard"
          volverLabel="Volver al inicio"
          acciones={
            <Tabs
              etiqueta="Vista de planta"
              value={mainTab}
              onChange={setMainTab}
              items={[
                { id: "inventario", label: "Inventario", icon: Package },
                { id: "ajustes", label: "Ajustes de Planta", icon: Settings },
              ] as const}
            />
          }
        />

        {/* ══════════════════════════════════════════════════════════
            VISTA 1: INVENTARIO (ORIGINAL MIGRADA)
        ══════════════════════════════════════════════════════════ */}
        {mainTab === "inventario" && (
          <div className="space-y-6 animate-rise">
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { id: "kpi-bodega",   label: "Total en Bodega", value: kpis.totalBodega, sub: "unidades disponibles", icon: Warehouse },
                { id: "kpi-entradas", label: "Entradas de Hoy",  value: kpis.entradasHoy, sub: "unidades ingresadas",  icon: TrendingUp },
                { id: "kpi-salidas",  label: "Despachos Hoy",    value: kpis.salidasHoy,  sub: "unidades despachadas", icon: TrendingDown },
              ].map(({ id, label, value, sub, icon: Icon }) => (
                <KpiCard
                  key={id}
                  id={id}
                  titulo={label}
                  valor={value}
                  descripcion={sub}
                  icono={Icon}
                />
              ))}
            </div>

            {/* Layout dos columnas */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
              <div className="space-y-6">
                {/* Tabla de stock */}
                <Card nivel="panel" className="overflow-hidden">
                  <CardHeader
                    titulo="Stock Actual en Bodega"
                    icono={<Package className="w-4 h-4" strokeWidth={1.5} />}
                  />
                  <div className="divide-y divide-line">
                    {stock.map((item) => {
                      const bajo = item.cantidad < STOCK_MINIMO;
                      const pct = Math.min(100, Math.round((item.cantidad / STOCK_MAX_REF) * 100));
                      return (
                        <div key={item.modelo} className="flex items-center gap-5 px-5 py-4">
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-ink">{item.modelo}</span>
                              {bajo && (
                                <Badge
                                  tono="warn"
                                  icono={<AlertTriangle className="w-3 h-3" strokeWidth={2} />}
                                >
                                  Bajo stock
                                </Badge>
                              )}
                            </div>
                            <div
                              className="h-1.5 bg-line rounded-full overflow-hidden"
                              role="progressbar"
                              aria-valuenow={item.cantidad}
                              aria-valuemin={0}
                              aria-valuemax={STOCK_MAX_REF}
                              aria-label={`Existencias de ${item.modelo}`}
                            >
                              <div
                                className={cn(
                                  "h-full rounded-full transition-[width] duration-500 ease-out",
                                  bajo ? "bg-warn" : "bg-ok",
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={cn("nums text-2xl font-bold", bajo ? "text-warn" : "text-ink")}>
                              {item.cantidad}
                            </span>
                            <p className="text-xs text-ink-muted">uds.</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Historial con pestañas */}
                <Card nivel="panel" className="overflow-hidden">
                  <CardHeader
                    titulo="Historial de Movimientos"
                    icono={<FileText className="w-4 h-4" strokeWidth={1.5} />}
                    accion={
                      <Tabs
                        etiqueta="Tipo de movimiento"
                        value={invTab}
                        onChange={setInvTab}
                        items={[
                          { id: "entradas", label: "Entradas" },
                          { id: "salidas", label: "Salidas" },
                        ] as const}
                      />
                    }
                  />
                  <div className="custom-scrollbar divide-y divide-line max-h-72">
                    {historial.length === 0 ? (
                      <EmptyState
                        icono={FileText}
                        titulo={invTab === "entradas" ? "Sin entradas registradas" : "Sin salidas registradas"}
                        descripcion="Los movimientos que registres en el formulario aparecen aquí al instante."
                      />
                    ) : (
                      historial.map((m) => {
                        const esEntrada = m.tipo === "entrada";
                        return (
                          <div key={m.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-sunken transition-colors">
                            <span
                              className={cn(
                                "mt-0.5 w-7 h-7 rounded-control flex items-center justify-center shrink-0 ring-1",
                                esEntrada
                                  ? "bg-ok-surface text-ok ring-ok-line"
                                  : "bg-info-surface text-info ring-info-line",
                              )}
                              aria-hidden="true"
                            >
                              {esEntrada ? <Plus className="w-3.5 h-3.5" strokeWidth={2} /> : <Minus className="w-3.5 h-3.5" strokeWidth={2} />}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-sm font-semibold text-ink">{m.modelo}</span>
                                <span className={cn("nums text-xs font-bold", esEntrada ? "text-ok" : "text-info")}>
                                  {esEntrada ? "+" : "−"}{m.cantidad}
                                </span>
                              </div>
                              <p className="text-xs text-ink-muted truncate mt-0.5">{m.observaciones}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="nums text-xs font-medium text-ink-body">{m.hora}</p>
                              <p className="nums text-xs text-ink-muted">{m.fecha}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </Card>
              </div>

              {/* Formulario Inventario */}
              <Card nivel="panel" className="overflow-hidden h-fit lg:sticky lg:top-20">
                <CardHeader
                  titulo="Registrar Movimiento"
                  subtitulo="Entrada de producción o salida a campo"
                  icono={<BarChart3 className="w-4 h-4" strokeWidth={1.5} />}
                />
                <form onSubmit={handleInvSubmit} className="px-5 py-5 space-y-4">
                  <FormField label="Modelo de estufa" htmlFor="inv-modelo">
                    <SelectInput
                      id="inv-modelo"
                      value={formInv.modelo}
                      onChange={(e) => setFormInv((p) => ({ ...p, modelo: e.target.value as Modelo }))}
                    >
                      {MODELOS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </SelectInput>
                  </FormField>

                  <fieldset className="space-y-1.5">
                    <legend className="text-xs font-semibold text-ink-body mb-1.5">Tipo de movimiento</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {(["entrada", "salida"] as const).map((t) => {
                        const activo = formInv.tipo === t;
                        const esEntrada = t === "entrada";
                        return (
                          <button
                            key={t}
                            type="button"
                            aria-pressed={activo}
                            onClick={() => setFormInv((p) => ({ ...p, tipo: t }))}
                            className={cn(
                              "touch flex items-center justify-center gap-2 px-3 rounded-control",
                              "text-sm font-semibold ring-1 transition-[background-color,color,box-shadow] duration-150 active:scale-[0.98]",
                              activo
                                ? esEntrada
                                  ? "bg-ok-surface text-ok ring-ok-line"
                                  : "bg-info-surface text-info ring-info-line"
                                : "bg-surface text-ink-muted ring-line hover:ring-line-strong hover:text-ink",
                            )}
                          >
                            {esEntrada ? <Plus className="w-4 h-4" strokeWidth={2} /> : <Minus className="w-4 h-4" strokeWidth={2} />}
                            {esEntrada ? "Entrada" : "Salida"}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <FormField
                    label="Cantidad"
                    htmlFor="inv-cantidad"
                    pista={
                      formInv.tipo === "salida"
                        ? `Disponible: ${stock.find((s) => s.modelo === formInv.modelo)?.cantidad ?? 0} uds.`
                        : undefined
                    }
                  >
                    <TextInput
                      id="inv-cantidad"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={999}
                      numerico
                      value={formInv.cantidad}
                      onChange={(e) => setFormInv((p) => ({ ...p, cantidad: Math.max(1, parseInt(e.target.value) || 1) }))}
                    />
                  </FormField>

                  <FormField label="Observaciones" htmlFor="inv-observaciones">
                    <TextInput
                      id="inv-observaciones"
                      type="text"
                      placeholder="Ej: Despacho a Sololá"
                      value={formInv.observaciones}
                      onChange={(e) => setFormInv((p) => ({ ...p, observaciones: e.target.value }))}
                    />
                  </FormField>

                  {errorInv && <Aviso tono="risk" icono={AlertTriangle}>{errorInv}</Aviso>}
                  {exitoInv && <Aviso tono="ok" icono={CheckCircle2}>Movimiento registrado.</Aviso>}

                  <Button
                    type="submit"
                    ancho
                    tamano="lg"
                    iconLeft={formInv.tipo === "entrada"
                      ? <Plus className="w-4 h-4" strokeWidth={2} />
                      : <Minus className="w-4 h-4" strokeWidth={2} />}
                  >
                    {formInv.tipo === "entrada" ? "Registrar entrada" : "Registrar salida"}
                  </Button>
                </form>
              </Card>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            VISTA 2: AJUSTES DE PLANTA (FIREBASE REAL)
        ══════════════════════════════════════════════════════════ */}
        {mainTab === "ajustes" && (
          <div className="space-y-6 animate-rise">

            {/* SUB-TABS AJUSTES */}
            <Tabs
              etiqueta="Ajustes de planta"
              value={ajustesTab}
              onChange={setAjustesTab}
              items={[
                { id: "recetas",       label: "Recetas (BOM)",        icon: Layers },
                { id: "tareas",        label: "Tareas de hoy",        icon: ListTodo },
                { id: "planificacion", label: "Planificación semanal", icon: BarChart3 },
              ] as const}
            />

            {/* ── SUBVISTA: RECETAS ── */}
            {ajustesTab === "recetas" && <ResumenRecetas />}

            {/* ── SUBVISTA: TAREAS (Asignación Dinámica) ── */}
            {ajustesTab === "tareas" && (
              <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_400px] gap-6">
                
                {/* Col 1: Áreas */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">1. Selecciona un área</h3>
                    <p className="text-xs text-ink-muted mt-0.5">Filtra a los empleados por su zona de trabajo.</p>
                  </div>
                  <div className="space-y-2">
                    {(Object.keys(AREA_META) as AreaPlanta[]).map((nombre) => {
                      const meta = AREA_META[nombre];
                      const activa = areaSeleccionada === nombre;
                      const nEmp = colaboradores.filter(c => c.areaPlanta === nombre).length;
                      return (
                        <button
                          key={nombre}
                          type="button"
                          aria-pressed={activa}
                          onClick={() => {
                            setAreaSeleccionada(nombre);
                            setEmpleadoSeleccionado("");
                            setIsAsignando(false);
                          }}
                          className={cn(
                            "w-full touch flex items-center gap-3 px-4 py-3 rounded-card ring-1 text-left",
                            "transition-[background-color,box-shadow] duration-150",
                            activa
                              ? "bg-surface ring-action shadow-card"
                              : "bg-surface ring-line hover:ring-line-strong hover:bg-sunken",
                          )}
                        >
                          <span
                            className={cn(
                              "w-8 h-8 rounded-control flex items-center justify-center shrink-0 ring-1",
                              activa ? "bg-action text-white ring-transparent" : "bg-sunken text-ink-muted ring-line",
                            )}
                            aria-hidden="true"
                          >
                            <meta.icon className="w-4 h-4" strokeWidth={2} />
                          </span>
                          <span className={cn("text-sm font-semibold", activa ? "text-ink" : "text-ink-body")}>
                            {nombre}
                          </span>
                          <span className="nums ml-auto text-xs font-medium text-ink-muted">
                            {nEmp} emp.
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Col 2: Empleados */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">2. Empleados del área</h3>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {areaSeleccionada ? `Personal de ${areaSeleccionada}` : "Selecciona un área primero"}
                    </p>
                  </div>
                  {areaSeleccionada ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        {empleadosEnArea.map((emp) => {
                          const activo = empleadoSeleccionado === emp.uid;
                          return (
                            <div key={emp.uid} className="flex items-center gap-2">
                              <button
                                type="button"
                                aria-pressed={activo}
                                onClick={() => setEmpleadoSeleccionado(emp.uid)}
                                className={cn(
                                  "flex-1 min-w-0 touch flex items-center gap-3 px-4 py-3 rounded-card ring-1 text-left",
                                  "transition-[background-color,box-shadow] duration-150",
                                  activo
                                    ? "bg-surface ring-action shadow-card"
                                    : "bg-surface ring-line hover:ring-line-strong hover:bg-sunken",
                                )}
                              >
                                <span
                                  className="w-8 h-8 rounded-full bg-action text-white flex items-center justify-center text-xs font-bold shrink-0"
                                  aria-hidden="true"
                                >
                                  {emp.nombre.charAt(0).toUpperCase()}
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-sm font-semibold text-ink truncate">{emp.nombre}</span>
                                  <span className="block text-xs text-ink-muted truncate">{emp.areaPlanta}</span>
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDesvincular(emp.uid)}
                                aria-label={`Desvincular a ${emp.nombre} del área`}
                                className="touch w-11 shrink-0 flex items-center justify-center text-ink-muted hover:text-risk hover:bg-risk-surface rounded-card transition-colors"
                              >
                                <Minus className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
                              </button>
                            </div>
                          );
                        })}
                        {empleadosEnArea.length === 0 && !isAsignando && (
                          <Card>
                            <EmptyState
                              icono={Users}
                              titulo="Nadie asignado a esta área"
                              descripcion="Asigna colaboradores para poder darles tareas del día."
                            />
                          </Card>
                        )}
                      </div>
                      {!isAsignando ? (
                        <Button
                          variante="secondary"
                          ancho
                          tamano="lg"
                          onClick={() => setIsAsignando(true)}
                          iconLeft={<UserPlus className="w-4 h-4" strokeWidth={2} />}
                        >
                          Asignar colaborador
                        </Button>
                      ) : (
                        <Card className="p-4 space-y-3">
                          <h4 className="text-xs font-semibold text-ink">Personal disponible</h4>
                          <div className="custom-scrollbar max-h-48 space-y-1.5 pr-1">
                            {colaboradores.filter(c => c.areaPlanta !== areaSeleccionada).map(c => (
                              <button
                                key={c.uid}
                                type="button"
                                onClick={() => handleAsignarArea(c.uid, areaSeleccionada)}
                                className="w-full touch text-left bg-surface ring-1 ring-line px-3 rounded-control text-sm font-semibold text-ink-body hover:ring-action hover:bg-sunken transition-[background-color,box-shadow] flex justify-between items-center gap-2"
                              >
                                <span className="truncate">{c.nombre}</span>
                                <Badge tono="neutral">{c.areaPlanta || "Sin área"}</Badge>
                              </button>
                            ))}
                            {colaboradores.filter(c => c.areaPlanta !== areaSeleccionada).length === 0 && (
                              <p className="text-xs text-ink-muted py-3 text-center">
                                No hay más colaboradores por asignar.
                              </p>
                            )}
                          </div>
                          <Button variante="ghost" ancho onClick={() => setIsAsignando(false)}>
                            Cancelar
                          </Button>
                        </Card>
                      )}
                    </div>
                  ) : (
                    <Card>
                      <EmptyState
                        icono={Wrench}
                        titulo="Elige un área"
                        descripcion="Selecciona Herrería, Fundición, Carga o Labores Extras para ver a su personal."
                      />
                    </Card>
                  )}
                </div>

                {/* Col 3: Tareas del Empleado */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">3. Tareas asignadas (hoy)</h3>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {empleadoSeleccionado
                        ? `Gestionando a ${colaboradores.find(e => e.uid === empleadoSeleccionado)?.nombre}`
                        : "Selecciona un empleado"}
                    </p>
                  </div>
                  {empleadoSeleccionado ? (
                    <Card nivel="panel" className="overflow-hidden flex flex-col min-h-[25rem]">
                      <div className="custom-scrollbar flex-1 p-4 space-y-3">
                        {tareasEmpleadoActual.length === 0 ? (
                          <EmptyState
                            icono={CheckCircle2}
                            titulo="Sin tareas pendientes hoy"
                            descripcion="Crea una tarea abajo y aparecerá en el portal del colaborador al instante."
                          />
                        ) : (
                          tareasEmpleadoActual.map(t => (
                            <div key={t.id} className="bg-surface p-3.5 rounded-card ring-1 ring-line flex items-start gap-3">
                              <div className="flex-1 min-w-0 space-y-1.5">
                                <p className={cn(
                                  "text-sm font-medium",
                                  t.completada ? "line-through text-ink-muted" : "text-ink-body",
                                )}>
                                  {t.descripcion}
                                </p>
                                <Badge tono={PRIORIDAD_TONO[t.prioridad]}>{t.prioridad}</Badge>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleBorrarTarea(t.id)}
                                aria-label={`Borrar la tarea: ${t.descripcion}`}
                                className="touch w-11 shrink-0 flex items-center justify-center text-ink-muted hover:text-risk hover:bg-risk-surface rounded-control transition-colors"
                              >
                                <Trash2 className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="p-4 border-t border-line">
                        <form onSubmit={handleCrearTarea} className="space-y-3">
                          <FormField label="Nueva tarea" htmlFor="tarea-descripcion">
                            <TextInput
                              id="tarea-descripcion"
                              type="text"
                              placeholder="Ej. Soldar 10 bases"
                              value={formTarea.descripcion}
                              onChange={(e) => setFormTarea(p => ({ ...p, descripcion: e.target.value }))}
                            />
                          </FormField>
                          <div className="flex gap-2">
                            {/* El select traía emoji de colores como indicador de
                                prioridad; el tono del Badge ya lo dice y usa el
                                mismo sistema que el resto de la plataforma. */}
                            <SelectInput
                              id="tarea-prioridad"
                              aria-label="Prioridad de la tarea"
                              value={formTarea.prioridad}
                              onChange={(e) => setFormTarea(p => ({ ...p, prioridad: e.target.value as Prioridad }))}
                              className="w-32 shrink-0"
                            >
                              <option value="Alta">Alta</option>
                              <option value="Media">Media</option>
                              <option value="Baja">Baja</option>
                            </SelectInput>
                            <Button
                              type="submit"
                              className="flex-1"
                              disabled={!formTarea.descripcion.trim()}
                              iconLeft={<Save className="w-4 h-4" strokeWidth={2} />}
                            >
                              Crear
                            </Button>
                          </div>
                        </form>
                      </div>
                    </Card>
                  ) : (
                    <Card>
                      <EmptyState
                        icono={ListTodo}
                        titulo="Elige un empleado"
                        descripcion="Selecciona a alguien de la columna anterior para ver y asignar sus tareas de hoy."
                      />
                    </Card>
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

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink">Planificación semanal</h2>
          <p className="text-xs text-ink-muted mt-0.5">Asigna metas de producción de lunes a sábado. Jornada de 48 h.</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center bg-surface ring-1 ring-line rounded-control p-1 shadow-card">
            <button
              type="button"
              onClick={handleSemanaPrev}
              aria-label="Semana anterior"
              className="touch w-11 sm:w-9 flex items-center justify-center text-ink-muted hover:text-ink hover:bg-sunken rounded-control transition-colors"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
            </button>
            <div className="px-3 text-center min-w-28">
              <span className="nums text-xs font-semibold text-ink block">
                Semana {semanaActual.split("-W")[1]}
              </span>
              <span className="nums text-xs text-ink-muted">{semanaActual.split("-W")[0]}</span>
            </div>
            <button
              type="button"
              onClick={handleSemanaNext}
              aria-label="Semana siguiente"
              className="touch w-11 sm:w-9 flex items-center justify-center text-ink-muted hover:text-ink hover:bg-sunken rounded-control transition-colors"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          <Button
            onClick={() => setMostrarForm(!mostrarForm)}
            aria-expanded={mostrarForm}
            iconLeft={<Plus className="w-4 h-4" strokeWidth={2.5} />}
          >
            Nuevo bloque
          </Button>
        </div>
      </div>

      {/* Formulario */}
      {mostrarForm && (
        <Card nivel="panel" className="animate-rise">
          <form onSubmit={handleGuardarBloque} className="p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-sm font-semibold text-ink">Crear bloque de producción</h3>
              <button
                type="button"
                onClick={() => setMostrarForm(false)}
                aria-label="Cerrar el formulario"
                className="touch w-11 sm:w-9 flex items-center justify-center text-ink-muted hover:text-ink hover:bg-sunken rounded-control transition-colors"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <FormField label="Área" htmlFor="bloque-area">
                <SelectInput
                  id="bloque-area"
                  value={formBloque.area || ""}
                  onChange={e => setFormBloque(p => ({ ...p, area: e.target.value as AreaPlanta, empleadoId: "" }))}
                  required
                >
                  <option value="">Seleccionar área</option>
                  {Object.keys(AREA_META).map(a => <option key={a} value={a}>{a}</option>)}
                </SelectInput>
              </FormField>

              <FormField label="Colaborador" htmlFor="bloque-colaborador">
                <SelectInput
                  id="bloque-colaborador"
                  value={formBloque.empleadoId || ""}
                  onChange={e => setFormBloque(p => ({ ...p, empleadoId: e.target.value }))}
                  required
                  disabled={!formBloque.area}
                >
                  <option value="">Seleccionar</option>
                  {colaboradores.filter(c => c.areaPlanta === formBloque.area).map(c => (
                    <option key={c.uid} value={c.uid}>{c.nombre}</option>
                  ))}
                </SelectInput>
              </FormField>

              <FormField label="Modelo" htmlFor="bloque-modelo">
                <SelectInput
                  id="bloque-modelo"
                  value={formBloque.modelo || ""}
                  onChange={e => setFormBloque(p => ({ ...p, modelo: e.target.value as Modelo }))}
                  required
                >
                  <option value="">Seleccionar</option>
                  {MODELOS.map(m => <option key={m} value={m}>{m}</option>)}
                </SelectInput>
              </FormField>

              <div className="flex flex-col justify-end">
                <label
                  htmlFor="bloque-urgente"
                  className={cn(
                    "touch flex items-center gap-2.5 cursor-pointer px-3 rounded-control ring-1 transition-colors",
                    formBloque.esUrgente
                      ? "bg-risk-surface ring-risk-line text-risk"
                      : "bg-surface ring-line text-ink-body hover:ring-line-strong",
                  )}
                >
                  <input
                    id="bloque-urgente"
                    type="checkbox"
                    checked={formBloque.esUrgente || false}
                    onChange={e => setFormBloque(p => ({ ...p, esUrgente: e.target.checked }))}
                    className="w-4 h-4 rounded accent-[var(--color-risk)]"
                  />
                  <span className="text-xs font-semibold">Extra / urgente</span>
                </label>
              </div>

              <FormField label="Meta total (uds)" htmlFor="bloque-meta">
                <TextInput
                  id="bloque-meta"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  required
                  numerico
                  value={formBloque.unidadesObjetivo || ""}
                  onChange={e => setFormBloque(p => ({ ...p, unidadesObjetivo: parseInt(e.target.value) || 1 }))}
                />
              </FormField>

              <FormField label="Horas totales (est.)" htmlFor="bloque-horas">
                <TextInput
                  id="bloque-horas"
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min={0.5}
                  required
                  numerico
                  value={formBloque.horasEstimadas || ""}
                  onChange={e => setFormBloque(p => ({ ...p, horasEstimadas: parseFloat(e.target.value) || 1 }))}
                />
              </FormField>
            </div>

            <div className="space-y-3 pt-3 border-t border-line">
              <div>
                <p className="text-xs font-semibold text-ink-body">Distribución diaria (lun – sáb)</p>
                <p className="text-xs text-ink-muted mt-0.5">
                  Asigna cuántas estufas se fabrican cada día. La suma debe dar {formBloque.unidadesObjetivo || 0}.
                </p>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {DIAS_SEMANA.map((dia) => (
                  <div key={dia} className="space-y-1">
                    <label htmlFor={`dist-${dia}`} className="block text-xs font-semibold text-ink-body text-center">
                      {dia}
                    </label>
                    <TextInput
                      id={`dist-${dia}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      numerico
                      value={formBloque.distribucionDiaria?.[dia] || 0}
                      onChange={e => setDist(dia, parseInt(e.target.value) || 0)}
                      className="text-center px-2"
                    />
                  </div>
                ))}
              </div>
              {/* Validación visual de la suma */}
              {(() => {
                const suma = DIAS_SEMANA.reduce((acc, d) => acc + (formBloque.distribucionDiaria?.[d] || 0), 0);
                const cuadra = suma === formBloque.unidadesObjetivo;
                return (
                  <div className="flex justify-between items-center gap-3 bg-sunken ring-1 ring-line px-3 py-2 rounded-control text-xs font-semibold">
                    <span className="text-ink-muted">Suma total distribuida</span>
                    <Badge tono={cuadra ? "ok" : "risk"} numerico>
                      {suma} / {formBloque.unidadesObjetivo || 0}
                    </Badge>
                  </div>
                );
              })()}
            </div>

            <FormField label="Notas (opcional)" htmlFor="bloque-notas">
              <TextInput
                id="bloque-notas"
                type="text"
                placeholder="Instrucciones especiales…"
                value={formBloque.notas || ""}
                onChange={e => setFormBloque(p => ({ ...p, notas: e.target.value }))}
              />
            </FormField>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button variante="ghost" onClick={() => setMostrarForm(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                cargando={isSaving}
                iconLeft={<Save className="w-4 h-4" strokeWidth={2} />}
              >
                Guardar bloque
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* KPI de Capacidad por Área */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.keys(AREA_META) as AreaPlanta[]).map(area => {
          const meta = AREA_META[area];
          const carga = cargaPorArea(area);
          const empCount = colaboradores.filter(c => c.areaPlanta === area).length;
          const bloquesArea = bloquesActuales.filter(b => b.area === area).length;
          const tonoCarga: Tono = carga >= 100 ? "risk" : carga >= 70 ? "warn" : "ok";
          const barraCarga = carga >= 100 ? "bg-risk" : carga >= 70 ? "bg-warn" : "bg-ok";
          return (
            <Card key={area} className="p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-8 h-8 shrink-0 rounded-control bg-sunken ring-1 ring-line text-ink-muted flex items-center justify-center"
                  aria-hidden="true"
                >
                  <meta.icon className="w-4 h-4" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink truncate">{area}</p>
                  <p className="nums text-xs text-ink-muted">{empCount} emp. · {bloquesArea} bloques</p>
                </div>
              </div>
              <div>
                <div className="flex items-end justify-between gap-2 mb-1.5">
                  <span className="text-xs font-medium text-ink-muted">Carga semanal</span>
                  <Badge tono={tonoCarga} numerico>{carga}%</Badge>
                </div>
                <div
                  className="h-1.5 bg-line rounded-full overflow-hidden"
                  role="progressbar"
                  aria-valuenow={carga}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Carga semanal de ${area}, sobre 48 h por empleado`}
                >
                  <div
                    className={cn("h-full rounded-full transition-[width] duration-500 ease-out", barraCarga)}
                    style={{ width: `${Math.min(carga, 100)}%` }}
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Grilla Semanal */}
      <Card nivel="panel" className="overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-4 h-4 text-ink-muted shrink-0" strokeWidth={1.5} aria-hidden="true" />
            <h3 className="text-sm font-semibold text-ink">Calendario semanal por área</h3>
          </div>
          <div className="hidden md:flex gap-2">
            {diasDeSemana.map((d, i) => (
              <div key={i} className="text-center w-16">
                <p className="text-xs font-semibold text-ink-body">{DIAS_SEMANA[i]}</p>
                <p className="nums text-xs text-ink-muted">{d.getDate()}/{d.getMonth() + 1}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="divide-y divide-line overflow-x-auto">
          {(Object.keys(AREA_META) as AreaPlanta[]).map(area => {
            const meta = AREA_META[area];
            const bloquesArea = bloquesActuales.filter(b => b.area === area);
            return (
              <div key={area} className="flex min-w-[37.5rem]">
                <div className="w-32 shrink-0 flex items-center gap-2 px-3 py-4 border-r border-line bg-sunken">
                  <meta.icon className="w-4 h-4 shrink-0 text-ink-muted" strokeWidth={2} aria-hidden="true" />
                  <span className="text-xs font-semibold text-ink-body leading-tight">{area}</span>
                </div>
                <div className="flex-1 grid grid-cols-6 divide-x divide-line">
                  {DIAS_SEMANA.map((diaStr) => {
                    // Filtrar los bloques que tienen al menos 1 unidad este día
                    const bloquesDelDia = bloquesArea.filter(b => (b.distribucionDiaria?.[diaStr] || 0) > 0);
                    return (
                      <div key={diaStr} className="min-h-20 p-2 space-y-1.5">
                        {bloquesDelDia.map(bloque => {
                          const emp = colaboradores.find(c => c.uid === bloque.empleadoId);
                          const isUrgent = bloque.esUrgente;
                          return (
                            <div
                              key={bloque.id}
                              className={cn(
                                "group relative rounded-control ring-1 px-2 py-2 space-y-0.5 transition-shadow hover:shadow-card",
                                /* El rojo queda libre para "urgente", que es lo
                                   único en esta grilla que exige reaccionar. */
                                isUrgent
                                  ? "bg-risk-surface ring-risk-line"
                                  : "bg-surface ring-line",
                              )}
                            >
                              <p className={cn("text-xs font-semibold truncate pr-4", isUrgent ? "text-risk" : "text-ink")}>
                                {emp?.nombre ?? "Sin asignar"}
                              </p>
                              <p className="text-xs text-ink-muted truncate">{bloque.modelo}</p>
                              <span className={cn("nums block text-xs font-bold", isUrgent ? "text-risk" : "text-ink-body")}>
                                {bloque.distribucionDiaria[diaStr]} uds
                              </span>
                              <button
                                type="button"
                                onClick={() => handleEliminarBloque(bloque.id)}
                                aria-label={`Eliminar el bloque de ${emp?.nombre ?? "sin asignar"} del ${diaStr}`}
                                /* Visible siempre en pantallas táctiles, donde
                                   no existe el hover que lo revelaba. */
                                className="absolute top-1 right-1 p-1 rounded-md text-ink-muted hover:text-risk hover:bg-risk-surface transition-colors md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" />
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
      </Card>
    </div>
  );
}
