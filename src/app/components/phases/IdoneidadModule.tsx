import React, { useState, useEffect, useMemo } from 'react';
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
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';

type EntryMethod = null | 'survey' | 'manual';
type ModuleState = 'selection' | 'data-entry' | 'processing' | 'completed';

export function getIdoneidadItemCode(value: any, fallback = 'Item') {
  const raw = String(value?.item ?? value?.codigo ?? value?.question_code ?? value?.factor ?? value?.id ?? fallback);
  const match = raw.match(/^([CEP]\d{1,2})/i);
  return match ? match[1].toUpperCase() : raw;
}

export function getIdoneidadItemScore(value: any) {
  const score = value?.promedio ?? value?.puntaje ?? value?.score ?? value?.valor ?? value?.answer_score;
  const numeric = typeof score === 'number' ? score : Number(score);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(1)) : null;
}

export function inferIdoneidadDimension(codeOrDimension: string) {
  const value = String(codeOrDimension || '').toUpperCase();
  if (value.startsWith('C') || value.includes('CULTURA')) return 'CULTURA';
  if (value.startsWith('E') || value.includes('EQUIPO')) return 'EQUIPO';
  if (value.startsWith('P') || value.includes('PROYECTO')) return 'PROYECTO';
  return value || 'N/A';
}

export function normalizeIdoneidadItems(source: any): any[] {
  const found: any[] = [];

  const visit = (node: any, fallbackKey?: string) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item));
      return;
    }
    if (typeof node !== 'object') {
      if (fallbackKey && /^[CEP]\d{1,2}/i.test(fallbackKey)) {
        const numeric = Number(node);
        if (Number.isFinite(numeric)) {
          const match = fallbackKey.match(/^([CEP]\d{1,2})/i);
          const code = match ? match[1].toUpperCase() : fallbackKey.toUpperCase();
          found.push({
            item: code,
            dimension: inferIdoneidadDimension(code),
            promedio: Number(numeric.toFixed(1)),
          });
        }
      }
      return;
    }

    const code = getIdoneidadItemCode(node, fallbackKey ?? '');
    const score = getIdoneidadItemScore(node);
    if (score !== null && /^[CEP]\d{1,2}/i.test(code)) {
      const match = code.match(/^([CEP]\d{1,2})/i);
      const cleanCode = match ? match[1].toUpperCase() : code.toUpperCase();
      found.push({
        ...node,
        item: cleanCode,
        dimension: node.dimension ?? inferIdoneidadDimension(cleanCode),
        promedio: score,
      });
    }

    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'number' || typeof value === 'string') {
        if (/^[CEP]\d{1,2}/i.test(key)) {
          const numeric = Number(value);
          if (Number.isFinite(numeric)) {
            const match = key.match(/^([CEP]\d{1,2})/i);
            const codeFromKey = match ? match[1].toUpperCase() : key.toUpperCase();
            found.push({
              item: codeFromKey,
              dimension: inferIdoneidadDimension(codeFromKey),
              promedio: Number(numeric.toFixed(1)),
            });
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        visit(value, key);
      }
    }
  };

  visit(source);

  const byCode = new Map<string, any>();
  for (const item of found) {
    byCode.set(item.item, item);
  }

  const orderGroup: Record<string, number> = { C: 0, E: 1, P: 2 };
  return [...byCode.values()].sort((a, b) => {
    const ac = a.item;
    const bc = b.item;
    const ag = orderGroup[ac[0]] ?? 9;
    const bg = orderGroup[bc[0]] ?? 9;
    if (ag !== bg) return ag - bg;
    return (Number(ac.slice(1)) || 0) - (Number(bc.slice(1)) || 0);
  });
}

