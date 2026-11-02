"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import type { Pedido, Cliente } from "@/types";
import { ArrowLeft, Printer, Scissors, Home } from "lucide-react";

const PIEZAS_POR_MODELO: Record<string, { nombre: string; cantidad: number }[]> = {
  "Ecoplancha Híbrida": [
    { nombre: "Plataforma 14'", cantidad: 1 },
    { nombre: "Caja cuadrada rellena", cantidad: 1 },
    { nombre: "Porta cenicero", cantidad: 1 },
    { nombre: "Sifones", cantidad: 1 },
    { nombre: "Plancha de 3 hornillas", cantidad: 1 },
    { nombre: "Ganchos", cantidad: 1 },
    { nombre: "Abrazaderas", cantidad: 1 },
    { nombre: "Protectores", cantidad: 1 },
    { nombre: "Sombreros", cantidad: 1 },
    { nombre: "Tubos 2", cantidad: 2 },
    { nombre: "Mesa de metal", cantidad: 1 },
  ],
  "EcoPlancha Superior": [
    { nombre: "Plataforma 14' SUPERIOR", cantidad: 1 },
    { nombre: "Caja cuadrada rellena", cantidad: 1 },
    { nombre: "Alas de concreto", cantidad: 1 },
    { nombre: "Cámara de combustión", cantidad: 1 },
    { nombre: "Porta cenicero", cantidad: 1 },
    { nombre: "Sifones", cantidad: 1 },
    { nombre: "Plancha de 3 hornillas", cantidad: 1 },
    { nombre: "Ganchos", cantidad: 1 },
    { nombre: "Abrazaderas", cantidad: 1 },
    { nombre: "Protectores", cantidad: 1 },
    { nombre: "Codos", cantidad: 1 },
    { nombre: "Sombreros", cantidad: 1 },
    { nombre: "Tubos", cantidad: 2 },
    { nombre: "Mesa de metal", cantidad: 1 },
  ],
  "Ecocomal": [
    { nombre: "Cámara de combustión", cantidad: 1 },
    { nombre: "Estante", cantidad: 1 },
    { nombre: "Arena Poma", cantidad: 1 },
    { nombre: "Canal", cantidad: 1 },
    { nombre: "Plancha redonda", cantidad: 1 },
    { nombre: "Ganchos", cantidad: 1 },
    { nombre: "Abrazaderas", cantidad: 1 },
    { nombre: "Protectores", cantidad: 1 },
    { nombre: "Codos", cantidad: 0 },
    { nombre: "Sombreros", cantidad: 1 },
    { nombre: "Tubos", cantidad: 2 },
  ],
  "Ecocina": [
    { nombre: "Cuerpo principal", cantidad: 1 },
    { nombre: "Cámara de combustión", cantidad: 1 },
    { nombre: "Plancha", cantidad: 1 },
    { nombre: "Tubo", cantidad: 1 },
    { nombre: "Sombrero", cantidad: 1 },
  ]
};

