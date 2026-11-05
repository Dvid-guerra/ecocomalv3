import assert from "node:assert/strict";
import test from "node:test";
import {
  leerCodigoEscaneado,
  normalizarUbicacion,
  pesoUnitarioDesdeMuestra,
  piezasPorPeso,
  urlEtiqueta,
} from "../src/features/inventory/domain/materiales.ts";

test("normaliza códigos de ubicación escritos a mano", () => {
  assert.equal(normalizarUbicacion("C-E1-N2-P03"), "C-E1-N2-P03");
  assert.equal(normalizarUbicacion("c e1 n2 p3"), "C-E1-N2-P03");
  assert.equal(normalizarUbicacion("ce1n2p12"), "C-E1-N2-P12");
  assert.equal(normalizarUbicacion("disco de corte"), null);
  assert.equal(normalizarUbicacion(""), null);
});

test("cuenta piezas por diferencia de peso", () => {
  const r = piezasPorPeso(1250, 1130, 12);
  assert.deepEqual(r, { piezas: 10, diferenciaG: 120, desviacion: 0, salieron: true });
  assert.equal(piezasPorPeso(500, 520, 10)?.salieron, false);
  assert.equal(piezasPorPeso(100, 94, 4)?.desviacion, 0.5);
  assert.equal(piezasPorPeso(100, 90, 0), null);
});

test("peso unitario desde una muestra", () => {
  assert.equal(pesoUnitarioDesdeMuestra(243, 20), 12.15);
  assert.equal(pesoUnitarioDesdeMuestra(243, 0), null);
  assert.equal(pesoUnitarioDesdeMuestra(-1, 5), null);
});

test("interpreta lo que manda el lector QR", () => {
  const url = urlEtiqueta("https://app.ecocomal.com/", "abc123");
  assert.equal(url, "https://app.ecocomal.com/dashboard/inventario/registro?m=abc123");
  assert.deepEqual(leerCodigoEscaneado(url), { tipo: "material", id: "abc123" });
  assert.deepEqual(leerCodigoEscaneado("M:xyz"), { tipo: "material", id: "xyz" });
  assert.deepEqual(leerCodigoEscaneado(" c-e2-n1-p4 "), { tipo: "ubicacion", codigo: "C-E2-N1-P04" });
  assert.deepEqual(leerCodigoEscaneado("disco 14"), { tipo: "texto", texto: "disco 14" });
});
