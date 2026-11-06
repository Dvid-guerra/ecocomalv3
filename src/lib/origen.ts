/** Política CSRF de API. No confía en cabeceras de proxy. */
export interface SolicitudOrigen {
  url: string;
  headers: Pick<Headers, "get">;
}
interface ConfiguracionOrigen {
  appOrigin?: string;
  produccion: boolean;
}
function normalizarOrigen(valor: string): string | null {
  try {
    const url = new URL(valor);
    if (!["http:", "https:"].includes(url.protocol) ||
        url.hostname.includes("*") || url.username || url.password || url.pathname !== "/" ||
        url.search || url.hash || valor.trim() !== valor) return null;
    return url.origin;
  } catch {
    return null;
  }
}
/** Origin ausente o null se rechaza: solo se admiten escrituras del navegador propio. */
export function comprobarOrigen(
  request: SolicitudOrigen,
  config: ConfiguracionOrigen,
): { error: string; status: number } | null {
  const denegado = { error: "Origen de solicitud no permitido.", status: 403 };
  const esperado = config.appOrigin
    ? normalizarOrigen(config.appOrigin)
    : config.produccion ? null : normalizarOrigen(new URL(request.url).origin);
  if (!esperado || (config.produccion && !esperado.startsWith("https://"))) {
    return {
      error: "Configuración de seguridad incompleta: configura APP_ORIGIN con el origen público HTTPS del sitio.",
      status: 503,
    };
  }
  if (request.headers.get("sec-fetch-site") === "cross-site") return denegado;
  const origin = request.headers.get("origin");
  if (!origin || normalizarOrigen(origin) !== esperado) return denegado;
  return null;
}
