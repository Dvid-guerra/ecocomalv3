import assert from "node:assert/strict";
import test from "node:test";
import { mesAuditoria, nombreMes, resumirAuditoria, validarConteo } from "../src/features/inventory/domain/auditoria.ts";

const quien = { contadoPorId: "u1", contadoPorNombre: "Juan" };
const materiales = [
  { id: "disco", nombre: "Disco de corte", unidad: "Unidad", precio: 45, stockActual: 10 },
  { id: "electrodo", nombre: "Electrodo 6013", unidad: "Libra", precio: 20, stockActual: 7 },
  { id: "thiner", nombre: "Thiner", unidad: "Galón", precio: 55, stockActual: 3 },
];

test("calcula diferencias, valores y no contados", () => {
  const r = resumirAuditoria(materiales, {
    disco: { contado: 8, sistemaAlContar: 10, ...quien },
    electrodo: { contado: 7.5, sistemaAlContar: 7, ...quien },
  });
  assert.deepEqual(r.noContados, [{ materialId: "thiner", nombre: "Thiner" }]);
  assert.equal(r.lineas[0].materialId, "disco"); // el faltante más caro primero
  assert.equal(r.lineas[0].diferencia, -2);
  assert.equal(r.lineas[0].valorDiferencia, -90);
  assert.equal(r.lineas[0].stockFinal, 8);
  assert.deepEqual(r.totales, { contados: 2, conDiferencia: 2, valorFaltante: -90, valorSobrante: 10, valorNeto: -80 });
});

test("respeta lo que se movió después de contar", () => {
  // Se contaron 8 cuando el sistema decía 10; luego alguien sacó 3 (el sistema ya va en 7).
  const r = resumirAuditoria([{ ...materiales[0], stockActual: 7 }], { disco: { contado: 8, sistemaAlContar: 10, ...quien } });
  assert.equal(r.lineas[0].diferencia, -2);
  assert.equal(r.lineas[0].stockFinal, 5);
});

test("nunca deja stock negativo", () => {
  const r = resumirAuditoria([{ ...materiales[0], stockActual: 0 }], { disco: { contado: 1, sistemaAlContar: 5, ...quien } });
  assert.equal(r.lineas[0].stockFinal, 0);
});

test("valida conteo y mes", () => {
  assert.equal(validarConteo(3.14159), 3.142);
  assert.throws(() => validarConteo(-1));
  assert.throws(() => validarConteo(Number.NaN));
  // 1 dic 2026 00:30 UTC = 30 nov 18:30 en Guatemala.
  assert.equal(mesAuditoria(new Date("2026-12-01T00:30:00Z")), "2026-11");
  assert.match(nombreMes("2026-11"), /^Noviembre de 2026$|^Noviembre 2026$/);
});
