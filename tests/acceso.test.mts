import assert from "node:assert/strict";
import test from "node:test";
import { destinoSinAcceso, puedeEntrar, rolesDeRuta } from "../src/lib/acceso.ts";

test("el Colaborador no entra a ningún módulo del dashboard", () => {
  for (const ruta of [
    "/dashboard",
    "/dashboard/planta",
    "/dashboard/inventario",
    "/dashboard/inventario/auditoria",
    "/dashboard/ventas",
    "/dashboard/entregas",
    "/dashboard/administracion",
    "/dashboard/finanzas",
  ]) {
    assert.equal(puedeEntrar("Colaborador", ruta), false, ruta);
  }
});

test("Finanzas es exclusivo del Gerente", () => {
  assert.equal(puedeEntrar("Gerente", "/dashboard/finanzas"), true);
  assert.equal(puedeEntrar("Subgerente", "/dashboard/finanzas"), false);
  assert.equal(puedeEntrar("Supervisor", "/dashboard/finanzas"), false);
});

test("los roles operativos entran al resto del dashboard", () => {
  for (const rol of ["Gerente", "Subgerente", "Supervisor"] as const) {
    assert.equal(puedeEntrar(rol, "/dashboard/planta"), true, rol);
    assert.equal(puedeEntrar(rol, "/dashboard/inventario"), true, rol);
    assert.equal(puedeEntrar(rol, "/dashboard"), true, rol);
  }
});

test("la política cubre las subrutas, no solo el prefijo exacto", () => {
  // Estas existen en el repo y antes quedaban fuera de toda guardia de rol.
  assert.equal(puedeEntrar("Colaborador", "/dashboard/inventario/registro"), false);
  assert.equal(puedeEntrar("Supervisor", "/dashboard/ventas/orden-envio/abc123"), true);
  assert.equal(puedeEntrar("Subgerente", "/dashboard/finanzas/cualquier-cosa"), false);
});

test("un prefijo más específico gana sobre /dashboard", () => {
  assert.deepEqual(rolesDeRuta("/dashboard/finanzas"), ["Gerente"]);
  assert.deepEqual(rolesDeRuta("/dashboard"), ["Gerente", "Subgerente", "Supervisor"]);
});

test("las rutas fuera de la política no se tocan", () => {
  assert.equal(rolesDeRuta("/empleado/portal"), null);
  assert.equal(rolesDeRuta("/login"), null);
  assert.equal(puedeEntrar("Colaborador", "/empleado/portal"), true);
  // `/dashboardzz` no es subruta de `/dashboard`: el prefijo exige el separador.
  assert.equal(rolesDeRuta("/dashboardzz"), null);
});

test("al Colaborador se le manda al portal, no al hub que también se le niega", () => {
  assert.equal(destinoSinAcceso("Colaborador"), "/empleado/portal");
  assert.equal(destinoSinAcceso("Supervisor"), "/dashboard?acceso=denegado");
});
