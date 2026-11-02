"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import type { Rol } from "@/types";
import {
  Settings,
  FlaskConical,
  TrendingUp,
  Lock,
  ArrowRight,
  AlertTriangle,
  X,
  Leaf,
  Package,
  Map,
} from "lucide-react";

/* ─────────────────────────────────────────────
   Tipos
───────────────────────────────────────────── */
interface ModuloConfig {
  id: string;
  titulo: string;
  descripcion: string;
  href: string;
  icono: React.ReactNode;
  /** Colores del ícono del módulo permitido */
  colorFondo: string;
  /** Roles con acceso. Undefined = todos */
  rolesPermitidos?: Rol[];
  /** Etiqueta informativa del acceso requerido */
  etiquetaRol?: string;
  /** Hace que la tarjeta ocupe más espacio en el grid */
  destacado?: boolean;
}

/* ─────────────────────────────────────────────
   Configuración de módulos
───────────────────────────────────────────── */
const MODULOS: ModuloConfig[] = [
  {
    id: "planta",
    titulo: "Planta de Trabajo",
    descripcion:
      "Centro de operaciones. Registra y monitorea la actividad productiva, turnos activos y seguimiento de procesos en tiempo real.",
    href: "/dashboard/planta",
    icono: <FlaskConical className="w-6 h-6" strokeWidth={1.5} />,
    colorFondo: "bg-emerald-600",
    rolesPermitidos: undefined, // todos los roles
    destacado: true,
  },
  {
    id: "administracion",
    titulo: "Administración",
    descripcion:
      "Gestión de usuarios, roles y configuración del sistema.",
    href: "/dashboard/administracion",
    icono: <Settings className="w-6 h-6" strokeWidth={1.5} />,
    colorFondo: "bg-slate-700",
    rolesPermitidos: ["Gerente", "Subgerente", "Supervisor"],
    etiquetaRol: "Gerente / Sub / Sup",
  },
  {
    id: "finanzas",
    titulo: "Finanzas",
    descripcion:
      "Análisis financiero completo: flujo de caja, rentabilidad, reportes y proyecciones económicas para la toma de decisiones.",
    href: "/dashboard/finanzas",
    icono: <TrendingUp className="w-6 h-6" strokeWidth={1.5} />,
    colorFondo: "bg-amber-600",
    rolesPermitidos: ["Gerente"],
    etiquetaRol: "Exclusivo Gerente",
  },
  {
    id: "ventas",
    titulo: "Ventas y Envíos",
    descripcion:
      "Control comercial y logística. Gestión de directorio de clientes, registro de ventas y planificación de despachos y entregas.",
    href: "/dashboard/ventas",
    icono: <Package className="w-6 h-6" strokeWidth={1.5} />,
    colorFondo: "bg-blue-600",
    rolesPermitidos: ["Gerente", "Subgerente", "Supervisor"],
    etiquetaRol: "Gerente / Sub / Sup",
  },
  {
    id: "entregas",
    titulo: "Mapa e Historial",
    descripcion:
      "Visualización geográfica de estufas entregadas a nivel nacional mediante mapas de calor y un registro histórico detallado.",
    href: "/dashboard/entregas",
    icono: <Map className="w-6 h-6" strokeWidth={1.5} />,
    colorFondo: "bg-indigo-600",
    rolesPermitidos: ["Gerente", "Subgerente", "Supervisor"],
    etiquetaRol: "Gerente / Sub / Sup",
  },
  {
    id: "inventario",
    titulo: "Inventario y Compras",
    descripcion:
      "Catálogo de materia prima, gestión de proveedores y generador automático de órdenes de compra.",
    href: "/dashboard/inventario",
    icono: <Package className="w-6 h-6" strokeWidth={1.5} />,
    colorFondo: "bg-teal-600",
    rolesPermitidos: ["Gerente", "Subgerente", "Supervisor"],
    etiquetaRol: "Gerente / Sub / Sup",
  },
];

