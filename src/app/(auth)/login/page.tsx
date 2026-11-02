"use client";

import { useState, FormEvent } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { UsuarioFirestore } from "@/types";
import { crearSesionServidor } from "@/lib/auth-session";

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
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-500 px-8 py-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Ecocomal v3</h1>
          <p className="text-green-100 text-sm mt-1">Sistema de Gestión Interno</p>
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
                  focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-sm"
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
                  focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-sm"
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
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60
                disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg
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
