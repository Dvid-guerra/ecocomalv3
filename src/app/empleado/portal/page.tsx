"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  serverTimestamp
} from "firebase/firestore";

import { BloqueSemanal } from "@/types";

import {
  LogOut,
  Clock,
  CheckSquare,
  BarChart2,
  FileText,
  Send,
  ChevronRight,
  Flame,
  CalendarDays,
  Timer,
  AlertCircle,
  CheckCircle2,
  Loader2,
  TrendingUp,
  Square,
  Check,
  Phone,
  Truck,
  MapPin,
  Package,
} from "lucide-react";

// ═══════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════

type ActiveTab = "asistencia" | "plan" | "tareas" | "rendimiento" | "permisos" | "entregas";
type Prioridad  = "Alta" | "Media" | "Baja";
type TipoPermiso = "Permiso por Salud" | "Día Libre Con Goce" | "Incidencia de Taller";

interface Tarea {
  id: string;
  descripcion: string;
  prioridad: Prioridad;
  completada: boolean;
}

interface RegistroAsistencia {
  id: string;
  fecha: string;
  entrada: string;
  salida: string | null;
  bitacora: string;
}

interface LogInterno {
  id: string;
  hora: string;
  mensaje: string;
}

const PRIORIDAD_ESTILOS: Record<Prioridad, string> = {
  Alta:  "bg-red-50 text-red-700 ring-1 ring-red-200/60",
  Media: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60",
  Baja:  "bg-slate-100 text-slate-600 ring-1 ring-slate-200/60",
};

