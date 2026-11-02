import assert from "node:assert/strict";
import test from "node:test";
import { calcularImportesFel, validarEntradaFel } from "../src/lib/fel.ts";

const facturaValida = {
  nit: "12345678-9",
  razonSocial: "Cliente de prueba",
  direccion: "Guatemala",
  item: "Ecocomal",
  cantidad: 3,
  precioUnitario: 112,
};

test("normaliza la entrada y descarta importes enviados por el cliente", () => {
  const input = validarEntradaFel({ ...facturaValida, nit: " 12345678-9 ", total: 0.01 });
  assert.equal(input.nit, "12345678-9");
  assert.equal("total" in input, false);
});

test("calcula total, base imponible e IVA en centavos", () => {
  assert.deepEqual(calcularImportesFel(3, 112), {
    subtotal: 300,
    iva: 36,
    total: 336,
  });
});

test("rechaza cantidades no enteras y precios con más de dos decimales", () => {
  assert.throws(() => validarEntradaFel({ ...facturaValida, cantidad: 1.5 }), /cantidad/);
  assert.throws(() => validarEntradaFel({ ...facturaValida, precioUnitario: 10.001 }), /dos decimales/);
});

test("rechaza campos vacíos y cuerpos que no son objetos", () => {
  assert.throws(() => validarEntradaFel({ ...facturaValida, razonSocial: " " }), /razón social/);
  assert.throws(() => validarEntradaFel(null), /cuerpo/);
});
