import "server-only";
import { NextResponse } from "next/server";
import { ErrorApi } from "@/lib/api-auth";

export function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

export function jsonOk(data: unknown) {
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

/** Lee y limita el cuerpo JSON. Devuelve `null` si no es JSON válido. */
export async function leerJson(request: Request, maxBytes = 16 * 1024): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) {
    throw new ErrorApi("La solicitud es demasiado grande.", 413);
  }
  return request.json().catch(() => null);
}
