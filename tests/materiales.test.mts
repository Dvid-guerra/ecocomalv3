import assert from "node:assert/strict";
import test from "node:test";
import {
  leerCodigoEscaneado,
  normalizarUbicacion,
  resolverEscaneo,
  urlEtiqueta,
} from "../src/features/inventory/domain/materiales.ts";
import { normalizar } from "../src/features/inventory/domain/texto.ts";

test("normaliza códigos de ubicación escritos a mano", () => {
  assert.equal(normalizarUbicacion("C-E1-N2-P03"), "C-E1-N2-P03");
  assert.equal(normalizarUbicacion("c e1 n2 p3"), "C-E1-N2-P03");
  assert.equal(normalizarUbicacion("ce1n2p12"), "C-E1-N2-P12");
  assert.equal(normalizarUbicacion("disco de corte"), null);
  assert.equal(normalizarUbicacion(""), null);
});

test("interpreta lo que manda el lector QR", () => {
  const url = urlEtiqueta("https://app.ecocomal.com/", "abc123");
  assert.equal(url, "https://app.ecocomal.com/dashboard/inventario/registro?m=abc123");
  assert.deepEqual(leerCodigoEscaneado(url), { tipo: "material", id: "abc123" });
  assert.deepEqual(leerCodigoEscaneado("M:xyz"), { tipo: "material", id: "xyz" });
  assert.deepEqual(leerCodigoEscaneado(" c-e2-n1-p4 "), { tipo: "ubicacion", codigo: "C-E2-N1-P04" });
  assert.deepEqual(leerCodigoEscaneado("disco 14"), { tipo: "texto", texto: "disco 14" });
});

const catalogo = [
  { id: "d14", nombre: "Disco de corte de 14", ubicacion: "C-E4-N2-P01", codigoBarras: "7501234567890" },
  { id: "d5", nombre: "Disco de pulir 5''", ubicacion: "C-E4-N2-P02" },
  { id: "e6013", nombre: "Electrodo 6013", ubicacion: "C-E1-N2-P03" },
];

test("resuelve QR, código de barras, ubicación y nombre", () => {
  const r = (t: string) => resolverEscaneo(catalogo, t, normalizar);
  assert.deepEqual(r("M:e6013"), { tipo: "uno", material: catalogo[2] });
  assert.deepEqual(r("750 1234 567890"), { tipo: "uno", material: catalogo[0] });
  assert.deepEqual(r("c-e1-n2-p3"), { tipo: "uno", material: catalogo[2] });
  assert.equal(r("disco").tipo, "varios");
  assert.deepEqual(r("pulir"), { tipo: "uno", material: catalogo[1] });
  assert.equal(r("M:nada").tipo, "ninguno");
  const barrasNuevo = r("7409999999999");
  assert.equal(barrasNuevo.tipo, "ninguno");
  assert.match(barrasNuevo.tipo === "ninguno" ? barrasNuevo.mensaje : "", /sin asignar/);
  assert.equal(r("C-E9-N1-P01").tipo, "ninguno");
});
