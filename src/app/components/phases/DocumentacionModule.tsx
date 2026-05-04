import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload, FileText, FileSpreadsheet, Presentation, Image,
  Trash2, RefreshCw, ChevronDown, Send, Loader2,
  CheckCircle2, FolderOpen, Sparkles, Download, ExternalLink, Info, Check,
  AlertCircle, FileSearch, ShieldAlert, MessageSquare, ChevronRight, Users, Clock, X
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import { useDocumentacion, type DocumentoLocal, type AgentDiagnosis } from '../../hooks/useDocumentacion';
import { useSoundManager } from '../../hooks/useSoundManager';
import { supabase } from '../../lib/supabase';
import PhaseHeader from './_shared/PhaseHeader';
import NextPhaseButton from './_shared/NextPhaseButton';

type DocCategory = 'D01' | 'D02' | 'D03' | 'D04' | 'D05' | 'D06' | 'D07' | 'D08' | 'D09' | 'D10' | 'D11';
type Documento = DocumentoLocal;

const CATEGORIES: { value: DocCategory; label: string }[] = [
  { value: 'D01', label: 'Organigrama' },
  { value: 'D02', label: 'Artefactos de Gestión de proyectos' },
  { value: 'D03', label: 'Plataformas y Sistemas' },
  { value: 'D04', label: 'Listado de Proyectos' },
  { value: 'D05', label: 'Proyecto mejor documentado' },
  { value: 'D06', label: 'Resultados Estratégicos' },
  { value: 'D07', label: 'Mapa de Procesos' },
  { value: 'D08', label: 'Arquitectura Organizacional/TI' },
  { value: 'D09', label: 'Metodología de Proyectos' },
  { value: 'D10', label: 'Portafolio de Productos/Servicios' },
  { value: 'D11', label: 'Otros' },
];



function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['xlsx', 'xls', 'csv'].includes(ext || '')) return <FileSpreadsheet size={15} className="text-neutral-900" strokeWidth={1.75} />;
  if (['pptx', 'ppt'].includes(ext || '')) return <Presentation size={15} className="text-neutral-700" strokeWidth={1.75} />;
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) return <Image size={15} className="text-neutral-500" strokeWidth={1.75} />;
  return <FileText size={15} className="text-neutral-400" strokeWidth={1.75} />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Category dropdown ──────────────────────────────────────────────────────────
interface CategoryDropdownProps {
  value: DocCategory;
  onChange: (v: DocCategory) => void;
}