/* ─────────────────────────────────────────────
   Badge de rol
───────────────────────────────────────────── */
function RolBadge({ rol }: { rol: string }) {
  const estilos: Record<string, string> = {
    Gerente:
      "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80",
    Subgerente:
      "bg-sky-50 text-sky-700 ring-1 ring-sky-200/80",
    Supervisor:
      "bg-violet-50 text-violet-700 ring-1 ring-violet-200/80",
    Colaborador:
      "bg-slate-100 text-slate-600 ring-1 ring-slate-200/60",
  };

  return (
    <span
      className={`
        inline-flex items-center
        px-2.5 py-1 rounded-full
        text-xs font-semibold tracking-wide
        ${estilos[rol] ?? "bg-slate-100 text-slate-600 ring-1 ring-slate-200/60"}
      `}
    >
      {rol}
    </span>
  );
}

/* ─────────────────────────────────────────────
   Skeleton de carga (mientras Firebase resuelve)
───────────────────────────────────────────── */
function SkeletonBento() {
  return (
    <div className="animate-pulse space-y-8">
      {/* Bienvenida skeleton */}
      <div className="space-y-3">
        <div className="h-3 w-24 bg-slate-200 rounded-full" />
        <div className="h-8 w-72 bg-slate-200 rounded-xl" />
        <div className="h-4 w-48 bg-slate-100 rounded-full" />
      </div>

      {/* Bento grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tarjeta grande (col 1-2) */}
        <div className="
          lg:col-span-2 h-52
          bg-slate-100/80 rounded-3xl
          ring-1 ring-slate-200/40
        " />
        {/* Tarjeta pequeña (col 3) */}
        <div className="
          lg:col-span-1 h-52
          bg-slate-100/80 rounded-3xl
          ring-1 ring-slate-200/40
        " />
        {/* Tarjeta ancha (fila 2, full width) */}
        <div className="
          lg:col-span-3 h-40
          bg-slate-100/80 rounded-3xl
          ring-1 ring-slate-200/40
        " />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Tarjeta de módulo — PERMITIDO
───────────────────────────────────────────── */
function TarjetaPermitida({
  modulo,
  className = "",
}: {
  modulo: ModuloConfig;
  className?: string;
}) {
  return (
    <Link
      id={`modulo-${modulo.id}`}
      href={modulo.href}
      aria-label={`Acceder a ${modulo.titulo}`}
      className={`
        group block
        bg-gradient-to-b from-white to-slate-50/50
        rounded-3xl
        ring-1 ring-slate-200/60
        shadow-xs shadow-inner shadow-slate-100/40
        p-6
        transition-all duration-300
        hover:-translate-y-1
        hover:ring-slate-300/80
        hover:shadow-md hover:from-white hover:to-white
        active:scale-[0.99]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/60
        ${className}
      `}
    >
      {/* Ícono */}
      <div className={`
        w-11 h-11 rounded-2xl mb-5
        flex items-center justify-center
        text-white
        shadow-sm
        ${modulo.colorFondo}
        group-hover:scale-105
        transition-transform duration-300
      `}>
        {modulo.icono}
      </div>

      {/* Título */}
      <h2 className="text-base font-semibold text-slate-800 tracking-tight mb-1.5">
        {modulo.titulo}
      </h2>

      {/* Descripción */}
      <p className="text-sm text-slate-400 leading-relaxed mb-5">
        {modulo.descripcion}
      </p>

      {/* CTA */}
      <div className="
        inline-flex items-center gap-1.5
        text-xs font-semibold text-slate-400
        group-hover:text-slate-800
        group-hover:gap-2.5
        transition-all duration-300
      ">
        Acceder al módulo
        <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
      </div>
    </Link>
  );
}

/* ─────────────────────────────────────────────
   Tarjeta de módulo — BLOQUEADO
───────────────────────────────────────────── */
function TarjetaBloqueada({
  modulo,
  className = "",
}: {
  modulo: ModuloConfig;
  className?: string;
}) {
  return (
    <div
      id={`modulo-${modulo.id}`}
      role="img"
      aria-label={`${modulo.titulo} — acceso restringido a ${modulo.etiquetaRol}`}
      className={`
        relative
        bg-slate-100/70
        rounded-3xl
        ring-1 ring-slate-200/40
        p-6
        opacity-45
        cursor-not-allowed
        select-none
        ${className}
      `}
    >
      {/* Badge de restricción */}
      <div className="
        absolute top-4 right-4
        inline-flex items-center gap-1
        bg-slate-200/80 text-slate-500
        text-[10px] font-semibold
        px-2 py-1 rounded-full
        ring-1 ring-slate-300/40
      ">
        <Lock className="w-2.5 h-2.5" strokeWidth={2.5} />
        Restringido
      </div>

      {/* Ícono (desaturado) */}
      <div className="
        w-11 h-11 rounded-2xl mb-5
        flex items-center justify-center
        bg-slate-300 text-slate-500
      ">
        {modulo.icono}
      </div>

      {/* Título */}
      <h2 className="text-base font-semibold text-slate-600 tracking-tight mb-1.5">
        {modulo.titulo}
      </h2>

      {/* Descripción */}
      <p className="text-sm text-slate-400 leading-relaxed mb-5">
        {modulo.descripcion}
      </p>

      {/* Etiqueta de acceso requerido */}
      {modulo.etiquetaRol && (
        <div className="
          inline-flex items-center gap-1.5
          text-[10px] font-semibold text-slate-400
        ">
          <Lock className="w-3 h-3" strokeWidth={2} />
          Requiere: {modulo.etiquetaRol}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Bento Grid con RBAC
───────────────────────────────────────────── */
function BentoGrid({ rolUsuario }: { rolUsuario: Rol }) {
  const tieneAcceso = (modulo: ModuloConfig) =>
    !modulo.rolesPermitidos || modulo.rolesPermitidos.includes(rolUsuario);

  /*
   * Layout asimétrico 4 tarjetas:
   *   Desktop (3 cols):
   *   ┌────────────────────┬──────────┐
   *   │  Planta (col 1-2)  │  Ventas  │
   *   ├────────────────────┼──────────┤
   *   │ Finanzas (col 1-2) │  Admin   │
   *   └────────────────────┴──────────┘
   */
  const [planta, admin, finanzas, ventas, entregas, inventario] = MODULOS;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Planta — destacado, 2 columnas */}
      {tieneAcceso(planta) ? (
        <TarjetaPermitida modulo={planta} className="lg:col-span-2" />
      ) : (
        <TarjetaBloqueada modulo={planta} className="lg:col-span-2" />
      )}

      {/* Ventas — 1 columna */}
      {tieneAcceso(ventas) ? (
        <TarjetaPermitida modulo={ventas} className="lg:col-span-1" />
      ) : (
        <TarjetaBloqueada modulo={ventas} className="lg:col-span-1" />
      )}

      {/* Finanzas — 2 columnas */}
      {tieneAcceso(finanzas) ? (
        <TarjetaPermitida modulo={finanzas} className="lg:col-span-2" />
      ) : (
        <TarjetaBloqueada modulo={finanzas} className="lg:col-span-2" />
      )}

      {/* Entregas — 1 columna */}
      {tieneAcceso(entregas) ? (
        <TarjetaPermitida modulo={entregas} className="lg:col-span-1" />
      ) : (
        <TarjetaBloqueada modulo={entregas} className="lg:col-span-1" />
      )}

      {/* Inventario — 1 columna */}
      {tieneAcceso(inventario) ? (
        <TarjetaPermitida modulo={inventario} className="lg:col-span-1" />
      ) : (
        <TarjetaBloqueada modulo={inventario} className="lg:col-span-1" />
      )}

      {/* Administración — 1 columna */}
      {tieneAcceso(admin) ? (
        <TarjetaPermitida modulo={admin} className="lg:col-span-1" />
      ) : (
        <TarjetaBloqueada modulo={admin} className="lg:col-span-1" />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Alerta de acceso denegado (query param)
───────────────────────────────────────────── */
function AlertaAccesoDenegado() {
  const params = useSearchParams();
  const router = useRouter();

  if (params.get("acceso") !== "denegado") return null;

  return (
    <div
      role="alert"
      className="
        flex items-start gap-3 mb-8
        bg-red-50/80 ring-1 ring-red-200/60
        text-red-700 rounded-2xl px-5 py-4
        shadow-inner shadow-red-50/40
      "
    >
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.5} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm tracking-tight">Acceso denegado</p>
        <p className="text-xs text-red-600 mt-0.5">
          No tienes permiso para ese módulo. Se requiere autorización de Gerencia.
        </p>
      </div>
      <button
        onClick={() => router.replace("/dashboard")}
        aria-label="Cerrar alerta"
        className="
          text-red-400 hover:text-red-600
          p-0.5 rounded-lg hover:bg-red-100
          transition-colors shrink-0
        "
      >
        <X className="w-4 h-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Saludo dinámico según la hora
───────────────────────────────────────────── */
function saludoSegunHora(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

/* ─────────────────────────────────────────────
   Dashboard Hub — Página principal
───────────────────────────────────────────── */
export default function DashboardPage() {
  const { sesion, cargando } = useAuth();
  const router = useRouter();

  // ── LÓGICA CRÍTICA DE REDIRECCIÓN (RBAC) ──
  useEffect(() => {
    if (!cargando && sesion) {
      if (sesion.rol === "Colaborador") {
        // Redirección INMEDIATA para Colaboradores
        router.replace("/empleado/portal");
      }
    }
  }, [cargando, sesion, router]);

  // Si está cargando, o si es Colaborador (esperando redirección), mostramos skeleton
  if (cargando || !sesion || sesion.rol === "Colaborador") {
    return <SkeletonBento />;
  }

  const nombreCorto = sesion.nombre.split(" ")[0];

  return (
    <div className="space-y-10">

      {/* ── Alerta de acceso denegado (si viene de redirect) ── */}
      <Suspense>
        <AlertaAccesoDenegado />
      </Suspense>

      {/* ── Hero de bienvenida ── */}
      <section aria-labelledby="heading-bienvenida">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">

          {/* Texto */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Leaf className="w-3.5 h-3.5 text-emerald-500" strokeWidth={2} />
              <p className="text-xs font-semibold text-slate-400 tracking-widest uppercase">
                {saludoSegunHora()}
              </p>
            </div>
            <h1
              id="heading-bienvenida"
              className="text-3xl font-bold text-slate-950 tracking-tight leading-tight"
            >
              Hola, {nombreCorto}.{" "}
              <span className="text-slate-400 font-normal">
                Bienvenido a tu centro de control.
              </span>
            </h1>
          </div>

          {/* Badge de rol + info */}
          <div className="
            shrink-0 flex items-center gap-3
            bg-gradient-to-b from-white to-slate-50/50
            ring-1 ring-slate-200/60
            rounded-2xl px-4 py-3 shadow-xs
          ">
            <div className="
              w-9 h-9 rounded-xl bg-slate-900
              flex items-center justify-center
              text-sm font-bold text-white
              ring-1 ring-white/10
            ">
              {sesion.nombre.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 tracking-tight leading-none">
                {sesion.nombre}
              </p>
              <div className="mt-1">
                <RolBadge rol={sesion.rol} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Separador con label ── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200/80" aria-hidden="true" />
        <p className="text-xs font-semibold text-slate-400 tracking-widest uppercase shrink-0">
          Módulos disponibles
        </p>
        <div className="flex-1 h-px bg-slate-200/80" aria-hidden="true" />
      </div>

      {/* ── Bento Grid de módulos ── */}
      <section aria-labelledby="heading-modulos">
        <h2 id="heading-modulos" className="sr-only">
          Módulos del sistema
        </h2>
        <BentoGrid rolUsuario={sesion.rol} />
      </section>

    </div>
  );
}
