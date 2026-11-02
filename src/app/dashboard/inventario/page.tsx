"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { Package, Truck, Plus, Trash2, Printer, Save, CheckCircle, Database, AlertTriangle } from "lucide-react";
import type { Material, Proveedor, OrdenCompra, OrdenItem } from "@/types";
import TabRecetas from "./TabRecetas";
import MovimientoMaterialModal from "@/features/inventory/components/MovimientoMaterialModal";
import HistorialMovimientos from "@/features/inventory/components/HistorialMovimientos";
import AsistenteInventario from "@/features/agente/components/AsistenteInventario";
import type { TipoMovimiento } from "@/features/inventory/domain/movimientos";

type TabView = "inventario" | "movimientos" | "catalogo" | "pedidos" | "recetas";

export default function InventarioPage() {
  const { sesion } = useAuth();
  const [activeTab, setActiveTab] = useState<TabView>("inventario");
  
  // Data
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);

  // Form States - Proveedor
  const [nuevoProv, setNuevoProv] = useState({ nombre: "", colorEtiqueta: "#3b82f6" });
  // Form States - Material
  const [nuevoMat, setNuevoMat] = useState({ nombre: "", unidadMedida: "Unidad", precioEstimado: 0, proveedorDefectoId: "" });
  
  // Form States - Nueva Orden de Compra
  const [nuevaOrden, setNuevaOrden] = useState<OrdenItem[]>([]);

  // Modal de movimiento de stock
  const [movimiento, setMovimiento] = useState<{ materialId: string; tipo: TipoMovimiento } | null>(null);
  
  const tieneAcceso = sesion && ["Gerente", "Subgerente", "Supervisor"].includes(sesion.rol);

  useEffect(() => {
    if (!tieneAcceso) return;

    const unSubProv = onSnapshot(collection(db, "proveedores"), (snap) => {
      setProveedores(snap.docs.map(d => ({ id: d.id, ...d.data() } as Proveedor)));
    });

    const unSubMat = onSnapshot(collection(db, "materiales"), (snap) => {
      setMateriales(snap.docs.map(d => ({ id: d.id, ...d.data() } as Material)));
    });

    const unSubOrd = onSnapshot(collection(db, "ordenes_compra"), (snap) => {
      // Mantiene activa la suscripción para reflejar futuras órdenes.
      void snap.docs.map(d => ({ id: d.id, ...d.data() } as OrdenCompra));
    });

    return () => {
      unSubProv();
      unSubMat();
      unSubOrd();
    };
  }, [tieneAcceso]);

  if (!tieneAcceso) {
    return <div className="p-8 text-center text-slate-500">No tienes permisos para ver el Inventario.</div>;
  }

  // ---- Funciones CRUD Catálogo ----
  const handleAddProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoProv.nombre) return;
    await addDoc(collection(db, "proveedores"), nuevoProv);
    setNuevoProv({ nombre: "", colorEtiqueta: "#3b82f6" });
  };

  const handleDeleteProveedor = async (id: string) => {
    if(confirm("¿Eliminar proveedor?")) await deleteDoc(doc(db, "proveedores", id));
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoMat.nombre) return;
    await addDoc(collection(db, "materiales"), {
      ...nuevoMat,
      stockActual: 0,
      puntoReorden: 10
    });
    setNuevoMat({ nombre: "", unidadMedida: "Unidad", precioEstimado: 0, proveedorDefectoId: "" });
  };

  const handleDeleteMaterial = async (id: string) => {
    if(confirm("¿Eliminar material?")) await deleteDoc(doc(db, "materiales", id));
  };

  const handleUpdatePuntoReorden = async (id: string, nuevoPunto: number) => {
    if (nuevoPunto < 0) return;
    await updateDoc(doc(db, "materiales", id), { puntoReorden: nuevoPunto });
  };

  // ---- Funciones Órdenes de Compra ----
  const handleAddToOrder = (materialId: string) => {
    const mat = materiales.find(m => m.id === materialId);
    if (!mat) return;
    setNuevaOrden([...nuevaOrden, {
      materialId: mat.id,
      materialNombre: mat.nombre,
      cantidad: 1,
      precioUnitario: mat.precioEstimado,
      subtotal: mat.precioEstimado,
      proveedorId: mat.proveedorDefectoId || "",
      pendiente: 0
    }]);
  };

  const updateOrderItem = <K extends keyof OrdenItem>(index: number, field: K, value: OrdenItem[K]) => {
    const arr = [...nuevaOrden];
    arr[index] = { ...arr[index], [field]: value };
    // Recalcular subtotal si cambia precio o cantidad
    if (field === "cantidad" || field === "precioUnitario") {
      arr[index].subtotal = Number(arr[index].cantidad) * Number(arr[index].precioUnitario);
    }
    setNuevaOrden(arr);
  };

  const removeOrderItem = (index: number) => {
    setNuevaOrden(nuevaOrden.filter((_, i) => i !== index));
  };

  const granTotal = nuevaOrden.reduce((acc, item) => acc + item.subtotal, 0);

  const handleSaveOrder = async () => {
    if (nuevaOrden.length === 0) return;
    try {
      const hoy = new Date().toISOString().split("T")[0];
      await addDoc(collection(db, "ordenes_compra"), {
        fecha: hoy,
        creadoPor: sesion.uid,
        items: nuevaOrden,
        totalOrden: granTotal,
        estado: "Pendiente",
      });
      setNuevaOrden([]);
      alert("Pedido guardado con éxito.");
    } catch (error) {
      console.error(error);
      alert("Error al guardar pedido.");
    }
  };

  const printOrder = () => {
    window.print();
  };

  // Carga inicial (Seed) de materiales basándonos en la imagen del usuario
  const seedDatosIniciales = async () => {
    if (!confirm("¿Deseas cargar los materiales y proveedores base de Ecocomal? Esto agregará los datos de la lista oficial.")) return;
    
    // Proveedores comunes del excel
    const provs = [
      { nombre: "El Mastil", colorEtiqueta: "#000000" }, // Negro
      { nombre: "FERROMAX", colorEtiqueta: "#3b82f6" },  // Azul
      { nombre: "ACUARIO", colorEtiqueta: "#ef4444" },   // Rojo
      { nombre: "LA COLONIAL", colorEtiqueta: "#eab308" }, // Amarillo
      { nombre: "FERROMADERA", colorEtiqueta: "#22c55e" }, // Verde
      { nombre: "El Alfarero", colorEtiqueta: "#94a3b8" }  // Gris
    ];

    const creados: { id: string; nombre: string; colorEtiqueta: string }[] = [];
    for (const p of provs) {
      const d = await addDoc(collection(db, "proveedores"), p);
      creados.push({ id: d.id, ...p });
    }

    const getId = (n: string) => creados.find(c => c.nombre === n)?.id || "";

    const mats = [
      { n: "Lámina de 1/8 4x8", p: getId("El Mastil"), u: "Unidad", pre: 609.00 },
      { n: "Lámina de 1/16 4x8", p: getId("El Mastil"), u: "Unidad", pre: 284.00 },
      { n: "Lámina de aluzinc 3x8", p: getId("El Mastil"), u: "Unidad", pre: 98.00 },
      { n: "Lámina de 1mm 4x8", p: getId("El Mastil"), u: "Unidad", pre: 201.14 },
      { n: "Plana de 2 x 1/8", p: getId("FERROMAX"), u: "Unidad", pre: 60.05 },
      { n: "Tubo 2x6", p: getId("FERROMAX"), u: "Unidad", pre: 290.20 },
      { n: "Varilla de 1/4", p: getId("FERROMAX"), u: "Unidad", pre: 7.00 },
      { n: "Angular de 3/4 x 1/8", p: getId("El Mastil"), u: "Unidad", pre: 48.60 },
      { n: "Plana de 1/2 x 1/8", p: getId("El Mastil"), u: "Unidad", pre: 17.80 },
      { n: "Tubo 1 1/2 Ch18", p: getId("ACUARIO"), u: "Unidad", pre: 84.90 },
      { n: "Cemento Estructural", p: getId("ACUARIO"), u: "Saco", pre: 85.00 },
      { n: "Cemento cantera", p: getId("ACUARIO"), u: "Saco", pre: 75.00 },
      { n: "Cal Horcalsa", p: getId("ACUARIO"), u: "Saco", pre: 36.00 },
      { n: "Azulejo decorado", p: getId("ACUARIO"), u: "Caja", pre: 122.00 },
      { n: "Azulejo liso", p: getId("ACUARIO"), u: "Caja", pre: 122.00 },
      { n: "Cedazo Arenero de 1/2", p: getId("ACUARIO"), u: "Rollo", pre: 306.24 },
      { n: "Pintura R15 CELCO", p: getId("ACUARIO"), u: "Cubeta", pre: 159.00 },
      { n: "Sierras Sanflex", p: getId("ACUARIO"), u: "Unidad", pre: 8.68 },
      { n: "Thiner", p: getId("LA COLONIAL"), u: "Galón", pre: 55.00 },
      { n: "Disco laminado Grano80", p: getId("LA COLONIAL"), u: "Unidad", pre: 12.00 },
      { n: "Disco de diamante", p: getId("LA COLONIAL"), u: "Unidad", pre: 25.00 },
      { n: "Lija de lona No. 80", p: getId("LA COLONIAL"), u: "Unidad", pre: 6.00 },
      { n: "Disco de pulir 5''", p: getId("El Mastil"), u: "Unidad", pre: 21.56 },
      { n: "Disco de corte de 14", p: getId("El Mastil"), u: "Unidad", pre: 45.00 },
      { n: "Alambre jardinero", p: getId("El Mastil"), u: "Rollo", pre: 10.58 },
      { n: "Remaches 5/32 x 3/8", p: getId("FERROMADERA"), u: "Caja", pre: 0.10 },
      { n: "Fachaleta", p: getId("El Alfarero"), u: "Unidad", pre: 1.20 }
    ];

    for(const m of mats) {
      await addDoc(collection(db, "materiales"), {
        nombre: m.n,
        unidadMedida: m.u,
        precioEstimado: m.pre,
        proveedorDefectoId: m.p,
        stockActual: 0,
        puntoReorden: 10
      });
    }

    alert("Catálogo base inicializado exitosamente.");
  };

  return (
    <div className="space-y-6">
      {/* Header Print-Hidden */}
      <header className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center ring-1 ring-indigo-100">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Inventario y Compras</h1>
            <p className="text-sm text-slate-500">Catálogo de BOM y Pedidos a Proveedores</p>
          </div>
        </div>

        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("inventario")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === "inventario" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Inventario
          </button>
          <button
            onClick={() => setActiveTab("movimientos")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === "movimientos" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Movimientos
          </button>
          <button
            onClick={() => setActiveTab("catalogo")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === "catalogo" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Catálogo Base
          </button>
          <button
            onClick={() => setActiveTab("pedidos")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === "pedidos" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Hacer Pedido
          </button>
          <button
            onClick={() => setActiveTab("recetas")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === "recetas" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Recetas (BOM)
          </button>
        </div>
      </header>

      {/* TABS */}
      {activeTab === "inventario" && (
        <div className="bg-white rounded-3xl shadow-sm ring-1 ring-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-500" /> Control de Existencias (Stock)
            </h2>
          </div>
          
          <div className="overflow-x-auto ring-1 ring-slate-200 rounded-xl">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Material</th>
                  <th className="px-4 py-3 font-bold">Unidad</th>
                  <th className="px-4 py-3 font-bold text-center">Stock Actual</th>
                  <th className="px-4 py-3 font-bold text-center">Punto de Reorden</th>
                  <th className="px-4 py-3 font-bold text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {materiales.map(m => {
                  const stock = m.stockActual || 0;
                  const reorden = m.puntoReorden || 0;
                  const bajoReorden = stock <= reorden;

                  return (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{m.nombre}</td>
                      <td className="px-4 py-3 text-slate-500">{m.unidadMedida}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => setMovimiento({ materialId: m.id, tipo: "salida" })} title="Registrar salida" className="w-6 h-6 rounded bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-300 font-bold">-</button>
                          <span className={`w-12 text-center font-mono font-bold text-base ${bajoReorden ? 'text-red-600' : 'text-slate-700'}`}>{stock}</span>
                          <button onClick={() => setMovimiento({ materialId: m.id, tipo: "entrada" })} title="Registrar entrada" className="w-6 h-6 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center hover:bg-indigo-200 font-bold">+</button>
                          <button onClick={() => setMovimiento({ materialId: m.id, tipo: "ajuste" })} title="Ajustar por conteo físico" className="ml-1 text-xs font-bold text-amber-600 hover:text-amber-700">Ajustar</button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <input type="number" min="0" value={reorden} onChange={(e) => handleUpdatePuntoReorden(m.id, parseInt(e.target.value) || 0)} className="w-16 p-1 text-center text-sm border-slate-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {bajoReorden ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-md ring-1 ring-red-200">
                            <AlertTriangle className="w-3 h-3" /> Pedir ya
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-md ring-1 ring-emerald-200">
                            <CheckCircle className="w-3 h-3" /> OK
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {materiales.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No hay materiales registrados. Ve a &quot;Catálogo Base&quot; para agregarlos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "movimientos" && <HistorialMovimientos />}

      {activeTab === "catalogo" && (
        <div className="print:hidden grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Col 1: Proveedores */}
          <div className="bg-white rounded-3xl shadow-sm ring-1 ring-slate-200 p-6 flex flex-col h-[500px]">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-indigo-500" /> Proveedores
            </h2>
            <form onSubmit={handleAddProveedor} className="flex gap-2 mb-4">
              <input type="color" value={nuevoProv.colorEtiqueta} onChange={e => setNuevoProv({...nuevoProv, colorEtiqueta: e.target.value})} className="w-10 h-10 rounded cursor-pointer" title="Color Etiqueta" />
              <input type="text" placeholder="Nombre Proveedor..." value={nuevoProv.nombre} onChange={e => setNuevoProv({...nuevoProv, nombre: e.target.value})} className="flex-1 rounded-xl border-slate-200 text-sm focus:ring-indigo-500 focus:border-indigo-500" required />
              <button type="submit" className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700"><Plus className="w-5 h-5"/></button>
            </form>
            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
              {proveedores.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl ring-1 ring-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: p.colorEtiqueta }}></div>
                    <span className="text-sm font-bold text-slate-700">{p.nombre}</span>
                  </div>
                  <button onClick={() => handleDeleteProveedor(p.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
            </div>
          </div>

          {/* Col 2 y 3: Materiales */}
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm ring-1 ring-slate-200 p-6 flex flex-col h-[500px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-500" /> Catálogo de Materiales
              </h2>
              {materiales.length === 0 && (
                <button onClick={seedDatosIniciales} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100">Cargar Catálogo Base</button>
              )}
            </div>
            
            <form onSubmit={handleAddMaterial} className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4 bg-slate-50 p-3 rounded-2xl ring-1 ring-slate-100">
              <input type="text" placeholder="Material (ej. Tubo 2x6)..." value={nuevoMat.nombre} onChange={e => setNuevoMat({...nuevoMat, nombre: e.target.value})} className="col-span-2 rounded-xl border-slate-200 text-sm focus:ring-indigo-500 focus:border-indigo-500" required />
              <select value={nuevoMat.proveedorDefectoId} onChange={e => setNuevoMat({...nuevoMat, proveedorDefectoId: e.target.value})} className="rounded-xl border-slate-200 text-sm focus:ring-indigo-500 focus:border-indigo-500">
                <option value="">Proveedor...</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <input type="number" step="0.01" placeholder="Precio Est." value={nuevoMat.precioEstimado || ""} onChange={e => setNuevoMat({...nuevoMat, precioEstimado: parseFloat(e.target.value)})} className="rounded-xl border-slate-200 text-sm focus:ring-indigo-500 focus:border-indigo-500" required />
              <button type="submit" className="bg-emerald-600 text-white p-2 rounded-xl hover:bg-emerald-700 flex items-center justify-center"><Plus className="w-5 h-5"/></button>
            </form>

            <div className="flex-1 overflow-y-auto custom-scrollbar ring-1 ring-slate-200 rounded-xl">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-100 text-xs uppercase text-slate-500 sticky top-0 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 font-bold">Material</th>
                    <th className="px-4 py-3 font-bold">Proveedor</th>
                    <th className="px-4 py-3 font-bold">Precio Est.</th>
                    <th className="px-4 py-3 font-bold text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {materiales.map(m => {
                    const prov = proveedores.find(p => p.id === m.proveedorDefectoId);
                    return (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{m.nombre}</td>
                        <td className="px-4 py-3">
                          {prov ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold text-white" style={{ backgroundColor: prov.colorEtiqueta }}>
                              {prov.nombre}
                            </span>
                          ) : <span className="text-slate-400 text-xs">Sin asignar</span>}
                        </td>
                        <td className="px-4 py-3 font-mono">Q{m.precioEstimado.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => handleDeleteMaterial(m.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4 mx-auto"/></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "pedidos" && (
        <div className="bg-white rounded-3xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
          {/* Tools Print Hidden */}
          <div className="print:hidden p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row items-center gap-4 justify-between">
            <div className="flex items-center gap-2">
              <select onChange={(e) => handleAddToOrder(e.target.value)} value="" className="rounded-xl border-slate-300 text-sm font-medium w-64 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm">
                <option value="" disabled>+ Agregar Material al Pedido</option>
                {materiales.map(m => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={printOrder} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors shadow-sm">
                <Printer className="w-4 h-4" /> Imprimir Hoja
              </button>
              <button onClick={handleSaveOrder} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm">
                <Save className="w-4 h-4" /> Guardar Pedido
              </button>
            </div>
          </div>

          {/* Área de Impresión estilo Excel */}
          <div className="p-8 print:p-0 overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Encabezado Excel */}
              <div className="flex justify-end mb-4">
                 <div className="text-right border-2 border-slate-800 p-2 bg-blue-500 text-white font-bold w-64">
                   <p className="text-xs">Orden de Compra / Materiales</p>
                   <p className="text-xl">Ecocomal</p>
                 </div>
              </div>

              {/* Tabla Excel */}
              <table className="w-full border-collapse border-2 border-slate-800 text-sm font-medium">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-800 p-2 text-left w-1/3">Material</th>
                    <th className="border border-slate-800 p-2 w-24">Cantidad</th>
                    <th className="border border-slate-800 p-2">Proveedor</th>
                    <th className="border border-slate-800 p-2 w-24">Pendiente</th>
                    <th className="border border-slate-800 p-2 w-32">Precio Uni</th>
                    <th className="border border-slate-800 p-2 w-32">Total</th>
                    <th className="border border-slate-800 p-2 w-10 print:hidden text-center">X</th>
                  </tr>
                </thead>
                <tbody>
                  {nuevaOrden.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">Agrega materiales desde el selector de arriba para comenzar tu pedido.</td>
                    </tr>
                  ) : (
                    nuevaOrden.map((item, idx) => {
                      const prov = proveedores.find(p => p.id === item.proveedorId);
                      const textColor = prov?.colorEtiqueta === '#000000' || prov?.colorEtiqueta === '#3b82f6' || prov?.colorEtiqueta === '#ef4444' ? 'text-white' : 'text-slate-900';
                      
                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="border border-slate-800 p-0">
                            <input type="text" value={item.materialNombre} readOnly className="w-full p-2 border-0 bg-transparent text-sm focus:ring-0" />
                          </td>
                          <td className="border border-slate-800 p-0">
                            <input type="number" min="1" value={item.cantidad || ""} onChange={e => updateOrderItem(idx, "cantidad", parseFloat(e.target.value) || 0)} className="w-full p-2 border-0 bg-transparent text-sm text-center font-bold text-indigo-700 focus:ring-0 bg-indigo-50/50" />
                          </td>
                          <td className="border border-slate-800 p-0" style={{ backgroundColor: prov?.colorEtiqueta || '#f8fafc' }}>
                            <select value={item.proveedorId} onChange={e => updateOrderItem(idx, "proveedorId", e.target.value)} className={`w-full p-2 border-0 bg-transparent text-sm font-bold text-center focus:ring-0 cursor-pointer ${textColor}`}>
                              <option value="" className="text-slate-900">N/A</option>
                              {proveedores.map(p => <option key={p.id} value={p.id} className="text-slate-900 bg-white">{p.nombre}</option>)}
                            </select>
                          </td>
                          <td className="border border-slate-800 p-0">
                            <input type="number" value={item.pendiente || ""} onChange={e => updateOrderItem(idx, "pendiente", parseFloat(e.target.value) || 0)} className="w-full p-2 border-0 bg-transparent text-sm text-center focus:ring-0" />
                          </td>
                          <td className="border border-slate-800 p-0">
                            <div className="flex items-center px-2">
                              <span className="text-slate-400">Q</span>
                              <input type="number" step="0.01" value={item.precioUnitario || ""} onChange={e => updateOrderItem(idx, "precioUnitario", parseFloat(e.target.value) || 0)} className="w-full p-2 border-0 bg-transparent text-sm text-right focus:ring-0" />
                            </div>
                          </td>
                          <td className="border border-slate-800 p-2 text-right bg-slate-50 font-mono text-slate-700">
                            {item.subtotal > 0 ? `Q ${item.subtotal.toFixed(2)}` : "-"}
                          </td>
                          <td className="border border-slate-800 p-0 print:hidden text-center">
                            <button onClick={() => removeOrderItem(idx)} className="text-slate-300 hover:text-red-500 transition-colors p-2"><Trash2 className="w-4 h-4 mx-auto" /></button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                  {/* Fila Total */}
                  <tr className="bg-slate-100 font-bold text-slate-800">
                    <td colSpan={5} className="border border-slate-800 p-2 text-right uppercase text-xs">Total</td>
                    <td className="border border-slate-800 p-2 text-right font-mono text-lg text-emerald-700">
                      Q {granTotal.toFixed(2)}
                    </td>
                    <td className="border border-slate-800 print:hidden bg-slate-100"></td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-8 print:hidden text-center text-xs text-slate-400">
                La vista impresa (PDF) ocultará los botones y menús, mostrando únicamente la tabla con colores.
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "recetas" && (
        <TabRecetas materiales={materiales} />
      )}

      <AsistenteInventario />

      {movimiento && (() => {
        const material = materiales.find(m => m.id === movimiento.materialId);
        if (!material) return null;
        return (
          <MovimientoMaterialModal
            key={`${material.id}-${movimiento.tipo}`}
            material={material}
            tipoInicial={movimiento.tipo}
            usuario={{ uid: sesion.uid, nombre: sesion.nombre }}
            onClose={() => setMovimiento(null)}
          />
        );
      })()}
    </div>
  );
}
