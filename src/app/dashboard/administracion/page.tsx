"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  query,
  orderBy
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Rol, UsuarioAdmin } from "@/types";
import {
  ArrowLeft,
  Users,
  Search,
  ShieldCheck,
  Clock,
  FileText,
  Camera,
  CheckCircle2,
  XCircle,
  Clock3,
  ExternalLink,
} from "lucide-react";

/* ─────────────────────────────────────────────
   Constantes & Tipos
───────────────────────────────────────────── */
const ROLES: Rol[] = ["Gerente", "Subgerente", "Supervisor", "Colaborador"];

const ROL_BADGE: Record<Rol, string> = {
  Gerente: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  Subgerente: "bg-orange-50 text-orange-700 border border-orange-200",
  Supervisor: "bg-slate-100 text-slate-700 border border-slate-200",
  Colaborador: "bg-stone-100 text-stone-600 border border-stone-200",
};

type AdminTab = "personal" | "asistencias" | "permisos";

/* ── Tipos Reales ── */
interface AsistenciaReal {
  id: string;
  nombre: string;
  fecha: string;
  entrada: string;
  salida: string | null;
  bitacora: string;
  fotosUrls: string[];
}

type EstadoPermiso = "Pendiente" | "Aprobado" | "Rechazado";

interface PermisoReal {
  id: string;
  nombre: string;
  tipo: string;
  fechaSolicitada: string;
  justificacion: string;
  estado: EstadoPermiso;
  fechaCreacion: string;
}

/* ─────────────────────────────────────────────
   Componentes Reutilizables
───────────────────────────────────────────── */
function ToggleActivo({
  activo,
  onChange,
  disabled,
}: {
  activo: boolean;
  onChange: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${activo ? "bg-emerald-800" : "bg-stone-200"} ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${activo ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function Avatar({ nombre }: { nombre: string }) {
  const iniciales = nombre.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-900 text-sm font-semibold select-none">
      {iniciales}
    </span>
  );
}

function formatFechaUI(iso: string): string {
  if (!iso) return "";
  const partes = iso.split("-");
  if (partes.length !== 3) return iso;
  const [y, m, d] = partes;
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d} ${meses[parseInt(m, 10) - 1]} ${y}`;
}

function Skeleton() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="w-full max-w-5xl px-4 space-y-4 animate-pulse">
        <div className="h-10 w-64 bg-stone-200 rounded-2xl" />
        <div className="h-6 w-40 bg-stone-100 rounded-xl" />
        <div className="mt-8 bg-white rounded-3xl border border-stone-200/60 p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-9 w-9 rounded-full bg-stone-100" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-stone-100 rounded" />
                <div className="h-3 w-32 bg-stone-50 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Página Principal (Layout y Tabs)
───────────────────────────────────────────── */
export default function AdministracionPage() {
  const { sesion, cargando } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<AdminTab | null>(null);

  /* ── Guardia de acceso RBAC ── */
  useEffect(() => {
    if (cargando) return;
    if (!sesion) {
      router.replace("/login");
      return;
    }
    const permitidos = ["Gerente", "Subgerente", "Supervisor"];
    if (!permitidos.includes(sesion.rol)) {
      router.replace("/dashboard?acceso=denegado");
      return;
    }
  }, [cargando, sesion, router]);

  if (cargando || !sesion) return <Skeleton />;
  const permitidos = ["Gerente", "Subgerente", "Supervisor"];
  if (!permitidos.includes(sesion.rol)) return null;

  const esSupervisor = sesion.rol === "Supervisor";
  const defaultTab = (sesion.rol === "Gerente" || sesion.rol === "Subgerente") ? "personal" : "asistencias";
  const currentTab = activeTab ?? defaultTab;

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">

        {/* ── Encabezado ── */}
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-emerald-700 transition-colors duration-200 mb-3 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Volver al Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            Gestión Administrativa
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Monitoreo de personal, asistencias y aprobaciones.
          </p>
        </div>

        {/* ── Navegación de Pestañas ── */}
        <div className="flex space-x-2 bg-stone-200/50 p-1.5 rounded-2xl w-fit">
          {!esSupervisor && (
            <button
              onClick={() => setActiveTab("personal")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${currentTab === "personal"
                ? "bg-white text-stone-900 shadow-sm ring-1 ring-stone-200/60"
                : "text-stone-500 hover:text-stone-700 hover:bg-white/50"
                }`}
            >
              <Users className="w-4 h-4" /> Personal
            </button>
          )}
          <button
            onClick={() => setActiveTab("asistencias")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${currentTab === "asistencias"
              ? "bg-white text-stone-900 shadow-sm ring-1 ring-stone-200/60"
              : "text-stone-500 hover:text-stone-700 hover:bg-white/50"
              }`}
          >
            <Clock className="w-4 h-4" /> Asistencias
          </button>
          <button
            onClick={() => setActiveTab("permisos")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${currentTab === "permisos"
              ? "bg-white text-stone-900 shadow-sm ring-1 ring-stone-200/60"
              : "text-stone-500 hover:text-stone-700 hover:bg-white/50"
              }`}
          >
            <FileText className="w-4 h-4" /> Permisos
          </button>d
        </div>
        {currentTab === "personal" && !esSupervisor && <TabPersonal />}
        {currentTab === "asistencias" && <TabAsistencias />}
        {currentTab === "permisos" && <TabPermisos />}

      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   TAB 1: Personal (Exclusivo Gerente / Sub)
