"use client";

import { useState, useEffect } from "react";
import { guardarReceta, suscribirRecetas } from "@/features/inventory/services/recetas";
import { Trash2, Save, Wand2, Edit3, X, Plus, ChevronDown, ChevronRight, PackageOpen } from "lucide-react";
import type { Material, ProductoReceta, RecetaPieza } from "@/types";
import { MODELOS } from "@/types";

export default function TabRecetas({ materiales }: { materiales: Material[] }) {
  const [recetas, setRecetas] = useState<ProductoReceta[]>([]);
  
  // Editor Modal State
  const [editingModel, setEditingModel] = useState<string | null>(null);
  const [draftPiezas, setDraftPiezas] = useState<RecetaPieza[]>([]);
  
  const [nuevaPiezaNombre, setNuevaPiezaNombre] = useState("");
  const [expandedPieza, setExpandedPieza] = useState<number | null>(null);

  useEffect(() => {
    return suscribirRecetas(setRecetas);
  }, []);

  const openEditor = (modelo: string) => {
    setEditingModel(modelo);
    const existing = recetas.find(r => r.modelo === modelo);
    if (existing && existing.piezas) {
      setDraftPiezas(existing.piezas);
    } else {
      setDraftPiezas([]);
    }
  };

  const handleAddPieza = () => {
    if (!nuevaPiezaNombre.trim()) return;
    setDraftPiezas([...draftPiezas, { nombrePieza: nuevaPiezaNombre.trim(), cantidadPieza: 1, insumos: [] }]);
    setNuevaPiezaNombre("");
    setExpandedPieza(draftPiezas.length);
  };

  const handleRemovePieza = (idx: number) => {
    setDraftPiezas(draftPiezas.filter((_, i) => i !== idx));
  };

  const handleAddInsumo = (piezaIdx: number, materialId: string) => {
    if (!materialId) return;
    const newPiezas = [...draftPiezas];
    if (newPiezas[piezaIdx].insumos.find(i => i.materialId === materialId)) return;
    
    newPiezas[piezaIdx].insumos.push({ materialId, cantidadReq: 1 });
    setDraftPiezas(newPiezas);
  };

  const updateInsumo = (piezaIdx: number, insumoIdx: number, qty: number) => {
    const newPiezas = [...draftPiezas];
    newPiezas[piezaIdx].insumos[insumoIdx].cantidadReq = qty;
    setDraftPiezas(newPiezas);
  };

  const removeInsumo = (piezaIdx: number, insumoIdx: number) => {
    const newPiezas = [...draftPiezas];
    newPiezas[piezaIdx].insumos = newPiezas[piezaIdx].insumos.filter((_, i) => i !== insumoIdx);
    setDraftPiezas(newPiezas);
  };

  const handleSaveRecipe = async () => {
    if (!editingModel) return;
    try {
      await guardarReceta(editingModel, draftPiezas);
      setEditingModel(null);
    } catch {
      alert("Error al guardar receta");
    }
  };

  const handleSeedAll = async () => {
    try {
      const recetasData = [
        {
          modelo: "Ecocina",
          piezas: [
            { nombrePieza: "Plataforma Ecocina", cantidadPieza: 1, insumos: [] },
            { nombrePieza: "Caja Ecocina", cantidadPieza: 1, insumos: [] },
          ]
        },
        {
          modelo: "EcoPlancha Superior",
          piezas: [
            { nombrePieza: "Plataforma 14' SUPERIOR", cantidadPieza: 1, insumos: [] },
            { nombrePieza: "Caja cuadrada rellena", cantidadPieza: 1, insumos: [] },
            { nombrePieza: "Cámara de combustión", cantidadPieza: 1, insumos: [] },
            { nombrePieza: "Porta cenicero", cantidadPieza: 1, insumos: [] },
            { nombrePieza: "Sifones", cantidadPieza: 1, insumos: [] },
            { nombrePieza: "Plancha de 3 hornillas", cantidadPieza: 1, insumos: [] },
            { nombrePieza: "Ganchos", cantidadPieza: 1, insumos: [] },
            { nombrePieza: "Abrazaderas", cantidadPieza: 1, insumos: [] },
            { nombrePieza: "Protectores", cantidadPieza: 1, insumos: [] },
            { nombrePieza: "Codos", cantidadPieza: 1, insumos: [] },
            { nombrePieza: "Sombreros", cantidadPieza: 1, insumos: [] },
            { nombrePieza: "Tubos", cantidadPieza: 1, insumos: [] },
            { nombrePieza: "Mesa de metal", cantidadPieza: 1, insumos: [] },
          ]
        },
        {
          modelo: "Ecoplancha Híbrida",
          piezas: [
            { nombrePieza: "Plataforma Híbrida", cantidadPieza: 1, insumos: [] },
            { nombrePieza: "Caja Híbrida", cantidadPieza: 1, insumos: [] },
          ]
        },
        {
          modelo: "Ecocomal",
          piezas: [
            { nombrePieza: "Estructura Comal", cantidadPieza: 1, insumos: [] },
          ]
        }
      ];

      // Nunca sobrescribir recetas que ya existen (podrían tener materiales cargados).
      const pendientes = recetasData.filter(r => !recetas.some(x => x.modelo === r.modelo && x.piezas?.length));
      if (pendientes.length === 0) {
        alert("Todos los modelos ya tienen receta. No se modificó nada.");
        return;
      }
      if (!confirm(`Se crearán las piezas base para: ${pendientes.map(r => r.modelo).join(", ")}. Las recetas existentes no se tocan. ¿Continuar?`)) return;

      for (const r of pendientes) {
        await guardarReceta(r.modelo, r.piezas);
      }

      alert("Piezas base creadas. Entra a cada modelo para agregarles sus materiales.");
    } catch {
      alert("Error al inyectar recetas.");
    }
  };

  // Helper for colors
  const modeloColor: Record<string, string> = {
    "Ecocina": "bg-amber-50 border-amber-200 text-amber-900",
    "EcoPlancha Superior": "bg-blue-50 border-blue-200 text-blue-900",
    "Ecoplancha Híbrida": "bg-purple-50 border-purple-200 text-purple-900",
    "Ecocomal": "bg-emerald-50 border-emerald-200 text-emerald-900",
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header Bento */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-indigo-50 rounded-xl">
            <PackageOpen className="w-5 h-5 text-indigo-600" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Estructura BOM (Por Piezas)</h2>
            <p className="text-xs text-slate-500">Listado de piezas y materiales (insumos) requeridos por cada estufa.</p>
          </div>
        </div>
        <button 
          onClick={handleSeedAll} 
          className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-sm font-bold transition-colors shadow-sm w-full sm:w-auto"
        >
          <Wand2 className="w-4 h-4" /> Inyectar Piezas Base
        </button>
      </div>

      {/* Grid of Models */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MODELOS.map(modelo => {
          const receta = recetas.find(r => r.modelo === modelo);
          const bgCls = modeloColor[modelo] || "bg-slate-50 border-slate-200 text-slate-900";
          const totalPiezas = receta?.piezas?.length || 0;
          const totalInsumos = receta?.piezas?.reduce((acc, p) => acc + (p.insumos?.length || 0), 0) || 0;
          
          return (
            <div key={modelo} className={`rounded-2xl border ${bgCls} p-5 flex flex-col h-full shadow-sm relative overflow-hidden group transition-all hover:shadow-md`}>
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                  <h3 className="font-extrabold text-lg tracking-tight">{modelo}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 bg-white/60 rounded-md text-[10px] font-bold shadow-sm">
                      {totalPiezas} piezas
                    </span>
                    <span className="px-2 py-0.5 bg-white/60 rounded-md text-[10px] font-bold shadow-sm">
                      {totalInsumos} insumos
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => openEditor(modelo)}
                  className="p-2 bg-white/60 hover:bg-white text-slate-700 rounded-xl transition-colors shadow-sm backdrop-blur-sm"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 bg-white/60 backdrop-blur-md rounded-xl p-3 border border-white/40 overflow-y-auto max-h-[250px] relative z-10">
                {!receta || !receta.piezas || receta.piezas.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 py-6">
                    <p className="text-xs font-medium">Estufa sin piezas configuradas</p>
                    <p className="text-[10px]">Haz clic en editar para armar la estufa</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {receta.piezas.map((pieza, idx) => (
                      <div key={idx} className="bg-white/80 rounded-lg p-2 shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-xs text-slate-800">{pieza.nombrePieza}</span>
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 rounded">x{pieza.cantidadPieza}</span>
                        </div>
                        {pieza.insumos && pieza.insumos.length > 0 ? (
                          <ul className="space-y-1">
                            {pieza.insumos.map((ins, iidx) => {
                              const mat = materiales.find(m => m.id === ins.materialId);
                              return (
                                <li key={iidx} className="flex justify-between items-center text-[10px] pl-2 border-l-2 border-slate-200">
                                  <span className="text-slate-600 truncate">{mat ? mat.nombre : "Eliminado"}</span>
                                  <span className="font-semibold text-slate-800 shrink-0 ml-2">{ins.cantidadReq} {mat?.unidadMedida}</span>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-[9px] text-slate-400 italic pl-2">Sin insumos configurados</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Editor Modal */}
      {editingModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditingModel(null)} />
          <div className="relative bg-stone-50 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-white">
              <div>
                <h2 className="font-bold text-stone-900 text-lg">Despiece de Estufa: {editingModel}</h2>
                <p className="text-xs text-stone-500">Agrega las piezas principales y luego asígnales insumos.</p>
              </div>
              <button onClick={() => setEditingModel(null)} className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              {/* Add New Pieza */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Nombre de la Nueva Pieza</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Plataforma 14' SUPERIOR"
                    value={nuevaPiezaNombre}
                    onChange={e => setNuevaPiezaNombre(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddPieza()}
                    className="w-full px-4 py-2.5 text-sm bg-stone-50 ring-1 ring-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                  />
                </div>
                <button 
                  onClick={handleAddPieza}
                  className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-semibold transition-colors shrink-0 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Agregar Pieza
                </button>
              </div>

              {/* List of Piezas */}
              <div className="space-y-4">
                {draftPiezas.length === 0 ? (
                  <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-stone-300">
                    <p className="text-stone-500 font-medium">Aún no hay piezas en este modelo.</p>
                    <p className="text-xs text-stone-400 mt-1">Crea la primera pieza arriba.</p>
                  </div>
                ) : (
                  draftPiezas.map((pieza, pIdx) => (
                    <div key={pIdx} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                      {/* Pieza Header */}
                      <div 
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-stone-50 transition-colors"
                        onClick={() => setExpandedPieza(expandedPieza === pIdx ? null : pIdx)}
                      >
                        <div className="flex items-center gap-3">
                          <button className="text-stone-400">
                            {expandedPieza === pIdx ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                          </button>
                          <div>
                            <h4 className="font-bold text-stone-800">{pieza.nombrePieza}</h4>
                            <p className="text-xs text-stone-500">{pieza.insumos?.length || 0} insumos</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-stone-500 uppercase">Cant:</span>
                            <input 
                              type="number" min="1" step="1"
                              value={pieza.cantidadPieza || 1}
                              onChange={e => {
                                const arr = [...draftPiezas];
                                arr[pIdx].cantidadPieza = parseInt(e.target.value) || 1;
                                setDraftPiezas(arr);
                              }}
                              className="w-16 px-2 py-1 text-sm text-center bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <button 
                            onClick={() => handleRemovePieza(pIdx)}
                            className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Pieza Insumos */}
                      {expandedPieza === pIdx && (
                        <div className="p-4 bg-stone-50/50 border-t border-stone-100">
                          <div className="mb-3 relative">
                            <select 
                              onChange={(e) => handleAddInsumo(pIdx, e.target.value)} 
                              value="" 
                              className="w-full pl-4 pr-10 py-2.5 text-sm bg-white ring-1 ring-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors appearance-none font-medium text-stone-700 shadow-sm"
                            >
                              <option value="" disabled>+ Agregar Insumo a {pieza.nombrePieza}...</option>
                              {materiales.map(mat => (
                                <option key={mat.id} value={mat.id}>{mat.nombre} ({mat.unidadMedida})</option>
                              ))}
                            </select>
                            <Plus className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                          </div>

                          <table className="w-full text-left text-sm text-stone-600">
                            <thead className="text-xs uppercase text-stone-400 border-b border-stone-200">
                              <tr>
                                <th className="pb-2 font-semibold">Material</th>
                                <th className="pb-2 font-semibold w-24">Cantidad</th>
                                <th className="pb-2 font-semibold text-center w-10"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                              {!pieza.insumos || pieza.insumos.length === 0 ? (
                                <tr>
                                  <td colSpan={3} className="py-4 text-center text-xs text-stone-400 italic">No hay insumos para esta pieza.</td>
                                </tr>
                              ) : (
                                pieza.insumos.map((ins, iIdx) => {
                                  const mat = materiales.find(m => m.id === ins.materialId);
                                  return (
                                    <tr key={iIdx}>
                                      <td className="py-2.5 font-medium text-stone-800">
                                        {mat ? `${mat.nombre} (${mat.unidadMedida})` : "Material Eliminado"}
                                      </td>
                                      <td className="py-2.5">
                                        <input 
                                          type="number" step="0.01" min="0" 
                                          value={ins.cantidadReq} 
                                          onChange={e => updateInsumo(pIdx, iIdx, parseFloat(e.target.value) || 0)} 
                                          className="w-full p-1.5 text-sm bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold" 
                                        />
                                      </td>
                                      <td className="py-2.5 text-center">
                                        <button 
                                          onClick={() => removeInsumo(pIdx, iIdx)} 
                                          className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-stone-200 bg-white flex justify-end gap-3">
              <button 
                onClick={() => setEditingModel(null)}
                className="px-5 py-2.5 text-sm text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveRecipe}
                className="flex items-center gap-2 px-6 py-2.5 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold transition-colors shadow-sm"
              >
                <Save className="w-4 h-4" /> Guardar Todo
              </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}
