import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, QrCode, Copy, ClipboardEdit, Globe, CheckCircle2,
  Loader2, AlertTriangle, Users, Send, TrendingUp, UserCheck, Sparkles, Trash2, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import { useIdoneidad } from '../../hooks/useIdoneidad';
import { useSoundManager } from '../../hooks/useSoundManager';
import PhaseHeader from './_shared/PhaseHeader';
import NextPhaseButton from './_shared/NextPhaseButton';
import IdoneidadDiagnosisView from './idoneidad/IdoneidadDiagnosisView';
import { LoadingRouteState, MissingProjectState } from '../layout/RouteState';
import {
  factorMapping,
  getIdoneidadItemCode,
  getIdoneidadItemScore,
  inferIdoneidadDimension,
  normalizeIdoneidadDiagnosisItems,
} from './idoneidad/idoneidadUtils';

export {
  factorMapping,
  getIdoneidadItemCode,
  getIdoneidadItemScore,
  inferIdoneidadDimension,
  normalizeIdoneidadDiagnosisItems,
  normalizeIdoneidadItems,
} from './idoneidad/idoneidadUtils';

type EntryMethod = null | 'survey' | 'manual';
type ModuleState = 'selection' | 'data-entry' | 'processing' | 'completed';

function ConfirmModal({ open, onCancel, onConfirm, isLoading }: {
  open: boolean; onCancel: () => void; onConfirm: () => void; isLoading: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onCancel} className="absolute inset-0 bg-neutral-900/30 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative bg-white rounded-2xl w-full max-w-md z-10 p-6 border border-neutral-200/70"
            style={{ boxShadow: '0 24px 64px -16px rgba(0,0,0,0.18)' }}
          >
            <div className="flex items-start gap-4 mb-6">
              <div>
                <h3 className="text-neutral-900 mb-1.5 tracking-tight" style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>¿Confirmar envío al Agente IA?</h3>
                <p className="text-neutral-500 text-[13px] leading-relaxed">
                  Al confirmar, los datos de la encuesta se bloquearán y serán enviados al Agente para análisis. Esta acción no puede deshacerse.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={onCancel} className="flex-1 py-2.5 border border-neutral-200/80 rounded-full text-neutral-700 text-[13px] hover:bg-neutral-50 transition-colors" style={{ fontWeight: 500 }}>
                Cancelar
              </button>
              <button onClick={onConfirm} disabled={isLoading}
                className="flex-1 py-2.5 rounded-full text-white text-[13px] flex items-center justify-center gap-2 disabled:opacity-70 hover:-translate-y-px transition-all"
                style={{ background: '#5454e9', fontWeight: 500 }}>
                {isLoading ? <><Loader2 size={13} className="animate-spin" /> Enviando…</> : <><Send size={13} /> Confirmar y enviar</>}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default function IdoneidadModule() {
  // useParams() extrae :id desde la URL dinámica (TODO: usar para queries a Supabase)
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updatePhaseStatus, reprocessPhase, isLoading } = useApp();
  const { playAgentSuccess, playProcessError, playPhaseComplete } = useSoundManager();

  const { activeLink, responses, diagnosis, isLoadingData, externalFile, setExternalFile, existingFileName, existingFileUrl, fetchInitialData, generateLink, processPhase, deleteFile } = useIdoneidad(projectId);

  const project = getProject(projectId!);
  const phase = project?.phases.find(p => p.number === 3);

  const radarData = useMemo(() => {
    if (!diagnosis) return [];
    
    // Debug para ver qué está llegando del agente
    console.log("PMO Agent Diagnosis Data:", diagnosis);

    const items = normalizeIdoneidadDiagnosisItems(diagnosis);
    
    // Fallback: Si no hay ítems detallados o vienen solo las 3 dimensiones generales
    if (items.length === 0 && diagnosis.indicadores) {
      return Object.entries(diagnosis.indicadores).filter(([key]) => key !== 'general').map(([key, data]: [string, any]) => {
        const label = key === 'cultura' ? 'CULTURA (Promedio)' : 
                      key === 'equipo' ? 'EQUIPO (Promedio)' : 
                      key === 'proyecto' ? 'PROYECTO (Promedio)' : key.toUpperCase();
        return {
          subject: label,
          fullLabel: `Dimensión General: ${key}`,
          dimension: key,
          Puntaje: typeof data.promedio === 'number' ? Number(data.promedio.toFixed(1)) : 0,
          AgileZone: 4,
          HybridZone: 8,
          PredictiveZone: 10,
        };
      });
    }

    // Mapeo detallado de los 21 ítems
    return items.map((res: any) => {
      const itemLabel = getIdoneidadItemCode(res);
      const score = getIdoneidadItemScore(res) ?? 0;
      const factorInfo = factorMapping[itemLabel];

      return {
        subject: factorInfo ? factorInfo.name : itemLabel,
        fullLabel: factorInfo ? `${itemLabel} - ${factorInfo.name}` : itemLabel,
        dimension: res.dimension ?? inferIdoneidadDimension(itemLabel),
        Puntaje: score,
        // Thresholds for background zones
        AgileZone: 4,
        HybridZone: 8,
        PredictiveZone: 10,
      };
    });
  }, [diagnosis]);

  const initialState: ModuleState = phase?.status === 'completado' ? 'completed' : 'selection';

  const [moduleState, setModuleState] = useState<ModuleState>(initialState);
  const [entryMethod, setEntryMethod] = useState<EntryMethod>(null);
  const [manualData, setManualData] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const diagnosisRespondentCount = Number(diagnosis?.numero_encuestados) || 0;
  const externalRespondentCount = existingFileUrl && diagnosisRespondentCount > responses.length
    ? diagnosisRespondentCount - responses.length
    : 0;
  const totalRespondentCount = responses.length + externalRespondentCount;

  // Cargar datos iniciales
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const isProcessing = phase?.status === 'procesando' || isSending;

  useEffect(() => {
    if (isProcessing) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isProcessing]);

  useEffect(() => {
    if (phase?.status === 'disponible' || phase?.status === 'error') {
      setModuleState('selection');
    } else if (phase?.status === 'completado') {
      setModuleState('completed');
    }
  }, [phase?.status]);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://pmo.icesi.edu.co';
  const surveyLink = activeLink ? `${baseUrl}/survey/${activeLink}` : 'Generando enlace...';

  const handleGenerateLink = async () => {
    try {
      await generateLink();
      toast.success('Nuevo enlace generado');
    } catch (e) {
      toast.error('Error generando enlace');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(surveyLink).catch(() => { });
    setLinkCopied(true);
    toast.success('Enlace copiado al portapapeles');
    setTimeout(() => setLinkCopied(false), 2500);
  };

  const handleMarkComplete = () => {
    if (entryMethod === 'manual' && !manualData.trim()) {
      toast.error('Ingrese los datos de la encuesta antes de continuar.');
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirmSend = async () => {
    setShowConfirm(false);
    setIsSending(true);
    updatePhaseStatus(projectId!, 3, 'procesando');

    try {
      await processPhase();
      updatePhaseStatus(projectId!, 3, 'completado', 'Diagnóstico generado.');
      setModuleState('completed');
      playPhaseComplete();
      toast.success('¡Fase 3 completada!', { description: 'El Agente ha finalizado el diagnóstico.' });
      await fetchInitialData(); // Refrescar los datos para ver el diagnóstico
    } catch (err: any) {
      toast.error('Error procesando fase', { description: err.message });
      setModuleState('data-entry');
      updatePhaseStatus(projectId!, 3, 'disponible');
      playProcessError();
    } finally {
      setIsSending(false);
    }
  };

  const handleReprocess = async () => {
    try {
      await reprocessPhase(projectId!, 3);
      updatePhaseStatus(projectId!, 3, 'disponible');
      setModuleState('selection');
      setEntryMethod(null);
      setManualData('');
      setShowConfirm(false);
      setExternalFile(null);
      await generateLink();
      await fetchInitialData();
      toast.success('Fase 3 reiniciada', {
        description: 'Puedes recopilar nuevas respuestas o cargar un nuevo archivo antes de enviar al agente.',
      });
    } catch (err: any) {
      toast.error('Error reiniciando fase', { description: err?.message });
      setModuleState('selection');
      updatePhaseStatus(projectId!, 3, 'disponible');
      playProcessError();
    }
  };

  const handleDownloadCSV = () => {
    // Si no hay respuestas online pero hay archivo CSV externo cargado en DB
    if (responses.length === 0 && existingFileUrl) {
      window.open(existingFileUrl, '_blank');
      return;
    }

    // Si hay respuestas online, exportar la tabla a CSV
    if (responses.length > 0) {
      const allKeys = new Set<string>();
      responses.forEach(r => {
        Object.keys(normalizeSurveyAnswersForCSV(r.respuestas)).forEach(k => allKeys.add(k));
      });
      const questionKeys = Array.from(allKeys).sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));

      const headers = ['Nombre_Encuestado', 'Cargo_Encuestado', 'Area_Encuestado', ...questionKeys, 'Fecha_Registro'];

      const rows = responses.map(r => {
        const row = [
          csvEscape(r.nombre_encuestado),
          csvEscape(r.cargo_encuestado),
          csvEscape(r.area_encuestado)
        ];

        const respObj = normalizeSurveyAnswersForCSV(r.respuestas);
        questionKeys.forEach(k => {
          row.push(csvEscape(respObj[k]));
        });

        row.push(csvEscape(new Date(r.created_at).toLocaleString()));
        return row.join(',');
      });

      // UTF-8 BOM para que Excel lea los tildes y eñes correctamente
      const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `respuestas_idoneidad_${projectId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      toast.error('No hay datos disponibles para descargar.');
    }
  };

  if (!project || !phase) {
    return isLoading
      ? <LoadingRouteState message="Cargando el proyecto y la fase de idoneidad..." />
      : <MissingProjectState title="Fase no disponible" description="No pudimos encontrar el proyecto o la fase de idoneidad." />;
  }

  return (
    <div className="min-h-screen bg-[#f7f8ff]">
      <PhaseHeader
        projectId={projectId!}
        companyName={project.companyName}
        phaseNumber={3}
        phaseName="Diagnóstico de Idoneidad"
        eyebrow={moduleState === 'completed' ? 'Completada' : 'Activa'}
        onReprocessed={handleReprocess}
      />

      {/* Processing overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-[#f7f8ff]/85 backdrop-blur-md flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full border border-neutral-200 bg-white flex items-center justify-center mb-5" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <Loader2 size={22} className="text-neutral-700 animate-spin" strokeWidth={1.75} />
            </div>
            <h2 className="text-neutral-900 text-[18px] mb-2 tracking-tight" style={{ fontWeight: 500 }}>
              Analizando respuestas...
            </h2>
            <p className="text-neutral-500 text-[13px] mt-2">El Agente está analizando la idoneidad organizacional…</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-[1100px] mx-auto px-10 py-10">
        <AnimatePresence mode="wait">

          {/* SELECTION */}
          {/* GESTIÓN DE DATOS (ENCUESTA EN LÍNEA + CARGA MANUAL) */}
          {(moduleState === 'selection' || moduleState === 'data-entry') && (
            <motion.div key="selection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-8">
                <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-3" style={{ fontWeight: 500 }}>Fase 3 · Diagnóstico de idoneidad</p>
                <h1 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '2.25rem', lineHeight: 1.05, letterSpacing: '-0.025em' }}>
                  Distribución de la encuesta
                </h1>
                <p className="text-neutral-500 text-[14px] mt-3 max-w-2xl leading-relaxed">
                  Comparta el enlace o código QR con los colaboradores y monitoree las respuestas en tiempo real.
                </p>
              </div>

              {/* Online Survey Tools */}
              <div className="grid grid-cols-3 gap-5">
                <div className="col-span-2 bg-white rounded-2xl border border-neutral-200/70 p-6" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                  <h3 className="text-neutral-900 text-[13px] mb-1" style={{ fontWeight: 500 }}>Enlace de acceso</h3>
                  <div className="flex items-center justify-between mb-5">
                    <p className="text-neutral-500 text-[13px]">Comparta este enlace con los colaboradores de la organización.</p>
                    <button onClick={handleGenerateLink} className="text-neutral-900 text-[13px] hover:underline" style={{ fontWeight: 600 }}>
                      {activeLink ? 'Generar nuevo enlace' : 'Generar enlace'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mb-5">
                    <div className="flex-1 px-3.5 py-2.5 bg-neutral-50 border border-neutral-200/80 rounded-full text-[12px] text-neutral-600 truncate font-mono">
                      {surveyLink}
                    </div>
                    <button
                      onClick={handleCopyLink}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] transition-all flex-shrink-0
                        ${linkCopied ? 'bg-neutral-100 text-neutral-900 border border-neutral-200' : 'bg-neutral-900 text-white hover:-translate-y-px'}
                      `}
                      style={{ fontWeight: 500 }}
                    >
                      {linkCopied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                      {linkCopied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-neutral-200/70 p-5" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Users size={13} className="text-neutral-500" strokeWidth={1.75} />
                      <h3 className="text-neutral-900 text-[13px]" style={{ fontWeight: 500 }}>Monitor de respuestas</h3>
                    </div>
                    {responses.length > 0 && (
                      <button
                        onClick={handleDownloadCSV}
                        className="p-1.5 rounded-lg border border-neutral-200/80 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 transition-all"
                        title="Descargar respuestas online (CSV)"
                      >
                        <Download size={13} />
                      </button>
                    )}
                  </div>
                  <div className="text-center mb-5 py-5 bg-neutral-50 rounded-xl border border-neutral-200/70">
                    <p className="text-neutral-900 tabular-nums" style={{ fontWeight: 500, fontSize: '2.25rem', letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {responses.length}
                    </p>
                    <p className="text-neutral-500 text-[11px] mt-1.5">respuestas registradas</p>
                  </div>
                  <div className="space-y-2.5 max-h-48 overflow-y-auto">
                    {responses.map((r, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <div className={`w-1.5 h-1.5 rounded-full bg-neutral-900`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-neutral-900 truncate" style={{ fontWeight: 500 }}>{r.nombre_encuestado}</p>
                          <p className="text-[11px] text-neutral-400 truncate">{r.cargo_encuestado}</p>
                        </div>
                        <CheckCircle2 size={11} className="text-neutral-900 flex-shrink-0" />
                      </div>
                    ))}
                    {responses.length === 0 && (
                      <p className="text-neutral-400 text-[12px] text-center mt-4">Esperando respuestas...</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Manual File Upload Option Below */}
              <div className="mt-8 bg-white rounded-2xl border border-neutral-200/70 p-6" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-neutral-900 text-[13px]" style={{ fontWeight: 500 }}>
                    Cargar resultados de manera manual
                  </h3>
                  <span className="text-[11px] uppercase tracking-wide bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded" style={{ fontWeight: 500 }}>
                    Alternativo
                  </span>
                </div>
                <p className="text-neutral-500 text-[13px] mb-4">
                  Si tiene resultados de encuestas realizadas fuera de la plataforma, puede cargarlos en formato PDF o CSV.
                </p>
                <div className="flex flex-col gap-2">
                  {existingFileName && !externalFile && (
                    <div className="flex items-center gap-2 p-2 bg-neutral-900 rounded-lg border border-neutral-800 w-fit">
                      <CheckCircle2 size={14} className="text-white flex-shrink-0" />
                      <span className="text-[12px] text-white font-medium truncate max-w-[180px]">
                        {existingFileName.split('_').slice(2).join('_')}
                      </span>
                      <div className="flex items-center gap-1 border-l border-white/20 ml-1 pl-1">
                        <button
                          onClick={() => window.open(existingFileUrl, '_blank')}
                          className="p-1 rounded-md text-white hover:bg-white/10 transition-colors"
                          title="Descargar archivo"
                        >
                          <Download size={13} />
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await deleteFile();
                              toast.success('Archivo eliminado correctamente.');
                            } catch {
                              toast.error('Error al eliminar el archivo.');
                            }
                          }}
                          className="p-1 rounded-md text-neutral-400 hover:text-white transition-colors flex-shrink-0"
                          title="Eliminar archivo"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept=".pdf,.csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setExternalFile(e.target.files[0]);
                      toast.success(`Archivo "${e.target.files[0].name}" listo para enviar.`);
                    }
                  }}
                  className="flex-1 text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[13px] file:font-semibold file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200 cursor-pointer transition-all"
                />
              </div>

              {/* Submit Button */}
              <div className="mt-8 flex justify-end">
                <motion.button
                  whileHover={{ y: -1 }} whileTap={{ y: 0 }}
                  onClick={handleMarkComplete}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-white text-[13px] transition-all disabled:opacity-50"
                  disabled={isSending}
                  style={{ background: '#5454e9', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}
                >
                  {isSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} strokeWidth={1.75} />}
                  {isSending ? 'Procesando y enviando...' : 'Marcar como completa y enviar al agente'}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* PROCESSING */}
          {moduleState === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="w-16 h-16 rounded-full border border-neutral-200 bg-white flex items-center justify-center mb-5" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <Loader2 size={22} className="text-neutral-700 animate-spin" strokeWidth={1.75} />
              </div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#5454e9] mb-2" style={{ fontWeight: 500 }}>Procesando</p>
              <h2 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
                Analizando idoneidad
              </h2>
              <p className="text-[#5454e9] text-[13px] mt-3 max-w-sm leading-relaxed">
                El Agente está procesando los datos y generando el diagnóstico organizacional…
              </p>
            </motion.div>
          )}

          {/* COMPLETED */}
          {moduleState === 'completed' && (
            <motion.div key="completed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              {diagnosis && (
                <IdoneidadDiagnosisView
                  diagnosis={diagnosis}
                  radarData={radarData}
                  totalRespondentCount={totalRespondentCount}
                  completedAt={phase?.completedAt}
                />
              )}
                {/* Data summary */}
                <div className="bg-white rounded-2xl border border-neutral-200/70 p-6" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-neutral-900 text-[13px]" style={{ fontWeight: 500 }}>Datos recopilados</h3>
                      <span className="text-[11px] text-neutral-400 tabular-nums bg-neutral-100 px-1.5 py-0.5 rounded">{totalRespondentCount}</span>
                    </div>
                    <button
                      onClick={handleDownloadCSV}
                      disabled={responses.length === 0 && !existingFileUrl}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-neutral-200/80 text-[11px] font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed print:hidden"
                      title="Descargar respuestas en CSV"
                    >
                      <Download size={12} strokeWidth={2} />
                      CSV
                    </button>
                  </div>
                  <div className="space-y-2">
                    {responses.length === 0 ? (
                      (diagnosis?.numero_encuestados || 0) > 0 ? (
                        <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/50">
                          <p className="text-neutral-600 text-[12px] font-medium">Datos cargados mediante archivo externo (CSV/PDF)</p>
                          <p className="text-neutral-400 text-[11px] mt-1">El archivo contenía {totalRespondentCount} registros válidos.</p>
                        </div>
                      ) : (
                        <p className="text-neutral-400 text-xs italic">No hay respuestas</p>
                      )
                    ) : responses.map((r, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center text-white text-[11px]" style={{ fontWeight: 600 }}>
                          {r.nombre_encuestado.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-neutral-900 text-[13px] truncate" style={{ fontWeight: 500 }}>{r.nombre_encuestado}</p>
                          <p className="text-neutral-400 text-[11px] truncate">{r.cargo_encuestado}</p>
                        </div>
                        <CheckCircle2 size={13} className="text-neutral-400 ml-auto flex-shrink-0" strokeWidth={1.75} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 p-4 bg-neutral-50 rounded-xl border border-neutral-200/70">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Respuestas totales</p>
                    <p className="text-neutral-900 tabular-nums mt-1" style={{ fontWeight: 500, fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
                      {totalRespondentCount}
                    </p>
                  </div>
                </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ConfirmModal
        open={showConfirm}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleConfirmSend}
        isLoading={isSending}
      />

      <NextPhaseButton projectId={projectId!} nextPhase={4} prevPhase={2} show={moduleState === 'completed'} />
    </div>
  );
}
