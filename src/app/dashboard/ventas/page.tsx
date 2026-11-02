"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  Cliente,
  Pedido,
  EstadoPedido,
  Envio,
  EstadoEnvio,
  Modelo,
  Material,
} from "@/types";
import { MODELOS } from "@/types";
import {
  actualizarEstadoPedido,
  RecetaNoConfiguradaError,
  type FaltanteProduccion,
} from "@/features/sales/services/pedidos";
import {
  ArrowLeft,
  Users,
  Search,
  ShoppingCart,
  CalendarRange,
  Phone,
  Plus,
  X,
  Trash2,
  ExternalLink,
  Package,
  Truck,
  ChevronDown,
  AlertTriangle,
  Printer,
} from "lucide-react";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
type VentasTab = "clientes" | "pedidos" | "planificacion";

const ESTADOS_PEDIDO: EstadoPedido[] = [
  "Cotización",
  "Confirmado",
  "En Producción",
  "Listo",
  "Entregado",
];

const VEHICULOS = [
  "Pick-up Blanca",
  "Camión Grande",
  "Camión Chico",
  "Moto",
] as const;

/* ─────────────────────────────────────────────
   Skeleton
───────────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="w-full max-w-5xl px-4 space-y-4 animate-pulse">
        <div className="h-10 w-64 bg-stone-200 rounded-2xl" />
        <div className="h-6 w-40 bg-stone-100 rounded-xl" />
        <div className="mt-8 bg-white rounded-3xl border border-stone-200/60 p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-9 w-9 rounded-full bg-stone-100" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-stone-100 rounded" />
                <div className="h-3 w-32 bg-stone-50 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Modal wrapper
───────────────────────────────────────────── */
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-stone-100">
          <h2 className="text-base font-bold text-stone-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Confirm dialog
───────────────────────────────────────────── */
function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-stone-900/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-sm text-stone-700 font-medium">{message}</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl font-semibold transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-xl font-semibold transition-colors"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Field label helper
───────────────────────────────────────────── */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-3.5 py-2.5 text-sm bg-stone-50 ring-1 ring-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/20 focus:bg-white transition-colors placeholder-stone-300";