function CategoryDropdown({ value, onChange }: CategoryDropdownProps) {
  const [open, setOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // El dropdown puede medir aprox 250-300px
      if (spaceBelow < 280 && spaceAbove > spaceBelow) {
        setOpenUpwards(true);
      } else {
        setOpenUpwards(false);
      }
    }
  }, [open]);

  const selected = CATEGORIES.find(c => c.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 border border-neutral-200/80 rounded-full text-[12px] bg-white text-neutral-700 hover:border-neutral-300 transition-all cursor-pointer"
        style={{ fontWeight: 500 }}
      >
        {selected?.label}
        <ChevronDown
          size={11}
          strokeWidth={2}
          className={`text-neutral-400 transition-transform duration-200 ${open ? (openUpwards ? 'rotate-0' : 'rotate-180') : (openUpwards ? 'rotate-180' : 'rotate-0')}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: openUpwards ? 5 : -5, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUpwards ? 3 : -3, scale: 0.97 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute right-0 min-w-[240px] max-h-[300px] overflow-y-auto bg-white rounded-2xl border border-neutral-200/70 z-[9999] py-1.5 px-1.5 scrollbar-thin ${openUpwards ? 'bottom-full mb-1.5 origin-bottom' : 'top-full mt-1.5 origin-top'
              }`}
            style={{ boxShadow: '0 4px 6px -2px rgba(0,0,0,0.04), 0 16px 40px -8px rgba(0,0,0,0.10)' }}
          >
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => { onChange(cat.value); setOpen(false); }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-[12px] transition-colors text-left ${value === cat.value
                  ? 'bg-neutral-50 text-neutral-900'
                  : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                  }`}
                style={{ fontWeight: value === cat.value ? 500 : 400 }}
              >
                <span>{cat.label}</span>
                {value === cat.value && (
                  <Check size={12} strokeWidth={2.25} className="text-neutral-900 flex-shrink-0" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ConfirmModal({ open, count, onCancel, onConfirm, isLoading }: {
  open: boolean; count: number; onCancel: () => void; onConfirm: () => void; isLoading: boolean;
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
            style={{ boxShadow: '0 24px 64px -16px rgba(0,0,0,0.18)' }}>
            <div className="flex items-start gap-4 mb-6">
              <div>
                <h3 className="text-neutral-900 mb-1.5 tracking-tight" style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>¿Enviar al Agente 1?</h3>
                <p className="text-neutral-500 text-[13px] leading-relaxed">
                  Se enviarán <span className="text-neutral-900" style={{ fontWeight: 500 }}>{count} documentos</span> al Agente 1 para análisis de completitud. Los archivos quedarán en modo lectura.
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
                {isLoading ? <><Loader2 size={13} className="animate-spin" /> Enviando…</> : <><Send size={13} /> Confirmar</>}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}



export default function DocumentacionModule() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updatePhaseStatus } = useApp();
  const { playAgentSuccess, playProcessError, playPhaseComplete } = useSoundManager();

  const project = getProject(projectId!);
  const phase = project?.phases.find(p => p.number === 1);
  const isCompleted = phase?.status === 'completado';

  // Hook real de Supabase + Agente
  const { isProcessing: hookIsProcessing, isLoadingData, diagnosis, documentos, setDocumentos, processPhase, fetchInitialData, deleteDocument } = useDocumentacion(projectId!);

  // La fase está procesando si el estado global es 'procesando' o si el hook local lo indica
  const isProcessing = phase?.status === 'procesando' || hookIsProcessing;

  const [liveDiagnosis, setLiveDiagnosis] = useState<AgentDiagnosis | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Agente 9 — Banco de preguntas de entrevista
  const [agent9Data, setAgent9Data] = useState<any>(null);
  const [agent9Status, setAgent9Status] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [expandedDim, setExpandedDim] = useState<string | null>(null);
  const agent9PollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (isProcessing) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isProcessing]);

  // Trigger Agent 9 manually (for existing projects or retry)
  const triggerAgent9 = async () => {
    if (!projectId) return;
    setAgent9Status('processing');
    try {
      await supabase.from('fases_estado').upsert(
        { proyecto_id: projectId, numero_fase: 9, estado_visual: 'procesando', updated_at: new Date().toISOString() },
        { onConflict: 'proyecto_id,numero_fase' }
      );
      supabase.functions.invoke('pmo-agent', {
        body: { projectId, phaseNumber: 9, iteration: 1 }
      }).catch(e => console.error('[Agent9] invoke error:', e));
    } catch (e) {
      console.error('[Agent9] trigger error:', e);
      setAgent9Status('error');
    }
  };

  // Poll for Agent 9 results (question bank)
  useEffect(() => {
    // Iniciamos el polling si ya tenemos diagnóstico del Agente 1 (aunque no esté aprobada la fase)
    if (!projectId || (!isCompleted && !diagnosis)) return;

    const pollAgent9 = async () => {
      const { data, error } = await supabase
        .from('fases_estado')
        .select('datos_consolidados, estado_visual')
        .eq('proyecto_id', projectId)
        .eq('numero_fase', 9)
        .maybeSingle();

      if (error) {
        console.error('[Agent9] poll error:', error);
        return;
      }

      // Si ya hay datos consolidados, los cargamos directamente sin importar el estado_visual
      if (data?.datos_consolidados) {
        const dc = data.datos_consolidados as any;
        const parsed = dc?.diagnosis ?? dc;
        if (parsed?.preguntas_apertura || parsed?.preguntas_por_dimension) {
          setAgent9Data(parsed);
          setAgent9Status('done');
          if (agent9PollRef.current) clearInterval(agent9PollRef.current);
          return;
        }
      }

      // Lógica de auto-trigger o actualización de estado
      if (data?.estado_visual === 'procesando') {
        setAgent9Status('processing');
      } else if (!data || (data?.estado_visual === 'disponible' && !data?.datos_consolidados)) {
        // No hay registro o está disponible sin datos -> Disparar Agente 9
        if (agent9PollRef.current) clearInterval(agent9PollRef.current);
        triggerAgent9();
      } else if (data?.estado_visual === 'disponible' && agent9Status === 'processing') {
        setAgent9Status('error');
        if (agent9PollRef.current) clearInterval(agent9PollRef.current);
      }
    };

    pollAgent9(); // Check immediately
    agent9PollRef.current = setInterval(pollAgent9, 4000);

    return () => { if (agent9PollRef.current) clearInterval(agent9PollRef.current); };
  }, [projectId, isCompleted, diagnosis]); // Añadido diagnosis como dependencia

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (agent9PollRef.current) clearInterval(agent9PollRef.current); };
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const canComplete = documentos.length > 0 && documentos.every(d =>
    d.category !== 'D11' || d.customCategory.trim() !== ''
  );

  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const maxSize = 50 * 1024 * 1024; // 50 MB

    fileArray.forEach(file => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (ext !== 'pdf' && ext !== 'csv') {
        toast.error(`Formato no permitido: .${ext}`, {
          description: 'Solo se aceptan archivos PDF o CSV.',
        });
        return;
      }
      if (file.size > maxSize) { toast.error(`${file.name} supera el límite de 50MB`); return; }
      const doc: Documento = {
        id: `d${Date.now()}_${Math.random()}`,
        name: file.name,
        size: file.size,
        type: file.type,
        category: 'D01',
        customCategory: '',
        file,
      };
      setDocumentos(prev => [...prev, doc]);
      toast.success(`${file.name} cargado correctamente`);
    });
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
  };

  const updateCategory = (id: string, category: DocCategory) => {
    setDocumentos(prev => prev.map(d => d.id === id ? { ...d, category, customCategory: '' } : d));
  };

  const updateCustomCategory = (id: string, val: string) => {
    setDocumentos(prev => prev.map(d => d.id === id ? { ...d, customCategory: val } : d));
  };

  const handleDelete = (doc: DocumentoLocal) => {
    deleteDocument(doc);
  };

  const handleMarkComplete = () => {
    if (!canComplete) {
      toast.error('Complete todos los campos de categoría antes de continuar.');
      return;
    }
    handleConfirm();
  };

  const handleConfirm = async () => {
    setIsSending(true);
    updatePhaseStatus(projectId!, 1, 'procesando');

    try {
      const result = await processPhase(documentos);
      if (result) {
        setLiveDiagnosis(result);
        const summary = result.summary ?? `${documentos.length} documentos analizados.`;
        updatePhaseStatus(projectId!, 1, 'completado', summary);
        playPhaseComplete();
        toast.success('¡Fase 1 completada!', { description: 'El Agente  finalizó el análisis documental.' });
        await fetchInitialData(); // Refrescar IDs de DB reales
      }
    } catch {
      updatePhaseStatus(projectId!, 1, 'disponible');
      playProcessError();
      toast.error('Hubo un error al procesar. Intenta nuevamente.');
    } finally {
      setIsSending(false);
    }
  };

  if (!project) return null;

  if (isLoadingData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-screen bg-[#fafaf9] gap-3">
        <Loader2 className="animate-spin text-neutral-400" size={24} />
        <span className="text-neutral-500 text-[13px]" style={{ fontWeight: 500 }}>Cargando datos de la fase...</span>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-[#fafaf9]">
      <PhaseHeader
        projectId={projectId!}
        companyName={project.companyName}
        phaseNumber={1}
        phaseName="Gestión Documental"
        eyebrow={isCompleted ? 'Completada' : 'Activa'}
      />

      {/* Processing overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-[#fafaf9]/85 backdrop-blur-md flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full border border-neutral-200 bg-white flex items-center justify-center mb-5" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <Loader2 size={22} className="text-neutral-700 animate-spin" strokeWidth={1.75} />
            </div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-2" style={{ fontWeight: 500 }}>Procesando</p>
            <h2 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '1.25rem', letterSpacing: '-0.01em' }}>
              Analizando documentos
            </h2>
            <p className="text-neutral-500 text-[13px] mt-2">El Agente 1 está evaluando la completitud documental…</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-[1100px] mx-auto px-10 py-10">
        <div className="mb-10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-3" style={{ fontWeight: 500 }}>Fase 1 · Gestión documental</p>
          <h1 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '2.25rem', lineHeight: 1.05, letterSpacing: '-0.025em' }}>
            {isCompleted ? 'Documentación analizada' : 'Cargue de artefactos PMO'}
          </h1>
          <p className="text-neutral-500 text-[14px] mt-3 max-w-2xl leading-relaxed">
            {isCompleted
              ? 'El Agente 1 evaluó la completitud, actualización y calidad del contenido documental.'
              : 'Cargue y categorice los documentos institucionales. El Agente 1 evaluará completitud y brechas.'}
          </p>

          {/* Metadata strip */}
          <div className="grid grid-cols-3 gap-px bg-neutral-200/60 rounded-2xl overflow-hidden mt-7 border border-neutral-200/60">
            <div className="bg-white px-5 py-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Documentos</p>
              <p className="mt-1.5 text-neutral-900 tabular-nums" style={{ fontWeight: 500, fontSize: '1.375rem', letterSpacing: '-0.02em' }}>
                {documentos.length}
              </p>
            </div>
            <div className="bg-white px-5 py-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Tamaño total</p>
              <p className="mt-1.5 text-neutral-900 tabular-nums" style={{ fontWeight: 500, fontSize: '1.375rem', letterSpacing: '-0.02em' }}>
                {formatSize(documentos.reduce((s, d) => s + d.size, 0))}
              </p>
            </div>
            <div className="bg-white px-5 py-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>Estado</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${isCompleted ? 'bg-neutral-900' : canComplete ? 'bg-neutral-800' : 'bg-neutral-300'}`} />
                <p className="text-neutral-900 text-[13px]" style={{ fontWeight: 500 }}>
                  {isCompleted ? 'Completada' : canComplete ? 'Lista para enviar' : 'En preparación'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {!isCompleted && (
          <>
            <div className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-neutral-200/70 bg-white mb-4" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <div className="w-7 h-7 rounded-lg bg-neutral-50 border border-neutral-200/80 flex items-center justify-center flex-shrink-0">
                <Info size={13} className="text-neutral-700" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-neutral-800 text-[13px] leading-snug">
                  <span style={{ fontWeight: 500 }}>Solo se aceptan archivos PDF o CSV.</span>{' '}
                  Los modelos de IA procesan estos formatos para garantizar la extracción de texto y análisis estructurado.
                </p>
                <a
                  href="https://www.ilovepdf.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="inline-flex items-center gap-1 mt-1.5 text-neutral-700 hover:text-neutral-900 hover:underline text-[12px] transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  ¿Tienes otro tipo de archivo? Conviértelo a PDF o CSV aquí
                  <ExternalLink size={11} />
                </a>
              </div>
            </div>

            {/* Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`group relative rounded-2xl p-14 text-center cursor-pointer transition-all mb-6 overflow-hidden
                ${dragActive
                  ? 'bg-neutral-900 text-white'
                  : 'bg-white border border-dashed border-neutral-300 hover:border-neutral-400'}
              `}
              style={!dragActive ? { boxShadow: '0 1px 2px rgba(0,0,0,0.02)' } : undefined}
            >
              {/* subtle radial gradient */}
              {!dragActive && (
                <div className="pointer-events-none absolute inset-0 opacity-60" style={{
                  background: 'radial-gradient(ellipse 600px 200px at 50% 0%, rgba(10,10,10,0.025), transparent 70%)'
                }} />
              )}
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput} accept=".pdf,.csv" />
              <motion.div animate={dragActive ? { scale: 1.03 } : { scale: 1 }} className="relative">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 border transition-all ${dragActive
                  ? 'bg-white/10 border-white/20 text-white'
                  : 'bg-neutral-50 border-neutral-200/80 text-neutral-700 group-hover:bg-neutral-900 group-hover:border-neutral-900 group-hover:text-white'
                  }`}>
                  <Upload size={20} strokeWidth={1.75} />
                </div>
                <p className={`mb-1.5 tracking-tight ${dragActive ? 'text-white' : 'text-neutral-900'}`}
                  style={{ fontWeight: 500, fontSize: '1rem', letterSpacing: '-0.01em' }}>
                  {dragActive ? 'Suelte los archivos aquí' : 'Arrastre archivos aquí'}
                </p>
                <p className={`text-[12px] ${dragActive ? 'text-white/70' : 'text-neutral-500'}`}>
                  o <span className="underline decoration-neutral-300 underline-offset-4">haga clic para explorar</span> · Máx. 50 MB
                </p>
              </motion.div>
            </div>
          </>
        )}

        {/* Document List */}
        {documentos.length > 0 && (
          <div className="bg-white rounded-2xl border border-neutral-200/70 mb-6" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
            <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen size={13} className="text-neutral-500" strokeWidth={1.75} />
                <span className="text-neutral-900 text-[13px]" style={{ fontWeight: 500 }}>
                  Documentos
                </span>
                <span className="text-[11px] text-neutral-400 tabular-nums">{documentos.length}</span>
              </div>
            </div>

            <div className="divide-y divide-neutral-100">
              {documentos.map(doc => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="px-5 py-4 flex items-center gap-4 transition-colors hover:bg-neutral-50/60"
                >
                  <div className="w-9 h-9 rounded-xl bg-neutral-50 border border-neutral-200/70 flex items-center justify-center flex-shrink-0">
                    {getFileIcon(doc.name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-neutral-900 text-[13px] truncate" style={{ fontWeight: 500 }}>{doc.name}</p>
                    <p className="text-neutral-400 text-[11px] tabular-nums">{formatSize(doc.size)}</p>
                  </div>

                  {!isCompleted ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <CategoryDropdown
                        value={doc.category}
                        onChange={v => updateCategory(doc.id, v)}
                      />

                      <AnimatePresence>
                        {doc.category === 'D11' && (
                          <motion.input
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: '10rem', opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            type="text"
                            value={doc.customCategory}
                            onChange={e => updateCustomCategory(doc.id, e.target.value)}
                            placeholder="Especifique…"
                            className={`px-2.5 py-1.5 border rounded-full text-[12px] outline-none transition-all bg-white
                              ${!doc.customCategory.trim() ? 'border-neutral-900 focus:ring-2 focus:ring-neutral-100' : 'border-neutral-200/80 focus:border-neutral-300'}
                            `}
                          />
                        )}
                      </AnimatePresence>

                      <button title="Reemplazar" className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors">
                        <RefreshCw size={12} strokeWidth={1.75} />
                      </button>
                      <button onClick={() => handleDelete(doc)} title="Eliminar"
                        className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors">
                        <Trash2 size={12} strokeWidth={1.75} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 bg-neutral-100 text-neutral-700 text-[11px] rounded-full" style={{ fontWeight: 500 }}>
                        {CATEGORIES.find(c => c.value === doc.category)?.label || doc.category || 'Sin categoría'}
                      </span>
                      <button
                        onClick={async () => {
                          try {
                            let url = doc.storagePath || (doc.file ? URL.createObjectURL(doc.file) : '');

                            // Si la URL es de Supabase y tiene un token, podría estar expirado (dura 1 hora).
                            // Extraemos la ruta real y generamos una nueva URL firmada.
                            if (url && url.includes('token=')) {
                              const match = url.match(/documentos-pmo\/(.+?)\?token=/);
                              if (match && match[1]) {
                                const rawPath = decodeURIComponent(match[1]);
                                const { data } = await supabase.storage.from('documentos-pmo').createSignedUrl(rawPath, 3600);
                                if (data?.signedUrl) url = data.signedUrl;
                              }
                            }

                            if (url) {
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = doc.name;
                              a.target = '_blank';
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                            }
                          } catch (err) {
                            console.error('Error al descargar:', err);
                            toast.error('No se pudo generar el enlace de descarga.');
                          }
                        }}
                        className="inline-flex items-center gap-1 text-[12px] text-neutral-700 hover:text-neutral-900 hover:underline"
                        style={{ fontWeight: 500 }}
                      >
                        <Download size={11} /> Descargar
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {documentos.length === 0 && !isCompleted && (
          <div className="bg-white rounded-2xl border border-dashed border-neutral-200 p-10 text-center">
            <FolderOpen size={24} className="text-neutral-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-neutral-500 text-[13px]">No hay documentos cargados.</p>
          </div>
        )}

        {/* Bottom action */}
        {!isCompleted && !isProcessing && (
          <div className="mt-8 flex justify-end">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ y: 0 }}
              onClick={handleMarkComplete}
              disabled={!canComplete}
              className="px-6 py-3 rounded-full text-white text-[13px] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{ background: '#0a0a0a', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}
            >
              Enviar al Agente
            </motion.button>
          </div>
        )}

        {/* Completed: Agent Diagnosis — Real Data from Gemini */}
        {isCompleted && (() => {
          const d = liveDiagnosis ?? diagnosis;
          if (!d) return (
            <div className="rounded-2xl border border-neutral-200/70 bg-white p-7 text-center">
              <Sparkles size={20} className="text-neutral-300 mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-neutral-500 text-[13px]">El diagnóstico se cargará aquí una vez completado.</p>
            </div>
          );
          return (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="space-y-5">

              {/* Header */}
              <div className="rounded-2xl border border-neutral-200/70 bg-white p-7"
                style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="w-7 h-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
                    <Sparkles size={13} strokeWidth={1.75} />
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-500" style={{ fontWeight: 500 }}>
                    Diagnóstico — Agente 3 · Documental
                  </span>
                </div>
                <p className="text-neutral-700 text-[14px] leading-relaxed">{d.summary}</p>
              </div>

              {/* Cobertura Stats */}
              <div className="grid grid-cols-3 gap-px bg-neutral-200/60 rounded-2xl overflow-hidden border border-neutral-200/60">
                {[
                  { label: 'Documentos Esperados', value: typeof d.cobertura_documental?.total_esperado === 'number' ? Number(d.cobertura_documental.total_esperado.toFixed(1)) : (d.cobertura_documental?.total_esperado ?? '—') },
                  { label: 'Recibidos Completos', value: typeof d.cobertura_documental?.recibidos_completos === 'number' ? Number(d.cobertura_documental.recibidos_completos.toFixed(1)) : (d.cobertura_documental?.recibidos_completos ?? '—') },
                  { label: 'Faltantes', value: typeof d.cobertura_documental?.faltantes === 'number' ? Number(d.cobertura_documental.faltantes.toFixed(1)) : (d.cobertura_documental?.faltantes ?? '—') },
                ].map((s, i) => (
                  <div key={i} className="bg-white px-5 py-4">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-400" style={{ fontWeight: 500 }}>{s.label}</p>
                    <p className="mt-2 text-neutral-900 tabular-nums" style={{ fontWeight: 500, fontSize: '1.75rem', letterSpacing: '-0.02em' }}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Calidad Documental */}
              {d.calidad_documental && (
                <div className="rounded-2xl border border-neutral-200/70 bg-white p-6"
                  style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <FileSearch size={14} className="text-neutral-500" strokeWidth={1.75} />
                    <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500" style={{ fontWeight: 500 }}>Calidad Documental</p>
                    <span className={`ml-auto px-2.5 py-1 rounded-full text-[11px] ${d.calidad_documental.resultado_consolidado === 'Alta' ? 'bg-neutral-900 text-white' :
                      d.calidad_documental.resultado_consolidado === 'Media' ? 'bg-neutral-200 text-neutral-700' :
                        'bg-neutral-100 text-neutral-500'
                      }`} style={{ fontWeight: 500 }}>{d.calidad_documental.resultado_consolidado}</span>
                  </div>
                  <p className="text-neutral-600 text-[13px] leading-relaxed">{d.calidad_documental.justificacion}</p>
                </div>
              )}

              {/* Key Insights (Hallazgos puntuales) */}
              {d.key_insights && d.key_insights.length > 0 && (
                <div className="rounded-2xl border border-neutral-200/70 bg-white p-6"
                  style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400 mb-4" style={{ fontWeight: 500 }}>Insights Rápidos</p>
                  <ul className="space-y-3">
                    {d.key_insights.map((insight, i) => (
                      <li key={i} className="flex items-start gap-3 text-neutral-700 text-[13px] leading-relaxed">
                        <Sparkles size={14} className="text-neutral-900 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Hallazgos Estructurados */}
              {d.hallazgos_documentales && d.hallazgos_documentales.length > 0 && (
                <div className="rounded-2xl border border-neutral-200/70 bg-white p-6"
                  style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400 mb-4" style={{ fontWeight: 500 }}>Hallazgos Estructurados</p>
                  <div className="space-y-3">
                    {d.hallazgos_documentales.map((hallazgo, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                        <CheckCircle2 size={14} className="text-neutral-900 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                        <div className="flex-1 min-w-0">
                          <p className="text-neutral-800 text-[13px]" style={{ fontWeight: 500 }}>{hallazgo.nombre}</p>
                          <p className="text-neutral-500 text-[12px] mt-0.5 leading-relaxed">{hallazgo.descripcion}</p>
                        </div>
                        {hallazgo.tipo && (
                          <span className="flex-shrink-0 px-2 py-0.5 bg-neutral-200/60 text-neutral-600 rounded-full text-[10px]" style={{ fontWeight: 500 }}>
                            {hallazgo.tipo.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Brechas */}
              {d.brechas_documentales && d.brechas_documentales.length > 0 && (
                <div className="rounded-2xl border border-neutral-200/70 bg-white p-6"
                  style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400 mb-4" style={{ fontWeight: 500 }}>Brechas Documentales</p>
                  <div className="space-y-3">
                    {d.brechas_documentales.map((brecha, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                        <ShieldAlert size={14} className={`flex-shrink-0 mt-0.5 ${brecha.impacto === 'Alto' ? 'text-neutral-900' :
                          brecha.impacto === 'Medio' ? 'text-neutral-600' : 'text-neutral-400'
                          }`} strokeWidth={1.75} />
                        <div className="flex-1 min-w-0">
                          <p className="text-neutral-800 text-[13px]" style={{ fontWeight: 500 }}>{brecha.dimension_o_area}</p>
                          <p className="text-neutral-500 text-[12px] mt-0.5 leading-relaxed">{brecha.descripcion}</p>
                        </div>
                        <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] ${brecha.impacto === 'Alto' ? 'bg-neutral-900 text-white' :
                          brecha.impacto === 'Medio' ? 'bg-neutral-200 text-neutral-700' :
                            'bg-neutral-100 text-neutral-500'
                          }`} style={{ fontWeight: 500 }}>{brecha.impacto}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recomendaciones */}
              {d.recommendations && d.recommendations.length > 0 && (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500 mb-4" style={{ fontWeight: 500 }}>Recomendaciones</p>
                  <ul className="space-y-3">
                    {d.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-3 text-neutral-700 text-[13px] leading-relaxed">
                        <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 mt-2 flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── Cobertura Documental (D01-D10) ── */}
              <div className="rounded-2xl border border-neutral-200/70 bg-white overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                <div className="bg-neutral-50/50 px-6 py-3 border-b border-neutral-200/70 flex items-center gap-2">
                  <FileSearch size={14} className="text-neutral-500" />
                  <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500" style={{ fontWeight: 600 }}>Inventario y Cobertura de Documentación</p>
                </div>
                <div className="overflow-x-auto">
                  {(() => {
                    // Build a lookup map from codigo_catalogo → entry
                    const estadoMap: Record<string, any> = {};
                    if (Array.isArray(d.estado_documentos)) {
                      for (const e of d.estado_documentos) {
                        const code = e.codigo_catalogo?.trim().toUpperCase();
                        if (code) estadoMap[code] = e;
                      }
                    }

                    const ESTADO_LABELS: Record<string, { label: string; color: string }> = {
                      'util_para_analisis':              { label: 'Útil para análisis',    color: 'text-neutral-900 bg-neutral-100 border-neutral-200' },
                      'critico_para_gp':                 { label: 'Crítico',                color: 'text-neutral-900 bg-neutral-900 text-white border-neutral-900' },
                      'incompleto':                      { label: 'Incompleto',             color: 'text-neutral-600 bg-neutral-100 border-neutral-200' },
                      'no_legible':                      { label: 'No legible',             color: 'text-neutral-500 bg-neutral-50 border-neutral-200' },
                      'parcialmente_interpretable':      { label: 'Parcial',                color: 'text-neutral-600 bg-neutral-100 border-neutral-200' },
                      'insuficiente_para_concluir':      { label: 'Insuficiente',           color: 'text-neutral-500 bg-neutral-50 border-neutral-200' },
                      'desactualizado':                  { label: 'Desactualizado',         color: 'text-neutral-600 bg-neutral-100 border-neutral-200' },
                      'solo_referenciado':               { label: 'Solo referenciado',      color: 'text-neutral-400 bg-neutral-50 border-neutral-200' },
                      'no_entregado':                    { label: 'No entregado',           color: 'text-neutral-400 bg-neutral-50 border-neutral-100' },
                    };

                    const standardCats = [
                      { id: 'D01', label: 'Organigrama' },
                      { id: 'D02', label: 'Artefactos de Gestión de proyectos' },
                      { id: 'D03', label: 'Plataformas y Sistemas' },
                      { id: 'D04', label: 'Listado de Proyectos' },
                      { id: 'D05', label: 'Proyecto mejor documentado' },
                      { id: 'D06', label: 'Resultados Estratégicos' },
                      { id: 'D07', label: 'Mapa de Procesos' },
                      { id: 'D08', label: 'Arquitectura Organizacional/TI' },
                      { id: 'D09', label: 'Metodología de Proyectos' },
                      { id: 'D10', label: 'Portafolio de Productos/Servicios' }
                    ];

                    // Find additional documents (DXX, etc.) not in the standard list
                    const additionalDocs = (d.estado_documentos || [])
                      .filter((e: any) => !standardCats.some(c => c.id === e.codigo_catalogo?.trim().toUpperCase()))
                      .map((e: any) => ({
                        id: e.codigo_catalogo || 'DXX',
                        label: e.nombre || 'Documento Adicional',
                        isExtra: true
                      }));

                    const allRows = [...standardCats, ...additionalDocs];

                    return (
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-neutral-100">
                            <th className="px-6 py-3 text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Documento</th>
                            <th className="px-6 py-3 text-[10px] uppercase tracking-wider text-neutral-400 font-semibold text-center w-28">Disponible</th>
                            <th className="px-6 py-3 text-[10px] uppercase tracking-wider text-neutral-400 font-semibold text-center w-28">Faltante</th>
                            <th className="px-6 py-3 text-[10px] uppercase tracking-wider text-neutral-400 font-semibold w-44">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-50">
                          {allRows.map((cat: any) => {
                            const entry = estadoMap[cat.id.toUpperCase()];
                            const isMissing = !entry || entry.estado === 'no_entregado';
                            const estadoInfo = entry ? ESTADO_LABELS[entry.estado] : null;
                            
                            // For extra docs, we don't show "Faltante" because they aren't required
                            const showMissing = !cat.isExtra;

                            return (
                              <tr key={cat.id} className="hover:bg-neutral-50/50 transition-colors">
                                <td className="px-6 py-3.5">
                                  <div className="flex items-center gap-2.5">
                                    <span className={`text-[10px] font-bold tabular-nums w-6 ${cat.isExtra ? 'text-neutral-900' : 'text-neutral-400'}`}>{cat.id}</span>
                                    <span className="text-neutral-700 text-[13px]" style={{ fontWeight: 500 }}>{cat.label}</span>
                                    {cat.isExtra && <span className="text-[9px] px-1.5 py-0.5 bg-neutral-900 text-white rounded-md border border-neutral-900 uppercase tracking-wider font-bold">Extra</span>}
                                  </div>
                                </td>
                                <td className="px-6 py-3.5 text-center">
                                  {!isMissing ? (
                                    <div className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-neutral-900 text-white">
                                      <Check size={12} strokeWidth={3} />
                                    </div>
                                  ) : (
                                    <span className="text-neutral-200 text-[10px]">—</span>
                                  )}
                                </td>
                                <td className="px-6 py-3.5 text-center">
                                  {showMissing && isMissing ? (
                                    <div className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-neutral-100 text-neutral-400 border border-neutral-200">
                                      <X size={12} strokeWidth={3} />
                                    </div>
                                  ) : (
                                    <span className="text-neutral-200 text-[10px]">—</span>
                                  )}
                                </td>
                                <td className="px-6 py-3.5">
                                  {estadoInfo ? (
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] border ${estadoInfo.color}`} style={{ fontWeight: 500 }}>
                                      {estadoInfo.label}
                                    </span>
                                  ) : (
                                    <span className="text-neutral-300 text-[11px]">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </div>


              {/* Limitaciones */}
              {d.limitaciones && d.limitaciones.length > 0 && (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-100/50 p-5 mt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Info size={14} className="text-neutral-500" strokeWidth={1.75} />
                    <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-600" style={{ fontWeight: 500 }}>Limitaciones de Análisis</p>
                  </div>
                  <ul className="space-y-2">
                    {d.limitaciones.map((lim, i) => (
                      <li key={i} className="text-[12px] text-neutral-600 flex items-start gap-2">
                        <span className="text-neutral-400 mt-0.5">•</span>
                        {lim.descripcion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}


              {/* ── Agente 9: Banco de Preguntas de Entrevista ── */}
              <div className="mt-2">
                {(agent9Status === 'idle' || agent9Status === 'processing') && (
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-neutral-200 flex items-center justify-center flex-shrink-0">
                      <Loader2 size={16} className="text-neutral-600 animate-spin" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500 mb-0.5" style={{ fontWeight: 500 }}>Recomendaciones para las entrevistas</p>
                      <p className="text-neutral-700 text-[13px]">Generando recomendaciones para las entrevistas…</p>
                    </div>
                  </div>
                )}

                {agent9Status === 'error' && (
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-xl bg-neutral-200 flex items-center justify-center flex-shrink-0">
                        <AlertCircle size={16} className="text-neutral-500" strokeWidth={1.75} />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500 mb-0.5" style={{ fontWeight: 500 }}>Error en recomendaciones</p>
                        <p className="text-neutral-600 text-[13px]">No se pudieron generar las recomendaciones para las entrevistas.</p>
                      </div>
                    </div>
                    <button
                      onClick={triggerAgent9}
                      className="flex items-center gap-2 px-4 py-2 rounded-full text-[12px] bg-white border border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 transition-all flex-shrink-0"
                      style={{ fontWeight: 500 }}
                    >
                      <RefreshCw size={12} strokeWidth={2} /> Reintentar
                    </button>
                  </div>
                )}

                {agent9Status === 'done' && agent9Data && (() => {
                  const a9 = agent9Data;
                  const PERFILES: Record<string, string> = {
                    'P-DIR': 'Dirección', 'P-PMO': 'PMO', 'P-GP': 'Ger. Proyecto',
                    'P-OPS': 'Operativo', 'P-FIN': 'Financiero', 'P-TEC': 'Técnico', 'P-ALL': 'Todos'
                  };
                  const PRIORIDAD_COLOR: Record<string, string> = {
                    'Alta': 'bg-neutral-900 text-white border-neutral-900',
                    'Media': 'bg-neutral-200 text-neutral-800 border-neutral-300',
                    'Baja': 'bg-neutral-50 text-neutral-500 border-neutral-200',
                  };
                  const dimensions = [
                    { key: 'inicio', label: 'Inicio', prefix: 'DI' },
                    { key: 'planeacion', label: 'Planeación', prefix: 'DP' },
                    { key: 'ejecucion', label: 'Ejecución', prefix: 'DE' },
                    { key: 'monitoreo_control', label: 'Monitoreo y Control', prefix: 'DMC' },
                    { key: 'cierre', label: 'Cierre', prefix: 'DC' },
                  ];

                  const renderPregunta = (p: any) => (
                    <div key={p.pregunta_id} className="p-4 rounded-xl bg-neutral-50 border border-neutral-100 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] text-neutral-400 tabular-nums mt-0.5 flex-shrink-0" style={{ fontWeight: 600 }}>{p.pregunta_id}</span>
                        <p className="text-neutral-800 text-[13px] leading-relaxed flex-1" style={{ fontWeight: 500 }}>{p.pregunta_principal}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap ml-5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${PRIORIDAD_COLOR[p.prioridad] || 'bg-neutral-100 text-neutral-500 border-neutral-200'}`} style={{ fontWeight: 500 }}>
                          {p.prioridad}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-neutral-900 text-white border border-neutral-900" style={{ fontWeight: 500 }}>
                          {PERFILES[p.perfil] || p.perfil}
                        </span>
                      </div>
                      {p.preguntas_de_profundizacion?.length > 0 && (
                        <ul className="ml-5 space-y-1 pt-1 border-t border-neutral-100">
                          {p.preguntas_de_profundizacion.map((pf: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-[12px] text-neutral-500">
                              <ChevronRight size={11} className="flex-shrink-0 mt-0.5 text-neutral-300" />
                              {pf}
                            </li>
                          ))}
                        </ul>
                      )}
                      {p.contexto_para_el_consultor && (
                        <p className="ml-5 text-[11px] text-neutral-500 italic border-t border-neutral-100 pt-1">
                          {p.contexto_para_el_consultor}
                        </p>
                      )}
                    </div>
                  );

                  return (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      {/* Header */}
                      <div className="rounded-2xl border border-neutral-200 bg-white p-6" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                        <div className="flex items-center gap-2.5 mb-4">
                          <div className="w-7 h-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
                            <MessageSquare size={13} strokeWidth={1.75} />
                          </div>
                          <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-500" style={{ fontWeight: 500 }}>Recomendaciones para las entrevistas</span>
                        </div>
                        <p className="text-neutral-700 text-[14px] leading-relaxed mb-5">{a9.summary}</p>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-px bg-neutral-200/60 rounded-xl overflow-hidden border border-neutral-200/60">
                          <div className="bg-white px-4 py-3">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-400" style={{ fontWeight: 500 }}>Total Preguntas</p>
                            <p className="mt-1 text-neutral-900 tabular-nums" style={{ fontWeight: 600, fontSize: '1.5rem', letterSpacing: '-0.02em' }}>{a9.total_preguntas}</p>
                          </div>
                          <div className="bg-white px-4 py-3">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-400" style={{ fontWeight: 500 }}>Tiempo estimado</p>
                            <div className="flex items-baseline gap-1 mt-1">
                              <p className="text-neutral-900 tabular-nums" style={{ fontWeight: 600, fontSize: '1.5rem', letterSpacing: '-0.02em' }}>{a9.instrucciones_para_el_consultor?.tiempo_estimado_por_entrevista_minutos ?? '—'}</p>
                              <span className="text-neutral-400 text-[12px]">min</span>
                            </div>
                          </div>
                          <div className="bg-white px-4 py-3">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-400" style={{ fontWeight: 500 }}>Mínimas por sesión</p>
                            <p className="mt-1 text-neutral-900 tabular-nums" style={{ fontWeight: 600, fontSize: '1.5rem', letterSpacing: '-0.02em' }}>{a9.instrucciones_para_el_consultor?.preguntas_minimas_recomendadas_por_entrevista ?? '—'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Preguntas de Apertura */}
                      {a9.preguntas_apertura?.length > 0 && (
                        <div className="rounded-2xl border border-neutral-200/70 bg-white p-6" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                          <div className="flex items-center gap-2 mb-4">
                            <Users size={14} className="text-neutral-500" strokeWidth={1.75} />
                            <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500" style={{ fontWeight: 500 }}>Preguntas de Apertura</p>
                            <span className="ml-auto text-[11px] text-neutral-400 tabular-nums">{a9.preguntas_apertura.length} preguntas</span>
                          </div>
                          <div className="space-y-3">{a9.preguntas_apertura.map(renderPregunta)}</div>
                        </div>
                      )}

                      {/* Preguntas por Dimensión */}
                      {dimensions.map(({ key, label }) => {
                        const preguntas = a9.preguntas_por_dimension?.[key] ?? [];
                        if (!preguntas.length) return null;
                        const isOpen = expandedDim === key;
                        return (
                          <div key={key} className="rounded-2xl border border-neutral-200/70 bg-white overflow-hidden print:border-none print:shadow-none" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                            <button
                              onClick={() => setExpandedDim(isOpen ? null : key)}
                              className="w-full flex items-center gap-3 px-6 py-4 hover:bg-neutral-50 transition-colors text-left print:pointer-events-none print:px-0 print:pb-2"
                            >
                              <div className="w-6 h-6 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0 print:hidden">
                                <MessageSquare size={11} className="text-neutral-600" strokeWidth={1.75} />
                              </div>
                              <p className="flex-1 text-neutral-800 text-[13px] print:text-[15px]" style={{ fontWeight: 600 }}>{label}</p>
                              <span className="text-[11px] text-neutral-400 tabular-nums print:hidden">{preguntas.length} preguntas</span>
                              <ChevronDown size={13} className={`text-neutral-400 transition-transform duration-200 print:hidden ${isOpen ? 'rotate-180' : ''}`} />
                            </button>
                            
                            <motion.div
                              initial={false}
                              animate={{ 
                                height: isOpen ? 'auto' : 0, 
                                opacity: isOpen ? 1 : 0 
                              }}
                              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                              className="overflow-hidden print:!h-auto print:!opacity-100 print:!block"
                            >
                              <div className="px-6 pb-5 pt-1 space-y-3 border-t border-neutral-100 print:px-0 print:border-none">
                                {preguntas.map(renderPregunta)}
                              </div>
                            </motion.div>
                          </div>
                        );
                      })}

                      {/* Señales metodológicas */}
                      {a9.preguntas_senales_metodologicas?.length > 0 && (
                        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/30 p-6">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500 mb-4" style={{ fontWeight: 500 }}>Señales Metodológicas</p>
                          <div className="space-y-3">{a9.preguntas_senales_metodologicas.map(renderPregunta)}</div>
                        </div>
                      )}

                      {/* Advertencias */}
                      {a9.instrucciones_para_el_consultor?.advertencias?.length > 0 && (
                        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <AlertCircle size={13} className="text-neutral-500" strokeWidth={1.75} />
                            <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-600" style={{ fontWeight: 500 }}>Advertencias para el Consultor</p>
                          </div>
                          <ul className="space-y-2">
                            {a9.instrucciones_para_el_consultor.advertencias.map((adv: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 text-[13px] text-neutral-700">
                                <span className="text-neutral-400 mt-0.5">•</span>{adv}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Orden recomendado */}
                      <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-neutral-50 border border-neutral-200/60">
                        <Clock size={13} className="text-neutral-400 flex-shrink-0" strokeWidth={1.75} />
                        <p className="text-[12px] text-neutral-600">
                          <span style={{ fontWeight: 500 }}>Orden recomendado: </span>
                          {a9.instrucciones_para_el_consultor?.orden_recomendado}
                        </p>
                      </div>
                    </motion.div>
                  );
                })()}
              </div>

            </motion.div>
          );
        })()}
      </div>



      <NextPhaseButton projectId={projectId!} nextPhase={2} show={isCompleted} />
    </div>
  );
}