export function normalizeIdoneidadDiagnosisItems(diagnosis: any): any[] {
  // Pass the entire diagnosis object to ensure we find all items regardless of where the agent placed them
  return normalizeIdoneidadItems(diagnosis);
}

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
                style={{ background: '#0a0a0a', fontWeight: 500 }}>
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
  const { getProject, updatePhaseStatus } = useApp();
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

      return {
        subject: itemLabel,
        fullLabel: itemLabel,
        dimension: res.dimension ?? inferIdoneidadDimension(itemLabel),
        Puntaje: score,
        // Thresholds for background zones
        AgileZone: 4,
        HybridZone: 8,
        PredictiveZone: 10,
      };
    });
  }, [diagnosis]);

  const emptyValue = 'N/A';
  const valueOrEmpty = (value: unknown) => {
    if (value === null || value === undefined || value === '') return emptyValue;
    if (typeof value === 'boolean') return value ? 'Si' : 'No';
    if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
    return String(value);
  };
  const listOrEmpty = (items?: unknown[]) => Array.isArray(items) && items.length > 0 ? items.map(valueOrEmpty) : [emptyValue];

  const KeyValueGrid = ({ rows }: { rows: { label: string; value: unknown }[] }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {rows.map((row) => (
        <div key={row.label} className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-400 mb-1" style={{ fontWeight: 500 }}>{row.label}</p>
          <p className="text-neutral-800 text-[13px] leading-relaxed">{valueOrEmpty(row.value)}</p>
        </div>
      ))}
    </div>
  );

  const EmptyAwareList = ({ items }: { items?: unknown[] }) => (
    <ul className="space-y-2">
      {listOrEmpty(items).map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-neutral-700 text-[13px] leading-relaxed">
          <span className="w-1.5 h-1.5 rounded-full mt-2 bg-neutral-400 flex-shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );

  const BadgeList = ({ items }: { items?: unknown[] }) => (
    <div className="flex flex-wrap gap-2">
      {listOrEmpty(items).map((item, i) => (
        <span key={i} className="px-2.5 py-1 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-700 text-[11px]" style={{ fontWeight: 500 }}>
          {item}
        </span>
      ))}
    </div>
  );

  const DiagnosisCard = ({ title, children, muted = false }: { title: string; children: React.ReactNode; muted?: boolean }) => (
    <div className={`rounded-2xl border border-neutral-200/70 ${muted ? 'bg-neutral-50' : 'bg-white'} p-6`} style={{ boxShadow: muted ? undefined : '0 1px 2px rgba(0,0,0,0.02)' }}>
      <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500 mb-4" style={{ fontWeight: 500 }}>{title}</p>
      {children}
    </div>
  );

  const diagnosisRespondentCount = Number(diagnosis?.numero_encuestados) || 0;
  const externalRespondentCount = existingFileUrl && diagnosisRespondentCount > responses.length
    ? diagnosisRespondentCount - responses.length
    : 0;
  const totalRespondentCount = responses.length + externalRespondentCount;

  const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  const normalizeSurveyAnswersForCSV = (rawAnswers: any) => {
    const answerMap: Record<string, string | number> = {};

    if (Array.isArray(rawAnswers)) {
      rawAnswers.forEach((answer, index) => {
        if (!answer || typeof answer !== 'object') return;
        const key = String(answer.codigo || answer.question_code || answer.pregunta_codigo || answer.pregunta_id || `respuesta_${index + 1}`);
        answerMap[key] = answer.valor ?? answer.answer_score ?? answer.score ?? answer.respuesta ?? '';
      });
      return answerMap;
    }

    if (rawAnswers && typeof rawAnswers === 'object') {
      Object.entries(rawAnswers).forEach(([key, value]) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const nested = value as Record<string, any>;
          answerMap[key] = nested.valor ?? nested.answer_score ?? nested.score ?? nested.respuesta ?? '';
        } else {
          answerMap[key] = value as string | number;
        }
      });
    }

    return answerMap;
  };

  // Custom tooltip for the Radar Chart
  const CustomRadarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-neutral-200/80 p-3.5 rounded-xl" style={{ boxShadow: '0 4px 24px -6px rgba(0,0,0,0.12)' }}>
          <div className="mb-2.5 pb-2 border-b border-neutral-100">
            <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold mb-0.5">{data.dimension}</p>
            <p className="text-[12px] text-neutral-900 leading-tight" style={{ fontWeight: 600 }}>{data.fullLabel}</p>
          </div>
          <div className="space-y-1.5">
            {payload.filter((p: any) => p.dataKey === 'Puntaje').map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-6">
                <span className="text-[12px] flex items-center gap-1.5 text-neutral-600 font-medium">
                  <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
                  {entry.name}
                </span>
                <span className="text-[13px] tabular-nums font-bold" style={{ color: entry.color }}>
                  {entry.value.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const initialState: ModuleState = phase?.status === 'completado' ? 'completed' : 'selection';

  const [moduleState, setModuleState] = useState<ModuleState>(initialState);
  const [entryMethod, setEntryMethod] = useState<EntryMethod>(null);
  const [manualData, setManualData] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

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

  if (!project || !phase) return null;

  return (
    <div className="min-h-screen bg-[#fafaf9]">
      <PhaseHeader
        projectId={projectId!}
        companyName={project.companyName}
        phaseNumber={3}
        phaseName="Diagnóstico de Idoneidad"
        eyebrow={moduleState === 'completed' ? 'Completada' : 'Activa'}
      />

      {/* Processing overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-[#fafaf9]/85 backdrop-blur-md flex flex-col items-center justify-center">
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
                  style={{ background: '#0a0a0a', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}
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
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-2" style={{ fontWeight: 500 }}>Procesando</p>
              <h2 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
                Analizando idoneidad
              </h2>
              <p className="text-neutral-500 text-[13px] mt-3 max-w-sm leading-relaxed">
                El Agente está procesando los datos y generando el diagnóstico organizacional…
              </p>
            </motion.div>
          )}

          {/* COMPLETED */}
          {moduleState === 'completed' && (
            <motion.div key="completed" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="mb-10">
                <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-3" style={{ fontWeight: 500 }}>Fase 3 · Diagnóstico de idoneidad</p>
                <h1 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '2.25rem', lineHeight: 1.05, letterSpacing: '-0.025em' }}>
                  Resultados consolidados
                </h1>
                <p className="text-neutral-500 text-[14px] mt-3 max-w-2xl leading-relaxed">
                  El Agente procesó las respuestas y generó la puntuación de idoneidad organizacional con observaciones clave.
                </p>

                <div className="grid grid-cols-3 gap-px bg-neutral-200/60 rounded-2xl overflow-hidden mt-7 border border-neutral-200/60">
                  <div className="bg-white px-5 py-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Respondieron</p>
                    <p className="mt-1.5 text-neutral-900 tabular-nums" style={{ fontWeight: 500, fontSize: '1.375rem', letterSpacing: '-0.02em' }}>
                      {totalRespondentCount} <span className="text-[12px] text-neutral-400 ml-1">personas</span>
                    </p>
                  </div>
                  <div className="bg-white px-5 py-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Fecha de análisis</p>
                    <p className="mt-1.5 text-neutral-900 tabular-nums" style={{ fontWeight: 500, fontSize: '1.375rem', letterSpacing: '-0.02em' }}>
                      {phase?.completedAt ? phase.completedAt : 'Reciente'}
                    </p>
                  </div>
                  <div className="bg-white px-5 py-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Puntuación</p>
                    <p className="mt-1.5 text-neutral-900 tabular-nums" style={{ fontWeight: 500, fontSize: '1.375rem', letterSpacing: '-0.02em' }}>
                      {Number((diagnosis?.suitability_score || diagnosis?.puntuacion_idoneidad || 0).toFixed(1))}<span className="text-[12px] text-neutral-400 ml-0.5">/10</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-5 mt-7">

                {/* Agent diagnosis */}
                <div className="rounded-2xl border border-neutral-200/70 bg-white p-6" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="w-7 h-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
                      <Sparkles size={13} strokeWidth={1.75} />
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-500" style={{ fontWeight: 500 }}>Diagnóstico — Agente 3</span>
                  </div>

                  <div className="flex items-center gap-5 mb-6 p-5 bg-neutral-50 rounded-xl border border-neutral-200/70">
                    <div className="relative w-20 h-20 flex-shrink-0">
                      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e5e5" strokeWidth="2.5" />
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#0a0a0a" strokeWidth="2.5"
                          strokeDasharray={`${((diagnosis?.suitability_score || diagnosis?.puntuacion_idoneidad || 0) * 10).toFixed(1)} 100`} strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-neutral-900 tabular-nums" style={{ fontWeight: 500, fontSize: '1.125rem', letterSpacing: '-0.02em' }}>{Number((diagnosis?.suitability_score || diagnosis?.puntuacion_idoneidad || 0).toFixed(1))}</span>
                        <span className="text-[10px] text-neutral-400 tabular-nums">/10</span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Puntuación de idoneidad</p>
                      <p className="text-neutral-900 mt-1 tracking-tight" style={{ fontWeight: 500, fontSize: '1.0625rem', letterSpacing: '-0.01em' }}>{diagnosis?.suitability_level || diagnosis?.nivel_idoneidad || 'N/A'}</p>
                      <span className="inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 bg-neutral-100 text-neutral-600 text-[11px] rounded-full border border-neutral-200" style={{ fontWeight: 500 }}>
                        <span className="w-1 h-1 rounded-full bg-neutral-400" /> Analizado por IA
                      </span>
                    </div>
                  </div>

                  <div className="mb-5">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400 mb-2.5" style={{ fontWeight: 500 }}>Observaciones</p>
                    <ul className="space-y-2">
                      {(diagnosis?.observations || diagnosis?.observaciones || []).map((obs: string, i: number) => (
                        <li key={i} className="flex items-start gap-2.5 text-neutral-700 text-[13px] leading-relaxed">
                          <span className="w-1 h-1 rounded-full mt-2 bg-neutral-400 flex-shrink-0" />
                          {obs}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {(diagnosis?.riesgos || diagnosis?.riesgos_metodologicos) && (diagnosis?.riesgos || diagnosis?.riesgos_metodologicos).length > 0 && (
                    <div className="mb-5">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400 mb-2.5" style={{ fontWeight: 500 }}>Riesgos Metodológicos</p>
                      <ul className="space-y-3">
                        {(diagnosis?.riesgos || diagnosis?.riesgos_metodologicos).map((riesgo: any, i: number) => (
                          <li key={i} className="p-3 bg-neutral-50 border border-neutral-200/60 rounded-xl">
                            <p className="text-[12px] font-semibold text-neutral-800 mb-1">{riesgo.nombre || riesgo.riesgo} <span className="text-[10px] uppercase bg-neutral-200 text-neutral-600 px-1.5 py-0.5 rounded-md ml-1">{riesgo.nivel || riesgo.impacto}</span></p>
                            <p className="text-neutral-600 text-[12px] leading-relaxed">{riesgo.descripcion}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {radarData.length > 0 && (
                    <div className="mb-8">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400 mb-3" style={{ fontWeight: 500 }}>Gráfica de radar para la Evaluación de Idoneidad</p>
                      <div className="p-5 bg-white rounded-xl border border-neutral-200/70" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                        <div className="h-[500px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                              <PolarGrid stroke="#d4d4d4" />
                              <PolarAngleAxis dataKey="subject" tick={{ fill: '#525252', fontSize: 11, fontWeight: 600 }} />
                              <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fill: '#737373', fontSize: 10 }} axisLine={false} tickCount={6} />
                              
                              {/* Background Zones */}
                              <Radar name="Zona Predictiva (8-10)" dataKey="PredictiveZone" stroke="none" fill="#ef4444" fillOpacity={0.12} isAnimationActive={false} />
                              <Radar name="Zona Híbrida (4-8)" dataKey="HybridZone" stroke="none" fill="#f59e0b" fillOpacity={0.18} isAnimationActive={false} />
                              <Radar name="Zona Ágil (0-4)" dataKey="AgileZone" stroke="none" fill="#10b981" fillOpacity={0.25} isAnimationActive={false} />
                              
                              <Radar name="Puntaje Real" dataKey="Puntaje" stroke="#171717" strokeWidth={3} fill="#171717" fillOpacity={0.45} />
                              
                              <Tooltip content={<CustomRadarTooltip />} />
                              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 500 }} />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-neutral-100">
                          {['cultura', 'equipo', 'proyecto'].map((dim) => {
                            const data = (diagnosis?.indicadores || diagnosis?.indicadores_dimension)[dim];
                            if (!data) return null;
                            return (
                              <div key={dim} className="bg-neutral-50 p-3 rounded-xl border border-neutral-200/50 flex items-center justify-between">
                                <div>
                                  <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-0.5">{dim}</p>
                                  <p className="text-[10px] text-neutral-400">Coherencia: {data.coherencia_interna}</p>
                                </div>
                                <p className="text-neutral-900 font-bold text-lg tabular-nums">
                                  {typeof data.promedio === 'number' ? Number(data.promedio.toFixed(1)) : data.promedio}
                                </p>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-6 pt-5 border-t border-neutral-100">
                          <h4 className="text-[10px] uppercase tracking-[0.12em] text-neutral-400 font-semibold mb-3">Detalle por factor</h4>
                          <div className="overflow-hidden rounded-xl border border-neutral-200/50 bg-white">
                            <table className="w-full text-left text-[11px]">
                              <thead className="bg-neutral-50/80 border-b border-neutral-200/60">
                                <tr>
                                  <th className="px-3 py-2 font-semibold text-neutral-500">Factor / Pregunta</th>
                                  <th className="px-3 py-2 font-semibold text-neutral-500 w-20 text-right">Pts</th>
                                  <th className="px-3 py-2 font-semibold text-neutral-500 w-28 text-center">Zona</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-neutral-100/60">
                                {(() => {
                                  const groups: Record<string, any[]> = { Cultura: [], Equipo: [], Proyecto: [], Otros: [] };
                                  normalizeIdoneidadDiagnosisItems(diagnosis).forEach((res: any) => {
                                    let dim = res.dimension || '';
                                    if (!dim) {
                                      const code = getIdoneidadItemCode(res);
                                      if (code.match(/^C\d/i)) dim = 'Cultura';
                                      else if (code.match(/^E\d/i)) dim = 'Equipo';
                                      else if (code.match(/^P\d/i)) dim = 'Proyecto';
                                      else dim = 'Otros';
                                    }
                                    const key = Object.keys(groups).find(k => k.toLowerCase() === dim.toLowerCase()) || 'Otros';
                                    groups[key].push(res);
                                  });

                                  return [
                                    { name: 'Cultura', items: groups.Cultura },
                                    { name: 'Equipo', items: groups.Equipo },
                                    { name: 'Proyecto', items: groups.Proyecto },
                                    { name: 'Otros', items: groups.Otros },
                                  ].filter(g => g.items.length > 0).map((group, gIdx) => (
                                    <React.Fragment key={gIdx}>
                                      {/* Group Header */}
                                      <tr className="bg-neutral-50/30">
                                        <td className="px-3 py-1.5 font-bold text-neutral-800 uppercase tracking-tight text-[9px] bg-neutral-50/50" colSpan={3}>
                                          {group.name}
                                        </td>
                                      </tr>
                                      {/* Group Items */}
                                      {group.items.map((res: any, idx: number) => {
                                        let zoneColor = 'bg-neutral-100 text-neutral-600 border-neutral-200';
                                        let zoneText = res.zona || 'Neutral';
                                        const p = res.promedio;
                                        
                                        if (p <= 4) {
                                          zoneColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                                          zoneText = 'Ágil';
                                        } else if (p <= 8) {
                                          zoneColor = 'bg-amber-50 text-amber-700 border-amber-100';
                                          zoneText = 'Híbrido';
                                        } else {
                                          zoneColor = 'bg-rose-50 text-rose-700 border-rose-100';
                                          zoneText = 'Predictivo';
                                        }

                                        return (
                                          <tr key={`${gIdx}-${idx}`} className="hover:bg-neutral-50/50 transition-colors">
                                            <td className="px-3 py-2 pl-5">
                                              <div className="flex flex-col">
                                                <span className="text-neutral-800 font-medium leading-tight">{getIdoneidadItemCode(res)}</span>
                                                {res.interpretacion && <p className="text-[10px] text-neutral-400 mt-0.5 leading-snug line-clamp-1 hover:line-clamp-none print:line-clamp-none transition-all">{res.interpretacion}</p>}
                                              </div>
                                            </td>
                                            <td className="px-3 py-2 tabular-nums text-right font-bold text-neutral-900" style={{ fontSize: '13px' }}>
                                              {valueOrEmpty(getIdoneidadItemScore(res))}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                              <span className={`inline-block px-2 py-0.5 text-[9px] uppercase font-bold tracking-wider rounded-md border ${zoneColor}`}>
                                                {zoneText}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </React.Fragment>
                                  ));
                                })()}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {diagnosis?.tensiones && diagnosis.tensiones.length > 0 && (
                    <div className="mb-5">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400 mb-2.5" style={{ fontWeight: 500 }}>Tensiones Estructurales</p>
                      <ul className="space-y-3">
                        {diagnosis.tensiones.map((tens: any, i: number) => (
                          <li key={i} className="p-3 bg-neutral-50 border border-neutral-200/50 rounded-xl">
                            <div className="flex justify-between items-center mb-1">
                              <p className="text-[12px] font-semibold text-neutral-800">{tens.par_dimensiones}</p>
                              <span className="text-[10px] uppercase bg-neutral-200 text-neutral-700 px-1.5 py-0.5 rounded-md font-medium">{tens.clasificacion}</span>
                            </div>
                            <p className="text-neutral-600 text-[12px] leading-relaxed">{tens.interpretacion}</p>
                            <p className="text-[10px] text-neutral-400 mt-1 font-mono">Diferencia: {typeof tens.diferencia_promedios === 'number' ? Number(tens.diferencia_promedios.toFixed(1)) : tens.diferencia_promedios} pts</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {diagnosis?.factores_criticos && (
                    <div className="mb-5 grid grid-cols-2 gap-4">
                      {diagnosis.factores_criticos.alta_afinidad_agil?.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-neutral-600 font-semibold mb-2 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-neutral-800"></span> Afinidad Ágil (≤3)</p>
                          <ul className="space-y-2">
                            {diagnosis.factores_criticos.alta_afinidad_agil.map((fac: any, i: number) => (
                              <li key={i} className="text-[11px] text-neutral-700 bg-neutral-50 border border-neutral-200 p-2 rounded-lg leading-snug">
                                <strong>{fac.item}:</strong> {fac.interpretacion}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {diagnosis.factores_criticos.alta_afinidad_predictiva?.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-2 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-neutral-400"></span> Afinidad Predictiva (≥7)</p>
                          <ul className="space-y-2">
                            {diagnosis.factores_criticos.alta_afinidad_predictiva.map((fac: any, i: number) => (
                              <li key={i} className="text-[11px] text-neutral-600 bg-white border border-neutral-200 p-2 rounded-lg leading-snug">
                                <strong>{fac.item}:</strong> {fac.interpretacion}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {diagnosis?.inconsistencias && diagnosis.inconsistencias.length > 0 && (
                    <div className="mb-5">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400 mb-2.5" style={{ fontWeight: 500 }}>Inconsistencias Internas</p>
                      <ul className="space-y-3">
                        {diagnosis.inconsistencias.map((inc: any, i: number) => (
                          <li key={i} className="flex items-start gap-2.5 text-neutral-700 text-[12px] leading-relaxed">
                            <span className="text-[10px] mt-0.5 flex-shrink-0 text-neutral-600 bg-neutral-100 px-1.5 rounded-md font-medium border border-neutral-200">{inc.clasificacion}</span>
                            <span>{inc.descripcion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {diagnosis && (
                  <div className="flex flex-col gap-5">
                    <DiagnosisCard title="Resumen del agente">
                      <p className="text-neutral-700 text-[14px] leading-relaxed mb-4">{valueOrEmpty(diagnosis.summary)}</p>
                      <KeyValueGrid rows={[
                        { label: 'Nivel de idoneidad', value: diagnosis.suitability_level || diagnosis.nivel_idoneidad },
                        { label: 'Puntaje de idoneidad', value: diagnosis.suitability_score || diagnosis.puntuacion_idoneidad },
                        { label: 'Nivel confiabilidad', value: diagnosis.nivel_confiabilidad },
                        { label: 'Justificacion confiabilidad', value: diagnosis.justificacion_confiabilidad },
                        { label: 'Formato entrada detectado', value: diagnosis.formato_entrada_detectado },
                        { label: 'Numero encuestados', value: diagnosis.numero_encuestados },
                      ]} />
                    </DiagnosisCard>

                    <DiagnosisCard title="Indicadores por dimension">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {['cultura', 'equipo', 'proyecto', 'general'].map((dim) => {
                          const item = diagnosis.indicadores?.[dim];
                          return (
                            <div key={dim} className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                              <p className="text-neutral-900 text-[13px] mb-3 capitalize" style={{ fontWeight: 600 }}>{dim}</p>
                              <KeyValueGrid rows={[
                                { label: 'Promedio', value: item?.promedio },
                                { label: 'Desviacion estandar', value: item?.desviacion_estandar },
                                { label: 'Coherencia interna', value: item?.coherencia_interna },
                                { label: 'Item mas alto', value: item?.item_mas_alto },
                                { label: 'Item mas bajo', value: item?.item_mas_bajo },
                                { label: 'Comportamiento', value: item?.comportamiento },
                                { label: 'Zona predominante', value: item?.zona_predominante },
                              ]} />
                            </div>
                          );
                        })}
                      </div>
                    </DiagnosisCard>

                    <DiagnosisCard title="Distribucion por zona">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {['cultura', 'equipo', 'proyecto', 'general'].map((dim) => {
                          const dist = diagnosis.distribucion?.[dim];
                          return (
                            <div key={dim} className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                              <p className="text-neutral-900 text-[13px] mb-3 capitalize" style={{ fontWeight: 600 }}>{dim}</p>
                              <KeyValueGrid rows={[
                                { label: 'Porcentaje agil', value: dist?.porcentaje_agil },
                                { label: 'Porcentaje transicion', value: dist?.porcentaje_transicion },
                                { label: 'Porcentaje predictivo', value: dist?.porcentaje_predictivo },
                              ]} />
                            </div>
                          );
                        })}
                      </div>
                    </DiagnosisCard>

                    <DiagnosisCard title="Alineacion y consenso">
                      <div className="space-y-4">
                        <KeyValueGrid rows={[
                          { label: 'Disponible', value: diagnosis.alineacion?.disponible },
                          { label: 'Consenso cultura', value: diagnosis.alineacion?.consenso_por_dimension?.cultura },
                          { label: 'Consenso equipo', value: diagnosis.alineacion?.consenso_por_dimension?.equipo },
                          { label: 'Consenso proyecto', value: diagnosis.alineacion?.consenso_por_dimension?.proyecto },
                        ]} />
                        <div className="space-y-3">
                          {(diagnosis.alineacion?.conflictos_percepcion?.length ? diagnosis.alineacion.conflictos_percepcion : [{ item: emptyValue, diferencia: emptyValue, valor_minimo: emptyValue, valor_maximo: emptyValue, cargos_involucrados: [] }]).map((conf: any, i: number) => (
                            <div key={i} className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                              <KeyValueGrid rows={[
                                { label: 'Item', value: conf.item },
                                { label: 'Diferencia', value: conf.diferencia },
                                { label: 'Valor minimo', value: conf.valor_minimo },
                                { label: 'Valor maximo', value: conf.valor_maximo },
                              ]} />
                              <div className="mt-3"><BadgeList items={conf.cargos_involucrados} /></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </DiagnosisCard>

                    <DiagnosisCard title="Calidad del input">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><p className="text-[11px] uppercase tracking-[0.12em] text-neutral-400 mb-2" style={{ fontWeight: 500 }}>Items faltantes</p><EmptyAwareList items={diagnosis.calidad_input?.items_faltantes} /></div>
                        <div><p className="text-[11px] uppercase tracking-[0.12em] text-neutral-400 mb-2" style={{ fontWeight: 500 }}>Limitaciones por formato</p><EmptyAwareList items={diagnosis.calidad_input?.limitaciones_por_formato} /></div>
                        <div><p className="text-[11px] uppercase tracking-[0.12em] text-neutral-400 mb-2" style={{ fontWeight: 500 }}>Alertas respuesta invalida</p><EmptyAwareList items={diagnosis.calidad_input?.alertas_respuesta_invalida} /></div>
                        <div><p className="text-[11px] uppercase tracking-[0.12em] text-neutral-400 mb-2" style={{ fontWeight: 500 }}>Encuestados con datos incompletos</p><EmptyAwareList items={diagnosis.calidad_input?.encuestados_con_datos_incompletos} /></div>
                      </div>
                    </DiagnosisCard>

                    <DiagnosisCard title="Interpretacion por factores">
                      <div className="flex flex-col gap-5">
                        {['cultura', 'equipo', 'proyecto'].map((dim) => {
                          const data = diagnosis.interpretacion_por_factores?.[dim] || {};
                          return (
                            <div key={dim} className="rounded-xl border border-neutral-100 bg-neutral-50 p-6 flex flex-col md:flex-row md:items-start gap-6">
                              <div className="md:w-[200px] flex-shrink-0">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-neutral-200/60 shadow-sm mb-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
                                  <p className="text-neutral-900 text-[12px] uppercase tracking-wider" style={{ fontWeight: 700 }}>{dim}</p>
                                </div>
                                <p className="text-neutral-400 text-[11px] leading-relaxed">
                                  Análisis detallado de los factores clave que influyen en la dimensión de {dim}.
                                </p>
                              </div>
                              <div className="flex-1">
                                <KeyValueGrid rows={Object.entries(data).map(([label, value]) => ({
                                  label: label.replace(/_/g, ' '),
                                  value,
                                }))} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </DiagnosisCard>

                    <DiagnosisCard title="Resultados por item completos">
                      <div className="overflow-x-auto rounded-xl border border-neutral-100">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-neutral-100 bg-neutral-50">
                              {['Item', 'Dimension', 'Promedio', 'Min', 'Max', 'Desv.', 'Zona', 'Critico'].map((h) => (
                                <th key={h} className="px-3 py-3 text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-50 bg-white">
                            {((normalizeIdoneidadDiagnosisItems(diagnosis).length ? normalizeIdoneidadDiagnosisItems(diagnosis) : [{ item: emptyValue, dimension: emptyValue, promedio: emptyValue, minimo: emptyValue, maximo: emptyValue, desviacion_estandar: emptyValue, zona: emptyValue, factor_critico: emptyValue }]) as any[]).map((item, i) => (
                              <tr key={i} className="hover:bg-neutral-50/60">
                                <td className="px-3 py-3 text-[12px] text-neutral-800" style={{ fontWeight: 600 }}>{valueOrEmpty(getIdoneidadItemCode(item))}</td>
                                <td className="px-3 py-3 text-[12px] text-neutral-600">{valueOrEmpty(item.dimension)}</td>
                                <td className="px-3 py-3 text-[12px] text-neutral-900 tabular-nums">{valueOrEmpty(getIdoneidadItemScore(item))}</td>
                                <td className="px-3 py-3 text-[12px] text-neutral-600 tabular-nums">{valueOrEmpty(item.minimo)}</td>
                                <td className="px-3 py-3 text-[12px] text-neutral-600 tabular-nums">{valueOrEmpty(item.maximo)}</td>
                                <td className="px-3 py-3 text-[12px] text-neutral-600 tabular-nums">{valueOrEmpty(item.desviacion_estandar)}</td>
                                <td className="px-3 py-3 text-[12px] text-neutral-600">{valueOrEmpty(item.zona)}</td>
                                <td className="px-3 py-3 text-[12px] text-neutral-600">{valueOrEmpty(item.factor_critico)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </DiagnosisCard>

                    <DiagnosisCard title="Cargos representados">
                      <BadgeList items={diagnosis.cargos_representados} />
                    </DiagnosisCard>

                    <DiagnosisCard title="Insumos para agente 4" muted>
                      <div className="space-y-5">
                        <KeyValueGrid rows={[
                          { label: 'Nivel confiabilidad', value: diagnosis.insumos_para_agente_4?.nivel_confiabilidad },
                          { label: 'Comportamiento general', value: diagnosis.insumos_para_agente_4?.comportamiento_general },
                          { label: 'Zona predominante general', value: diagnosis.insumos_para_agente_4?.zona_predominante_general },
                        ]} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div><p className="text-[11px] uppercase tracking-[0.12em] text-neutral-400 mb-2" style={{ fontWeight: 500 }}>Tensiones criticas resumen</p><EmptyAwareList items={diagnosis.insumos_para_agente_4?.tensiones_criticas_resumen} /></div>
                          <div><p className="text-[11px] uppercase tracking-[0.12em] text-neutral-400 mb-2" style={{ fontWeight: 500 }}>Inconsistencias criticas resumen</p><EmptyAwareList items={diagnosis.insumos_para_agente_4?.inconsistencias_criticas_resumen} /></div>
                          <div><p className="text-[11px] uppercase tracking-[0.12em] text-neutral-400 mb-2" style={{ fontWeight: 500 }}>Indicadores agilidad</p><EmptyAwareList items={diagnosis.insumos_para_agente_4?.indicadores_agilidad} /></div>
                          <div><p className="text-[11px] uppercase tracking-[0.12em] text-neutral-400 mb-2" style={{ fontWeight: 500 }}>Indicadores hibridos</p><EmptyAwareList items={(diagnosis.insumos_para_agente_4?.indicadores_hibridos || []).map((x: any) => `${valueOrEmpty(x.item_o_dimension)}: ${valueOrEmpty(x.interpretacion_del_factor)} (${valueOrEmpty(x.promedio)})`)} /></div>
                          <div><p className="text-[11px] uppercase tracking-[0.12em] text-neutral-400 mb-2" style={{ fontWeight: 500 }}>Indicadores predictivos</p><EmptyAwareList items={(diagnosis.insumos_para_agente_4?.indicadores_predictivos || []).map((x: any) => `${valueOrEmpty(x.item || x.dimension)}: ${valueOrEmpty(x.interpretacion_del_factor)} (${valueOrEmpty(x.promedio)})`)} /></div>
                        </div>
                      </div>
                    </DiagnosisCard>
                  </div>
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
