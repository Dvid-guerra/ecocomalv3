"use client";

import { useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Spinner } from "@/components/ui";
import { destinoSinAcceso, puedeEntrar } from "@/lib/acceso";

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

  /*
   * El rol decide la ruta según la política única de `@/lib/acceso`, la misma
   * que aplica el proxy en el borde.
   */
  const sinAcceso = !!sesion && !puedeEntrar(sesion.rol, pathname);

  /* ── Guardias de acceso ── */
  useEffect(() => {
    if (cargando) return;

    if (!sesion) {
      router.replace("/login");
      return;
    }

    if (sinAcceso) router.replace(destinoSinAcceso(sesion.rol));
  }, [cargando, sesion, sinAcceso, router]);

  /* ── Spinner solo en primer arranque ── */
  if (cargando && !sesion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <Spinner etiqueta="Verificando sesión…" visible tamano="lg" />
      </div>
    );
  }

  /*
   * Sin sesión, o con un rol que no corresponde a esta ruta, no se monta
   * `children`: si se montara, los listeners de la página se suscribirían a
   * Firestore antes del redirect y fallarían con `permission-denied`.
   */
  if (!sesion || sinAcceso) return null;

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
    <header className="brand-masthead on-dark sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 min-h-20 py-3 flex items-center justify-between gap-4">

        {/* Marca original, sin reconstruir ni deformar el logotipo. */}
        <Link
          href="/dashboard"
          id="logo-ecocomal"
          className="flex items-center gap-2.5 shrink-0 group rounded-control"
          aria-label="Volver al inicio"
        >
          <BrandLogo inverso className="w-24 sm:w-28" />
          <span className="hidden sm:inline text-sm font-medium text-white/85 border-l border-white/25 pl-4 ml-3">
            Gestión de fábrica
          </span>
        </Link>

        {/* ── Sesión ── */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-8 h-8 shrink-0 rounded-full bg-brand-accent flex items-center justify-center text-xs font-bold text-brand-ink"
              aria-hidden="true"
            >
              {sesion.nombre.charAt(0).toUpperCase()}
            </span>
            <span className="hidden sm:flex flex-col leading-tight min-w-0">
              <span className="text-xs font-semibold text-white truncate">
                {sesion.nombre}
              </span>
              <span className="text-xs text-white/80">{sesion.rol}</span>
            </span>
          </div>

          <div className="hidden sm:block w-px h-4 bg-white/25 mx-1" aria-hidden="true" />

          <button
            id="btn-logout"
            type="button"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            className="
              inline-flex items-center gap-1.5 shrink-0
              touch sm:min-h-8 px-3 rounded-control
              text-xs font-semibold text-white/85
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