/* ─────────────────────────────────────────────
   Modelo badge
───────────────────────────────────────────── */
const modeloColor: Record<string, string> = {
  Ecocina: "bg-amber-50 text-amber-700 ring-amber-200",
  "EcoPlancha Superior": "bg-blue-50 text-blue-700 ring-blue-200",
  "Ecoplancha Híbrida": "bg-purple-50 text-purple-700 ring-purple-200",
  Ecocomal: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

function ModeloBadge({ modelo }: { modelo: string }) {
  const cls =
    modeloColor[modelo] ?? "bg-stone-100 text-stone-700 ring-stone-200";
  return (
    <span
      className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ring-1 ${cls}`}
    >
      {modelo}
    </span>
  );
}

/* ─────────────────────────────────────────────
   EstadoEnvio badge colors
───────────────────────────────────────────── */
const estadoEnvioColor: Record<EstadoEnvio, string> = {
  Pendiente: "bg-amber-50 text-amber-700 ring-amber-200",
  "En Ruta": "bg-blue-50 text-blue-700 ring-blue-200",
  Entregado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function formatQ(n: number) {
  return `Q ${n.toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/* ═════════════════════════════════════════════
   PAGE
═════════════════════════════════════════════ */
export default function VentasPage() {
  const { sesion, cargando } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<VentasTab>("clientes");
  const [filtroClienteId, setFiltroClienteId] = useState<string | null>(null);

  /* ── RBAC guard ── */
  useEffect(() => {
    if (cargando) return;
    if (!sesion) {
      router.replace("/login");
      return;
    }
    const permitidos = ["Gerente", "Subgerente", "Supervisor"];
    if (!permitidos.includes(sesion.rol)) {
      router.replace("/dashboard?acceso=denegado");
    }
  }, [cargando, sesion, router]);

  if (cargando || !sesion) return <Skeleton />;
  const permitidos = ["Gerente", "Subgerente", "Supervisor"];
  if (!permitidos.includes(sesion.rol)) return null;

  function handleVerPedidos(clienteId: string) {
    setFiltroClienteId(clienteId);
    setActiveTab("pedidos");
  }

  const tabBtn = (
    tab: VentasTab,
    icon: React.ReactNode,
    label: string
  ) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
        activeTab === tab
          ? "bg-white text-stone-900 shadow-sm ring-1 ring-stone-200/60"
          : "text-stone-500 hover:text-stone-700 hover:bg-white/50"
      }`}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">

        {/* ── Encabezado ── */}
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-blue-700 transition-colors duration-200 mb-3 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Volver al Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            Ventas y Envíos
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Gestión comercial, directorio de clientes y planificación de rutas.
          </p>
        </div>

        {/* ── Tab nav ── */}
        <div className="flex space-x-2 bg-stone-200/50 p-1.5 rounded-2xl w-fit">
          {tabBtn("clientes", <Users className="w-4 h-4" />, "Clientes")}
          {tabBtn("pedidos", <ShoppingCart className="w-4 h-4" />, "Pedidos")}
          {tabBtn(
            "planificacion",
            <CalendarRange className="w-4 h-4" />,
            "Planificar Envíos"
          )}
        </div>

        {/* ── Content ── */}
        {activeTab === "clientes" && (
          <TabClientes onVerPedidos={handleVerPedidos} />
        )}
        {activeTab === "pedidos" && (
          <TabPedidos
            filtroClienteId={filtroClienteId}
            onClearFiltro={() => setFiltroClienteId(null)}
          />
        )}
        {activeTab === "planificacion" && <TabEnvios />}

      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════
   TAB 1: CLIENTES
═════════════════════════════════════════════ */
function TabClientes({
  onVerPedidos,
}: {
  onVerPedidos: (clienteId: string) => void;
}) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Cliente | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    nit: "",
    telefono: "",
    comunidad: "",
    departamento: "",
    modeloInteres: "" as Modelo | "",
    notas: "",
  });

  /* Real-time listener */
  useEffect(() => {
    const q = query(collection(db, "clientes"), orderBy("nombre"));
    const unsub = onSnapshot(q, (snap) => {
      setClientes(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Cliente, "id">),
        }))
      );
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtrados = clientes.filter(
    (c) =>
      c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.comunidad.toLowerCase().includes(busqueda.toLowerCase())
  );

  function resetForm() {
    setForm({
      nombre: "",
      nit: "",
      telefono: "",
      comunidad: "",
      departamento: "",
      modeloInteres: "",
      notas: "",
    });
  }

  async function handleAdd() {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "clientes"), {
        nombre: form.nombre.trim(),
        nit: form.nit.trim() || "C/F",
        telefono: form.telefono.trim(),
        comunidad: form.comunidad.trim(),
        departamento: form.departamento.trim(),
        modeloInteres: form.modeloInteres,
        notas: form.notas.trim(),
        creadoEn: serverTimestamp(),
      });
      resetForm();
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(cliente: Cliente) {
    await deleteDoc(doc(db, "clientes", cliente.id));
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white rounded-2xl border border-stone-200/60 p-4 shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-blue-50 rounded-xl">
            <Users className="w-5 h-5 text-blue-700" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-bold text-stone-900 tracking-tight">
              Directorio de Clientes
            </p>
            <p className="text-xs text-stone-500">
              {clientes.length}{" "}
              {clientes.length === 1 ? "cliente" : "clientes"} registrados
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap sm:flex-nowrap">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o comunidad..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-100/60 ring-1 ring-slate-200/80 rounded-xl shadow-inner focus:bg-white focus:outline-none transition-colors"
            />
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm w-full sm:w-auto whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Agregar Cliente
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-stone-200/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50/50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-400 uppercase tracking-tight">
                  Cliente
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-400 uppercase tracking-tight">
                  NIT
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-400 uppercase tracking-tight">
                  Comunidad / Dpto.
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-400 uppercase tracking-tight">
                  Modelo Interés
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-400 uppercase tracking-tight">
                  Teléfono
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-stone-400 uppercase tracking-tight">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 w-36 bg-stone-100 rounded" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-20 bg-stone-100 rounded" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-32 bg-stone-100 rounded" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-5 w-24 bg-stone-100 rounded-lg" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-28 bg-stone-100 rounded" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-7 w-20 bg-stone-100 rounded-lg ml-auto" />
                    </td>
                  </tr>
                ))
              ) : filtrados.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-sm text-stone-400"
                  >
                    {busqueda
                      ? "Sin resultados para esa búsqueda."
                      : "No hay clientes registrados aún."}
                  </td>
                </tr>
              ) : (
                filtrados.map((cliente) => (
                  <tr
                    key={cliente.id}
                    className="hover:bg-stone-50/80 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-stone-800">
                        {cliente.nombre}
                      </span>
                      {cliente.notas && (
                        <p className="text-xs text-stone-400 mt-0.5 truncate max-w-[200px]">
                          {cliente.notas}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-stone-600 font-mono">
                        {cliente.nit || "C/F"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-stone-600">
                        {cliente.comunidad}
                      </span>
                      {cliente.departamento && (
                        <p className="text-xs text-stone-400">
                          {cliente.departamento}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {cliente.modeloInteres ? (
                        <ModeloBadge modelo={cliente.modeloInteres} />
                      ) : (
                        <span className="text-xs text-stone-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {cliente.telefono ? (
                        <a
                          href={`tel:${cliente.telefono.replace(/\s+/g, "")}`}
                          className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-blue-700 transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          {cliente.telefono}
                        </a>
                      ) : (
                        <span className="text-xs text-stone-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onVerPedidos(cliente.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-stone-50 hover:bg-blue-50 text-stone-500 hover:text-blue-700 text-xs font-semibold rounded-lg ring-1 ring-stone-200/60 hover:ring-blue-200 transition-all"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Pedidos
                        </button>
                        <button
                          onClick={() => setDeleteTarget(cliente)}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Client Modal */}
      {showModal && (
        <Modal
          title="Agregar Cliente"
          onClose={() => {
            resetForm();
            setShowModal(false);
          }}
        >
          <div className="space-y-4">
            <Field label="Nombre / Razón Social *">
              <input
                type="text"
                placeholder="Ej. María González"
                value={form.nombre}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nombre: e.target.value }))
                }
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="NIT">
                <input
                  type="text"
                  placeholder="1234567-8"
                  value={form.nit}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nit: e.target.value }))
                  }
                  className={inputCls}
                />
              </Field>
              <div className="flex flex-col justify-end pb-0.5">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, nit: "C/F" }))}
                  className="px-3 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 text-sm font-semibold rounded-xl transition-colors ring-1 ring-stone-200"
                >
                  CF (Consumidor Final)
                </button>
              </div>
            </div>

            <Field label="Teléfono">
              <input
                type="text"
                placeholder="+502 5555-0000"
                value={form.telefono}
                onChange={(e) =>
                  setForm((f) => ({ ...f, telefono: e.target.value }))
                }
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Comunidad">
                <input
                  type="text"
                  placeholder="Ej. San Juan del Obispo"
                  value={form.comunidad}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, comunidad: e.target.value }))
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Departamento">
                <input
                  type="text"
                  placeholder="Ej. Sacatepéquez"
                  value={form.departamento}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, departamento: e.target.value }))
                  }
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Modelo de Interés">
              <select
                value={form.modeloInteres}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    modeloInteres: e.target.value as Modelo | "",
                  }))
                }
                className={inputCls}
              >
                <option value="">Sin especificar</option>
                {MODELOS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Notas (opcional)">
              <textarea
                rows={3}
                placeholder="Comentarios o información adicional..."
                value={form.notas}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notas: e.target.value }))
                }
                className={`${inputCls} resize-none`}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  resetForm();
                  setShowModal(false);
                }}
                className="px-4 py-2 text-sm text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAdd}
                disabled={saving || !form.nombre.trim()}
                className="px-5 py-2 text-sm text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-colors"
              >
                {saving ? "Guardando..." : "Agregar Cliente"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDialog
          message={`¿Eliminar a "${deleteTarget.nombre}"? Esta acción no se puede deshacer.`}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════
   TAB 2: PEDIDOS — Kanban
═════════════════════════════════════════════ */
function TabPedidos({
  filtroClienteId,
  onClearFiltro,
}: {
  filtroClienteId: string | null;
  onClearFiltro: () => void;
}) {
  const { sesion } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showFaltantesModal, setShowFaltantesModal] = useState(false);
  const [faltantesParaProducir, setFaltantesParaProducir] = useState<FaltanteProduccion[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    clienteId: "",
    modelo: "" as Modelo | "",
    cantidad: "",
    precioUnitario: "",
    notas: "",
    estado: "Cotización" as EstadoPedido,
  });

  const [nuevoEstado, setNuevoEstado] = useState<EstadoPedido>("Cotización");

  useEffect(() => {
    const q1 = query(
      collection(db, "pedidos"),
      orderBy("fecha", "desc")
    );
    const u1 = onSnapshot(q1, (snap) => {
      setPedidos(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Pedido, "id">),
        }))
      );
      setLoading(false);
    });
    const q2 = query(collection(db, "clientes"), orderBy("nombre"));
    const u2 = onSnapshot(q2, (snap) => {
      setClientes(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Cliente, "id">),
        }))
      );
    });
    return () => {
      u1();
      u2();
    };
  }, []);

  const pedidosFiltrados = filtroClienteId
    ? pedidos.filter((p) => p.clienteId === filtroClienteId)
    : pedidos;

  const pedidosPorEstado = useCallback(
    (estado: EstadoPedido) =>
      pedidosFiltrados.filter((p) => p.estado === estado),
    [pedidosFiltrados]
  );

  function resetForm() {
    setForm({
      clienteId: "",
      modelo: "",
      cantidad: "",
      precioUnitario: "",
      notas: "",
      estado: "Cotización",
    });
  }

  async function handleAddPedido() {
    if (
      !form.clienteId ||
      !form.modelo ||
      !form.cantidad ||
      !form.precioUnitario
    )
      return;
    const cliente = clientes.find((c) => c.id === form.clienteId);
    if (!cliente) return;
    const cantidad = parseInt(form.cantidad, 10);
    const precioUnitario = parseFloat(form.precioUnitario);
    setSaving(true);
    try {
      await addDoc(collection(db, "pedidos"), {
        clienteId: form.clienteId,
        clienteNombre: cliente.nombre,
        modelo: form.modelo,
        cantidad,
        precioUnitario,
        total: cantidad * precioUnitario,
        estado: form.estado,
        fecha: new Date().toISOString().split("T")[0],
        notas: form.notas.trim(),
        creadoEn: serverTimestamp(),
      });
      resetForm();
      setShowNewModal(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateEstado() {
    if (!selectedPedido || !sesion) return;
    setSaving(true);
    try {
      const faltantes = await actualizarEstadoPedido(selectedPedido, nuevoEstado, { uid: sesion.uid, nombre: sesion.nombre });
      if (faltantes.length) {
        setFaltantesParaProducir(faltantes);
        setShowFaltantesModal(true);
        return;
      }
      setSelectedPedido(null);
    } catch (e) {
      console.error(e);
      alert(e instanceof RecetaNoConfiguradaError
        ? `${e.message} Configúrala en Inventario > Recetas.`
        : "Ocurrió un error al actualizar el estado");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerarOrdenFaltantes() {
    setSaving(true);
    try {
      const snapMats = await getDocs(collection(db, "materiales"));
      const materiales = snapMats.docs.map(d => ({ id: d.id, ...d.data() } as Material));

      const items = faltantesParaProducir.map(f => {
        const mat = materiales.find(m => m.id === f.materialId);
        const qty = f.requerido - f.actual;
        return {
          materialId: f.materialId,
          materialNombre: f.nombre,
          cantidad: qty,
          precioUnitario: mat?.precioEstimado || 0,
          subtotal: qty * (mat?.precioEstimado || 0),
          proveedorId: mat?.proveedorDefectoId || "",
          pendiente: 0
        };
      });

      const total = items.reduce((acc, i) => acc + i.subtotal, 0);

      await addDoc(collection(db, "ordenes_compra"), {
        fecha: new Date().toISOString().split("T")[0],
        creadoPor: "Sistema MRP",
        items,
        totalOrden: total,
        estado: "Pendiente",
        notas: `Auto-generada por faltante para pedido de ${selectedPedido?.clienteNombre}`
      });
      alert("Orden de Compra en Borrador generada en la pestaña Inventario.");
      setShowFaltantesModal(false);
    } catch {
      alert("Error al generar Orden de Compra");
    } finally {
      setSaving(false);
    }
  }

  const filtroCliente = filtroClienteId
    ? clientes.find((c) => c.id === filtroClienteId)
    : null;

  const columnTopBorder: Record<EstadoPedido, string> = {
    Cotización: "border-t-stone-300",
    Confirmado: "border-t-blue-400",
    "En Producción": "border-t-amber-400",
    Listo: "border-t-emerald-400",
    Entregado: "border-t-slate-300",
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white rounded-2xl border border-stone-200/60 p-4 shadow-sm gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-blue-50 rounded-xl">
            <Package className="w-5 h-5 text-blue-700" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-bold text-stone-900 tracking-tight">
              Pipeline de Pedidos
            </p>
            <p className="text-xs text-stone-500">
              {pedidos.length} pedidos en total
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {filtroCliente && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-xl ring-1 ring-blue-200">
              <span>Filtrando: {filtroCliente.nombre}</span>
              <button
                onClick={onClearFiltro}
                className="hover:text-blue-900"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Nuevo Pedido
          </button>
        </div>
      </div>

      {/* Kanban board */}
      {loading ? (
        <div className="grid grid-cols-5 gap-3">
          {ESTADOS_PEDIDO.map((e) => (
            <div
              key={e}
              className="bg-white rounded-2xl border border-stone-200/60 p-4 space-y-3 animate-pulse"
            >
              <div className="h-4 w-24 bg-stone-100 rounded" />
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-20 bg-stone-50 rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {ESTADOS_PEDIDO.map((estado) => {
            const cards = pedidosPorEstado(estado);
            return (
              <div
                key={estado}
                className={`bg-white rounded-2xl border-t-4 border border-stone-200/60 shadow-sm flex flex-col ${columnTopBorder[estado]}`}
              >
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-700 uppercase tracking-wide">
                    {estado}
                  </span>
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-stone-100 text-stone-500 text-xs font-bold">
                    {cards.length}
                  </span>
                </div>
                <div className="px-3 pb-3 space-y-2 flex-1">
                  {cards.length === 0 ? (
                    <div className="py-4 text-center text-xs text-stone-300">
                      Vacío
                    </div>
                  ) : (
                    cards.map((pedido) => (
                      <button
                        key={pedido.id}
                        onClick={() => {
                          setSelectedPedido(pedido);
                          setNuevoEstado(pedido.estado);
                        }}
                        className="w-full text-left bg-stone-50 hover:bg-stone-100 border border-stone-200/60 rounded-xl p-3 transition-colors space-y-2"
                      >
                        <p className="text-xs font-semibold text-stone-800 leading-tight">
                          {pedido.clienteNombre}
                        </p>
                        <ModeloBadge modelo={pedido.modelo} />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-stone-500">
                            {pedido.cantidad} u.
                          </span>
                          <span className="text-xs font-bold text-stone-700">
                            {formatQ(pedido.total)}
                          </span>
                        </div>
                        {pedido.fecha && (
                          <p className="text-[10px] text-stone-400">
                            {pedido.fecha}
                          </p>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pedido detail modal */}
      {selectedPedido && (
        <Modal
          title="Detalle del Pedido"
          onClose={() => setSelectedPedido(null)}
        >
          <div className="space-y-5">
            <div className="bg-stone-50 rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold text-stone-900">
                    {selectedPedido.clienteNombre}
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {selectedPedido.fecha}
                  </p>
                </div>
                <ModeloBadge modelo={selectedPedido.modelo} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white rounded-xl p-3 ring-1 ring-stone-100">
                  <p className="text-lg font-bold text-stone-800">
                    {selectedPedido.cantidad}
                  </p>
                  <p className="text-xs text-stone-400">Unidades</p>
                </div>
                <div className="bg-white rounded-xl p-3 ring-1 ring-stone-100">
                  <p className="text-sm font-bold text-stone-800">
                    {formatQ(selectedPedido.precioUnitario)}
                  </p>
                  <p className="text-xs text-stone-400">Precio/u</p>
                </div>
                <div className="bg-white rounded-xl p-3 ring-1 ring-stone-100">
                  <p className="text-sm font-bold text-emerald-700">
                    {formatQ(selectedPedido.total)}
                  </p>
                  <p className="text-xs text-stone-400">Total</p>
                </div>
              </div>
              {selectedPedido.notas && (
                <p className="text-xs text-stone-500 italic">
                  {selectedPedido.notas}
                </p>
              )}
            </div>

            <Field label="Cambiar Estado">
              <select
                value={nuevoEstado}
                onChange={(e) =>
                  setNuevoEstado(e.target.value as EstadoPedido)
                }
                className={inputCls}
              >
                {ESTADOS_PEDIDO.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </Field>

            <div className="flex justify-end gap-2 pt-4">
              <Link
                href={`/dashboard/ventas/orden-envio/${selectedPedido.id}`}
                target="_blank"
                className="mr-auto inline-flex items-center gap-1.5 px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-xl font-semibold transition-colors"
              >
                <Printer className="w-4 h-4" /> Orden de Envío
              </Link>
              
              <button
                onClick={() => setSelectedPedido(null)}
                className="px-4 py-2 text-sm text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl font-semibold transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={handleUpdateEstado}
                disabled={saving || nuevoEstado === selectedPedido.estado}
                className="px-5 py-2 text-sm text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-colors"
              >
                {saving ? "Guardando..." : "Guardar Estado"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Faltantes modal */}
      {showFaltantesModal && (
        <Modal
          title="Producción Bloqueada por Faltantes"
          onClose={() => setShowFaltantesModal(false)}
        >
          <div className="space-y-4">
            <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 ring-1 ring-red-200">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Inventario Insuficiente</p>
                <p className="text-sm mt-1">Para enviar a producción {selectedPedido?.cantidad} unidad(es) de {selectedPedido?.modelo}, faltan los siguientes insumos en el inventario de bodega:</p>
              </div>
            </div>
            
            <div className="bg-white ring-1 ring-stone-200 rounded-xl overflow-hidden text-sm">
              <table className="w-full text-left">
                <thead className="bg-stone-50 text-stone-500">
                  <tr>
                    <th className="p-3 font-semibold">Material</th>
                    <th className="p-3 font-semibold text-center">Requerido</th>
                    <th className="p-3 font-semibold text-center">Faltante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {faltantesParaProducir.map(f => (
                    <tr key={f.materialId}>
                      <td className="p-3 font-medium text-stone-800">{f.nombre}</td>
                      <td className="p-3 text-center text-stone-600">{f.requerido.toFixed(2)}</td>
                      <td className="p-3 text-center text-red-600 font-bold">{(f.requerido - f.actual).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={() => setShowFaltantesModal(false)}
                className="px-4 py-2 text-sm text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl font-semibold transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={handleGenerarOrdenFaltantes}
                disabled={saving}
                className="px-5 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-xl font-semibold transition-colors disabled:opacity-50"
              >
                {saving ? "Generando..." : "Generar O.C."}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* New Pedido modal */}
      {showNewModal && (
        <Modal
          title="Nuevo Pedido"
          onClose={() => {
            resetForm();
            setShowNewModal(false);
          }}
        >
          <div className="space-y-4">
            <Field label="Cliente *">
              <select
                value={form.clienteId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, clienteId: e.target.value }))
                }
                className={inputCls}
              >
                <option value="">Seleccionar cliente...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Modelo *">
              <select
                value={form.modelo}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    modelo: e.target.value as Modelo | "",
                  }))
                }
                className={inputCls}
              >
                <option value="">Seleccionar modelo...</option>
                {MODELOS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Cantidad *">
                <input
                  type="number"
                  min={1}
                  placeholder="0"
                  value={form.cantidad}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cantidad: e.target.value }))
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Precio Unitario (Q) *">
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={form.precioUnitario}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      precioUnitario: e.target.value,
                    }))
                  }
                  className={inputCls}
                />
              </Field>
            </div>

            {/* Auto-calculated total */}
            {form.cantidad && form.precioUnitario && (
              <div className="flex items-center justify-between bg-emerald-50 rounded-xl px-4 py-3 ring-1 ring-emerald-200">
                <span className="text-sm text-emerald-700 font-semibold">
                  Total calculado
                </span>
                <span className="text-base font-bold text-emerald-800">
                  {formatQ(
                    parseFloat(form.precioUnitario || "0") *
                      parseInt(form.cantidad || "0", 10)
                  )}
                </span>
              </div>
            )}

            <Field label="Estado Inicial">
              <select
                value={form.estado}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    estado: e.target.value as EstadoPedido,
                  }))
                }
                className={inputCls}
              >
                {ESTADOS_PEDIDO.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Notas (opcional)">
              <textarea
                rows={3}
                placeholder="Información adicional sobre el pedido..."
                value={form.notas}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notas: e.target.value }))
                }
                className={`${inputCls} resize-none`}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  resetForm();
                  setShowNewModal(false);
                }}
                className="px-4 py-2 text-sm text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddPedido}
                disabled={
                  saving ||
                  !form.clienteId ||
                  !form.modelo ||
                  !form.cantidad ||
                  !form.precioUnitario
                }
                className="px-5 py-2 text-sm text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-colors"
              >
                {saving ? "Guardando..." : "Crear Pedido"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════
   TAB 3: PLANIFICACIÓN DE ENVÍOS
═════════════════════════════════════════════ */
function TabEnvios() {
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedEnvio, setSelectedEnvio] = useState<Envio | null>(null);
  const [nuevoEstadoEnvio, setNuevoEstadoEnvio] =
    useState<EstadoEnvio>("Pendiente");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    fecha: "",
    hora: "",
    destino: "",
    vehiculo: VEHICULOS[0] as string,
    resumenPedidos: "",
    colaboradores: "",
    notas: "",
  });

  useEffect(() => {
    const q = query(collection(db, "envios"), orderBy("fecha", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setEnvios(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Envio, "id">),
        }))
      );
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const today = new Date().toISOString().split("T")[0];
  const upcoming = envios
    .filter((e) => e.fecha >= today)
    .sort(
      (a, b) =>
        a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora)
    );
  const past = envios
    .filter((e) => e.fecha < today)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  function resetForm() {
    setForm({
      fecha: "",
      hora: "",
      destino: "",
      vehiculo: VEHICULOS[0],
      resumenPedidos: "",
      colaboradores: "",
      notas: "",
    });
  }

  async function handleAddEnvio() {
    if (!form.fecha || !form.destino || !form.vehiculo) return;
    setSaving(true);
    try {
      const colaboradoresArr = form.colaboradores
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await addDoc(collection(db, "envios"), {
        fecha: form.fecha,
        hora: form.hora,
        destino: form.destino.trim(),
        vehiculo: form.vehiculo,
        resumenPedidos: form.resumenPedidos.trim(),
        colaboradores: colaboradoresArr,
        notas: form.notas.trim(),
        estado: "Pendiente" as EstadoEnvio,
        pedidoIds: [],
        creadoEn: serverTimestamp(),
      });
      resetForm();
      setShowNewModal(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateEstadoEnvio() {
    if (!selectedEnvio) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "envios", selectedEnvio.id), {
        estado: nuevoEstadoEnvio,
      });
      setSelectedEnvio(null);
    } finally {
      setSaving(false);
    }
  }

  function formatFecha(f: string) {
    try {
      return new Date(f + "T12:00:00").toLocaleDateString("es-GT", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return f;
    }
  }

  function EnvioCard({ envio }: { envio: Envio }) {
    const estCls =
      estadoEnvioColor[envio.estado] ??
      "bg-stone-100 text-stone-600 ring-stone-200";
    return (
      <button
        onClick={() => {
          setSelectedEnvio(envio);
          setNuevoEstadoEnvio(envio.estado);
        }}
        className="w-full text-left bg-white hover:bg-stone-50 border border-stone-200/60 rounded-2xl p-5 transition-colors shadow-sm space-y-3 group"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-sm font-bold text-stone-900 capitalize">
              {formatFecha(envio.fecha)}
            </p>
            {envio.hora && (
              <p className="text-xs text-stone-500">{envio.hora} hrs</p>
            )}
          </div>
          <span
            className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ring-1 flex-shrink-0 ${estCls}`}
          >
            {envio.estado}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600">
          <span className="flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-stone-400" />
            {envio.vehiculo}
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarRange className="w-3.5 h-3.5 text-stone-400" />
            {envio.destino}
          </span>
        </div>

        {envio.resumenPedidos && (
          <p className="text-xs text-stone-500 italic leading-relaxed line-clamp-2">
            {envio.resumenPedidos}
          </p>
        )}

        {envio.colaboradores && envio.colaboradores.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {envio.colaboradores.map((col, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-stone-100 text-stone-600 text-xs rounded-lg ring-1 ring-stone-200"
              >
                {col}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1 text-xs text-stone-400 group-hover:text-stone-600 transition-colors">
          <ChevronDown className="w-3 h-3" />
          Clic para cambiar estado
        </div>
      </button>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white rounded-2xl border border-stone-200/60 p-4 shadow-sm gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-blue-50 rounded-xl">
            <Truck className="w-5 h-5 text-blue-700" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-bold text-stone-900 tracking-tight">
              Planificación de Envíos
            </p>
            <p className="text-xs text-stone-500">
              {upcoming.length} próximos · {past.length} anteriores
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Planificar Envío
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-stone-200/60 p-5 animate-pulse space-y-3"
            >
              <div className="flex justify-between">
                <div className="h-4 w-48 bg-stone-100 rounded" />
                <div className="h-5 w-20 bg-stone-100 rounded-lg" />
              </div>
              <div className="h-3 w-32 bg-stone-100 rounded" />
              <div className="h-3 w-56 bg-stone-50 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Upcoming */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-stone-500 uppercase tracking-widest px-1">
              📅 Próximos Envíos ({upcoming.length})
            </h3>
            {upcoming.length === 0 ? (
              <div className="bg-white rounded-2xl border border-stone-200/60 p-8 text-center">
                <p className="text-sm text-stone-400">
                  No hay envíos planificados próximamente.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {upcoming.map((e) => (
                  <EnvioCard key={e.id} envio={e} />
                ))}
              </div>
            )}
          </section>

          {/* Past */}
          {past.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">
                🕐 Envíos Anteriores ({past.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 opacity-75">
                {past.map((e) => (
                  <EnvioCard key={e.id} envio={e} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Envio detail / change estado modal */}
      {selectedEnvio && (
        <Modal
          title="Detalle del Envío"
          onClose={() => setSelectedEnvio(null)}
        >
          <div className="space-y-5">
            <div className="bg-stone-50 rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-stone-900 capitalize">
                    {formatFecha(selectedEnvio.fecha)}
                  </p>
                  {selectedEnvio.hora && (
                    <p className="text-xs text-stone-500">
                      {selectedEnvio.hora} hrs
                    </p>
                  )}
                </div>
                <span
                  className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ring-1 ${estadoEnvioColor[selectedEnvio.estado]}`}
                >
                  {selectedEnvio.estado}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-stone-400 mb-0.5">Destino</p>
                  <p className="font-medium text-stone-700">
                    {selectedEnvio.destino}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 mb-0.5">Vehículo</p>
                  <p className="font-medium text-stone-700">
                    {selectedEnvio.vehiculo}
                  </p>
                </div>
              </div>
              {selectedEnvio.resumenPedidos && (
                <div>
                  <p className="text-xs text-stone-400 mb-0.5">
                    Resumen de Pedidos
                  </p>
                  <p className="text-sm text-stone-600">
                    {selectedEnvio.resumenPedidos}
                  </p>
                </div>
              )}
              {selectedEnvio.colaboradores?.length > 0 && (
                <div>
                  <p className="text-xs text-stone-400 mb-1">Colaboradores</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedEnvio.colaboradores.map((col, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-stone-200 text-stone-600 text-xs rounded-lg"
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selectedEnvio.notas && (
                <p className="text-xs text-stone-500 italic">
                  {selectedEnvio.notas}
                </p>
              )}
            </div>

            <Field label="Cambiar Estado">
              <select
                value={nuevoEstadoEnvio}
                onChange={(e) =>
                  setNuevoEstadoEnvio(e.target.value as EstadoEnvio)
                }
                className={inputCls}
              >
                {(["Pendiente", "En Ruta", "Entregado"] as EstadoEnvio[]).map(
                  (e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  )
                )}
              </select>
            </Field>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setSelectedEnvio(null)}
                className="px-4 py-2 text-sm text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl font-semibold transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={handleUpdateEstadoEnvio}
                disabled={
                  saving || nuevoEstadoEnvio === selectedEnvio.estado
                }
                className="px-5 py-2 text-sm text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-colors"
              >
                {saving ? "Guardando..." : "Guardar Estado"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* New Envio modal */}
      {showNewModal && (
        <Modal
          title="Planificar Envío"
          onClose={() => {
            resetForm();
            setShowNewModal(false);
          }}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fecha *">
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, fecha: e.target.value }))
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Hora">
                <input
                  type="time"
                  value={form.hora}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, hora: e.target.value }))
                  }
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Destino *">
              <input
                type="text"
                placeholder="Comunidad / Municipio / Departamento"
                value={form.destino}
                onChange={(e) =>
                  setForm((f) => ({ ...f, destino: e.target.value }))
                }
                className={inputCls}
              />
            </Field>

            <Field label="Vehículo *">
              <select
                value={form.vehiculo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, vehiculo: e.target.value }))
                }
                className={inputCls}
              >
                {VEHICULOS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Resumen de Pedidos">
              <input
                type="text"
                placeholder="Ej. 5 Ecocinas + 3 Ecoplanchas para comunidad X"
                value={form.resumenPedidos}
                onChange={(e) =>
                  setForm((f) => ({ ...f, resumenPedidos: e.target.value }))
                }
                className={inputCls}
              />
            </Field>

            <Field label="Colaboradores (separados por coma)">
              <input
                type="text"
                placeholder="Ej. Juan López, María García"
                value={form.colaboradores}
                onChange={(e) =>
                  setForm((f) => ({ ...f, colaboradores: e.target.value }))
                }
                className={inputCls}
              />
            </Field>

            <Field label="Notas (opcional)">
              <textarea
                rows={3}
                placeholder="Instrucciones especiales, puntos de referencia, etc."
                value={form.notas}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notas: e.target.value }))
                }
                className={`${inputCls} resize-none`}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  resetForm();
                  setShowNewModal(false);
                }}
                className="px-4 py-2 text-sm text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddEnvio}
                disabled={
                  saving || !form.fecha || !form.destino || !form.vehiculo
                }
                className="px-5 py-2 text-sm text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-colors"
              >
                {saving ? "Guardando..." : "Crear Envío"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
