import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Trash2, Loader2, User, Briefcase, MessageSquare, ChevronDown,
  Paperclip, FileUp, Download, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { useApp } from '../../context/AppContext';
import {
  normalizeEntrevistasDiagnosis,
  useEntrevistas,
  type AgentErrorPayload,
  type EntrevistaLocal as Entrevista,
  type EntrevistasDiagnosis,
} from '../../hooks/useEntrevistas';
import { useSoundManager } from '../../hooks/useSoundManager';
import { supabase } from '../../lib/supabase';
import PhaseHeader from './_shared/PhaseHeader';
import NextPhaseButton from './_shared/NextPhaseButton';
import EntrevistasDiagnosisView from './entrevistas/EntrevistasDiagnosisView';
import { ConfirmModal, DetailPanel, EmptyStatePanel, FormPanel, type PanelMode } from './entrevistas/EntrevistasPanels';
import { LoadingRouteState, MissingProjectState } from '../layout/RouteState';

// Using Entrevista from hook now

// ---------------------------------------------------------------------------
function AgentErrorCard({ error }: { error: AgentErrorPayload }) {
  return (
    <div className="rounded-2xl border border-[#ef4444]/25 bg-white overflow-hidden" style={{ boxShadow: '0 18px 44px -30px rgba(239,68,68,0.35)' }}>
      <div className="h-1.5 bg-[#ef4444]" />
      <div className="p-5 flex gap-4">
        <div className="w-10 h-10 rounded-2xl bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20 flex items-center justify-center flex-shrink-0">
          <AlertTriangle size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-neutral-950 text-[15px]" style={{ fontWeight: 750 }}>El agente no pudo completar el analisis</p>
          <p className="text-neutral-600 text-[13px] leading-relaxed mt-1">{error.message}</p>
          {error.details && <p className="text-neutral-500 text-[12px] leading-relaxed mt-2">{error.details}</p>}
          {error.code && (
            <span className="inline-flex mt-3 px-2.5 py-1 rounded-full bg-[#ef4444]/10 text-[#b91c1c] border border-[#ef4444]/20 text-[10px]" style={{ fontWeight: 750 }}>
              {error.code}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export default function EntrevistasModule() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updatePhaseStatus, reprocessPhase, isLoading } = useApp();
  const { playAgentSuccess, playProcessError, playPhaseComplete } = useSoundManager();

  const project = getProject(projectId!);
  const phase = project?.phases.find(p => p.number === 2);

  // ---- Real hook state ----
  const {
    entrevistas,
    setEntrevistas,
    isLoadingData,
    isProcessing,
    diagnosis,
    agentError,
    fetchInitialData,
    saveEntrevista,
    deleteEntrevista,
    processPhase,
  } = useEntrevistas(projectId!);

  const [liveDiagnosis, setLiveDiagnosis] = useState<EntrevistasDiagnosis | null>(null);

  type PanelMode = 'empty' | 'detail' | 'new' | 'edit';

  // ---- Master-Detail state ----
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>('empty');

  // ---- Form state ----
  const EMPTY_FORM = { nombre: '', cargo: '', area: '', notas: '', file: undefined as File | undefined };
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [showConfirm, setShowConfirm]       = useState(false);
  const [isSending, setIsSending]           = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [registeredExpanded, setRegisteredExpanded] = useState(false);
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const visibleDiagnosis = liveDiagnosis ?? diagnosis;
  const hasDiagnosis = Boolean(visibleDiagnosis);
  const isCompleted = hasDiagnosis;
  const isPhaseProcessing = !hasDiagnosis && !agentError && (phase?.status === 'procesando' || isProcessing || isSending);

  useEffect(() => {
    if (phase?.agentData) {
      const data = phase.agentData as any;
      if (data?._error || data?.metadata?.status === 'error') {
        setLiveDiagnosis(null);
        setIsSending(false);
        return;
      }
      const parsed = normalizeEntrevistasDiagnosis(data);
      if (parsed) {
        setLiveDiagnosis(parsed);
        setIsSending(false);
      } else if (phase?.status !== 'procesando') {
        setLiveDiagnosis(null);
      }
    } else if (phase?.status === 'disponible' || phase?.status === 'bloqueado') {
      setLiveDiagnosis(null);
      setIsSending(false);
    }
  }, [phase?.agentData, phase?.status]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const keepProcessingIfAgentStarted = async () => {
    if (!projectId) return false;
    const { data } = await supabase
      .from('fases_estado')
      .select('estado_visual')
      .eq('proyecto_id', projectId)
      .eq('numero_fase', 2)
      .single();

    if (data?.estado_visual === 'procesando') {
      setIsSending(false);
      toast.info('El Agente 2 sigue en ejecucion.', {
        description: 'Seguiremos esperando el resultado guardado en Supabase.',
      });
      return true;
    }

    return false;
  };

  // ---- Handlers (declared before early returns) ──────────────────────────────
  const handleDownloadZip = async () => {
    if (entrevistas.length === 0) {
      toast.error('No hay entrevistas registradas.');
      return;
    }

    setIsDownloadingZip(true);
    const zip = new JSZip();
    const folder = zip.folder("Entrevistas_PMO");

    try {
      for (const e of entrevistas) {
        if (e.storagePath && e.fileName) {
          try {
            let fileData: Blob | null = null;
            if (e.storagePath.startsWith('http')) {
              try {
                const res = await fetch(e.storagePath);
                if (res.ok) {
                  fileData = await res.blob();
                } else if (res.status === 403 || res.status === 401 || !res.ok) {
                  // Probablemente el token expiró, intentamos extraer el path y descargar vía SDK
                  const pathMatch = e.storagePath.match(/documentos-pmo\/(.+?)(?:\?token=|$)/);
                  const rawPath = pathMatch ? decodeURIComponent(pathMatch[1]) : e.storagePath;
                  
                  if (rawPath) {
                    const { data: storageBlob, error: storageErr } = await supabase.storage
                      .from('documentos-pmo')
                      .download(rawPath);
                    if (!storageErr) fileData = storageBlob;
                  }
                }
              } catch (fetchErr) {
                console.warn("Fetch falló, intentando descarga directa...", fetchErr);
                // Fallback catch
                const pathMatch = e.storagePath.match(/documentos-pmo\/(.+?)(?:\?token=|$)/);
                const rawPath = pathMatch ? decodeURIComponent(pathMatch[1]) : e.storagePath;
                if (rawPath) {
                  const { data: storageBlob, error: storageErr } = await supabase.storage
                    .from('documentos-pmo')
                    .download(rawPath);
                  if (!storageErr) fileData = storageBlob;
                }
              }
            } 
            
            // Si aún no tenemos data (o no era una URL), intentamos descarga directa con el path guardado
            if (!fileData && !e.storagePath.startsWith('http')) {
              const pathMatch = e.storagePath.match(/documentos-pmo\/(.+?)(?:\?token=|$)/);
              const rawPath = pathMatch ? decodeURIComponent(pathMatch[1]) : e.storagePath;
              
              const { data: storageBlob, error: storageErr } = await supabase.storage
                .from('documentos-pmo')
                .download(rawPath);
              if (!storageErr) fileData = storageBlob;
            }

            if (fileData) {
              folder?.file(e.fileName, fileData);
            } else {
              folder?.file(`${e.nombre}_error_descarga.txt`, `No se pudo obtener el archivo original: ${e.fileName}\nPath: ${e.storagePath}`);
            }
          } catch (err) {
            console.error(`Error al procesar archivo ${e.fileName}:`, err);
            folder?.file(`${e.nombre}_error_critico.txt`, `Error inesperado al descargar ${e.fileName}`);
          }
        } else {
          const content = `ENTREVISTA REGISTRADA\n\nNombre: ${e.nombre}\nCargo: ${e.cargo}\nÁrea: ${e.area}\nFecha: ${e.createdAt || 'N/A'}\n\nNOTAS:\n${e.notas}`;
          const safeName = e.nombre.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          folder?.file(`${safeName}.txt`, content);
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Entrevistas_${project?.companyName.replace(/\s+/g, '_') || 'Proyecto'}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Archivo comprimido generado con éxito');
    } catch (error) {
      console.error('Error generando el ZIP:', error);
      toast.error('Error al generar el archivo comprimido.');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleSelectInterview = (e: Entrevista) => {
    setSelectedId(e.id);
    setPanelMode('detail');
  };

  const handleNewInterview = () => {
    setSelectedId(null);
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setPanelMode('new');
  };

  const handleNewDocumentBanco = () => {
    setSelectedId(null);
    setFormData({ ...EMPTY_FORM, cargo: 'No aplica', area: 'No aplica' });
    setFormErrors({});
    setPanelMode('new');
  };

  const handleEdit = () => {
    const entrevista = entrevistas.find(e => e.id === selectedId);
    if (!entrevista) return;
    setFormData({ nombre: entrevista.nombre, cargo: entrevista.cargo, area: entrevista.area, notas: entrevista.notas });
    setFormErrors({});
    setPanelMode('edit');
  };

  const handleDelete = async (entrevista: Entrevista) => {
    try {
      await deleteEntrevista(entrevista);
      if (selectedId === entrevista.id) {
        setSelectedId(null);
        setPanelMode('empty');
      }
    } catch (error) {
      console.error('Error al eliminar entrevista:', error);
    }
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFormErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!formData.nombre.trim()) errs.nombre = 'El nombre es requerido.';
    if (!formData.cargo.trim()) errs.cargo = 'El cargo es requerido.';
    if (!formData.notas.trim() && !formData.file) errs.notas = 'Las notas o el archivo de la entrevista son requeridos.';
    return errs;
  };

  const handleSave = async () => {
    const errs = validateForm();
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }

    const loadingToast = toast.loading('Guardando...');
    try {
      if (panelMode === 'edit' && selectedId) {
        const existing = entrevistas.find(e => e.id === selectedId);
        if (existing) {
          const payload = { ...existing, ...formData };
          const result = await saveEntrevista(payload);
          setEntrevistas(prev =>
            prev.map(e => e.id === selectedId ? { ...e, ...payload, storagePath: result.storagePath, fileName: result.fileName } : e)
          );
        }
        toast.success('Entrevista actualizada', { id: loadingToast });
        setPanelMode('detail');
      } else {
        const newE: Entrevista = {
          id: `local_${Date.now()}`,
          ...formData,
          createdAt: new Date().toLocaleDateString('es-CO'),
        };
        const result = await saveEntrevista(newE);
        newE.id = result.dbId;
        newE.dbId = result.dbId;
        newE.storagePath = result.storagePath;
        newE.fileName = result.fileName;
        setEntrevistas(prev => [...prev, newE]);
        setSelectedId(result.dbId);
        setPanelMode('detail');
        toast.success('Entrevista guardada', { id: loadingToast });
      }
      setFormErrors({});
    } catch (error) {
      toast.error('Error al guardar la entrevista', { id: loadingToast });
    }
  };

  const handleCancelForm = () => {
    setFormErrors({});
    if (panelMode === 'edit' && selectedId) {
      setPanelMode('detail');
    } else {
      setSelectedId(null);
      setPanelMode('empty');
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsBulkUploading(true);
    const toastId = toast.loading(`Subiendo ${files.length} entrevistas...`);
    
    let successCount = 0;
    const newEntrevistas: Entrevista[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        toast.loading(`Procesando (${i + 1}/${files.length}): ${file.name}`, { id: toastId });

        const newE: Entrevista = {
          id: `local_bulk_${Date.now()}_${i}`,
          nombre: file.name.replace(/\.[^/.]+$/, "").replace(/_/g, ' '), // Nombre basado en archivo
          cargo: 'Por definir',
          area: 'Por definir',
          notas: `Entrevista cargada mediante archivo: ${file.name}`,
          file: file,
          createdAt: new Date().toLocaleDateString('es-CO'),
        };

        try {
          const result = await saveEntrevista(newE);
          newE.id = result.dbId;
          newE.dbId = result.dbId;
          newE.storagePath = result.storagePath;
          newE.fileName = result.fileName;
          newEntrevistas.push(newE);
          successCount++;
        } catch (err) {
          console.error(`Error subiendo ${file.name}:`, err);
          toast.error(`Error con ${file.name}`, { description: 'Se omitió este archivo.' });
        }
      }

      setEntrevistas(prev => [...prev, ...newEntrevistas]);
      toast.success(`¡Carga masiva completada!`, { 
        id: toastId, 
        description: `Se agregaron ${successCount} entrevistas exitosamente.` 
      });
    } catch (error) {
      toast.error('Error en la carga masiva', { id: toastId });
    } finally {
      setIsBulkUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleMarkComplete = () => {
    if (entrevistas.length === 0) {
      toast.error('Agregue al menos una entrevista antes de continuar.');
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirmSend = async () => {
    setIsSending(true);
    setShowConfirm(false);
    updatePhaseStatus(projectId!, 2, 'procesando');

    try {
      const result = await processPhase();
      if (result) {
        setLiveDiagnosis(result);
        updatePhaseStatus(projectId!, 2, 'completado', 'Análisis consolidado de entrevistas completado.');
        playPhaseComplete();
        toast.success('¡Fase 2 completada!', { description: 'El Agente ha finalizado el análisis de entrevistas.' });
        await fetchInitialData();
      }
    } catch {
      if (await keepProcessingIfAgentStarted()) return;
      updatePhaseStatus(projectId!, 2, 'disponible');
      playProcessError();
    } finally {
      setIsSending(false);
    }
  };

  if (!project) {
    return isLoading
      ? <LoadingRouteState message="Cargando el proyecto y las entrevistas..." />
      : <MissingProjectState />;
  }

  if (isLoadingData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-screen bg-[#f7f8ff] gap-3">
        <Loader2 className="animate-spin text-neutral-400" size={24} />
        <span className="text-neutral-500 text-[13px]" style={{ fontWeight: 500 }}>Cargando datos de la fase...</span>
      </div>
    );
  }

  // Derive currently selected interview object
  const selectedEntrevista = entrevistas.find(e => e.id === selectedId) ?? null;

  return (
    <div className="min-h-screen bg-[#f7f8ff]">
      <PhaseHeader
        projectId={projectId!}
        companyName={project.companyName}
        phaseNumber={2}
        phaseName="Registro de Entrevistas"
        eyebrow={isCompleted ? 'Completada' : `${entrevistas.length} entrevistas`}
        onReprocessed={async () => {
          await reprocessPhase(projectId!, 2);
          setLiveDiagnosis(null);
          setSelectedId(null);
          setPanelMode('empty');
          setExpandedId(null);
          setRegisteredExpanded(false);
          setIsSending(false);
          await fetchInitialData();
        }}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Processing overlay */}
      {/* ------------------------------------------------------------------ */}
      <AnimatePresence>
        {isPhaseProcessing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-[#f7f8ff]/85 backdrop-blur-md flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full border border-neutral-200 bg-white flex items-center justify-center mb-5" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <Loader2 size={22} className="text-neutral-700 animate-spin" strokeWidth={1.75} />
            </div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#5454e9] mb-2" style={{ fontWeight: 500 }}>Procesando</p>
            <h2 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '1.25rem', letterSpacing: '-0.01em' }}>
              Consolidando entrevistas
            </h2>
            <p className="text-[#5454e9] text-[13px] mt-2">El Agente está analizando los registros…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------------ */}
      {/* Main content */}
      {/* ------------------------------------------------------------------ */}
      <div className="max-w-[1100px] mx-auto px-10 py-10">
        <div className="mb-10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-3" style={{ fontWeight: 500 }}>Fase 2 · Entrevistas a stakeholders</p>
          <h1 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '2.25rem', lineHeight: 1.05, letterSpacing: '-0.025em' }}>
            {isCompleted ? 'Entrevistas analizadas' : 'Registro de entrevistas'}
          </h1>
          <p className="text-neutral-500 text-[14px] mt-3 max-w-2xl leading-relaxed">
            {isCompleted ? 'El Agente 2 consolidó hallazgos, temas recurrentes y patrones de conversación.' : 'Documente las conversaciones con stakeholders clave. El Agente 2 analizará patrones y temas emergentes.'}
          </p>

          <div className="grid grid-cols-3 gap-px bg-neutral-200/60 rounded-2xl overflow-hidden mt-7 border border-neutral-200/60">
            <div className="bg-white px-5 py-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Entrevistas</p>
              <p className="mt-1.5 text-neutral-900 tabular-nums" style={{ fontWeight: 500, fontSize: '1.375rem', letterSpacing: '-0.02em' }}>
                {entrevistas.length}
              </p>
            </div>
            <div className="bg-white px-5 py-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Áreas cubiertas</p>
              <p className="mt-1.5 text-neutral-900 tabular-nums" style={{ fontWeight: 500, fontSize: '1.375rem', letterSpacing: '-0.02em' }}>
                {new Set(entrevistas.map(e => e.area)).size}
              </p>
            </div>
            <div className="bg-white px-5 py-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Estado</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-neutral-900'}`} />
                <p className="text-neutral-900 text-[13px]" style={{ fontWeight: 500 }}>
                  {isCompleted ? 'Completada' : 'En curso'}
                </p>
              </div>
            </div>
          </div>
        </div>
        {agentError && !isCompleted && (
          <div className="mb-8">
            <AgentErrorCard error={agentError} />
          </div>
        )}
        {isCompleted ? (
          /* ======================================================= */
          /* COMPLETED VIEW                                           */
          /* ======================================================= */
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex flex-col gap-5">

              {/* Agent diagnosis */}
              {visibleDiagnosis && <EntrevistasDiagnosisView diagnosis={visibleDiagnosis} />}
              {agentError && <AgentErrorCard error={agentError} />}
              {/* Read-only accordion list */}
              <div className="bg-white rounded-2xl border border-neutral-200/70 overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                <div className={`px-6 py-4 flex items-center justify-between gap-4 hover:bg-neutral-50 transition-colors ${registeredExpanded ? 'border-b border-neutral-100' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setRegisteredExpanded((open) => !open)}
                    className="flex items-center gap-2 min-w-0 text-left flex-1"
                  >
                    <MessageSquare size={13} className="text-neutral-500 flex-shrink-0" strokeWidth={1.75} />
                    <h3 className="text-neutral-900 text-[13px] truncate" style={{ fontWeight: 500 }}>Entrevistas registradas</h3>
                    <span className="text-[11px] text-neutral-400 tabular-nums flex-shrink-0">{entrevistas.length}</span>
                  </button>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                      type="button"
                      onClick={handleDownloadZip}
                      disabled={isDownloadingZip}
                      className="flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-neutral-900 transition-colors disabled:opacity-50"
                      style={{ fontWeight: 500 }}
                    >
                      {isDownloadingZip ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                      Descargar todo
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegisteredExpanded((open) => !open)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                      title={registeredExpanded ? 'Ocultar entrevistas' : 'Mostrar entrevistas'}
                    >
                      <ChevronDown size={13} className={`transition-transform ${registeredExpanded ? 'rotate-180' : ''}`} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
                <AnimatePresence initial={false}>
                  {registeredExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="p-6 space-y-2">
                        {entrevistas.map(e => (
                          <div key={e.id}>
                            <button
                              onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                              className="w-full flex items-center justify-between p-3 bg-neutral-50 rounded-xl hover:bg-neutral-100 transition-colors"
                            >
                              <div className="flex items-center gap-3 text-left">
                                <div className="w-8 h-8 rounded-full bg-white border border-neutral-200/80 flex items-center justify-center">
                                  <User size={13} className="text-neutral-700" strokeWidth={1.75} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-neutral-900 text-[13px]" style={{ fontWeight: 500 }}>{e.nombre}</p>
                                    {e.fileName && (
                                      <span className="bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border border-neutral-200/60">
                                        <Paperclip size={10} /> PDF
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-neutral-500 text-[11px]">{e.cargo} · {e.area}</p>
                                </div>
                              </div>
                              <ChevronDown size={13} className={`text-neutral-400 transition-transform ${expandedId === e.id ? 'rotate-180' : ''}`} strokeWidth={1.75} />
                            </button>
                            <AnimatePresence>
                              {expandedId === e.id && (
                                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                  <p className="text-neutral-700 text-[13px] p-4 leading-relaxed bg-neutral-50 rounded-b-xl border-t border-neutral-100 whitespace-pre-wrap">
                                    {e.notas}
                                  </p>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>
          </motion.div>
        ) : (
          /* ======================================================= */
          /* ACTIVE VIEW — Master-Detail                              */
          /* ======================================================= */
          <div className="grid grid-cols-5 gap-5">
            {/* ---- LEFT: Interview list ---- */}
            <div className="col-span-2 flex flex-col">
              <motion.button
                whileHover={{ y: -1 }} whileTap={{ y: 0 }}
                onClick={handleNewInterview}
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-neutral-300 text-neutral-700 text-[13px] mb-2 transition-all hover:bg-white hover:border-neutral-400"
                style={{ fontWeight: 500 }}
              >
                <Plus size={14} strokeWidth={1.75} />
                Agregar nueva entrevista
              </motion.button>

              <motion.button
                whileHover={{ y: -1 }} whileTap={{ y: 0 }}
                onClick={() => bulkInputRef.current?.click()}
                disabled={isBulkUploading}
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-neutral-300 text-neutral-700 text-[13px] mb-2 transition-all hover:bg-white hover:border-neutral-400 disabled:opacity-50"
                style={{ fontWeight: 500 }}
              >
                {isBulkUploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} strokeWidth={1.75} />}
                Carga masiva de PDFs
              </motion.button>

              <input
                ref={bulkInputRef}
                type="file"
                multiple
                accept=".pdf"
                className="hidden"
                onChange={handleBulkUpload}
              />
              
              <motion.button
                whileHover={{ y: -1 }} whileTap={{ y: 0 }}
                onClick={handleNewDocumentBanco}
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-neutral-300 text-neutral-700 text-[13px] mb-4 transition-all hover:bg-neutral-50 hover:border-neutral-400"
                style={{ fontWeight: 500 }}
              >
                <FileUp size={14} strokeWidth={1.75} />
                Agregar documento con banco de entrevistas
              </motion.button>

              {/* List */}
              <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {entrevistas.length === 0 && (
                  <div className="text-center py-10 text-neutral-400">
                    <MessageSquare size={22} className="mx-auto mb-2 opacity-40" strokeWidth={1.5} />
                    <p className="text-[13px]">No hay entrevistas aún</p>
                  </div>
                )}
                {entrevistas.map(e => {
                  const isSelected = selectedId === e.id;
                  return (
                    <motion.div
                      key={e.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={() => handleSelectInterview(e)}
                      className={`bg-white rounded-xl border p-4 cursor-pointer transition-all
                        ${isSelected
                          ? 'border-neutral-900'
                          : 'border-neutral-200/70 hover:border-neutral-300'
                        }
                      `}
                      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-neutral-900' : 'bg-neutral-50 border border-neutral-200/70'}`}>
                            <User size={13} className={isSelected ? 'text-white' : 'text-neutral-600'} strokeWidth={1.75} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-neutral-900 text-[13px] truncate" style={{ fontWeight: 500 }}>
                              {e.nombre}
                            </p>
                            <p className="text-neutral-500 text-[11px] flex items-center gap-1 mt-0.5 truncate">
                              <Briefcase size={9} strokeWidth={1.75} /> {e.cargo}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(ev) => { ev.stopPropagation(); handleDelete(e); }}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-300 hover:text-rose-600 hover:bg-rose-50 transition-colors flex-shrink-0"
                        >
                          <Trash2 size={12} strokeWidth={1.75} />
                        </button>
                      </div>

                      <p className="text-neutral-500 text-[11px] line-clamp-2 leading-relaxed pl-10">
                        {e.notas}
                      </p>

                      <div className="flex items-center justify-between mt-2 pl-10">
                        <p className="text-neutral-400 text-[11px] tabular-nums">{e.createdAt}</p>
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-neutral-500" style={{ fontWeight: 500 }}>
                            <span className="w-1 h-1 rounded-full bg-neutral-900" /> Seleccionado
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* ---- RIGHT: Detail / Form / Empty ---- */}
            <div className="col-span-3">
              <div className="bg-white rounded-2xl border border-neutral-200/70 p-6 sticky top-24 min-h-[480px] flex flex-col" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                <AnimatePresence mode="wait">
                  {panelMode === 'empty' && (
                    <EmptyStatePanel key="empty" />
                  )}

                  {panelMode === 'detail' && selectedEntrevista && (
                    <DetailPanel
                      key={`detail-${selectedEntrevista.id}`}
                      entrevista={selectedEntrevista}
                      onEdit={handleEdit}
                      onDelete={() => handleDelete(selectedEntrevista)}
                    />
                  )}

                  {(panelMode === 'new' || panelMode === 'edit') && (
                    <FormPanel
                      key={panelMode}
                      mode={panelMode}
                      formData={formData}
                      formErrors={formErrors}
                      onChange={handleFormChange}
                      onSave={handleSave}
                      onCancel={handleCancelForm}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Bottom action */}
      {/* ------------------------------------------------------------------ */}
      {!isCompleted && !isPhaseProcessing && (
        <div className="max-w-[1100px] mx-auto px-10 pb-12">
          <div className="flex justify-end pt-8 border-t border-neutral-200/60">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ y: 0 }}
              onClick={handleMarkComplete}
              disabled={entrevistas.length === 0}
              className="px-6 py-3 rounded-full text-white text-[13px] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{ background: '#5454e9', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}
            >
              Enviar al Agente
            </motion.button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Confirm Modal */}
      {/* ------------------------------------------------------------------ */}
      <ConfirmModal
        open={showConfirm}
        count={entrevistas.length}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleConfirmSend}
        isLoading={isSending}
      />

      <NextPhaseButton projectId={projectId!} nextPhase={3} prevPhase={1} show={isCompleted} />
    </div>
  );
}
