"use client";

import { useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { LogOut, Flame } from "lucide-react";
import { Spinner } from "@/components/ui";

interface Props {
  children: ReactNode;
}

/* ─────────────────────────────────────────────
   Layout principal del dashboard

   El spinner solo aparece en el primer arranque (cuando aún no
   hay sesión y se está cargando), nunca durante navegaciones
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
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <Spinner etiqueta="Verificando sesión…" visible tamano="lg" />
      </div>
    );
  }

  if (!sesion) return null;

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <TopBar sesion={sesion} />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="border-t border-line py-4">
        <p className="text-center text-xs text-ink-muted">
          Ecocomal v3.0 — Sistema de Gestión Interno © {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}

/* ─────────────────────────────────────────────
   TopBar — info de sesión + logout
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
    <header className="sticky top-0 z-40 bg-surface/85 backdrop-blur-md border-b border-line">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">

        {/* ── Marca ──
            Marca provisional: el logotipo de Ecocomal sigue pendiente.
            La llama al menos pertenece al producto (estufas de leña) y
            usa el mismo set de íconos y grosor de trazo que el resto. */}
        <Link
          href="/dashboard"
          id="logo-ecocomal"
          className="flex items-center gap-2.5 shrink-0 group rounded-control"
          aria-label="Volver al inicio"
        >
          <span className="w-7 h-7 rounded-control bg-action flex items-center justify-center transition-colors duration-150 group-hover:bg-action-hover">
            <Flame className="w-4 h-4 text-white" strokeWidth={2} aria-hidden="true" />
          </span>
          <span className="font-bold text-ink text-sm">Ecocomal</span>
          <span className="hidden sm:inline text-xs font-semibold text-ink-muted bg-sunken px-1.5 py-0.5 rounded-md ring-1 ring-line">
            v3
          </span>
        </Link>

        {/* ── Sesión ── */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-8 h-8 shrink-0 rounded-full bg-action flex items-center justify-center text-xs font-bold text-white"
              aria-hidden="true"
            >
              {sesion.nombre.charAt(0).toUpperCase()}
            </span>
            <span className="hidden sm:flex flex-col leading-tight min-w-0">
              <span className="text-xs font-semibold text-ink-body truncate">
                {sesion.nombre}
              </span>
              <span className="text-xs text-ink-muted">{sesion.rol}</span>
            </span>
          </div>

          <div className="hidden sm:block w-px h-4 bg-line mx-1" aria-hidden="true" />

          <button
            id="btn-logout"
            type="button"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            className="
              inline-flex items-center gap-1.5 shrink-0
              touch sm:min-h-8 px-3 rounded-control
              text-xs font-semibold text-ink-muted
              hover:text-risk hover:bg-risk-surface
              transition-colors duration-150 active:scale-[0.97]
            "
          >
            <LogOut className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>

      </div>
    </header>
  );
}
