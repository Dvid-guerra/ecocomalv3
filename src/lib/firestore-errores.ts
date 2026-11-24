import type { FirestoreError } from "firebase/firestore";

/**
 * Manejadores de error para los observadores `onSnapshot`.
 *
 * Un `onSnapshot` sin tercer argumento deja morir al listener con un
 * "Uncaught Error in snapshot listener" que no dice qué colección falló. Con
 * `alFallarListener` el error siempre queda registrado con su contexto, y la
 * página puede mostrar el mensaje si tiene dónde.
 */

/** Código de Firestore si lo trae; `undefined` en un Error cualquiera. */
function codigoDe(error: unknown): string | undefined {
  return (error as Partial<FirestoreError> | undefined)?.code;
}

/** Traduce el fallo a algo que un operario pueda entender y accionar. */
export function mensajeDeFallo(error: unknown): string {
  switch (codigoDe(error)) {
    case "permission-denied":
      return "No tienes permiso para ver estos datos.";
    case "unavailable":
      return "Sin conexión con la base de datos. Se reintentará al volver la señal.";
    case "unauthenticated":
      return "Tu sesión expiró. Vuelve a iniciar sesión.";
    case "failed-precondition":
      // Firestore devuelve este código cuando la consulta necesita un índice.
      return "La consulta necesita un índice que no está creado.";
    case "resource-exhausted":
      return "La base de datos alcanzó su cuota. Intenta más tarde.";
    default:
      return "No se pudieron cargar los datos.";
  }
}

/**
 * Manejador de error para `onSnapshot`.
 *
 * @param contexto  Qué se estaba leyendo, como `"planta: usuarios"`. Es lo que
 *                  identifica al listener en la consola.
 * @param avisar    Opcional: recibe el mensaje para mostrarlo en la interfaz.
 */
export function alFallarListener(
  contexto: string,
  avisar?: (mensaje: string) => void,
): (error: Error) => void {
  // Acepta `Error` y no `FirestoreError` para servir también a los servicios de
  // `src/features/inventory/services`, que declaran el suyo con el tipo ancho.
  return error => {
    console.error(`[firestore] falló el listener de ${contexto} (${codigoDe(error) ?? "sin código"}):`, error);
    avisar?.(mensajeDeFallo(error));
  };
}
