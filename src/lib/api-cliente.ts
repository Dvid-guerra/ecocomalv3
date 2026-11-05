/** Error devuelto por una API propia, con el código y los datos extra del cuerpo. */
export class ErrorRespuestaApi extends Error {
  readonly status: number;
  readonly codigo?: string;
  readonly datos: Record<string, unknown>;

  constructor(message: string, status: number, datos: Record<string, unknown> = {}) {
    super(message);
    this.name = "ErrorRespuestaApi";
    this.status = status;
    this.codigo = typeof datos.codigo === "string" ? datos.codigo : undefined;
    this.datos = datos;
  }
}

/** POST JSON a una API propia. Lanza `ErrorRespuestaApi` con el mensaje del servidor. */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    throw new ErrorRespuestaApi("Sin conexión. Revisa el WiFi e intenta de nuevo.", 0);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ErrorRespuestaApi(String(data.error ?? `Error ${res.status}`), res.status, data);
  }
  return data as T;
}
