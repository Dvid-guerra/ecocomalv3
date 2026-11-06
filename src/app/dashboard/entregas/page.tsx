"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { Map, Calendar, Inbox, MapPin, Truck, Filter, X, Lock } from "lucide-react";
import type { Envio, Pedido, Cliente } from "@/types";
import {
  PageHeader,
  Card,
  CardHeader,
  Badge,
  Button,
  Spinner,
  EmptyState,
  SelectInput,
} from "@/components/ui";

// URL al archivo estático en public
const geoUrl = "/guatemala-departments.json";

// Normalizador para que coincida "Alta Verapaz" con "ALTA VERAPAZ" o sin acentos
const normalizarStr = (str: string) =>
  str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/**
 * Las fechas de envío llegan como ISO. Sin formatear, la tarjeta mostraba
 * la cadena cruda. Si el valor no es una fecha válida se devuelve tal cual
 * en lugar de inventar un "Invalid Date".
 */
const formatearFecha = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-GT", {
    timeZone: "America/Guatemala",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

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

  /* La rampa va del hundido del sistema al verde de marca: es el único
     lugar del módulo donde el verde codifica un dato, no un estado. */
  const colorScale = scaleLinear<string>()
    .domain([0, maxEstufas])
    .range(["#e2e8f0", "#047857"]);

  if (!tieneAcceso) {
    return (
      <Card nivel="panel">
        <EmptyState
          icono={Lock}
          titulo="Este módulo está restringido"
          descripcion="El mapa de entregas está disponible para Gerencia, Subgerencia y Supervisión. Si necesitas acceso, pídelo en Administración."
        />
      </Card>
    );
  }

  // Filtrar tabla si se hace clic en un departamento
  const registrosFiltrados = datosProcesados.registros.filter((r) => {
    if (!filtroDept) return true;
    return normalizarStr(r.departamento).includes(filtroDept);
  });

  const totalEstufas = registrosFiltrados.reduce((s, r) => s + r.cantidadEstufas, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Mapa de Entregas"
        descripcion="Historial y distribución geográfica"
        icono={Map}
        volverHref="/dashboard"
        acciones={
          <>
            <SelectInput
              id="filtro-tiempo"
              aria-label="Filtrar por período"
              value={filtroTiempo}
              onChange={(e) => setFiltroTiempo(e.target.value as typeof filtroTiempo)}
              iconLeft={<Filter className="w-4 h-4" strokeWidth={1.5} />}
              className="w-auto min-w-52"
            >
              <option value="todo">Histórico completo</option>
              <option value="este-ano">Este año</option>
              <option value="este-mes">Este mes</option>
            </SelectInput>

            {filtroDept && (
              <Button
                variante="danger"
                onClick={() => setFiltroDept("")}
                iconLeft={<X className="w-4 h-4" strokeWidth={2} />}
              >
                Quitar filtro
              </Button>
            )}
          </>
        }
      />

      {cargando ? (
        <Card nivel="panel" className="h-64 flex items-center justify-center">
          <Spinner etiqueta="Cargando entregas…" visible />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── MAPA ── */}
          <Card nivel="panel" className="lg:col-span-2 flex flex-col overflow-hidden">
            <CardHeader
              titulo="Densidad de entregas"
              subtitulo={
                filtroDept
                  ? `Filtrando por ${filtroDept.toUpperCase()}`
                  : "Toca un departamento para filtrar el historial"
              }
              icono={<MapPin className="w-4 h-4" strokeWidth={1.5} />}
            />

            <div className="p-4 sm:p-5">
              <div className="bg-sunken rounded-card ring-1 ring-line overflow-hidden relative">
                <ComposableMap
                  projection="geoMercator"
                  projectionConfig={{
                    scale: 6500,
                    center: [-90.25, 15.5], // Centro aproximado de Guatemala
                  }}
                  className="w-full h-full min-h-[22rem] sm:min-h-[26rem]"
                >
                  <ZoomableGroup>
                    <Geographies geography={geoUrl}>
                      {({ geographies }) =>
                        geographies.map((geo) => {
                          const deptoName = geo.properties.Departamento;
                          const normalName = normalizarStr(deptoName || "");
                          const estufas = datosProcesados.deptoCounts[normalName] || 0;
                          const color = estufas > 0 ? colorScale(estufas) : "#f8fafc";
                          const seleccionado = filtroDept === normalName;

                          return (
                            <Geography
                              key={geo.rsmKey}
                              geography={geo}
                              fill={color}
                              /* El hover y la selección se marcan con el
                                 trazo, no con el relleno: cambiar el relleno
                                 borraría el dato que el mapa codifica. */
                              stroke={seleccionado ? "#0f172a" : "#cbd5e1"}
                              strokeWidth={seleccionado ? 1.5 : 0.5}
                              style={{
                                default: { outline: "none", transition: "stroke 150ms" },
                                hover: {
                                  outline: "none",
                                  cursor: "pointer",
                                  stroke: "#0f172a",
                                  strokeWidth: 1.25,
                                },
                                pressed: { outline: "none" },
                              }}
                              onMouseEnter={() =>
                                setTooltipContent(
                                  `${deptoName}: ${estufas} ${estufas === 1 ? "estufa" : "estufas"}`,
                                )
                              }
                              onMouseLeave={() => setTooltipContent("")}
                              onClick={() =>
                                setFiltroDept((prev) => (prev === normalName ? "" : normalName))
                              }
                            />
                          );
                        })
                      }
                    </Geographies>
                  </ZoomableGroup>
                </ComposableMap>

                {tooltipContent && (
                  <div
                    role="status"
                    className="absolute top-3 left-3 right-3 sm:left-auto sm:right-3 sm:max-w-xs bg-action text-white text-xs font-semibold px-3 py-2 rounded-control shadow-overlay pointer-events-none z-10"
                  >
                    {tooltipContent}
                  </div>
                )}

                {/* Leyenda de la rampa */}
                <div className="absolute bottom-3 right-3 bg-surface/90 backdrop-blur px-3 py-2 rounded-control ring-1 ring-line shadow-card flex items-center gap-2 text-xs font-semibold text-ink-body">
                  <span className="nums">0</span>
                  <span
                    className="w-20 h-2 rounded-full"
                    style={{ backgroundImage: "linear-gradient(to right, #e2e8f0, #047857)" }}
                    aria-hidden="true"
                  />
                  <span className="nums">{maxEstufas}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* ── HISTORIAL ── */}
          <Card nivel="panel" className="lg:col-span-1 flex flex-col overflow-hidden">
            <CardHeader
              titulo="Últimas entregas"
              subtitulo={
                registrosFiltrados.length > 0
                  ? `${registrosFiltrados.length} ${registrosFiltrados.length === 1 ? "envío" : "envíos"} · ${totalEstufas} estufas`
                  : undefined
              }
              icono={<Calendar className="w-4 h-4" strokeWidth={1.5} />}
            />

            <div className="custom-scrollbar flex-1 lg:max-h-[30rem] p-4 sm:p-5 space-y-3">
              {registrosFiltrados.length === 0 ? (
                <EmptyState
                  icono={Inbox}
                  titulo={
                    filtroDept
                      ? "Sin entregas en este departamento"
                      : "Aún no hay entregas registradas"
                  }
                  descripcion={
                    filtroDept
                      ? "Quita el filtro para ver el resto del historial."
                      : "Un envío aparece aquí cuando pasa a estado Entregado en Ventas y Envíos."
                  }
                  accion={
                    filtroDept ? (
                      <Button variante="secondary" onClick={() => setFiltroDept("")}>
                        Quitar filtro
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                registrosFiltrados.map((reg) => (
                  <article
                    key={reg.envioId}
                    className="bg-sunken rounded-card ring-1 ring-line p-4"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="nums text-xs font-semibold text-ink-muted">
                        {formatearFecha(reg.fecha)}
                      </span>
                      <Badge tono="ok" numerico>
                        {reg.cantidadEstufas} {reg.cantidadEstufas === 1 ? "estufa" : "estufas"}
                      </Badge>
                    </div>

                    <h3 className="text-sm font-semibold text-ink leading-snug">
                      {reg.comunidadDestino}
                    </h3>

                    <p className="text-xs text-ink-muted mt-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                      {reg.departamento}
                    </p>

                    <p className="text-xs font-medium text-ink-muted mt-3 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                      {reg.vehiculo}
                    </p>
                  </article>
                ))
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
