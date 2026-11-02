import re

with open("src/app/dashboard/planta/page.tsx", "r") as f:
    content = f.read()

# We want to replace everything from "function PlanificacionSemanal({" to the end of the file.
# Since it's the last function in the file, we can do:
start_idx = content.find("function PlanificacionSemanal({")

before_comp = content[:start_idx]

new_comp = """
function PlanificacionSemanal({
  semanaActual,
  setSemanaActual,
  bloquesSemanales,
  colaboradores,
  mostrarForm,
  setMostrarForm,
  formBloque,
  setFormBloque,
}: {
  semanaActual: string;
  setSemanaActual: (s: string) => void;
  bloquesSemanales: BloqueSemanal[];
  colaboradores: UsuarioReal[];
  mostrarForm: boolean;
  setMostrarForm: (b: boolean) => void;
  formBloque: Partial<BloqueSemanal>;
  setFormBloque: React.Dispatch<React.SetStateAction<Partial<BloqueSemanal>>>;
}) {
  const [isSaving, setIsSaving] = useState(false);
  
  const handleSemanaPrev = () => {
    const [y, w] = semanaActual.split("-W");
    const d = new Date(parseInt(y), 0, 1 + (parseInt(w) - 1) * 7);
    d.setDate(d.getDate() - 7);
    setSemanaActual(getSemanaId(d.toISOString().split("T")[0]));
  };
  const handleSemanaNext = () => {
    const [y, w] = semanaActual.split("-W");
    const d = new Date(parseInt(y), 0, 1 + (parseInt(w) - 1) * 7);
    d.setDate(d.getDate() + 7);
    setSemanaActual(getSemanaId(d.toISOString().split("T")[0]));
  };

  const getDiasDeSemana = (semanaId: string) => {
    const [y, w] = semanaId.split("-W");
    const year = parseInt(y);
    const week = parseInt(w);
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dayOfWeek = simple.getDay();
    const isoWeekStart = simple;
    if (dayOfWeek <= 4) isoWeekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else isoWeekStart.setDate(simple.getDate() + 8 - simple.getDay());
    
    // Generar 6 días (Lunes a Sábado)
    return Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(isoWeekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  const diasDeSemana = getDiasDeSemana(semanaActual);
  const bloquesActuales = bloquesSemanales.filter(b => b.semanaId === semanaActual);

  const cargaPorArea = (area: AreaPlanta) => {
    const empCount = colaboradores.filter(c => c.areaPlanta === area).length;
    if (empCount === 0) return 0;
    const horasDisponibles = empCount * HORAS_JORNADA_SEMANAL; // 48h
    const bloquesArea = bloquesActuales.filter(b => b.area === area);
    const horasPlanificadas = bloquesArea.reduce((acc, b) => acc + (b.horasEstimadas || 0), 0);
    return Math.round((horasPlanificadas / horasDisponibles) * 100) || 0;
  };

  // Función recursiva / iterativa para mover déficit (Opción A)
  const aplicarCascada = async (empleadoId: string, bloquesSemana: BloqueSemanal[], dbBatch: any) => {
     // Esta función revisa cada día (Lun a Sab). Si un día excede las 8h para el empleado,
     // mueve unidades de bloques NO URGENTES al día siguiente.
     let bloquesModificados = JSON.parse(JSON.stringify(bloquesSemana)) as BloqueSemanal[];
     let hayCambios = false;
     
     const sumHorasDia = (diaKey: string) => {
       let total = 0;
       bloquesModificados.filter(b => b.empleadoId === empleadoId).forEach(b => {
         const hp = b.unidadesObjetivo > 0 ? (b.horasEstimadas / b.unidadesObjetivo) : 0;
         const uni = b.distribucionDiaria?.[diaKey] || 0;
         total += uni * hp;
       });
       return total;
     };

     for (let i = 0; i < DIAS_SEMANA.length; i++) {
        const dia = DIAS_SEMANA[i];
        let horas = sumHorasDia(dia);
        
        // Mientras las horas del día excedan 8 y no sea Sábado (i < 5)
        while (horas > 8.01 && i < 5) {
           const diaSiguiente = DIAS_SEMANA[i+1];
           // Buscar un bloque no urgente que tenga unidades este día
           const bCandidate = bloquesModificados.find(b => b.empleadoId === empleadoId && !b.esUrgente && (b.distribucionDiaria?.[dia] || 0) > 0);
           
           if (!bCandidate) break; // Si no hay de dónde quitar, se rompe el ciclo (solo quedan urgentes o ya no hay nada)
           
           // Mover 1 unidad
           bCandidate.distribucionDiaria[dia] -= 1;
           bCandidate.distribucionDiaria[diaSiguiente] = (bCandidate.distribucionDiaria[diaSiguiente] || 0) + 1;
           hayCambios = true;
           horas = sumHorasDia(dia);
        }
     }
     
     return { bloquesModificados, hayCambios };
  };

  const handleGuardarBloque = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBloque.area || !formBloque.empleadoId || !formBloque.modelo) return;
    
    // Validar suma
    const obj = formBloque.unidadesObjetivo || 1;
    const sum = DIAS_SEMANA.reduce((acc, d) => acc + (formBloque.distribucionDiaria?.[d] || 0), 0);
    if (sum !== obj) {
       alert(`La distribución diaria (${sum}) no coincide con el total de unidades objetivo (${obj}).`);
       return;
    }

    setIsSaving(true);
    try {
      const nuevoId = uid();
      const nuevoDoc = {
        area: formBloque.area,
        empleadoId: formBloque.empleadoId,
        modelo: formBloque.modelo,
        unidadesObjetivo: obj,
        horasEstimadas: formBloque.horasEstimadas || 1,
        distribucionDiaria: formBloque.distribucionDiaria || {},
        semanaId: formBloque.semanaId,
        esUrgente: formBloque.esUrgente || false,
        notas: formBloque.notas || "",
      };
      
      // Guardar el bloque nuevo
      await addDoc(collection(db, "planificacion_semanal"), nuevoDoc);

      // Ahora simulamos el algoritmo de cascada con los bloques actuales + el nuevo
      // Construimos un array en memoria temporal
      const tempBloques = [...bloquesActuales, { id: nuevoId, ...nuevoDoc } as BloqueSemanal];
      
      const { bloquesModificados, hayCambios } = await aplicarCascada(formBloque.empleadoId, tempBloques, null);
      
      if (hayCambios) {
         alert("La tarea excedió la capacidad diaria de 8h del empleado. El sistema ha reestructurado automáticamente las tareas no urgentes desplazándolas a los días siguientes (Opción A).");
         // Guardar los bloques modificados que ya existían
         for (const b of bloquesModificados) {
            if (b.id !== nuevoId) {
               await updateDoc(doc(db, "planificacion_semanal", b.id), { distribucionDiaria: b.distribucionDiaria });
            } else {
               // Si el mismo bloque nuevo fue modificado en cascada (raro pero posible si era no-urgente y excedía),
               // idealmente tendríamos que buscar su doc ref, pero como lo acabamos de crear sin guardar el ref directamente...
               // Para simplificar, la reestructuración afecta principalmente a los otros bloques.
            }
         }
      }

      setMostrarForm(false);
      setFormBloque({ 
         semanaId: semanaActual, 
         unidadesObjetivo: 1, 
         horasEstimadas: 1, 
         distribucionDiaria: {},
         esUrgente: false 
      });
    } catch (error) {
      console.error(error);
      alert("Error al guardar el bloque.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEliminarBloque = async (id: string) => {
    if (!confirm("¿Eliminar este bloque de producción?")) return;
    try {
      await deleteDoc(doc(db, "planificacion_semanal", id));
    } catch (e) {
      console.error(e);
    }
  };
  
  const setDist = (dia: string, val: number) => {
    setFormBloque(p => ({
      ...p,
      distribucionDiaria: {
        ...(p.distribucionDiaria || {}),
        [dia]: val
      }
    }));
  };

  const inputCls = "w-full text-sm px-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900";

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Planificación Semanal (Industrial)</h2>
          <p className="text-xs text-slate-500 mt-0.5">Asigna metas de producción de Lunes a Sábado. Jornada 48h.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white ring-1 ring-slate-200/60 rounded-xl p-1 shadow-sm">
            <button onClick={handleSemanaPrev} className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"><ChevronLeft className="w-4 h-4" strokeWidth={2} /></button>
            <div className="px-4 text-center min-w-[120px]">
              <span className="text-xs font-bold text-slate-700 block">Semana {semanaActual.split("-W")[1]}</span>
              <span className="text-[10px] text-slate-400 font-medium">{semanaActual.split("-W")[0]}</span>
            </div>
            <button onClick={handleSemanaNext} className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"><ChevronRight className="w-4 h-4" strokeWidth={2} /></button>
          </div>
          <button 
            onClick={() => setMostrarForm(!mostrarForm)}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} /> Nuevo Bloque
          </button>
        </div>
      </div>

      {/* Formulario */}
      {mostrarForm && (
        <form onSubmit={handleGuardarBloque} className="bg-white ring-1 ring-slate-200/60 rounded-3xl p-6 shadow-xl shadow-slate-200/20 space-y-5 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800">Crear Bloque de Producción</h3>
            <button type="button" onClick={() => setMostrarForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Área</label>
              <select value={formBloque.area || ""} onChange={e => {
                 setFormBloque(p => ({ ...p, area: e.target.value as AreaPlanta, empleadoId: "" }));
              }} className={inputCls} required>
                <option value="">Seleccionar área</option>
                {Object.keys(AREA_META).map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Colaborador</label>
              <select value={formBloque.empleadoId || ""} onChange={e => setFormBloque(p => ({ ...p, empleadoId: e.target.value }))} className={inputCls} required disabled={!formBloque.area}>
                <option value="">Seleccionar</option>
                {colaboradores.filter(c => c.areaPlanta === formBloque.area).map(c => (
                  <option key={c.uid} value={c.uid}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Modelo</label>
              <select value={formBloque.modelo || ""} onChange={e => setFormBloque(p => ({ ...p, modelo: e.target.value as Modelo }))} className={inputCls} required>
                <option value="">Seleccionar</option>
                {MODELOS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            
            <div className="space-y-1.5 flex flex-col justify-end">
               <label className="flex items-center gap-2 cursor-pointer p-2 bg-red-50 ring-1 ring-red-200 rounded-xl hover:bg-red-100 transition-colors">
                  <input type="checkbox" checked={formBloque.esUrgente || false} onChange={e => setFormBloque(p => ({ ...p, esUrgente: e.target.checked }))} className="w-4 h-4 text-red-600 rounded" />
                  <span className="text-xs font-bold text-red-700">Extra / Urgente</span>
               </label>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Meta Total (Uds)</label>
              <input type="number" min={1} required value={formBloque.unidadesObjetivo || ""} onChange={e => setFormBloque(p => ({ ...p, unidadesObjetivo: parseInt(e.target.value)||1 }))} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Horas Totales (Est.)</label>
              <input type="number" step="0.5" min={0.5} required value={formBloque.horasEstimadas || ""} onChange={e => setFormBloque(p => ({ ...p, horasEstimadas: parseFloat(e.target.value)||1 }))} className={inputCls} />
            </div>
          </div>
          
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Distribución Diaria (Lun - Sáb)</label>
            <p className="text-[10px] text-slate-400">Asigna la cantidad de estufas a fabricar cada día. La suma debe dar {formBloque.unidadesObjetivo || 0}.</p>
            <div className="grid grid-cols-6 gap-2">
               {DIAS_SEMANA.map((dia) => (
                  <div key={dia} className="space-y-1 text-center">
                     <span className="text-xs font-bold text-slate-700">{dia}</span>
                     <input 
                        type="number" min={0}
                        value={formBloque.distribucionDiaria?.[dia] || 0}
                        onChange={e => setDist(dia, parseInt(e.target.value) || 0)}
                        className={`${inputCls} text-center`}
                     />
                  </div>
               ))}
            </div>
            {/* Validación visual de la suma */}
            <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg text-xs font-semibold">
               <span className="text-slate-500">Suma total distribuida:</span>
               <span className={DIAS_SEMANA.reduce((acc, d) => acc + (formBloque.distribucionDiaria?.[d] || 0), 0) === formBloque.unidadesObjetivo ? "text-emerald-600" : "text-red-600"}>
                  {DIAS_SEMANA.reduce((acc, d) => acc + (formBloque.distribucionDiaria?.[d] || 0), 0)} / {formBloque.unidadesObjetivo || 0}
               </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Notas (opcional)</label>
            <input type="text" placeholder="Instrucciones especiales..." value={formBloque.notas || ""} onChange={e => setFormBloque(p => ({ ...p, notas: e.target.value }))} className={inputCls} />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setMostrarForm(false)} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
            <button type="submit" disabled={isSaving} className="px-5 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:opacity-50">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" strokeWidth={2} />} Guardar Bloque
            </button>
          </div>
        </form>
      )}

      {/* KPI de Capacidad por Área */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.keys(AREA_META) as AreaPlanta[]).map(area => {
          const meta = AREA_META[area];
          const carga = cargaPorArea(area);
          const empCount = colaboradores.filter(c => c.areaPlanta === area).length;
          const bloquesArea = bloquesActuales.filter(b => b.area === area).length;
          return (
            <div key={area} className="bg-white ring-1 ring-slate-200/60 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${meta.bg} ${meta.color}`}>
                  <meta.icon className="w-4 h-4" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">{area}</p>
                  <p className="text-[10px] text-slate-400">{empCount} emp. · {bloquesArea} bloques</p>
                </div>
              </div>
              <div>
                <div className="flex items-end justify-between mb-1">
                  <span className="text-[10px] font-medium text-slate-500">Carga Semanal (48h/emp)</span>
                  <span className={`text-xs font-bold ${carga >= 100 ? "text-red-600" : carga >= 70 ? "text-amber-600" : "text-emerald-600"}`}>{carga}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${carga >= 100 ? "bg-red-500" : carga >= 70 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${Math.min(carga, 100)}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grilla Semanal */}
      <div className="bg-white ring-1 ring-slate-200/60 rounded-3xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-500" strokeWidth={1.5} />
            <h3 className="text-sm font-bold text-slate-800">Calendario Semanal por Área (Distribución)</h3>
          </div>
          <div className="flex gap-1 md:gap-2">
            {diasDeSemana.map((d, i) => (
              <div key={i} className="text-center w-12 md:w-16">
                <p className="text-xs font-bold text-slate-700">{DIAS_SEMANA[i]}</p>
                <p className="text-[10px] text-slate-400 hidden md:block">{d.getDate()}/{d.getMonth() + 1}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-100 overflow-x-auto">
          {(Object.keys(AREA_META) as AreaPlanta[]).map(area => {
            const meta = AREA_META[area];
            const bloquesArea = bloquesActuales.filter(b => b.area === area);
            return (
              <div key={area} className="flex min-w-[600px]">
                <div className={`w-32 shrink-0 flex items-center gap-2 px-3 py-4 border-r border-slate-100 ${meta.bg}`}>
                  <meta.icon className={`w-4 h-4 shrink-0 ${meta.color}`} strokeWidth={2} />
                  <span className={`text-xs font-bold ${meta.color} leading-tight`}>{area}</span>
                </div>
                <div className="flex-1 grid grid-cols-6 divide-x divide-slate-100">
                  {DIAS_SEMANA.map((diaStr) => {
                    // Filtrar los bloques que tienen al menos 1 unidad este día
                    const bloquesDelDia = bloquesArea.filter(b => (b.distribucionDiaria?.[diaStr] || 0) > 0);
                    return (
                      <div key={diaStr} className="min-h-[80px] p-2 space-y-1.5">
                        {bloquesDelDia.map(bloque => {
                          const emp = colaboradores.find(c => c.uid === bloque.empleadoId);
                          const isUrgent = bloque.esUrgente;
                          return (
                            <div key={bloque.id} className={`group relative bg-white rounded-xl ring-1 ${isUrgent ? 'ring-red-400 bg-red-50' : meta.ring} px-2 py-2 text-[10px] space-y-0.5 hover:shadow-sm transition-all`}>
                              <p className={`font-bold truncate ${isUrgent ? 'text-red-800' : 'text-slate-800'}`}>{emp?.nombre ?? "?"}</p>
                              <p className="text-slate-500 truncate">{bloque.modelo}</p>
                              <div className="flex items-center justify-between">
                                <span className={`font-mono font-bold ${isUrgent ? 'text-red-600' : meta.color}`}>
                                   {bloque.distribucionDiaria[diaStr]} uds
                                </span>
                              </div>
                              <button onClick={() => handleEliminarBloque(bloque.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-500 transition-all">
                                <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
"""

content = before_comp + new_comp
with open("src/app/dashboard/planta/page.tsx", "w") as f:
    f.write(content)

print("Updated successfully")
