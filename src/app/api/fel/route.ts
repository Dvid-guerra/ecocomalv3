import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { calcularImportesFel, validarEntradaFel, type FelInput } from "@/lib/fel";

const COOKIE_NAME = "ecocomal_session";
const MAX_BODY_BYTES = 16 * 1024;

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { success: false, error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function solicitudMismoOrigen(request: NextRequest) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;

  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function POST(request: NextRequest) {
  if (!solicitudMismoOrigen(request)) {
    return jsonError("Origen de solicitud no permitido.", 403);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return jsonError("La solicitud excede el tamaño permitido.", 413);
  }

  const sessionCookie = request.cookies.get(COOKIE_NAME)?.value;
  if (!sessionCookie) return jsonError("Debes iniciar sesión.", 401);

  let uid: string;
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    uid = decoded.uid;
  } catch {
    return jsonError("La sesión no es válida o expiró.", 401);
  }

  try {
    const profile = await adminDb.collection("usuarios").doc(uid).get();
    const user = profile.data();
    if (!profile.exists || user?.activo !== true) {
      return jsonError("La cuenta está inactiva o no tiene perfil.", 403);
    }
    if (user.rol !== "Gerente") {
      return jsonError("No tienes permisos para emitir facturas.", 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("El cuerpo JSON de la solicitud no es válido.", 400);
    }

    let input: FelInput;
    try {
      input = validarEntradaFel(body);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Datos de factura no válidos.", 400);
    }

    const importes = calcularImportesFel(input.cantidad, input.precioUnitario);

    // TODO: Sustituir esta simulación por el adaptador del certificador FEL elegido.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const uuid = crypto.randomUUID().toUpperCase();

    return NextResponse.json(
      {
        success: true,
        data: {
          uuid,
          serie: "A",
          numero: crypto.getRandomValues(new Uint32Array(1))[0].toString(),
          fechaCertificacion: new Date().toISOString(),
          url_pdf: `https://report.feel.com.gt/ingfacereport/ingfacereport_documento?uuid=${uuid}`,
          ...importes,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[fel] Error al procesar la factura:", error);
    return jsonError("Fallo interno en el motor de facturación (FEL).", 500);
  }
}
