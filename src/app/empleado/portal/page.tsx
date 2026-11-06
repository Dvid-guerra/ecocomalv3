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
  TrendingUp,
  Check,
  Truck,
  LogIn,
  Target,
  Inbox,
} from "lucide-react";

import {
  Card,
  Button,
  Badge,
  Tabs,
  FormField,
  TextInput,
  SelectInput,
  TextArea,
  EmptyState,
  Aviso,
  Skeleton,
  type Tono,
} from "@/components/ui";
import { cn } from "@/lib/cn";

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

const PRIORIDAD_TONO: Record<Prioridad, Tono> = {
  Alta:  "risk",
  Media: "warn",
  Baja:  "neutral",
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
    <div className="min-h-screen bg-canvas">
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40 rounded-control" />
            <Skeleton className="h-3 w-28 rounded-control" />
          </div>
          <Skeleton className="h-9 w-24 rounded-control" />
        </div>
        <Skeleton className="h-11 rounded-control" />
        <Skeleton className="h-72 rounded-panel" />
        <span className="sr-only">Cargando tu portal…</span>
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
    <div className="min-h-screen bg-canvas">

      {/* ── ENCABEZADO MÓVIL OPTIMIZADO ── */}
      <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur-md border-b border-line">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="w-9 h-9 rounded-control bg-action flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              <Flame className="w-4 h-4 text-white" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink leading-tight truncate">
                Hola, {nombreCorto}
              </p>
              <p className="text-xs text-ink-muted">Colaborador de planta</p>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => { await cerrarSesion(); router.replace("/login"); }}
            className="touch shrink-0 inline-flex items-center gap-1.5 px-3 rounded-control text-xs font-semibold text-ink-muted hover:text-risk hover:bg-risk-surface transition-colors active:scale-95"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            {/* El breakpoint `xs` no existe en Tailwind: esta etiqueta
                llevaba `hidden xs:inline` y no se mostraba nunca. */}
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* ── BARRA DE PESTAÑAS ── */}
        <Tabs
          etiqueta="Portal de autoservicio"
          value={activeTab}
          onChange={setActiveTab}
          items={TABS}
        />

        {/* ── TARJETA CONTENEDORA PRINCIPAL ── */}
        <Card nivel="panel" className="p-5 sm:p-6">

          {/* ══════════════════════════════════
              PESTAÑA 1 — ASISTENCIA
          ══════════════════════════════════ */}
          {activeTab === "asistencia" && (
            <div className="space-y-6">

              {/* Reloj en vivo */}
              <div className="text-center space-y-1">
                <p className="text-xs font-medium text-ink-muted capitalize">{fechaViva}</p>
                <p className="nums text-5xl font-bold text-ink leading-none">{horaViva}</p>
                {jornandaActiva && horaEntrada && (
                  <p className="nums text-xs text-ok font-semibold">
                    Jornada iniciada a las {horaEntrada}
                  </p>
                )}
              </div>

              {/* Clock-in */}
              {!jornandaActiva && (
                <Button
                  onClick={handleClockIn}
                  ancho
                  className="min-h-16 text-base"
                  iconLeft={<Timer className="w-5 h-5" strokeWidth={2} />}
                >
                  Iniciar jornada
                </Button>
              )}

              {/* Formulario de cierre de turno */}
              {jornandaActiva && (
                <form onSubmit={handleClockOut} className="space-y-5">
                  <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-control bg-ok-surface ring-1 ring-ok-line">
                    <span className="w-2 h-2 rounded-full bg-ok animate-skeleton shrink-0" aria-hidden="true" />
                    <p className="text-sm font-semibold text-ok">
                      Jornada en curso — completa la bitácora para finalizar
                    </p>
                  </div>

                  <FormField
                    label="Bitácora del turno"
                    htmlFor="bitacora-turno"
                    pista="Describe lo que hiciste hoy. Es obligatoria para marcar la salida."
                  >
                    <TextArea
                      id="bitacora-turno"
                      rows={4}
                      value={bitacoraTexto}
                      onChange={(e) => setBitacoraTexto(e.target.value)}
                      disabled={isSubmittingAsistencia}
                      required
                      placeholder="Ej. Soldé 12 bases y preparé la carga de Sololá."
                    />
                  </FormField>

                  <Button
                    type="submit"
                    variante="danger"
                    ancho
                    className="min-h-14"
                    disabled={!canClockOut}
                    cargando={isSubmittingAsistencia}
                    iconLeft={<LogOut className="w-4 h-4" strokeWidth={2} />}
                  >
                    {isSubmittingAsistencia ? "Marcando salida…" : "Finalizar jornada"}
                  </Button>

                  {!canClockOut && !isSubmittingAsistencia && (
                    <p className="text-xs text-ink-muted text-center flex items-center justify-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                      Completa la bitácora para marcar la salida.
                    </p>
                  )}
                </form>
              )}

              {/* Historial minimalista */}
              <div className="space-y-3 pt-4 border-t border-line">
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider flex items-center gap-2">
                  <CalendarDays className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" />
                  Turnos pasados
                </p>
                <div className="space-y-2">
                  {historialAsistencia.map((r) => (
                    <div key={r.id} className="rounded-card ring-1 ring-line bg-sunken px-4 py-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-ink-body">{formatFecha(r.fecha)}</span>
                        <div className="flex items-center gap-3 text-xs font-semibold shrink-0">
                          <span className="nums text-ok inline-flex items-center gap-1">
                            <LogIn className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
                            <span className="sr-only">Entrada: </span>{r.entrada}
                          </span>
                          {r.salida ? (
                            <span className="nums text-ink-muted inline-flex items-center gap-1">
                              <LogOut className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
                              <span className="sr-only">Salida: </span>{r.salida}
                            </span>
                          ) : (
                            <Badge tono="warn">En turno</Badge>
                          )}
                        </div>
                      </div>
                      {r.bitacora && <p className="text-xs text-ink-muted line-clamp-2">{r.bitacora}</p>}
                    </div>
                  ))}
                  {historialAsistencia.length === 0 && (
                    <EmptyState
                      icono={Clock}
                      titulo="Sin turnos registrados"
                      descripcion="Cuando inicies y cierres tu primera jornada, el historial aparecerá aquí."
                    />
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
                <CalendarDays className="w-5 h-5 text-ink-muted" strokeWidth={1.5} aria-hidden="true" />
                <h2 className="text-base font-semibold text-ink">Mi plan semanal</h2>
              </div>

              {bloquesSemana.length === 0 ? (
                <EmptyState
                  icono={CalendarDays}
                  titulo="Sin planificación esta semana"
                  descripcion="Cuando tu supervisor te asigne metas de producción, aparecerán aquí repartidas por día."
                />
              ) : (
                <div className="space-y-4">
                  {bloquesSemana.map(bloque => (
                    <div
                      key={bloque.id}
                      className={cn(
                        "p-4 rounded-card ring-1 shadow-card",
                        bloque.esUrgente ? "bg-risk-surface ring-risk-line" : "bg-surface ring-line",
                      )}
                    >
                      <div className="mb-3">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-ink">{bloque.modelo}</h3>
                          {bloque.esUrgente && <Badge tono="risk">Urgente</Badge>}
                        </div>
                        <p className="text-xs text-ink-muted mt-1">
                          {bloque.area} · Total semanal:{" "}
                          <span className="nums font-semibold text-ink-body">{bloque.unidadesObjetivo}</span> uds
                        </p>
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((dia) => {
                          const isHoy = getDiaSemanaCorta() === dia;
                          const meta = bloque.distribucionDiaria?.[dia] || 0;
                          return (
                            <div
                              key={dia}
                              aria-current={isHoy ? "date" : undefined}
                              className={cn(
                                "flex flex-col items-center justify-center py-2 rounded-control ring-1",
                                /* Hoy se marca con el grafito de la acción, no con
                                   un azul que en el resto del sistema significa
                                   "salida de inventario". */
                                isHoy ? "ring-action bg-surface" : "ring-line bg-sunken",
                              )}
                            >
                              <span className={cn(
                                "text-xs font-semibold uppercase",
                                isHoy ? "text-ink" : "text-ink-muted",
                              )}>
                                {dia}
                              </span>
                              <span className={cn(
                                "nums text-lg font-bold",
                                meta === 0
                                  ? "text-ink-muted"
                                  : bloque.esUrgente ? "text-risk" : "text-ink",
                              )}>
                                {meta}
                              </span>
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
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-ink-muted" strokeWidth={1.5} aria-hidden="true" />
                  <h2 className="text-base font-semibold text-ink">Tareas de hoy</h2>
                </div>
                <Badge
                  tono={tareas.length > 0 && tareasCompletadasHoy === tareas.length ? "ok" : "neutral"}
                  numerico
                >
                  {tareasCompletadasHoy} / {tareas.length} hechas
                </Badge>
              </div>

              {/* BANNERS DE METAS DEL DÍA */}
              {bloquesSemana.filter(b => (b.distribucionDiaria?.[getDiaSemanaCorta()] || 0) > 0).map(bloque => {
                const metaHoy = bloque.distribucionDiaria[getDiaSemanaCorta()];
                const isUrgente = bloque.esUrgente;
                return (
                  <div
                    key={`meta-${bloque.id}`}
                    className={cn(
                      "p-4 rounded-card ring-1 flex items-center gap-3",
                      isUrgente ? "bg-risk-surface ring-risk-line" : "bg-sunken ring-line",
                    )}
                  >
                    <span
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center shrink-0 ring-1",
                        isUrgente ? "bg-surface text-risk ring-risk-line" : "bg-surface text-ink-body ring-line",
                      )}
                      aria-hidden="true"
                    >
                      <Target className="w-5 h-5" strokeWidth={1.5} />
                    </span>
                    <div className="min-w-0">
                      <p className={cn(
                        "text-xs font-bold uppercase tracking-wider",
                        isUrgente ? "text-risk" : "text-ink-muted",
                      )}>
                        Meta de hoy{isUrgente && " · Urgente"}
                      </p>
                      <p className="text-sm font-semibold mt-0.5 text-ink">
                        Ensamblar <span className="nums">{metaHoy}</span> unidades de {bloque.modelo}
                      </p>
                    </div>
                  </div>
                )
              })}

              {/* Lista de tareas */}
              <div className="space-y-2">
                {tareas.length === 0 && (
                  <EmptyState
                    icono={CheckSquare}
                    titulo="No tienes tareas asignadas"
                    descripcion="Tu supervisor asigna las tareas del día desde Planta. Aparecerán aquí al instante."
                  />
                )}
                {tareas.map((tarea) => {
                  const completada = tarea.completada;
                  return (
                    <button
                      key={tarea.id}
                      type="button"
                      aria-pressed={completada}
                      onClick={() => toggleTarea(tarea.id, completada)}
                      className={cn(
                        "w-full flex items-start gap-3 px-4 py-3.5 rounded-card ring-1 text-left",
                        "transition-[background-color,box-shadow] duration-200",
                        completada
                          ? "bg-sunken ring-line"
                          : "bg-surface ring-line hover:ring-line-strong active:scale-[0.99]",
                      )}
                    >
                      {/* Checkbox interactivo */}
                      <span
                        className={cn(
                          "mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 ring-1 transition-colors",
                          completada ? "bg-ok ring-ok text-white" : "bg-surface ring-line-strong",
                        )}
                        aria-hidden="true"
                      >
                        {completada && <Check className="w-3 h-3" strokeWidth={3} />}
                      </span>
                      <span className="flex-1 min-w-0 space-y-1.5">
                        <span className={cn(
                          "block text-sm font-medium leading-snug",
                          completada ? "line-through text-ink-muted" : "text-ink",
                        )}>
                          {tarea.descripcion}
                        </span>
                        <Badge tono={completada ? "neutral" : PRIORIDAD_TONO[tarea.prioridad]}>
                          {tarea.prioridad}
                        </Badge>
                      </span>
                      <ChevronRight
                        className={cn(
                          "w-4 h-4 shrink-0 mt-0.5 text-ink-muted transition-transform duration-200",
                          completada && "rotate-90",
                        )}
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
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
                <TrendingUp className="w-5 h-5 text-ink-muted" strokeWidth={1.5} aria-hidden="true" />
                <h2 className="text-base font-semibold text-ink">Mis métricas</h2>
              </div>

              {/* Métricas reales, calculadas de las suscripciones de Firestore. */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-sunken ring-1 ring-line rounded-card p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-ink-muted">Tareas hechas hoy</p>
                    <CheckCircle2 className="w-4 h-4 text-ink-muted shrink-0" strokeWidth={1.5} aria-hidden="true" />
                  </div>
                  <p className="nums text-3xl font-bold text-ink leading-none">{tareasCompletadasHoy}</p>
                </div>
                <div className="bg-sunken ring-1 ring-line rounded-card p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-ink-muted">Jornadas registradas</p>
                    <CalendarDays className="w-4 h-4 text-ink-muted shrink-0" strokeWidth={1.5} aria-hidden="true" />
                  </div>
                  <p className="nums text-3xl font-bold text-ink leading-none">{historialAsistencia.length}</p>
                </div>
              </div>

              {/*
                Aquí vivía una barra de "Estufas ensambladas por mí este mes"
                con 12 / 30, 40 % y "faltan 18 unidades" escritos a mano en el
                JSX. Ninguna de esas cifras salía de Firestore, así que el
                portal le mostraba al colaborador un rendimiento inventado.
                Se retira hasta que se conecte a `registros_produccion`
                (RegistroProduccion.empleadoIds / unidadesProducidas).
              */}
              <Aviso tono="warn" icono={AlertCircle}>
                La producción mensual por persona todavía no está conectada. En cuanto se
                registre en planta, aparecerá aquí.
              </Aviso>

              {/* Logs internos */}
              {logs.length > 0 && (
                <div className="space-y-2 pt-4 border-t border-line">
                  <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Actividad de hoy</p>
                  <div className="custom-scrollbar max-h-32 space-y-1">
                    {logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-2 py-1 text-xs text-ink-body">
                        <span className="nums text-ink-muted shrink-0">[{log.hora}]</span>
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
                <FileText className="w-5 h-5 text-ink-muted" strokeWidth={1.5} aria-hidden="true" />
                <h2 className="text-base font-semibold text-ink">Solicitudes</h2>
              </div>

              {permisoExito && (
                <Aviso tono="ok" icono={CheckCircle2}>
                  Solicitud enviada a gerencia.
                </Aviso>
              )}

              <form onSubmit={handlePermisoSubmit} className="space-y-4">
                <FormField label="Tipo de solicitud" htmlFor="permiso-tipo">
                  <SelectInput
                    id="permiso-tipo"
                    value={permisoTipo}
                    onChange={(e) => setPermisoTipo(e.target.value as TipoPermiso)}
                  >
                    <option>Permiso por Salud</option>
                    <option>Día Libre Con Goce</option>
                    <option>Incidencia de Taller</option>
                  </SelectInput>
                </FormField>

                <FormField label="Fecha del permiso" htmlFor="permiso-fecha">
                  <TextInput
                    id="permiso-fecha"
                    type="date"
                    value={permisoFecha}
                    onChange={(e) => setPermisoFecha(e.target.value)}
                    required
                    min={hoyISO()}
                    numerico
                  />
                </FormField>

                <FormField label="Justificación" htmlFor="permiso-justificacion">
                  <TextArea
                    id="permiso-justificacion"
                    rows={4}
                    value={permisoJustificacion}
                    onChange={(e) => setPermisoJustificacion(e.target.value)}
                    placeholder="Describe el motivo…"
                    required
                  />
                </FormField>

                <Button
                  type="submit"
                  ancho
                  tamano="lg"
                  disabled={!permisoFecha || !permisoJustificacion.trim()}
                  cargando={isSubmittingPermiso}
                  iconLeft={<Send className="w-4 h-4" strokeWidth={2} />}
                >
                  {isSubmittingPermiso ? "Enviando…" : "Enviar solicitud"}
                </Button>
              </form>
            </div>
          )}

          {/* ══════════════════════════════════
              PESTAÑA 5 — ENTREGAS
          ══════════════════════════════════ */}
          {activeTab === "entregas" && <TabEntregas />}

        </Card>
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────────
   TabEntregas

   Esta pestaña traía tres entregas escritas a mano en el código
   — clientes, direcciones, teléfonos y notas inventados — que se
   le presentaban al colaborador como su ruta del día, y el botón
   "Entregado" solo abría un alert("A futuro: ..."). Se retira el
   contenido ficticio y queda el estado honesto.

   Para conectarla de verdad: leer `envios` filtrando por
   `colaboradores` array-contains el uid de la sesión y estado
   distinto de "Entregado", y unir con `pedidos` → `clientes`
   para la dirección y el teléfono, igual que hace
   src/app/dashboard/entregas/page.tsx.
───────────────────────────────────────────── */
function TabEntregas() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Truck className="w-5 h-5 text-ink-muted" strokeWidth={1.5} aria-hidden="true" />
        <h2 className="text-base font-semibold text-ink">Entregas de hoy</h2>
      </div>

      <EmptyState
        icono={Inbox}
        titulo="Tus entregas aún no están conectadas"
        descripcion="Cuando el módulo de Ventas y Envíos asigne rutas a tu usuario, verás aquí el destino, el vehículo y los datos de contacto."
      />
    </div>
  );
}
