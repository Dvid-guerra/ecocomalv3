"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { Map, Calendar, Search, MapPin, Truck, Filter, X } from "lucide-react";
import type { Envio, Pedido, Cliente } from "@/types";

// URL al archivo estático en public
const geoUrl = "/guatemala-departments.json";

// Normalizador para que coincida "Alta Verapaz" con "ALTA VERAPAZ" o sin acentos
const normalizarStr = (str: string) =>
  str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

interface RegistroEntrega {
  envioId: string;
  fecha: string;
  vehiculo: string;
  comunidadDestino: string;
  departamento: string;
  cantidadEstufas: number;
}

export default function EntregasPage() {
  const { sesion } = useAuth();
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);

  // Filtros
  const [filtroTiempo, setFiltroTiempo] = useState<"todo" | "este-mes" | "este-ano">("todo");
  const [filtroDept, setFiltroDept] = useState<string>("");
  const [tooltipContent, setTooltipContent] = useState("");

  // Acceso: Solo Gerente, Subgerente, Supervisor
  const tieneAcceso = sesion && ["Gerente", "Subgerente", "Supervisor"].includes(sesion.rol);

  // Cargar colecciones
  useEffect(() => {
    if (!tieneAcceso) return;

    const qEnvios = query(collection(db, "envios"), where("estado", "==", "Entregado"));
    const unSubEnvios = onSnapshot(qEnvios, (snap) => {
      setEnvios(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Envio)));
    });

    const unSubPedidos = onSnapshot(collection(db, "pedidos"), (snap) => {
      setPedidos(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Pedido)));
    });

    const unSubClientes = onSnapshot(collection(db, "clientes"), (snap) => {
      setClientes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Cliente)));
    });

    return () => {
      unSubEnvios();
      unSubPedidos();
      unSubClientes();
    };
  }, [tieneAcceso]);

  useEffect(() => {
    if (envios.length > 0 || pedidos.length > 0 || clientes.length > 0) {
      // Damos un pequeño margen para que se resuelvan todas
      setTimeout(() => setCargando(false), 500);
    } else {
      const t = setTimeout(() => setCargando(false), 2000); // timeout si está vacío
      return () => clearTimeout(t);
    }
  }, [envios, pedidos, clientes]);

  // Procesar datos para el mapa y tabla
  const datosProcesados = useMemo(() => {
    const registros: RegistroEntrega[] = [];
    const deptoCounts: Record<string, number> = {};

    // Filtrado de fechas
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
    const inicioAno = new Date(ahora.getFullYear(), 0, 1).toISOString();

    envios.forEach((envio) => {
      // Aplicar filtro de fecha sobre la fecha de entrega
      if (filtroTiempo === "este-mes" && envio.fecha < inicioMes) return;
      if (filtroTiempo === "este-ano" && envio.fecha < inicioAno) return;

      // Un envío puede tener múltiples pedidos
      let estufasEnvio = 0;
      const deptosEnEsteEnvio: Set<string> = new Set(); // en caso de mezclar

      envio.pedidoIds.forEach((pid) => {
        const ped = pedidos.find((p) => p.id === pid);
        if (ped) {
          estufasEnvio += ped.cantidad;
          const cli = clientes.find((c) => c.id === ped.clienteId);
          if (cli && cli.departamento) {
            deptosEnEsteEnvio.add(cli.departamento);
            // Sumar al contador del departamento
            const nDept = normalizarStr(cli.departamento);
            deptoCounts[nDept] = (deptoCounts[nDept] || 0) + ped.cantidad;
          }
        }
      });

      // Registrar para la tabla
      if (estufasEnvio > 0) {
        registros.push({
          envioId: envio.id,
          fecha: envio.fecha,
          vehiculo: envio.vehiculo,
          comunidadDestino: envio.destino, // Destino textual del envío
          departamento: Array.from(deptosEnEsteEnvio).join(", ") || "Desconocido",
          cantidadEstufas: estufasEnvio,
        });
      }
    });

    // Ordenar tabla más reciente primero
    registros.sort((a, b) => b.fecha.localeCompare(a.fecha));

    return { registros, deptoCounts };
  }, [envios, pedidos, clientes, filtroTiempo]);

  // Configurar escala de color basada en el máximo de estufas
  const maxEstufas = useMemo(() => {
    const vals = Object.values(datosProcesados.deptoCounts);
    return vals.length > 0 ? Math.max(...vals) : 1;
  }, [datosProcesados.deptoCounts]);

  const colorScale = scaleLinear<string>()
    .domain([0, maxEstufas])
    .range(["#f1f5f9", "#059669"]); // Slate 100 to Emerald 600

  if (!tieneAcceso) {
    return (
      <div className="p-8 text-center text-slate-500">
        No tienes permisos para ver este módulo.
      </div>
    );
  }

  // Filtrar tabla si se hace clic en un departamento
  const registrosFiltrados = datosProcesados.registros.filter((r) => {
    if (!filtroDept) return true;
    return normalizarStr(r.departamento).includes(filtroDept);
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center ring-1 ring-indigo-100">
            <Map className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Mapa de Entregas</h1>
            <p className="text-sm text-slate-500">Historial y distribución geográfica</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={filtroTiempo}
              onChange={(e) => setFiltroTiempo(e.target.value as typeof filtroTiempo)}
              className="pl-9 pr-8 py-2 bg-slate-50 border-0 ring-1 ring-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="todo">Histórico Completo</option>
              <option value="este-ano">Este Año</option>
              <option value="este-mes">Este Mes</option>
            </select>
          </div>
          {filtroDept && (
            <button
              onClick={() => setFiltroDept("")}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 ring-1 ring-red-200 transition-colors"
            >
              <X className="w-4 h-4" />
              Quitar filtro: {filtroDept.toUpperCase()}
            </button>
          )}
        </div>
      </header>

      {cargando ? (
        <div className="h-64 flex items-center justify-center bg-white rounded-3xl shadow-sm ring-1 ring-slate-200">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* MAPA */}
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm ring-1 ring-slate-200 p-6 flex flex-col relative">
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-indigo-500" />
              Densidad de Entregas
            </h2>
            
            <div className="flex-1 bg-slate-50 rounded-2xl ring-1 ring-slate-200 overflow-hidden relative">
              <ComposableMap
                projection="geoMercator"
                projectionConfig={{
                  scale: 6500,
                  center: [-90.25, 15.5] // Centro aproximado de Guatemala
                }}
                className="w-full h-full min-h-[400px]"
              >
                <ZoomableGroup>
                  <Geographies geography={geoUrl}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const deptoName = geo.properties.Departamento;
                        const normalName = normalizarStr(deptoName || "");
                        const estufas = datosProcesados.deptoCounts[normalName] || 0;
                        const color = estufas > 0 ? colorScale(estufas) : "#f8fafc";

                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={color}
                            stroke="#cbd5e1"
                            strokeWidth={0.5}
                            style={{
                              default: { outline: "none" },
                              hover: { fill: "#4f46e5", outline: "none", cursor: "pointer", stroke: "#e2e8f0", strokeWidth: 1 },
                              pressed: { outline: "none" },
                            }}
                            onMouseEnter={() => {
                              setTooltipContent(`${deptoName}: ${estufas} estufas`);
                            }}
                            onMouseLeave={() => {
                              setTooltipContent("");
                            }}
                            onClick={() => {
                              setFiltroDept(normalName);
                            }}
                          />
                        );
                      })
                    }
                  </Geographies>
                </ZoomableGroup>
              </ComposableMap>
              
              {/* Tooltip Overlay */}
              {tooltipContent && (
                <div className="absolute top-4 right-4 bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xl pointer-events-none z-10">
                  {tooltipContent}
                </div>
              )}

              {/* Leyenda */}
              <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-3 py-2 rounded-xl ring-1 ring-slate-200 shadow-sm flex items-center gap-2 text-xs font-medium text-slate-600">
                <span>0</span>
                <div className="w-24 h-2 bg-gradient-to-r from-slate-100 to-emerald-600 rounded-full" />
                <span>{maxEstufas}</span>
              </div>
            </div>
          </div>

          {/* TABLA HISTORIAL */}
          <div className="lg:col-span-1 bg-white rounded-3xl shadow-sm ring-1 ring-slate-200 p-6 flex flex-col h-[500px]">
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" />
              Últimas Entregas
            </h2>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              {registrosFiltrados.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <Search className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">No hay entregas registradas.</p>
                </div>
              ) : (
                registrosFiltrados.map((reg) => (
                  <div key={reg.envioId} className="bg-slate-50 rounded-2xl p-4 ring-1 ring-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-500 bg-white px-2 py-1 rounded-md ring-1 ring-slate-200">
                        {reg.fecha}
                      </span>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md">
                        {reg.cantidadEstufas} estufas
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 leading-tight mb-1">
                      {reg.comunidadDestino}
                    </p>
                    <p className="text-xs text-slate-500 mb-3 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      Depto: {reg.departamento}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                      <Truck className="w-3.5 h-3.5" />
                      {reg.vehiculo}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
