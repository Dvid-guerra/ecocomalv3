/* ─────────────────────────────────────────────
   Tipos del módulo Planta de Trabajo
───────────────────────────────────────────── */

export type EstadoPieza  = "pendiente" | "en_proceso" | "terminado";
export type EstadoEntrega = "pendiente" | "en_camino" | "entregado";
export type TabPlanta     = "operaciones" | "configuracion";

export interface PiezaHerreria {
  id: string;
  nombre: string;
  estado: EstadoPieza;
  esPedidoExtra: boolean;
  cliente?: string;
}

export interface ActividadFundicion {
  id: string;
  nombre: string;
  unidadesHoy: number;
  meta: number;
}

export interface Entrega {
  id: string;
  descripcion: string;
  cliente: string;
  fecha: string; // YYYY-MM-DD
  unidades: number;
  estado: EstadoEntrega;
}

/* ─────────────────────────────────────────────
   Datos iniciales
───────────────────────────────────────────── */
export const PIEZAS_INICIALES: PiezaHerreria[] = [
  { id: "sifones",        nombre: "Sifones",                estado: "en_proceso", esPedidoExtra: false },
  { id: "bocas",          nombre: "Bocas",                  estado: "pendiente",  esPedidoExtra: false },
  { id: "canastas",       nombre: "Canastas para plataforma", estado: "terminado", esPedidoExtra: false },
  { id: "portaceniceros", nombre: "Portaceniceros",          estado: "en_proceso", esPedidoExtra: false },
  { id: "tubos",          nombre: "Tubos",                  estado: "pendiente",  esPedidoExtra: false },
  { id: "protectores",    nombre: "Protectores",            estado: "pendiente",  esPedidoExtra: false },
  { id: "sombreros",      nombre: "Sombreros",              estado: "terminado",  esPedidoExtra: false },
];

export const ACTIVIDADES_INICIALES: ActividadFundicion[] = [
  { id: "sellado",  nombre: "Sellado de cajas",    unidadesHoy: 12, meta: 20 },
  { id: "fundir",   nombre: "Fundir plataformas",  unidadesHoy: 7,  meta: 15 },
  { id: "concreto", nombre: "Piezas de concreto",  unidadesHoy: 34, meta: 50 },
];

export const ENTREGAS_INICIALES: Entrega[] = [
  { id: "e1", descripcion: "Estufas mod. E-200",       cliente: "Ferretería García",     fecha: "2026-05-28", unidades: 15, estado: "pendiente" },
  { id: "e2", descripcion: "Plataformas reforzadas",   cliente: "Constructora Del Valle", fecha: "2026-06-01", unidades: 8,  estado: "pendiente" },
  { id: "e3", descripcion: "Piezas de repuesto",       cliente: "Distribuidora Norte",    fecha: "2026-06-05", unidades: 30, estado: "en_camino" },
  { id: "e4", descripcion: "Lote de sombreros",        cliente: "Almacén San Marcos",     fecha: "2026-05-24", unidades: 20, estado: "entregado" },
];

/* ─────────────────────────────────────────────
   Simulador de materiales — Coeficientes
   por unidad de estufa producida
───────────────────────────────────────────── */
export const COEFICIENTES = {
  planchas:  { label: "Planchas de metal", unidad: "láminas",  valor: 3,  stock: 200 },
  comales:   { label: "Comales",           unidad: "unidades", valor: 1,  stock: 80  },
  mesas:     { label: "Mesas de metal",    unidad: "mesas",    valor: 1,  stock: 50  },
  soldadura: { label: "Soldadura",         unidad: "lbs",      valor: 2,  stock: 100 },
  pintura:   { label: "Pintura",           unidad: "litros",   valor: 1,  stock: 30  },
  tornillos: { label: "Tornillos",         unidad: "piezas",   valor: 12, stock: 500 },
} as const;

export type InsumoKey = keyof typeof COEFICIENTES;

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
export function generarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function formatearFecha(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-GT", { day: "numeric", month: "short", year: "numeric" });
}
