import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

const COOKIE_NAME = "ecocomal_session";
const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const { idToken } = (await request.json()) as { idToken?: string };
    if (!idToken) {
      return NextResponse.json({ error: "Token requerido." }, { status: 400 });
    }

    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const profile = await adminDb.collection("usuarios").doc(decoded.uid).get();

    if (!profile.exists || profile.data()?.activo !== true) {
      return NextResponse.json({ error: "Cuenta inactiva o sin perfil." }, { status: 403 });
    }

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_MS / 1000,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[session] No se pudo crear la sesión:", error);
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
