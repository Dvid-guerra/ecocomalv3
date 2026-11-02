import type { User } from "firebase/auth";

export async function crearSesionServidor(user: User): Promise<void> {
  const idToken = await user.getIdToken(true);
  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    throw new Error("No se pudo establecer la sesión segura.");
  }
}

export async function cerrarSesionServidor(): Promise<void> {
  const response = await fetch("/api/session", { method: "DELETE" });
  if (!response.ok) {
    throw new Error("No se pudo cerrar la sesión del servidor.");
  }
}
