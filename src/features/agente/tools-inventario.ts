import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { MODELOS } from "@/types";
import {
  capacidadProduccion,
  consultarStock,
  faltantesParaProducir,
  historialMovimientos,
  materialesBajoMinimo,
  stockEstufas,
} from "@/features/inventory/server/consultas";

const modelo = z.enum(MODELOS).describe("Modelo de estufa");

/** Herramientas de SOLO LECTURA. Las de escritura se agregan con confirmación del usuario. */
export const toolsInventario = {
  consultar_stock: tool({
    description:
      "Busca materiales de materia prima o consumibles (lámina, tubo, discos, electrodos, pintura…) y devuelve su stock actual, unidad y punto de reorden. Sin búsqueda devuelve todos.",
    inputSchema: z.object({
      busqueda: z.string().optional().describe("Parte del nombre del material, ej. 'disco', 'tubo 2x6'"),
    }),
    execute: ({ busqueda }) => consultarStock(busqueda),
  }),

  materiales_bajo_minimo: tool({
    description:
      "Lista los materiales cuyo stock está en o por debajo de su punto de reorden, con proveedor y precio estimado. Úsala para '¿qué hay que comprar?'.",
    inputSchema: z.object({}),
    execute: () => materialesBajoMinimo(),
  }),

  capacidad_produccion: tool({
    description:
      "Calcula cuántas estufas completas se pueden fabricar con el stock actual según la receta (BOM), qué material limita y el costo de materiales por unidad.",
    inputSchema: z.object({ modelo: modelo.optional().describe("Si se omite, calcula todos los modelos") }),
    execute: ({ modelo }) => capacidadProduccion(modelo),
  }),

  faltantes_para_producir: tool({
    description:
      "Indica qué materiales faltan (y cuánto costaría comprarlos) para fabricar una cantidad específica de un modelo.",
    inputSchema: z.object({
      modelo,
      unidades: z.number().int().positive().max(1000).describe("Cantidad de estufas a fabricar"),
    }),
    execute: ({ modelo, unidades }) => faltantesParaProducir(modelo, unidades),
  }),

  historial_movimientos: tool({
    description:
      "Historial de entradas, salidas y ajustes de materiales: quién, cuándo, cuánto y por qué. Incluye el cambio neto por material en el periodo. Úsala para consumo, '¿quién sacó…?', '¿cuánto se gastó…?'.",
    inputSchema: z.object({
      busqueda: z.string().optional().describe("Parte del nombre del material"),
      dias: z.number().int().min(1).max(365).default(7).describe("Cuántos días hacia atrás"),
      tipo: z.enum(["entrada", "salida", "ajuste"]).optional(),
      limite: z.number().int().min(1).max(50).default(20).describe("Máximo de movimientos a listar"),
    }),
    execute: input => historialMovimientos(input),
  }),

  stock_estufas: tool({
    description: "Estufas TERMINADAS en bodega por modelo (producto final, no materia prima).",
    inputSchema: z.object({}),
    execute: () => stockEstufas(),
  }),
};
