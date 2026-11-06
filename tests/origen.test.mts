import assert from "node:assert/strict";
import test from "node:test";
import { comprobarOrigen } from "../src/lib/origen.ts";

const config = { appOrigin: "https://taller.example", produccion: true };
function solicitud(origin: string | null, extra: Record<string, string> = {}) {
  const headers = new Headers(extra);
  if (origin !== null) headers.set("origin", origin);
  return { url: "http://127.0.0.1:3000/api/inventario/movimientos", headers };
}
test("acepta el origen público detrás de una URL interna y normaliza host y puerto estándar", () => {
  assert.equal(comprobarOrigen(solicitud("https://TALLER.example:443"), config), null);
});
test("rechaza otro esquema, puerto, subdominio o dominio parecido", () => {
  for (const origin of ["http://taller.example", "https://taller.example:444",
    "https://otro.taller.example", "https://taller.example.evil.test"]) {
    assert.equal(comprobarOrigen(solicitud(origin), config)?.status, 403);
  }
});
test("rechaza Origin ausente, opaco null y malformado", () => {
  for (const origin of [null, "null", "inválido", "https://taller.example/ruta",
    "https://usuario@taller.example", "https://taller.example?a=1"]) {
    assert.equal(comprobarOrigen(solicitud(origin), config)?.status, 403);
  }
});
test("rechaza cross-site incluso con Origin permitido", () => {
  assert.equal(comprobarOrigen(solicitud(config.appOrigin, { "sec-fetch-site": "cross-site" }), config)?.status, 403);
});
test("cabeceras Host y forwarded manipuladas no autorizan un origen externo", () => {
  assert.equal(comprobarOrigen(solicitud("https://evil.test", {
    host: "evil.test", "x-forwarded-host": "evil.test", "x-forwarded-proto": "https",
  }), config)?.status, 403);
  assert.equal(comprobarOrigen(solicitud(config.appOrigin, {
    host: "evil.test", "x-forwarded-host": "evil.test", "x-forwarded-proto": "http",
  }), config), null);
});
test("same-origin declarado no basta para autorizar un origen externo", () => {
  assert.equal(comprobarOrigen(solicitud("https://evil.test", { "sec-fetch-site": "same-origin" }), config)?.status, 403);
});
test("producción sin configuración válida falla cerrada con explicación", () => {
  for (const appOrigin of [undefined, "", "null", "http://taller.example",
    "https://taller.example/ruta", "https://*.example", "https://user:pass@taller.example"]) {
    const result = comprobarOrigen(solicitud(config.appOrigin), { appOrigin, produccion: true });
    assert.equal(result?.status, 503);
    assert.match(result!.error, /APP_ORIGIN/);
  }
});
test("desarrollo permite URL local pero sigue exigiendo Origin coincidente", () => {
  const local = { produccion: false };
  assert.equal(comprobarOrigen(solicitud("http://127.0.0.1:3000"), local), null);
  assert.equal(comprobarOrigen(solicitud(null), local)?.status, 403);
  assert.equal(comprobarOrigen(solicitud("https://evil.test"), local)?.status, 403);
});
