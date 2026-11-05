"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ArrowLeft, CheckCircle2, Maximize, UserRound } from "lucide-react";
import { db } from "@/lib/firebase";
import type { Material, Pedido, Rol } from "@/types";
import BuscadorMaterial from "../BuscadorMaterial";
import PasoCantidad, { type PersonaRegistro, type ResumenRegistro } from "./PasoCantidad";

type Paso = "quien" | "material" | "cantidad" | "listo";

interface Persona extends PersonaRegistro {
  rol: Rol;
  areaPlanta?: string;
}

/** Sin tocar la pantalla este tiempo, vuelve al inicio para que nadie registre a nombre de otro. */
const INACTIVIDAD_MS = 2 * 60_000;
const VOLVER_TRAS_REGISTRO_MS = 8_000;

export default function PuntoRegistro({ materialInicial }: { materialInicial: string | null }) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [paso, setPaso] = useState<Paso>("quien");
  const [persona, setPersona] = useState<Persona | null>(null);
  const [materialId, setMaterialId] = useState<string | null>(materialInicial);
  const [resumen, setResumen] = useState<ResumenRegistro | null>(null);

  useEffect(() => {
    const falla = () => setErrorCarga("No se pudieron cargar los datos. Revisa la conexión.");
    const unsubs = [
      onSnapshot(query(collection(db, "usuarios"), where("activo", "==", true)), snap => {
        setPersonas(
          snap.docs
            .map(d => ({ uid: d.id, nombre: String(d.data().nombre ?? ""), rol: d.data().rol as Rol, areaPlanta: d.data().areaPlanta }))
            .filter(p => p.nombre)
            .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
        );
      }, falla),
      onSnapshot(collection(db, "materiales"), snap => {
        setMateriales(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Material));
      }, falla),
      onSnapshot(query(collection(db, "pedidos"), where("estado", "==", "En Producción")), snap => {
        setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Pedido));
      }, falla),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const reiniciar = useCallback(() => {
    setPaso("quien");
    setPersona(null);
    setMaterialId(null);
    setResumen(null);
    // Quita ?m= de la URL para que recargar no vuelva a abrir el mismo material.
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  // Vuelve al inicio por inactividad.
  useEffect(() => {
    if (paso === "quien") return;
    let timer = setTimeout(reiniciar, INACTIVIDAD_MS);
    const tocar = () => {
      clearTimeout(timer);
      timer = setTimeout(reiniciar, INACTIVIDAD_MS);
    };
    window.addEventListener("pointerdown", tocar);
    window.addEventListener("keydown", tocar);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", tocar);
      window.removeEventListener("keydown", tocar);
    };
  }, [paso, reiniciar]);

  // Tras registrar, vuelve solo al inicio.
  useEffect(() => {
    if (paso !== "listo") return;
    const timer = setTimeout(reiniciar, VOLVER_TRAS_REGISTRO_MS);
    return () => clearTimeout(timer);
  }, [paso, reiniciar]);

  const material = materialId ? materiales.find(m => m.id === materialId) ?? null : null;

  const elegirPersona = (p: Persona) => {
    setPersona(p);
    setPaso(materialId ? "cantidad" : "material");
  };

  const elegirMaterial = (id: string) => {
    setMaterialId(id);
    setPaso("cantidad");
  };

  const pantallaCompleta = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard/inventario" className="p-3 rounded-2xl bg-white ring-1 ring-slate-200 text-slate-600" aria-label="Volver a Inventario">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900">Punto de registro</h1>
            <p className="text-sm text-slate-500 truncate">Furgón de consumibles</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {persona && paso !== "quien" && (
            <button onClick={reiniciar} className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 text-white text-sm font-bold max-w-[12rem]">
              <UserRound className="w-4 h-4 shrink-0" /> <span className="truncate">{persona.nombre}</span>
            </button>
          )}
          <button onClick={pantallaCompleta} className="p-3 rounded-2xl bg-white ring-1 ring-slate-200 text-slate-600" aria-label="Pantalla completa">
            <Maximize className="w-5 h-5" />
          </button>
        </div>
      </header>

      {errorCarga && <p className="rounded-2xl bg-red-50 ring-1 ring-red-200 text-red-700 px-5 py-4">{errorCarga}</p>}

      {paso === "quien" && (
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">¿Quién registra?</h2>
          {material && (
            <p className="text-slate-600">
              Material escaneado: <span className="font-bold text-slate-900">{material.nombre}</span>
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {personas.map(p => (
              <button
                key={p.uid}
                onClick={() => elegirPersona(p)}
                className="flex flex-col items-center justify-center gap-2 min-h-32 p-4 rounded-3xl bg-white ring-1 ring-slate-200 active:bg-slate-100"
              >
                <span className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 text-2xl font-bold flex items-center justify-center">
                  {p.nombre.trim().charAt(0).toUpperCase()}
                </span>
                <span className="text-lg font-bold text-slate-900 text-center leading-tight">{p.nombre}</span>
                <span className="text-xs text-slate-500">{p.areaPlanta ?? p.rol}</span>
              </button>
            ))}
          </div>
          {personas.length === 0 && !errorCarga && <p className="text-slate-400">Cargando personal…</p>}
        </section>
      )}

      {paso === "material" && (
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">Escanear la gaveta o el empaque</h2>
          <BuscadorMaterial materiales={materiales} onElegir={m => elegirMaterial(m.id)} />
        </section>
      )}

      {paso === "cantidad" && persona && material && (
        <PasoCantidad
          key={material.id}
          material={material}
          persona={persona}
          pedidos={pedidos}
          onCambiarMaterial={() => setPaso("material")}
          onRegistrado={r => {
            setResumen(r);
            setPaso("listo");
          }}
        />
      )}
      {paso === "cantidad" && persona && !material && materialId && materiales.length > 0 && (
        <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-200 text-amber-800 px-5 py-4 space-y-3">
          <p>Ese QR no corresponde a ningún material del catálogo.</p>
          <button onClick={() => setPaso("material")} className="px-4 py-3 rounded-xl bg-white ring-1 ring-amber-200 font-bold">Buscar material</button>
        </div>
      )}

      {paso === "listo" && resumen && (
        <section className="bg-white rounded-3xl ring-1 ring-slate-200 p-8 text-center space-y-4">
          <CheckCircle2 className="w-20 h-20 mx-auto text-emerald-600" />
          <h2 className="text-2xl font-bold text-slate-900">
            {resumen.tipo === "salida" ? "Salida registrada" : resumen.tipo === "entrada" ? "Entrada registrada" : "Conteo registrado"}
          </h2>
          <p className="text-lg text-slate-600">
            {resumen.tipo === "ajuste"
              ? <>{resumen.material.nombre}: ajustado a <b>{resumen.stockResultante}</b> ({resumen.delta >= 0 ? "+" : ""}{resumen.delta})</>
              : <><b>{resumen.cantidad}</b> {resumen.material.unidadMedida} de {resumen.material.nombre}</>}
          </p>
          <p className="text-slate-500">
            Quedan <span className="font-mono font-bold text-slate-900">{resumen.stockResultante}</span> {resumen.material.unidadMedida} · {resumen.persona.nombre}
          </p>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => {
                setMaterialId(null);
                setResumen(null);
                setPaso("material");
              }}
              className="h-16 rounded-2xl bg-slate-900 text-white text-lg font-bold"
            >
              Otro material
            </button>
            <button onClick={reiniciar} className="h-16 rounded-2xl bg-slate-100 text-slate-700 text-lg font-bold">
              Terminar
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

