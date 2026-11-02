import assert from "node:assert/strict";
import test from "node:test";
import {
  calcularMovimiento,
  StockMaterialInsuficienteError,
  type MovimientoInput,
} from "../src/features/inventory/domain/movimientos.ts";

const base = { materialId: "disco-corte" } as const;
const mov = (m: Omit<MovimientoInput, "materialId">): MovimientoInput => ({ ...base, ...m });

test("entrada suma al stock", () => {
  assert.deepEqual(calcularMovimiento(5, mov({ tipo: "entrada", cantidad: 10, motivo: "compra" })), {
    stockAnterior: 5, stockResultante: 15, delta: 10,
  });
});

test("salida resta y bloquea stock negativo", () => {
  assert.equal(calcularMovimiento(5, mov({ tipo: "salida", cantidad: 2, motivo: "merma" })).stockResultante, 3);
  assert.throws(
    () => calcularMovimiento(1, mov({ tipo: "salida", cantidad: 2, motivo: "consumo_produccion" })),
    StockMaterialInsuficienteError,
  );
});

test("ajuste fija el stock contado y calcula la diferencia", () => {
  assert.deepEqual(calcularMovimiento(12, mov({ tipo: "ajuste", cantidad: 9, motivo: "conteo_fisico" })), {
    stockAnterior: 12, stockResultante: 9, delta: -3,
  });
  assert.equal(calcularMovimiento(4, mov({ tipo: "ajuste", cantidad: 0, motivo: "conteo_fisico" })).stockResultante, 0);
});

test("evita errores de punto flotante", () => {
  assert.equal(calcularMovimiento(0.1, mov({ tipo: "entrada", cantidad: 0.2, motivo: "compra" })).stockResultante, 0.3);
});

test("rechaza cantidades inválidas y motivos que no corresponden", () => {
  assert.throws(() => calcularMovimiento(5, mov({ tipo: "entrada", cantidad: 0, motivo: "compra" })), /mayor a cero/);
  assert.throws(() => calcularMovimiento(5, mov({ tipo: "ajuste", cantidad: -1, motivo: "conteo_fisico" })), /negativo/);
  assert.throws(() => calcularMovimiento(5, mov({ tipo: "entrada", cantidad: 1, motivo: "merma" })), /no aplica/);
});