───────────────────────────────────────────── */
function TabPersonal() {
  const { sesion } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [dbError, setDbError] = useState<string | null>(null);
  const [actualizando, setActualizando] = useState<string | null>(null);

  useEffect(() => {
    if (!sesion) return;
    const ref = collection(db, "usuarios");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const lista: UsuarioAdmin[] = snap.docs.map((d) => ({
          uid: d.id,
          nombre: d.data().nombre ?? "",
          email: d.data().email ?? "",
          rol: d.data().rol ?? "Colaborador",
          activo: d.data().activo ?? false,
          creadoEn: d.data().creadoEn ?? null,
        }));
        lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
        setUsuarios(lista);
        setDbError(null);
      },
      (err) => {
        console.error("Error en onSnapshot:", err);
        setDbError("No se pudo conectar con la base de datos.");
      }
    );
    return () => unsub();
  }, [sesion]);

  const handleRoleChange = async (uid: string, nuevoRol: Rol) => {
    setActualizando(uid + "-rol");
    try {
      await updateDoc(doc(db, "usuarios", uid), { rol: nuevoRol });
    } catch {
      alert("No se pudo actualizar el rol. Verifica tus permisos.");
    } finally {
      setActualizando(null);
    }
  };

  const handleToggleActive = async (uid: string, estadoActual: boolean) => {
    setActualizando(uid + "-activo");
    try {
      await updateDoc(doc(db, "usuarios", uid), { activo: !estadoActual });
    } catch {
      alert("No se pudo actualizar el estado de la cuenta.");
    } finally {
      setActualizando(null);
    }
  };

  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) => u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [usuarios, busqueda]);

  const totalActivos = useMemo(() => usuarios.filter((u) => u.activo).length, [usuarios]);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between bg-white rounded-2xl border border-stone-200/60 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-emerald-50 rounded-xl">
            <Users className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <p className="text-sm font-bold text-stone-900">Personal en Base de Datos</p>
            <p className="text-xs text-stone-500">{totalActivos} activos de {usuarios.length} totales</p>
          </div>
        </div>
        <div className="relative max-w-sm w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-stone-200 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {dbError && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-5 py-4 text-sm">
          <ShieldCheck className="w-5 h-5" />
          <p>{dbError}</p>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-stone-200/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50/50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-400 uppercase">Usuario</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-400 uppercase">Rol actual</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-400 uppercase">Cambiar rol</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-400 uppercase">Activo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-sm text-stone-400">Sin resultados.</td>
                </tr>
              ) : (
                usuariosFiltrados.map((u) => {
                  const esPropioUsuario = u.uid === sesion?.uid;
                  const puedeEditar = sesion?.rol === "Gerente" || (sesion?.rol === "Subgerente" && u.rol !== "Gerente" && !esPropioUsuario);
                  return (
                    <tr key={u.uid} className="hover:bg-stone-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar nombre={u.nombre} />
                          <div>
                            <p className="text-sm font-medium text-stone-800">{u.nombre}</p>
                            <p className="text-xs text-stone-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${ROL_BADGE[u.rol]}`}>{u.rol}</span>
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={u.rol}
                          disabled={!puedeEditar || actualizando === u.uid + "-rol"}
                          onChange={(e) => handleRoleChange(u.uid, e.target.value as Rol)}
                          className={`text-sm rounded-xl border border-stone-200 bg-stone-50 text-stone-700 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${!puedeEditar ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <ToggleActivo activo={u.activo} disabled={!puedeEditar || actualizando === u.uid + "-activo"} onChange={() => handleToggleActive(u.uid, u.activo)} />
                          <span className={`text-xs font-medium ${u.activo ? "text-emerald-700" : "text-stone-400"}`}>{u.activo ? "Activo" : "Inactivo"}</span>
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
    </div>
  );
}

/* ─────────────────────────────────────────────
   TAB 2: Asistencias (Conectado a Firestore)
───────────────────────────────────────────── */
function TabAsistencias() {
  const [asistencias, setAsistencias] = useState<AsistenciaReal[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Usamos Firestore ordenado por fecha descendente
    const q = query(collection(db, "asistencias"));
    const unsub = onSnapshot(q, (snap) => {
      const lista: AsistenciaReal[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          nombre: data.nombre || "Desconocido",
          fecha: data.fecha || "",
          entrada: data.entrada || "",
          salida: data.salida || null,
          bitacora: data.bitacora || "",
          fotosUrls: data.fotosUrls || []
        };
      });

      // Orden en cliente para ordenar por fecha y luego hora
      lista.sort((a, b) => {
        if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha);
        return b.entrada.localeCompare(a.entrada);
      });

      setAsistencias(lista);
      setCargando(false);
    });

    return () => unsub();
  }, []);

  const filtradas = asistencias.filter((a) =>
    a.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    a.fecha.includes(busqueda)
  );

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between bg-white rounded-2xl border border-stone-200/60 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-blue-50 rounded-xl">
            <Clock className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <p className="text-sm font-bold text-stone-900">Control de Entradas y Salidas</p>
            <p className="text-xs text-stone-500">Registro en tiempo real desde Planta</p>
          </div>
        </div>
        <div className="relative max-w-sm w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar colaborador o fecha..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-stone-200 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cargando ? (
          <p className="text-sm text-stone-400 py-8 text-center col-span-2">Cargando registros...</p>
        ) : filtradas.length === 0 ? (
          <p className="text-sm text-stone-400 py-8 text-center col-span-2 bg-white rounded-3xl border border-stone-200/60">
            No se encontraron registros de asistencia.
          </p>
        ) : (
          filtradas.map((asist) => (
            <div key={asist.id} className="bg-white rounded-3xl border border-stone-200/60 p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-3">
                  <Avatar nombre={asist.nombre} />
                  <div>
                    <p className="text-sm font-bold text-stone-900">{asist.nombre}</p>
                    <p className="text-xs font-mono text-stone-400">{formatFechaUI(asist.fecha)}</p>
                  </div>
                </div>
                <div className="text-right font-mono text-sm space-y-1">
                  <p className="text-emerald-700 flex items-center justify-end gap-1"><Clock className="w-3.5 h-3.5" /> {asist.entrada}</p>
                  {asist.salida ? (
                    <p className="text-red-600 flex items-center justify-end gap-1"><Clock className="w-3.5 h-3.5" /> {asist.salida}</p>
                  ) : (
                    <p className="text-amber-500 text-xs flex items-center justify-end gap-1"><Clock3 className="w-3.5 h-3.5 animate-pulse" /> En turno</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Bitácora del turno
                </p>
                {asist.bitacora ? (
                  <p className="text-sm text-stone-600 bg-stone-50 p-3 rounded-xl ring-1 ring-stone-200/60 leading-relaxed">
                    {asist.bitacora}
                  </p>
                ) : (
                  <p className="text-sm text-stone-400 italic">No ha registrado salida.</p>
                )}
              </div>

              {asist.fotosUrls.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" /> {asist.fotosUrls.length} Evidencias Adjuntas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {asist.fotosUrls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border border-blue-200"
                      >
                        <ExternalLink className="w-3 h-3" /> Ver Foto {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   TAB 3: Permisos (Conectado a Firestore)
───────────────────────────────────────────── */
function TabPermisos() {
  const [permisos, setPermisos] = useState<PermisoReal[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Escuchar todas las solicitudes de permisos
    const q = query(collection(db, "permisos"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const lista: PermisoReal[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          nombre: data.nombre || "Desconocido",
          tipo: data.tipo || "",
          fechaSolicitada: data.fechaSolicitada || "",
          justificacion: data.justificacion || "",
          estado: data.estado || "Pendiente",
          fechaCreacion: data.fechaCreacion || ""
        };
      });
      setPermisos(lista);
      setCargando(false);
    });

    return () => unsub();
  }, []);

  const actualizarEstado = async (id: string, nuevoEstado: EstadoPermiso) => {
    try {
      await updateDoc(doc(db, "permisos", id), { estado: nuevoEstado });
    } catch (e) {
      console.error(e);
      alert("Hubo un error al actualizar el estado del permiso.");
    }
  };

  const filtradas = permisos.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.tipo.toLowerCase().includes(busqueda.toLowerCase())
  );

  const StatusIcon = {
    Pendiente: Clock3,
    Aprobado: CheckCircle2,
    Rechazado: XCircle,
  };

  const StatusColor = {
    Pendiente: "text-amber-600 bg-amber-50 ring-amber-200/60",
    Aprobado: "text-emerald-700 bg-emerald-50 ring-emerald-200/60",
    Rechazado: "text-red-700 bg-red-50 ring-red-200/60",
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between bg-white rounded-2xl border border-stone-200/60 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-amber-50 rounded-xl">
            <FileText className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <p className="text-sm font-bold text-stone-900">Solicitudes de Permiso</p>
            <p className="text-xs text-stone-500">Revisión y aprobación en tiempo real</p>
          </div>
        </div>
        <div className="relative max-w-sm w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar colaborador o tipo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-stone-200 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50/50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-400 uppercase">Colaborador</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-400 uppercase">Detalles Solicitud</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-400 uppercase">Justificación</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-stone-400 uppercase">Estado</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-stone-400 uppercase">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {cargando ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-stone-400">Cargando solicitudes...</td>
                </tr>
              ) : filtradas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-stone-400">No se encontraron solicitudes.</td>
                </tr>
              ) : (
                filtradas.map((permiso) => {
                  const IconoSt = StatusIcon[permiso.estado];
                  return (
                    <tr key={permiso.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar nombre={permiso.nombre} />
                          <div>
                            <p className="text-sm font-medium text-stone-800">{permiso.nombre}</p>
                            <p className="text-xs text-stone-400">Solicitado: {formatFechaUI(permiso.fechaCreacion)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold text-stone-700">{permiso.tipo}</p>
                        <p className="text-xs text-stone-500 mt-0.5">Para: <span className="font-mono text-stone-600">{formatFechaUI(permiso.fechaSolicitada)}</span></p>
                      </td>
                      <td className="px-4 py-4 max-w-xs">
                        <p className="text-sm text-stone-600 line-clamp-3">{permiso.justificacion}</p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ring-1 ${StatusColor[permiso.estado]}`}>
                          <IconoSt className="w-3.5 h-3.5" />
                          {permiso.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {permiso.estado === "Pendiente" ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => actualizarEstado(permiso.id, "Aprobado")}
                              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                            >
                              Aprobar
                            </button>
                            <button
                              onClick={() => actualizarEstado(permiso.id, "Rechazado")}
                              className="px-3 py-1.5 bg-stone-100 hover:bg-red-50 hover:text-red-700 hover:ring-1 hover:ring-red-200 text-stone-600 text-xs font-semibold rounded-lg transition-colors"
                            >
                              Rechazar
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-stone-400 italic">Procesado</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

