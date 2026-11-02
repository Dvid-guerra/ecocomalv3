"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { cerrarSesionServidor, crearSesionServidor } from "@/lib/auth-session";
import { SesionUsuario, UsuarioFirestore } from "@/types";

/* ─────────────────────────────────────────────
   Tipos del contexto
───────────────────────────────────────────── */
interface AuthContextValue {
  sesion:       SesionUsuario | null;
  cargando:     boolean;
  cerrarSesion: () => Promise<void>;
}

/* ─────────────────────────────────────────────
   Contexto
───────────────────────────────────────────── */
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/* ─────────────────────────────────────────────
   Provider
───────────────────────────────────────────── */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion,   setSesion]   = useState<SesionUsuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {

      // ── Sin usuario en Firebase Auth ──────────────────────────────────
      if (!firebaseUser) {
        await cerrarSesionServidor().catch(() => undefined);
        setSesion(null);
        setCargando(false);
        return;
      }

      // ── Usuario autenticado: consultar Firestore ───────────────────────
      try {
        const ref  = doc(db, "usuarios", firebaseUser.uid);
        const snap = await getDoc(ref);

        // Caso 1: Documento no existe en Firestore (estado inconsistente)
        if (!snap.exists()) {
          console.warn("[AuthContext] Documento de usuario no encontrado:", firebaseUser.uid);
          await signOut(auth);
          await cerrarSesionServidor().catch(() => undefined);
          setSesion(null);
          setCargando(false);
          return;
        }

        const datos = snap.data() as UsuarioFirestore;

        // Caso 2: Cuenta desactivada por el administrador
        if (!datos.activo) {
          console.warn("[AuthContext] Cuenta inactiva:", firebaseUser.uid);
          await signOut(auth);
          await cerrarSesionServidor().catch(() => undefined);
          setSesion(null);
          setCargando(false);
          return;
        }

        // Caso 3: Firebase Admin verifica el token y escribe una cookie HTTP-only.
        await crearSesionServidor(firebaseUser);

        setSesion({
          uid:    firebaseUser.uid,
          email:  firebaseUser.email,
          nombre: datos.nombre,
          rol:    datos.rol,
          activo: datos.activo,
        });
        setCargando(false);

      } catch (error) {
        // Error de red o Firestore: no cerramos sesión para no perder el contexto,
        // pero sí liberamos el estado de carga para evitar pantalla congelada.
        console.error("[AuthContext] Error al obtener datos de Firestore:", error);
        setSesion(null);
        setCargando(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const cerrarSesion = async () => {
    try {
      await cerrarSesionServidor();
    } finally {
      await signOut(auth);
      setSesion(null);
    }
  };

  return (
    <AuthContext.Provider value={{ sesion, cargando, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ─────────────────────────────────────────────
   Hook de conveniencia
───────────────────────────────────────────── */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return ctx;
}
