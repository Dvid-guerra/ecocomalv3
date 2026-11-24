import assert from "node:assert/strict";
import test from "node:test";
import { alFallarListener, mensajeDeFallo } from "../src/lib/firestore-errores.ts";

const falloFirestore = (code: string) => Object.assign(new Error(code), { code });

test("distingue falta de permiso de falta de señal", () => {
  // Son las dos causas reales en este proyecto y piden acciones opuestas:
  // una es de reglas o de rol, la otra se resuelve sola al volver la señal.
  assert.match(mensajeDeFallo(falloFirestore("permission-denied")), /permiso/i);
  assert.match(mensajeDeFallo(falloFirestore("unavailable")), /señal|conexión/i);
  assert.notEqual(
    mensajeDeFallo(falloFirestore("permission-denied")),
    mensajeDeFallo(falloFirestore("unavailable")),
  );
});

test("nombra el índice faltante en vez de un error genérico", () => {
  assert.match(mensajeDeFallo(falloFirestore("failed-precondition")), /índice/i);
});

test("un Error sin código cae al mensaje genérico", () => {
  assert.equal(mensajeDeFallo(new Error("cualquier cosa")), "No se pudieron cargar los datos.");
  assert.equal(mensajeDeFallo(undefined), "No se pudieron cargar los datos.");
});

test("el manejador registra el contexto y avisa a la interfaz", () => {
  const registrado: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => void registrado.push(args);

  const avisos: string[] = [];
  try {
    alFallarListener("planta: usuarios", m => avisos.push(m))(falloFirestore("permission-denied"));
  } finally {
    console.error = original;
  }

  assert.equal(registrado.length, 1);
  // Lo que faltaba en el error original: saber qué listener murió.
  assert.match(String(registrado[0][0]), /planta: usuarios/);
  assert.match(String(registrado[0][0]), /permission-denied/);
  assert.deepEqual(avisos, ["No tienes permiso para ver estos datos."]);
});

test("sin callback de aviso no truena", () => {
  const original = console.error;
  console.error = () => {};
  try {
    assert.doesNotThrow(() => alFallarListener("x")(falloFirestore("unavailable")));
  } finally {
    console.error = original;
  }
});