const TABS: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
  { id: "asistencia",  label: "Jornada",     icon: Clock       },
  { id: "plan",        label: "Mi Plan",     icon: CalendarDays },
  { id: "tareas",      label: "Tareas",      icon: CheckSquare },
  { id: "rendimiento", label: "Rendimiento", icon: BarChart2   },
  { id: "permisos",    label: "Permisos",    icon: FileText    },
  { id: "entregas",    label: "Entregas",    icon: Truck       },
];

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function horaActual(): string {
  return new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function hoyISO(): string {
  return new Date().toISOString().split("T")[0];
}

function formatFecha(iso: string): string {
  if (!iso) return "";
  const partes = iso.split("-");
  if (partes.length !== 3) return iso;
  const [y, m, d] = partes;
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${d} ${meses[parseInt(m, 10) - 1]} ${y}`;
}

function getSemanaId(fechaIso: string): string {
  if (!fechaIso) return "";
  const d = new Date(fechaIso);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
}

function getDiaSemanaCorta(): string {
  const map = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  return map[new Date().getDay()];
}

// ═══════════════════════════════════════════════════════
// SKELETON SCREEN
// ═══════════════════════════════════════════════════════

function SkeletonPortal() {
  return (
    <div className="min-h-screen bg-slate-50 animate-pulse">
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-5 w-40 bg-slate-200 rounded-lg" />
            <div className="h-3 w-28 bg-slate-100 rounded-md" />
          </div>
          <div className="h-8 w-24 bg-slate-200 rounded-xl" />
        </div>
        <div className="h-10 bg-slate-200 rounded-xl" />
        <div className="h-72 bg-slate-100 rounded-3xl" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════

export default function EmpleadoPortalPage() {
  const { sesion, cargando, cerrarSesion } = useAuth();
  const router = useRouter();

  // ── Reloj en vivo ──
  const [horaViva, setHoraViva] = useState<string>("--:--:--");
  const [fechaViva, setFechaViva] = useState<string>("");

  useEffect(() => {
    const tick = () => {
      const ahora = new Date();
      setHoraViva(ahora.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setFechaViva(ahora.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── SEGURIDAD DE ENTRADA: Redirigir roles administrativos ──
  useEffect(() => {
    if (cargando) return;
    if (!sesion) {
      router.replace("/login");
      return;
    }
    if (sesion.rol === "Gerente" || sesion.rol === "Subgerente" || sesion.rol === "Supervisor") {
      router.replace("/dashboard");
    }
  }, [cargando, sesion, router]);

  // ── Tabs ──
  const [activeTab, setActiveTab] = useState<ActiveTab>("asistencia");

  // ── Estado: Asistencia (FIREBASE REAL) ──
  const [jornandaActiva, setJornadaActiva] = useState(false);
  const [idAsistenciaActiva, setIdAsistenciaActiva] = useState<string | null>(null);
  const [horaEntrada, setHoraEntrada] = useState<string | null>(null);
  const [bitacoraTexto, setBitacoraTexto] = useState("");
  const [isSubmittingAsistencia, setIsSubmittingAsistencia] = useState(false);
  const [historialAsistencia, setHistorialAsistencia] = useState<RegistroAsistencia[]>([]);

  // ── Estado: Tareas ──
  const [tareas, setTareas] = useState<Tarea[]>([]);
  
  // ── Estado: Planificación Semanal ──
  const [bloquesSemana, setBloquesSemana] = useState<BloqueSemanal[]>([]);

  // ── Estado: Permisos (FIREBASE REAL) ──
  const [permisoTipo, setPermisoTipo] = useState<TipoPermiso>("Permiso por Salud");
  const [permisoFecha, setPermisoFecha] = useState("");
  const [permisoJustificacion, setPermisoJustificacion] = useState("");
  const [isSubmittingPermiso, setIsSubmittingPermiso] = useState(false);
  const [permisoExito, setPermisoExito] = useState(false);

  // ── Logs internos ──
  const [logs, setLogs] = useState<LogInterno[]>([]);
  const addLog = useCallback((msg: string) => {
    setLogs((p) => [{ id: uid(), hora: horaActual(), mensaje: msg }, ...p].slice(0, 40));
  }, []);

  // ─────────────────────────────────────────────────────
  // FIREBASE ONSNAPSHOT: Cargar Asistencias del Empleado
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!sesion || sesion.rol !== "Colaborador") return;

    const q = query(
      collection(db, "asistencias"),
      where("usuarioId", "==", sesion.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      let tieneActiva = false;
      const historial: RegistroAsistencia[] = [];

      snap.forEach((d) => {
        const data = d.data();
        historial.push({
          id: d.id,
          fecha: data.fecha || "",
          entrada: data.entrada || "",
          salida: data.salida || null,
          bitacora: data.bitacora || "",
        });

        // Detectar si hay una jornada abierta el día de hoy
        if (data.fecha === hoyISO() && !data.salida) {
          tieneActiva = true;
          setIdAsistenciaActiva(d.id);
          setHoraEntrada(data.entrada);
        }
      });

      // Ordenar de más reciente a más antigua
      historial.sort((a, b) => {
        if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha);
        return b.entrada.localeCompare(a.entrada);
      });

      setHistorialAsistencia(historial);
      setJornadaActiva(tieneActiva);

      if (!tieneActiva) {
        setIdAsistenciaActiva(null);
        setHoraEntrada(null);
      }
    });

    return () => unsub();
  }, [sesion]);

  // ─────────────────────────────────────────────────────
  // FIREBASE ONSNAPSHOT: Cargar Tareas del Empleado
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!sesion || sesion.rol !== "Colaborador") return;
    const q = query(
      collection(db, "tareas_planta"),
      where("empleadoId", "==", sesion.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const lista: Tarea[] = snap.docs.map(d => ({
        id: d.id,
        descripcion: d.data().descripcion ?? "",
        prioridad: d.data().prioridad ?? "Media",
        completada: d.data().completada ?? false,
      }));
      setTareas(lista);
    });
    return () => unsub();
  }, [sesion]);
  
  // ─────────────────────────────────────────────────────
  // FIREBASE ONSNAPSHOT: Cargar Plan Semanal del Empleado
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!sesion || sesion.rol !== "Colaborador") return;
    const semanaActual = getSemanaId(hoyISO());
    const q = query(
      collection(db, "planificacion_semanal"),
      where("empleadoId", "==", sesion.uid),
      where("semanaId", "==", semanaActual)
    );
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as BloqueSemanal[];
      setBloquesSemana(lista);
    });
    return () => unsub();
  }, [sesion]);

  // ─────────────────────────────────────────────────────
  // LÓGICA: CLOCK-IN
  // ─────────────────────────────────────────────────────

  const handleClockIn = async () => {
    if (!sesion) return;
    const hora = horaActual();
    const fecha = hoyISO();

    try {
      const docRef = await addDoc(collection(db, "asistencias"), {
        usuarioId: sesion.uid,
        nombre: sesion.nombre,
        fecha: fecha,
        entrada: hora,
        salida: null,
        bitacora: "",
        fotosUrls: [],
      });
      
      setJornadaActiva(true);
      setHoraEntrada(hora);
      setIdAsistenciaActiva(docRef.id);
      addLog(`Jornada iniciada a las ${hora}`);
    } catch (error) {
      console.error("Error al hacer clock-in:", error);
      alert("Hubo un error al iniciar la jornada. Revisa tu conexión.");
    }
  };

  // ─────────────────────────────────────────────────────
  // LÓGICA: CLOCK-OUT CON BITÁCORA
  // ─────────────────────────────────────────────────────

  const handleClockOut = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!sesion || !idAsistenciaActiva) return;
    if (!bitacoraTexto.trim()) return;
    
    setIsSubmittingAsistencia(true);
    const horaSalida = horaActual();

    try {
      await updateDoc(doc(db, "asistencias", idAsistenciaActiva), {
        salida: horaSalida,
        bitacora: bitacoraTexto.trim(),
      });

      addLog(`Jornada cerrada a las ${horaSalida}.`);
      
      setBitacoraTexto("");
    } catch (error) {
      console.error("Error al cerrar la jornada:", error);
      alert("No se pudo marcar la salida. Verifica tu conexión e inténtalo nuevamente.");
    } finally {
      setIsSubmittingAsistencia(false);
    }
  };

  // ─────────────────────────────────────────────────────
  // LÓGICA: TAREAS (FIREBASE REAL)
  // ─────────────────────────────────────────────────────

  const toggleTarea = async (id: string, estadoActual: boolean) => {
    try {
      await updateDoc(doc(db, "tareas_planta", id), {
        completada: !estadoActual
      });
      addLog(`Tarea actualizada exitosamente.`);
    } catch (e) {
      console.error(e);
      alert("Error al actualizar la tarea.");
    }
  };

  const tareasCompletadasHoy = tareas.filter((t) => t.completada).length;

  // ─────────────────────────────────────────────────────
  // LÓGICA: PERMISOS
  // ─────────────────────────────────────────────────────

  const handlePermisoSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!sesion || !permisoFecha || !permisoJustificacion.trim()) return;
    
    setIsSubmittingPermiso(true);

    try {
      await addDoc(collection(db, "permisos"), {
        usuarioId: sesion.uid,
        nombre: sesion.nombre,
        tipo: permisoTipo,
        fechaSolicitada: permisoFecha,
        justificacion: permisoJustificacion.trim(),
        estado: "Pendiente",
        fechaCreacion: hoyISO(),
        timestamp: serverTimestamp()
      });

      addLog(`Solicitud de "${permisoTipo}" enviada para el ${formatFecha(permisoFecha)}.`);
      setPermisoExito(true);
      setPermisoFecha("");
      setPermisoJustificacion("");
      setTimeout(() => setPermisoExito(false), 5000);
    } catch (error) {
      console.error("Error al solicitar permiso:", error);
      alert("Error al enviar solicitud de permiso.");
    } finally {
      setIsSubmittingPermiso(false);
    }
  };

  // ─────────────────────────────────────────────────────
  // RENDERS CONDICIONALES
  // ─────────────────────────────────────────────────────

  if (cargando || !sesion) return <SkeletonPortal />;
  if (sesion.rol !== "Colaborador") return <SkeletonPortal />; // Evita flasheo mientras redirige

  const nombreCorto = sesion.nombre.split(" ")[0];
  const canClockOut = bitacoraTexto.trim().length > 0;

  // ─────────────────────────────────────────────────────
  // RENDER PRINCIPAL
  // ─────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── ENCABEZADO MÓVIL OPTIMIZADO ── */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
              <Flame className="w-4 h-4 text-white" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 tracking-tight leading-none truncate">
                Hola, {nombreCorto}
              </p>
              <span className="inline-flex items-center mt-0.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-semibold ring-1 ring-slate-200/60">
                Colaborador de Planta
              </span>
            </div>
          </div>
          <button
            onClick={async () => { await cerrarSesion(); router.replace("/login"); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 hover:ring-1 hover:ring-red-200/60 transition-all duration-150 active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span className="hidden xs:inline">Salir</span>
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* ── BARRA DE PESTAÑAS ── */}
        <nav aria-label="Portal de autoservicio" className="bg-slate-100/80 p-1 flex gap-1.5 overflow-x-auto ring-1 ring-slate-200/40 rounded-xl">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 whitespace-nowrap flex-1 justify-center transition-all duration-200 ${
                activeTab === id
                  ? "bg-white text-slate-900 font-semibold shadow-xs ring-1 ring-slate-200/80 rounded-lg px-3 py-2 text-xs"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/50 rounded-lg px-3 py-2 text-xs"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
              {label}
            </button>
          ))}
        </nav>

        {/* ── TARJETA CONTENEDORA PRINCIPAL ── */}
        <div className="bg-gradient-to-b from-white to-slate-50/50 rounded-3xl p-6 ring-1 ring-slate-200/60 shadow-inner shadow-slate-100/40">

          {/* ══════════════════════════════════
              PESTAÑA 1 — ASISTENCIA
          ══════════════════════════════════ */}
          {activeTab === "asistencia" && (
            <div className="space-y-6">

              {/* Reloj en vivo */}
              <div className="text-center space-y-1">
                <p className="text-xs font-medium text-slate-400 capitalize">{fechaViva}</p>
                <p className="text-5xl font-bold font-mono text-slate-900 tracking-tight tabular-nums">{horaViva}</p>
                {jornandaActiva && horaEntrada && (
                  <p className="text-xs text-emerald-600 font-semibold">
                    Jornada iniciada a las {horaEntrada}
                  </p>
                )}
              </div>

              {/* Clock-in */}
              {!jornandaActiva && (
                <button
                  onClick={handleClockIn}
                  className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-600 text-white font-bold text-lg shadow-lg shadow-emerald-200 hover:shadow-xl hover:from-emerald-400 hover:to-emerald-500 active:scale-[0.98] transition-all duration-200"
                >
                  <Timer className="w-6 h-6" strokeWidth={1.5} />
                  ⏱️ Iniciar Jornada (Clock-In)
                </button>
              )}

              {/* Formulario de cierre de turno */}
              {jornandaActiva && (
                <form onSubmit={handleClockOut} className="space-y-5">
                  <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200/60">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-sm font-semibold text-emerald-800">Jornada en curso — completa la bitácora para finalizar</p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="bitacora-turno" className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <FileText className="w-4 h-4 text-slate-500" strokeWidth={1.5} />
                      Explicación detallada de lo realizado en su turno (Bitácora)
                      <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="bitacora-turno"
                      rows={4}
                      value={bitacoraTexto}
                      onChange={(e) => setBitacoraTexto(e.target.value)}
                      disabled={isSubmittingAsistencia}
                      placeholder="Describe detalladamente las actividades realizadas..."
                      className="w-full px-4 py-3 rounded-xl border border-slate-200/80 bg-white text-slate-900 text-sm placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-slate-400/60 transition-all disabled:opacity-50"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!canClockOut || isSubmittingAsistencia}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-b from-red-500 to-red-600 text-white font-bold text-sm shadow-md hover:from-red-400 hover:to-red-500 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    {isSubmittingAsistencia ? (
                      <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} /> Marcando salida...</>
                    ) : (
                      <>🛑 Finalizar Jornada (Clock-Out)</>
                    )}
                  </button>
                  {!canClockOut && !isSubmittingAsistencia && (
                    <p className="text-xs text-slate-400 text-center flex items-center justify-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                      Completa la bitácora para marcar la salida.
                    </p>
                  )}
                </form>
              )}

              {/* Historial minimalista */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <CalendarDays className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Turnos Pasados
                </p>
                <div className="space-y-2">
                  {historialAsistencia.map((r) => (
                    <div key={r.id} className="rounded-2xl ring-1 ring-slate-200/60 bg-slate-50/60 px-4 py-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">{formatFecha(r.fecha)}</span>
                        <div className="flex items-center gap-3 text-xs font-mono text-slate-500">
                          <span className="text-emerald-700">↓ {r.entrada}</span>
                          {r.salida ? (
                            <span className="text-red-600">↑ {r.salida}</span>
                          ) : (
                            <span className="text-amber-500 font-sans font-bold">En turno</span>
                          )}
                        </div>
                      </div>
                      {r.bitacora && <p className="text-xs text-slate-500 line-clamp-2">{r.bitacora}</p>}
                    </div>
                  ))}
                  {historialAsistencia.length === 0 && (
                    <p className="text-sm text-center py-4 text-slate-400">Sin registros recientes.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════
              PESTAÑA "PLAN" — MI PLAN SEMANAL
          ══════════════════════════════════ */}
          {activeTab === "plan" && (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-slate-600" strokeWidth={1.5} />
                <h2 className="text-base font-bold text-slate-950 tracking-tight">Mi Plan Semanal</h2>
              </div>
               
              {bloquesSemana.length === 0 ? (
                <div className="text-center py-10 bg-slate-50/50 rounded-2xl ring-1 ring-slate-200/60 border border-dashed border-slate-300">
                  <CalendarDays className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-500">No hay planificación asignada para esta semana.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bloquesSemana.map(bloque => (
                    <div key={bloque.id} className={`p-4 rounded-2xl ring-1 shadow-sm overflow-hidden ${bloque.esUrgente ? "bg-red-50/50 ring-red-200/60" : "bg-white ring-slate-200/60"}`}>
                      <div className="mb-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900">{bloque.modelo}</h3>
                          {bloque.esUrgente && <span className="text-[10px] uppercase font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-md">Urgente</span>}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Área: {bloque.area} | Total semanal: <span className="font-semibold text-slate-700">{bloque.unidadesObjetivo}</span> uds</p>
                      </div>
                       
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((dia) => {
                          const isHoy = getDiaSemanaCorta() === dia;
                          const meta = bloque.distribucionDiaria?.[dia] || 0;
                          return (
                            <div key={dia} className={`flex flex-col items-center justify-center p-2 rounded-xl border ${isHoy ? 'border-blue-400 bg-blue-50' : 'border-slate-100 bg-slate-50/80'}`}>
                              <span className={`text-[10px] uppercase font-semibold ${isHoy ? 'text-blue-600' : 'text-slate-400'}`}>{dia}</span>
                              <span className={`text-lg font-bold ${meta > 0 ? (bloque.esUrgente ? 'text-red-600' : 'text-slate-800') : 'text-slate-300'}`}>{meta}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════
              PESTAÑA 2 — TAREAS
          ══════════════════════════════════ */}
          {activeTab === "tareas" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-slate-600" strokeWidth={1.5} />
                  <h2 className="text-base font-bold text-slate-950 tracking-tight">Tareas de Hoy</h2>
                </div>
                <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg ring-1 ring-slate-200/60">
                  {tareasCompletadasHoy} / {tareas.length} completadas
                </span>
              </div>

              {/* BANNERS DE METAS DEL DÍA */}
              {bloquesSemana.filter(b => (b.distribucionDiaria?.[getDiaSemanaCorta()] || 0) > 0).map(bloque => {
                const metaHoy = bloque.distribucionDiaria[getDiaSemanaCorta()];
                const isUrgente = bloque.esUrgente;
                return (
                  <div key={`meta-${bloque.id}`} className={`p-4 rounded-2xl ring-1 shadow-sm flex items-center gap-3 ${isUrgente ? "bg-red-50 ring-red-200/60" : "bg-blue-50 ring-blue-200/60"}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isUrgente ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}>
                      <Flame className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-wider ${isUrgente ? "text-red-700" : "text-blue-700"}`}>
                        🎯 Meta de Hoy {isUrgente && "- URGENTE"}
                      </p>
                      <p className={`text-sm font-semibold mt-0.5 ${isUrgente ? "text-red-900" : "text-blue-900"}`}>
                        Ensamblar {metaHoy} unidades de {bloque.modelo}
                      </p>
                    </div>
                  </div>
                )
              })}

              {/* Lista de tareas */}
              <div className="space-y-2">
                {tareas.length === 0 && (
                  <div className="text-center py-10 bg-slate-50/50 rounded-2xl ring-1 ring-slate-200/60 border border-dashed border-slate-300">
                    <CheckSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-500">No tienes tareas asignadas por ahora.</p>
                  </div>
                )}
                {tareas.map((tarea) => {
                  const completada = tarea.completada;
                  return (
                    <button
                      key={tarea.id}
                      onClick={() => toggleTarea(tarea.id, completada)}
                      className={`w-full flex items-start gap-3 px-4 py-3.5 rounded-2xl ring-1 text-left transition-all duration-200 ${
                        completada
                          ? "bg-slate-50 ring-slate-200/40 opacity-50"
                          : "bg-white ring-slate-200/60 hover:ring-slate-300/70 hover:bg-slate-50/50 active:scale-[0.99]"
                      }`}
                    >
                      {/* Checkbox interactivo */}
                      <div className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 ring-1 transition-all ${
                        completada ? "bg-emerald-500 ring-emerald-500" : "bg-white ring-slate-300"
                      }`}>
                        {completada ? <Check className="w-3 h-3 text-white" strokeWidth={2.5} /> : <Square className="w-3 h-3 text-transparent" strokeWidth={0} />}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className={`text-sm font-medium leading-snug ${completada ? "line-through text-slate-400" : "text-slate-900"}`}>
                          {tarea.descripcion}
                        </p>
                        <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-md ${PRIORIDAD_ESTILOS[tarea.prioridad]}`}>
                          {tarea.prioridad}
                        </span>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 mt-0.5 transition-transform ${completada ? "rotate-90 text-slate-300" : "text-slate-400"}`} strokeWidth={1.5} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════
              PESTAÑA 3 — RENDIMIENTO
          ══════════════════════════════════ */}
          {activeTab === "rendimiento" && (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-slate-600" strokeWidth={1.5} />
                <h2 className="text-base font-bold text-slate-950 tracking-tight">Métricas Individuales</h2>
              </div>

              {/* Barra de meta de estufas */}
              <div className="space-y-3 p-5 rounded-2xl bg-slate-50 ring-1 ring-slate-200/60">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">Estufas Ensambladas por Mí Este Mes</p>
                  <span className="font-mono text-sm font-bold text-slate-900">12 <span className="text-slate-400 font-normal">/ 30</span></span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full w-[40%] bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-700" />
                </div>
                <p className="text-xs text-slate-500">40% completado · Faltan 18 unidades</p>
              </div>

              {/* Micro-KPIs font-mono */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-emerald-800">Tareas Completadas Hoy</p>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={1.5} />
                  </div>
                  <p className="text-3xl font-bold font-mono text-emerald-700 leading-none">{tareasCompletadasHoy}</p>
                </div>
                <div className="bg-blue-50 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-blue-800">Jornadas Registradas</p>
                    <CalendarDays className="w-4 h-4 text-blue-600 shrink-0" strokeWidth={1.5} />
                  </div>
                  <p className="text-3xl font-bold font-mono text-blue-700 leading-none">{historialAsistencia.length}</p>
                </div>
              </div>

              {/* Logs internos */}
              {logs.length > 0 && (
                <div className="space-y-2 pt-4 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Actividad de hoy</p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-2 py-1 text-xs text-slate-600">
                        <span className="font-mono text-slate-400 shrink-0">[{log.hora}]</span>
                        <span>{log.mensaje}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════
              PESTAÑA 4 — PERMISOS
          ══════════════════════════════════ */}
          {activeTab === "permisos" && (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-600" strokeWidth={1.5} />
                <h2 className="text-base font-bold text-slate-950 tracking-tight">Solicitudes Rápidas</h2>
              </div>

              {permisoExito && (
                <div className="flex items-center gap-2.5 p-4 bg-emerald-50 border border-emerald-200/60 rounded-2xl">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" strokeWidth={1.5} />
                  <p className="text-sm font-semibold text-emerald-800">¡Solicitud enviada a gerencia!</p>
                </div>
              )}

              <form onSubmit={handlePermisoSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="permiso-tipo" className="block text-sm font-semibold text-slate-800">Tipo de Solicitud</label>
                  <select
                    id="permiso-tipo"
                    value={permisoTipo}
                    onChange={(e) => setPermisoTipo(e.target.value as TipoPermiso)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200/80 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/60 focus:border-transparent transition-all cursor-pointer"
                  >
                    <option>Permiso por Salud</option>
                    <option>Día Libre Con Goce</option>
                    <option>Incidencia de Taller</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="permiso-fecha" className="block text-sm font-semibold text-slate-800">Fecha del Permiso</label>
                  <input
                    id="permiso-fecha"
                    type="date"
                    value={permisoFecha}
                    onChange={(e) => setPermisoFecha(e.target.value)}
                    required
                    min={hoyISO()}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200/80 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/60 focus:border-transparent transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="permiso-justificacion" className="block text-sm font-semibold text-slate-800">Justificación</label>
                  <textarea
                    id="permiso-justificacion"
                    rows={4}
                    value={permisoJustificacion}
                    onChange={(e) => setPermisoJustificacion(e.target.value)}
                    placeholder="Describe el motivo..."
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200/80 bg-white text-slate-900 text-sm placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-slate-400/60 focus:border-transparent transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingPermiso || !permisoFecha || !permisoJustificacion.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingPermiso ? (
                    <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} /> Procesando…</>
                  ) : (
                    <><Send className="w-4 h-4" strokeWidth={1.5} /> Enviar Solicitud a Base de Datos</>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ══════════════════════════════════
              PESTAÑA 5 — ENTREGAS
          ══════════════════════════════════ */}
          {activeTab === "entregas" && <TabEntregas />}

        </div>
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────────
   TabEntregas
───────────────────────────────────────────── */
function TabEntregas() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const entregasPlanificadas = [
    {
      id: "ENV-001",
      cliente: "María González",
      comunidad: "Jocotenango, Sacatepéquez",
      direccion: "3ra Calle Poniente #12, Barrio San Felipe",
      telefono: "+502 5555-0101",
      producto: "Ecocina",
      estado: "Pendiente",
      horaEstimada: "10:00 AM",
      notas: "Cuidado con el perro. Dejar en la puerta principal.",
    },
    {
      id: "ENV-002",
      cliente: "Comité Comunitario San Juan",
      comunidad: "San Juan del Obispo",
      direccion: "Salón Comunal, frente a la plaza",
      telefono: "+502 5555-0202",
      producto: "EcoPlancha Superior",
      estado: "En Ruta",
      horaEstimada: "11:30 AM",
      notas: "Llamar al presidente del comité 10 min antes de llegar.",
    },
    {
      id: "ENV-003",
      cliente: "Marta López",
      comunidad: "Santiago Zamora",
      direccion: "Lote 45, Callejón Los Pinos",
      telefono: "+502 5555-0404",
      producto: "Ecocomal",
      estado: "Pendiente",
      horaEstimada: "02:00 PM",
      notas: "Camino de terracería. Subir despacio.",
    },
  ];

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const badgeEstilos: Record<string, string> = {
    Pendiente: "bg-amber-50 text-amber-700 ring-amber-200/60",
    "En Ruta": "bg-blue-50 text-blue-700 ring-blue-200/60",
    Completado: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-slate-600" strokeWidth={1.5} />
          <h2 className="text-base font-bold text-slate-950 tracking-tight">Entregas de Hoy</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {entregasPlanificadas.map((entrega) => {
          const isExpanded = expandedId === entrega.id;

          return (
            <div
              key={entrega.id}
              className="bg-white rounded-2xl border border-slate-200/60 shadow-xs hover:border-slate-300 transition-all overflow-hidden"
            >
              {/* Header (Clickable para expandir) */}
              <div
                className="p-4 flex items-center justify-between cursor-pointer active:bg-slate-50"
                onClick={() => toggleExpand(entrega.id)}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900 truncate">{entrega.cliente}</p>
                    <span
                      className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-md ring-1 ${
                        badgeEstilos[entrega.estado] || "bg-slate-100 text-slate-600 ring-slate-200/60"
                      }`}
                    >
                      {entrega.estado}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {entrega.comunidad}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 ml-3 shrink-0">
                  <span className="text-xs font-semibold text-slate-700">{entrega.horaEstimada}</span>
                  <ChevronRight
                    className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                    strokeWidth={1.5}
                  />
                </div>
              </div>

              {/* Contenido Expandido */}
              <div
                className={`grid transition-all duration-300 ease-in-out ${
                  isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="p-4 pt-0 border-t border-slate-100 mt-2 space-y-4 bg-slate-50/50">
                    
                    <div className="grid grid-cols-1 gap-3 text-sm pt-4">
                      <div className="flex items-start gap-2 text-slate-700">
                        <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                        <div>
                          <p className="font-semibold text-xs text-slate-500 uppercase tracking-wider mb-0.5">Dirección Exacta</p>
                          <p>{entrega.direccion}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 text-slate-700">
                        <Package className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                        <div>
                          <p className="font-semibold text-xs text-slate-500 uppercase tracking-wider mb-0.5">Producto a Entregar</p>
                          <p className="font-medium">{entrega.producto}</p>
                        </div>
                      </div>

                      {entrega.notas && (
                        <div className="flex items-start gap-2 text-slate-700">
                          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                          <div>
                            <p className="font-semibold text-xs text-slate-500 uppercase tracking-wider mb-0.5">Notas / Observaciones</p>
                            <p className="text-xs">{entrega.notas}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <a
                        href={`tel:${entrega.telefono.replace(/\s+/g, "")}`}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone className="w-4 h-4" />
                        Llamar
                      </a>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          alert("A futuro: abrir cámara para subir evidencia y marcar entregado.");
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 transition-all active:scale-95 shadow-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Entregado
                      </button>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
