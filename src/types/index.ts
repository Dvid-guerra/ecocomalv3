import { Timestamp } from "firebase/firestore";

/**
 * Roles disponibles en el sistema Ecocomal.
 */
export type Rol = "Gerente" | "Subgerente" | "Supervisor" | "Colaborador";

/**
 * Estructura del documento en la colección `usuarios` de Firestore.
 */
export interface UsuarioFirestore {
  nombre:   string;
  email:    string;
  rol:      Rol;
  activo:   boolean;
  creadoEn: Timestamp | null;
}

/**
 * Estado de sesión que se expone a través del AuthContext.
 */
export interface SesionUsuario {
  uid:    string;
  email:  string | null;
  nombre: string;
  rol:    Rol;
  activo: boolean;
}

/**
 * Documento de usuario enriquecido con su UID (usado en listas de la UI).
 */
export interface UsuarioAdmin extends UsuarioFirestore {
  uid: string;
}

/* ─────────────────────────────────────────────
   TIPOS DEL MÓDULO DE PLANTA Y PRODUCCIÓN
───────────────────────────────────────────── */

export const MODELOS = [
  "Ecocina",
  "EcoPlancha Superior",
  "Ecoplancha Híbrida",
  "Ecocomal",
] as const;

export type Modelo = (typeof MODELOS)[number];

export type AreaPlanta = "Herrería" | "Fundición" | "Carga" | "Labores Extras";
export type PrioridadTarea = "Alta" | "Media" | "Baja";

export interface StockItem {
  modelo: string;
  cantidad: number;
}

export interface Movimiento {
  id: string;
  fecha: string;
  hora: string;
  modelo: string;
  cantidad: number;
  observaciones: string;
  tipo: "entrada" | "salida";
}

export interface RecetaInsumo {
  materialId?: string;
  cantidadReq: number;
  nombre?: string;
  unidad?: string;
}

export interface RecetaPieza {
  nombrePieza: string;
  cantidadPieza: number;
  insumos: RecetaInsumo[];
}

export interface ProductoReceta {
  id: string; // Ej: "EcoPlancha Superior"
  modelo: string; // Ej: "EcoPlancha Superior"
  piezas: RecetaPieza[];
}

export interface UsuarioReal {
  uid: string;
  nombre: string;
  email: string;
  areaPlanta?: string;
}

export interface TareaReal {
  id: string;
  empleadoId: string;
  descripcion: string;
  prioridad: PrioridadTarea;
  completada: boolean;
  fecha: string;
}

/* ─────────────────────────────────────────────
   TIPOS DEL MÓDULO DE VENTAS
───────────────────────────────────────────── */

export interface Cliente {
  id: string;
  nombre: string;
  nit: string;
  telefono: string;
  comunidad: string;
  departamento: string;
  modeloInteres: Modelo | "";
  notas?: string;
  creadoEn?: string;
}

export type EstadoPedido =
  | "Cotización"
  | "Confirmado"
  | "En Producción"
  | "Listo"
  | "Entregado";

export interface Pedido {
  id: string;
  clienteId: string;
  clienteNombre: string;
  modelo: Modelo;
  cantidad: number;
  precioUnitario: number;
  total: number;
  estado: EstadoPedido;
  fecha: string;
  notas?: string;
}

/* ─────────────────────────────────────────────
   TIPOS DEL MÓDULO DE ENVÍOS
───────────────────────────────────────────── */

export type EstadoEnvio = "Pendiente" | "En Ruta" | "Entregado";

export interface Envio {
  id: string;
  pedidoIds: string[];
  resumenPedidos: string;
  vehiculo: string;
  colaboradores: string[];
  fecha: string;
  hora: string;
  destino: string;
  estado: EstadoEnvio;
  notas?: string;
}

/* ─────────────────────────────────────────────
   TIPOS DEL MÓDULO DE ANÁLISIS DE PRODUCCIÓN
───────────────────────────────────────────── */

export const SALARIO_DIARIO_DEFAULT = 84; // Q. — salario mínimo Guatemala 2024

export interface RegistroProduccion {
  id: string;
  fecha: string;           // "YYYY-MM-DD"
  semanaId: string;        // "YYYY-WNN" ej. "2026-W23"
  area: AreaPlanta;
  empleadoIds: string[];   // colaboradores que participaron
  modelo: Modelo;
  unidadesProducidas: number;
  horasTrabajadas: number;
  costoManoObra: number;   // salarioDia × nColaboradores
  costoUnitario: number;   // costoManoObra / unidadesProducidas
  registradoPor: string;   // uid del gerente
}

/* ─────────────────────────────────────────────
   TIPOS DEL MÓDULO DE PLANIFICACIÓN SEMANAL
───────────────────────────────────────────── */

export const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;
export type DiaSemana = (typeof DIAS_SEMANA)[number];

export const HORAS_JORNADA_SEMANAL = 48; // 8h × 6 días

export interface BloqueSemanal {
  id: string;
  semanaId: string;        // "YYYY-WNN"
  area: AreaPlanta;
  empleadoId: string;
  modelo: Modelo;
  unidadesObjetivo: number;
  horasEstimadas: number;
  distribucionDiaria: Record<string, number>; // { "Lun": 10, "Mar": 10, ... }
  esUrgente?: boolean;
  notas?: string;
}

/* ─────────────────────────────────────────────
   TIPOS DEL MÓDULO DE PLANILLAS (NÓMINA)
───────────────────────────────────────────── */

export interface Asistencia {
  id: string;
  usuarioId: string;
  nombre: string;
  fecha: string;
  entrada: string;
  salida: string | null;
  bitacora: string;
  fotosUrls: string[];
}

export interface PlanillaQuincenal {
  id: string;
  quincenaId: string; // ej. "2026-06-Q1"
  empleadoId: string;
  empleadoNombre: string;
  diasTrabajados: number;
  horasOrdinarias: number;
  horasExtra: number;
  horasDeficit: number;
  estado: "Borrador" | "Aprobada";
}

/* ─────────────────────────────────────────────
   TIPOS DEL MÓDULO DE INVENTARIO Y COMPRAS
───────────────────────────────────────────── */

export interface Proveedor {
  id: string;
  nombre: string;
  colorEtiqueta: string; // ej. '#ef4444' para Acuario
  telefono?: string;
  contacto?: string;
}

export interface Material {
  id: string;
  nombre: string; // ej. "Lámina de 1/8 4x8"
  unidadMedida: string; // ej. "Unidad", "Libras", "Galón"
  precioEstimado: number;
  proveedorDefectoId?: string;
  /** Solo lo cambia el servidor al registrar un movimiento. */
  stockActual?: number;
  puntoReorden?: number;
  /** Familia de consumible (color de gaveta). Ver `FAMILIAS` en features/inventory/domain/materiales. */
  familia?: string;
  /** Código de ubicación física, ej. "C-E1-N2-P03". */
  ubicacion?: string;
  /** Código de barras del empaque del proveedor (EAN/UPC/Code128), para escanearlo directo. */
  codigoBarras?: string;
}

export interface OrdenItem {
  materialId: string;
  materialNombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  proveedorId?: string;
  pendiente?: number; // Opcional, para coincidir con la columna "Pendiente" del excel
}

export interface OrdenCompra {
  id: string;
  fecha: string;
  creadoPor: string;
  items: OrdenItem[];
  totalOrden: number;
  estado: "Pendiente" | "Recibida";
  notas?: string;
}
