"use client";

import { useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { LogOut } from "lucide-react";

/* ─────────────────────────────────────────────
   Tipos
   ───────────────────────────────────────────── */
interface Props {
  children: ReactNode;
}

/* ─────────────────────────────────────────────
   Layout principal del dashboard

   Fix navegación lenta: El spinner solo aparece
   en el primer arranque (cuando aún no hay sesión
   y se está cargando), nunca durante navegaciones
   internas.
   ───────────────────────────────────────────── */
export default function DashboardLayout({ children }: Props) {
  const { sesion, cargando } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  /* ── Guardias de acceso ── */
  useEffect(() => {
    if (cargando) return;

    if (!sesion) {
      router.replace("/login");
      return;
    }

    const esFinanzas = pathname.startsWith("/dashboard/finanzas");
    if (esFinanzas && sesion.rol !== "Gerente") {
      router.replace("/dashboard?acceso=denegado");
    }
  }, [cargando, sesion, pathname, router]);

  /* ── Spinner solo en primer arranque ── */
  if (cargando && !sesion) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
        <div className="
          w-10 h-10 rounded-2xl
          bg-gradient-to-b from-white to-slate-50/50
          ring-1 ring-slate-200/60 shadow-sm
          flex items-center justify-center
        ">
          <svg
            className="animate-spin h-5 w-5 text-slate-500"
            viewBox="0 0 24 24"
            fill="none"
            aria-label="Verificando sesión"
          >
            <circle
              className="opacity-25"
              cx="12" cy="12" r="10"
              stroke="currentColor" strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
        </div>
        <p className="text-slate-500 font-medium text-sm tracking-tight">
          Verificando sesión…
        </p>
      </div>
    );
  }

  if (!sesion) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ── Barra superior: solo usuario + cerrar sesión ── */}
      <TopBar sesion={sesion} />

      {/* ── Contenido de la ruta activa ── */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* ── Pie de página ── */}
      <footer className="border-t border-slate-100/80 py-4">
        <p className="text-center text-xs text-slate-400 tracking-tight">
          Ecocomal v3.0 — Sistema de Gestión Interno © {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}

/* ─────────────────────────────────────────────
   TopBar — solo info de sesión + logout
───────────────────────────────────────────── */
interface TopBarProps {
  sesion: { nombre: string; rol: string; email: string | null };
}

function TopBar({ sesion }: TopBarProps) {
  const { cerrarSesion } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await cerrarSesion();
    router.replace("/login");
  };

  return (
    <header className="
      sticky top-0 z-40
      bg-white/80 backdrop-blur-md
      border-b border-slate-200/60
      shadow-sm
    ">
      <div className="
        max-w-6xl mx-auto px-4 sm:px-6 lg:px-8
        h-14 flex items-center justify-between gap-4
      ">

        {/* ── Logotipo ── */}
        <Link
          href="/dashboard"
          id="logo-ecocomal"
          className="flex items-center gap-2.5 shrink-0 group"
          aria-label="Volver al inicio"
        >
          <div className="
            w-7 h-7 rounded-lg bg-slate-900
            flex items-center justify-center
            group-hover:bg-slate-700
            transition-colors duration-150
          ">
            <svg
              className="w-4 h-4 text-white"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16A8 8 0 0010 2zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <span className="font-bold text-slate-800 text-sm tracking-tight">
            Ecocomal
          </span>
          <span className="
            hidden sm:inline
            text-xs bg-slate-100 text-slate-500 font-semibold
            px-1.5 py-0.5 rounded-md ring-1 ring-slate-200/60
          ">
            v3
          </span>
        </Link>

        {/* ── Info de sesión + cerrar sesión ── */}
        <div className="flex items-center gap-2">
          {/* Avatar + nombre + rol */}
          <div className="flex items-center gap-2.5">
            <div className="
              w-8 h-8 rounded-full
              bg-slate-900 ring-1 ring-slate-800/40
              flex items-center justify-center
              text-xs font-bold text-white
              shrink-0
            ">
              {sesion.nombre.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:flex flex-col leading-tight">
              <span className="text-xs font-semibold text-slate-700 tracking-tight">
                {sesion.nombre}
              </span>
              <span className="text-[10px] text-slate-400">{sesion.rol}</span>
            </div>
          </div>

          {/* Separador */}
          <div className="hidden sm:block w-px h-4 bg-slate-200 mx-1" aria-hidden="true" />

          {/* Botón cerrar sesión */}
          <button
            id="btn-logout"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            className="
              inline-flex items-center gap-1.5
              px-3 py-1.5 rounded-lg
              text-xs font-medium text-slate-500
              hover:text-red-600 hover:bg-red-50
              hover:ring-1 hover:ring-red-200/60
              transition-all duration-150 active:scale-[0.97]
            "
          >
            <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>

      </div>
    </header>
  );
}
