"use client";

import { useState, FormEvent } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { UsuarioFirestore } from "@/types";
import { crearSesionServidor } from "@/lib/auth-session";
import { BrandLogo } from "@/components/BrandLogo";

/* ─────────────────────────────────────────────
   Traducción de códigos de error Firebase
───────────────────────────────────────────── */
function mensajeDeError(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Correo o contraseña incorrectos. Verifica tus datos.";
    case "auth/user-disabled":
      return "Esta cuenta ha sido deshabilitada. Contacta con el administrador.";
    case "auth/too-many-requests":
      return "Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.";
    case "auth/network-request-failed":
      return "Error de conexión. Verifica tu acceso a internet.";
    default:
      return "Ocurrió un error inesperado. Por favor intenta de nuevo.";
  }
}

/* ─────────────────────────────────────────────
   Componente de página
───────────────────────────────────────────── */
export default function LoginPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const destino      = searchParams.get("from") ?? "/dashboard";
  const registroPendiente = searchParams.get("registro") === "pendiente";

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Autenticar con Firebase Auth
      const credential  = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = credential.user;

      // 2. Verificar documento en Firestore
      const ref  = doc(db, "usuarios", firebaseUser.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        // Cuenta en Auth pero sin documento Firestore: estado inconsistente
        await auth.signOut();
        setError("Tu cuenta no tiene perfil configurado. Contacta con el administrador.");
        setLoading(false);
        return;
      }

      const datos = snap.data() as UsuarioFirestore;

      // 3. Verificar que la cuenta esté activa
      if (!datos.activo) {
        await auth.signOut();
        setError("Tu cuenta está pendiente de aprobación. Contacta con el administrador.");
        setLoading(false);
        return;
      }

      // 4. Crear cookie HTTP-only verificada por Firebase Admin.
      await crearSesionServidor(firebaseUser);

      // 5. Redirigir al dashboard (o a la ruta solicitada originalmente)
      router.push(destino.startsWith("/dashboard") ? destino : "/dashboard");

    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(mensajeDeError(code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="brand-auth flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md bg-surface rounded-panel shadow-raised overflow-hidden">

        {/* Header */}
        <div className="brand-auth-header on-dark px-8 py-8 text-center">
          <BrandLogo inverso className="mx-auto w-40 mb-5" />
          <h1 className="text-2xl text-white">Gestión de fábrica</h1>
          <p className="text-white/80 text-sm mt-2">Sistema de Gestión Interno</p>
        </div>

        {/* Formulario */}
        <div className="px-8 py-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">Iniciar Sesión</h2>

          {registroPendiente && (
            <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Cuenta creada. Un administrador debe activarla antes de que puedas iniciar sesión.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none
                  focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-sm placeholder:text-ink-muted"
                placeholder="usuario@ecocomal.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none
                  focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-sm placeholder:text-ink-muted"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700
                text-sm rounded-lg px-4 py-3">
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button
              id="btn-login"
              type="submit"
              disabled={loading}
              className="w-full bg-brand-accent hover:bg-brand-accent-hover disabled:opacity-60
                disabled:cursor-not-allowed text-brand-ink font-semibold min-h-11 py-2.5 rounded-control
                transition-colors duration-200 text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Verificando…
                </>
              ) : "Entrar"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            ¿Sin cuenta?{" "}
            <Link href="/registro" className="text-green-600 font-medium hover:underline">
              Regístrate aquí
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
