import assert from "node:assert/strict";
import test from "node:test";
import {
  calcularCapacidad,
  calcularCostoUnitario,
  calcularFaltantes,
  calcularMaterialesRequeridos,
  recetaTieneMateriales,
} from "../src/features/inventory/domain/recetas.ts";

const receta = {
  piezas: [
    { nombrePieza: "Caja", cantidadPieza: 1, insumos: [{ materialId: "lamina", cantidadReq: 0.5 }, { materialId: "electrodo", cantidadReq: 2 }] },
    { nombrePieza: "Sifón", cantidadPieza: 2, insumos: [{ materialId: "tubo", cantidadReq: 1 }, { materialId: "electrodo", cantidadReq: 1 }] },
    { nombrePieza: "Sin material", cantidadPieza: 1, insumos: [{ cantidadReq: 3 }] },
  ],
};

test("suma materiales por pieza y multiplica por unidades", () => {
  assert.deepEqual(Object.fromEntries(calcularMaterialesRequeridos(receta, 3)), {
    lamina: 1.5, electrodo: 12, tubo: 6,
  });
});

test("detecta recetas sin materiales ligados", () => {
  assert.equal(recetaTieneMateriales(receta), true);
  assert.equal(recetaTieneMateriales({ piezas: [{ nombrePieza: "x", cantidadPieza: 1, insumos: [] }] }), false);
  assert.equal(recetaTieneMateriales(null), false);
});

test("calcula costo unitario; sin precio cuenta como 0", () => {
  const precios = new Map([["lamina", 600], ["electrodo", 1.5]]);
  assert.equal(calcularCostoUnitario(receta, precios), 306);
});

test("capacidad de producción y material limitante", () => {
  const stock = new Map([["lamina", 10], ["electrodo", 9], ["tubo", 100]]);
  assert.deepEqual(calcularCapacidad(receta, stock), { unidades: 2, limitanteId: "electrodo" });
  assert.deepEqual(calcularCapacidad({ piezas: [] }, stock), { unidades: 0, limitanteId: null });
});

test("capacidad no falla por punto flotante", () => {
  const r = { piezas: [{ nombrePieza: "p", cantidadPieza: 1, insumos: [{ materialId: "m", cantidadReq: 0.1 }] }] };
  assert.equal(calcularCapacidad(r, new Map([["m", 0.3]])).unidades, 3);
});

test("faltantes para un lote", () => {
  const stock = new Map([["lamina", 1], ["electrodo", 20], ["tubo", 4]]);
  assert.deepEqual(calcularFaltantes(receta, 3, stock), [
    { materialId: "lamina", requerido: 1.5, disponible: 1, falta: 0.5 },
    { materialId: "tubo", requerido: 6, disponible: 4, falta: 2 },
  ]);
});