export default function OrdenEnvioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: pedidoId } = use(params);
  const router = useRouter();
  const { sesion, cargando } = useAuth();
  
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);

  const [correlativo, setCorrelativo] = useState("");
  const [fechaStr, setFechaStr] = useState("");
  const [piezas, setPiezas] = useState<{ nombre: string; cantidad: number }[]>([]);

  useEffect(() => {
    if (cargando) return;
    if (!sesion) {
      router.replace("/login");
      return;
    }
  }, [cargando, sesion, router]);

  useEffect(() => {
    async function loadData() {
      try {
        const pedSnap = await getDoc(doc(db, "pedidos", pedidoId));
        if (!pedSnap.exists()) return;
        
        const pedData = { id: pedSnap.id, ...pedSnap.data() } as Pedido;
        setPedido(pedData);
        
        const clieSnap = await getDoc(doc(db, "clientes", pedData.clienteId));
        if (clieSnap.exists()) {
          setCliente({ id: clieSnap.id, ...clieSnap.data() } as Cliente);
        }

        const modeloPiezas = PIEZAS_POR_MODELO[pedData.modelo] || [];
        setPiezas(JSON.parse(JSON.stringify(modeloPiezas))); 

        const hoy = new Date();
        const dd = String(hoy.getDate()).padStart(2, '0');
        const mm = String(hoy.getMonth() + 1).padStart(2, '0');
        const yyyy = hoy.getFullYear();
        setFechaStr(`${dd}/${mm}/${yyyy}`);
      } catch (error) {
        console.error("Error al cargar orden:", error);
      } finally {
        setLoading(false);
      }
    }
    if (pedidoId) loadData();
  }, [pedidoId]);

  const handleUpdatePieza = (index: number, newCantidad: string) => {
    const val = parseInt(newCantidad) || 0;
    const n = [...piezas];
    n[index].cantidad = val;
    setPiezas(n);
  };

  const handleImprimir = () => {
    window.print();
  };

  if (loading || !sesion) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full" />
    </div>
  );

  if (!pedido || !cliente) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center flex-col gap-4">
      <p className="text-stone-500 font-medium">No se encontró el pedido o cliente.</p>
      <button onClick={() => router.back()} className="text-emerald-600 hover:underline">Regresar</button>
    </div>
  );

  const renderBoleta = (tipoCopia: string) => {
    const mid = Math.ceil(piezas.length / 2);
    const piezasCols = piezas.map((p, i) => ({ ...p, i }));
    const leftCol = piezasCols.slice(0, mid);
    const rightCol = piezasCols.slice(mid);

    return (
      <div className="p-8 text-[13px] font-sans text-stone-900 leading-tight bg-white w-full box-border" style={{ fontFamily: 'Arial, sans-serif' }}>
        
        {/* HEADER BLOCK */}
        <div className="flex items-start justify-between gap-4 mb-4">
          
          {/* Logo (Left) */}
          <div className="flex flex-col items-center flex-shrink-0 w-32 relative">
            <Home className="w-12 h-12 text-orange-500" strokeWidth={1} fill="currentColor" />
            <div className="font-black text-xl -mt-2 tracking-tighter" style={{ fontFamily: 'Impact, sans-serif' }}>
              <span className="text-orange-500">ECO</span><span className="text-green-600">COMAL</span>
            </div>
          </div>

          {/* Center Title and Fields */}
          <div className="flex-1 flex flex-col gap-2 relative">
            {/* Title / Fecha / Orden */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1 bg-stone-100 rounded px-2 py-0.5">
                <span className="font-bold text-xs text-stone-600">Fecha:</span>
                <input 
                  type="text" 
                  value={fechaStr} 
                  onChange={e => setFechaStr(e.target.value)}
                  className="w-20 outline-none bg-transparent font-bold text-center border-none"
                />
              </div>
              
              <h1 className="text-xl font-bold tracking-widest text-center absolute left-1/2 -translate-x-1/2">
                ORDEN DE ENVÍO
              </h1>

              <div className="flex items-center gap-1 bg-stone-100 rounded px-2 py-0.5">
                <span className="font-bold text-xs text-stone-600">No. Orden:</span>
                <input 
                  type="text" 
                  value={correlativo}
                  onChange={e => setCorrelativo(e.target.value)}
                  placeholder="0001"
                  className="w-16 outline-none bg-transparent font-bold text-center border-none text-red-600"
                />
              </div>
            </div>

            {/* Inputs grid */}
            <div className="grid grid-cols-[1fr_200px] gap-2 items-center">
              <div className="flex items-center gap-2">
                <span className="font-bold whitespace-nowrap text-xs">Cliente / Comprador:</span>
                <div className="bg-stone-100 border border-stone-200 rounded px-2 py-1 flex-1 font-semibold truncate h-6">
                  {cliente.nombre}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold whitespace-nowrap text-xs">NIT:</span>
                <div className="bg-stone-100 border border-stone-200 rounded px-2 py-1 flex-1 h-6 flex items-center">
                  {cliente.nit || "C/F"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold whitespace-nowrap text-xs">Contacto / Tel:</span>
              <div className="bg-stone-100 border border-stone-200 rounded px-2 py-1 w-32 font-bold h-6 flex items-center">
                {cliente.telefono}
              </div>
              <span className="font-bold whitespace-nowrap text-xs ml-2">Dirección de Entrega:</span>
              <div className="bg-stone-100 border border-stone-200 rounded px-2 py-1 flex-1 truncate h-6 flex items-center">
                {cliente.comunidad}, {cliente.departamento}
              </div>
            </div>

          </div>
        </div>

        {/* PROYECTO & COPIA TEXT */}
        <div className="flex justify-between items-end mb-2 px-1">
          <div className="font-bold text-sm">
            PROYECTO: <span className="font-normal">{pedido.modelo} {pedido.modelo === 'Ecoplancha Híbrida' ? "14'" : ""}</span>
          </div>
          <div className="text-xs font-bold text-stone-600">
            [Copia {tipoCopia}]
          </div>
        </div>

        {/* PIEZAS TABLES (2 columns side by side) */}
        <div className="grid grid-cols-2 gap-4">
          {/* Left Table */}
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-stone-200 border border-stone-300">
                <th className="py-1 px-2 text-center font-bold w-16 text-xs">[Qty]</th>
                <th className="py-1 px-2 text-left font-bold text-xs border-l border-stone-300">[Componente]</th>
              </tr>
            </thead>
            <tbody>
              {leftCol.map((p) => (
                <tr key={p.i} className="border border-stone-300">
                  <td className="py-0.5 px-1 border-r border-stone-300 text-center bg-stone-50 print:bg-transparent">
                    <input 
                      type="number" 
                      min="0"
                      value={p.cantidad.toString()}
                      onChange={e => handleUpdatePieza(p.i, e.target.value)}
                      className="w-10 text-center outline-none bg-transparent font-bold"
                    />
                  </td>
                  <td className="py-0.5 px-2 text-xs">{p.nombre}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Right Table */}
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-stone-200 border border-stone-300">
                <th className="py-1 px-2 text-center font-bold w-16 text-xs">[Qty]</th>
                <th className="py-1 px-2 text-left font-bold text-xs border-l border-stone-300">[Componente]</th>
              </tr>
            </thead>
            <tbody>
              {rightCol.map((p) => (
                <tr key={p.i} className="border border-stone-300">
                  <td className="py-0.5 px-1 border-r border-stone-300 text-center bg-stone-50 print:bg-transparent">
                    <input 
                      type="number" 
                      min="0"
                      value={p.cantidad.toString()}
                      onChange={e => handleUpdatePieza(p.i, e.target.value)}
                      className="w-10 text-center outline-none bg-transparent font-bold"
                    />
                  </td>
                  <td className="py-0.5 px-2 text-xs">{p.nombre}</td>
                </tr>
              ))}
              {/* Padding rows if uneven */}
              {leftCol.length > rightCol.length && (
                <tr className="border border-stone-300">
                  <td className="py-0.5 px-1 border-r border-stone-300 bg-stone-50 print:bg-transparent h-[25px]"></td>
                  <td className="py-0.5 px-2"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* FIRMAS */}
        <div className="grid grid-cols-2 gap-8 mt-12 px-8">
          <div className="text-center">
            <p className="text-xs font-bold text-stone-600 mb-6">[Recibido por (Cliente)]</p>
            <div className="border-b border-stone-800 relative flex justify-center">
              <span className="absolute bottom-1 -left-4 font-bold text-sm">F.</span>
            </div>
            <p className="text-xs font-bold text-stone-600 mt-1">[Nombre del Comprador]</p>
          </div>

          <div className="text-center">
            <p className="text-xs font-bold text-stone-600 mb-6">[Entregado por (Piloto)]</p>
            <div className="border-b border-stone-800 relative flex justify-center">
              <span className="absolute bottom-1 -left-4 font-bold text-sm">F.</span>
            </div>
            <p className="text-xs font-bold text-stone-600 mt-1">[Nombre de quien entrega]</p>
          </div>
        </div>

      </div>
    );
  };

  return (
    <div className="min-h-screen bg-stone-200 py-8 print:bg-white print:p-0 text-black">
      
      {/* Controles NO imprimibles */}
      <div className="max-w-4xl mx-auto mb-6 px-4 flex justify-between items-center print:hidden">
        <button 
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-stone-600 rounded-xl shadow-sm hover:bg-stone-50 font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Pedidos
        </button>

        <button 
          onClick={handleImprimir}
          className="inline-flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-xl shadow-sm hover:bg-emerald-700 font-bold transition-colors"
        >
          <Printer className="w-4 h-4" /> Imprimir Documento
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4 print:hidden mb-4">
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-xl text-sm">
          <strong>Modo Edición:</strong> Las dos copias (Control Interno y Cliente) están sincronizadas. Edita los números o cantidades en cualquier lado y se actualizarán para la impresión.
        </div>
      </div>

      {/* HOJA ESTILO EXCEL (A4) - Dos mitades */}
      <div className="max-w-[800px] mx-auto bg-white shadow-xl print:shadow-none print:w-full print:max-w-none print:m-0 flex flex-col justify-between" style={{ minHeight: '1050px', maxHeight: '1100px' }}>
        
        {/* Mitad Superior */}
        <div className="flex-1 flex flex-col justify-center overflow-hidden">
          {renderBoleta("Control Interno (Ecoplancha)")}
        </div>

        {/* Línea de corte */}
        <div className="relative flex items-center justify-center border-t-[2px] border-dashed border-stone-400 my-0 print:my-0">
          <div className="bg-white px-2 py-1 absolute text-xs font-bold text-stone-500 flex items-center gap-1">
            <Scissors className="w-4 h-4" /> CORTAR AQUÍ PARA ENTREGA
          </div>
        </div>

        {/* Mitad Inferior */}
        <div className="flex-1 flex flex-col justify-center overflow-hidden">
          {renderBoleta("del Cliente")}
        </div>

      </div>
    </div>
  );
}
