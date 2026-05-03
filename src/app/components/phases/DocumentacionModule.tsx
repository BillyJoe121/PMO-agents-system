import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload, FileText, FileSpreadsheet, Presentation, Image,
  Trash2, RefreshCw, ChevronDown, Send, Loader2,
  CheckCircle2, FolderOpen, Sparkles, Download, ExternalLink, Info, Check,
  AlertCircle, FileSearch, ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import { useDocumentacion, type DocumentoLocal, type AgentDiagnosis } from '../../hooks/useDocumentacion';
import PhaseHeader from './_shared/PhaseHeader';
import NextPhaseButton from './_shared/NextPhaseButton';

type DocCategory = 'acta_constitucion' | 'plan_proyecto' | 'organigrama' | 'politica_interna' | 'otro';
type Documento = DocumentoLocal;



const CATEGORIES: { value: DocCategory; label: string }[] = [
  { value: 'acta_constitucion', label: 'Acta de constitución' },
  { value: 'plan_proyecto', label: 'Plan de proyecto' },
  { value: 'organigrama', label: 'Organigrama' },
  { value: 'politica_interna', label: 'Política interna' },
  { value: 'otro', label: 'Otro' },
];



function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['xlsx', 'xls', 'csv'].includes(ext || '')) return <FileSpreadsheet size={15} className="text-emerald-600" strokeWidth={1.75} />;
  if (['pptx', 'ppt'].includes(ext || '')) return <Presentation size={15} className="text-orange-600" strokeWidth={1.75} />;
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) return <Image size={15} className="text-violet-600" strokeWidth={1.75} />;
  return <FileText size={15} className="text-rose-600" strokeWidth={1.75} />;
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
          className={`text-neutral-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 3, scale: 0.97 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 mt-1.5 min-w-[180px] bg-white rounded-2xl border border-neutral-200/70 z-50 overflow-hidden py-1.5 px-1.5"
            style={{ boxShadow: '0 4px 6px -2px rgba(0,0,0,0.04), 0 16px 40px -8px rgba(0,0,0,0.10)' }}
          >
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => { onChange(cat.value); setOpen(false); }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-[12px] transition-colors ${value === cat.value
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

  const project = getProject(projectId!);
  const phase = project?.phases.find(p => p.number === 1);
  const isCompleted = phase?.status === 'completado';

  // Hook real de Supabase + Agente
  const { isProcessing: hookIsProcessing, isLoadingData, diagnosis, documentos, setDocumentos, processPhase, fetchInitialData } = useDocumentacion(projectId!);

  // La fase está procesando si el estado global es 'procesando' o si el hook local lo indica
  const isProcessing = phase?.status === 'procesando' || hookIsProcessing;

  const [liveDiagnosis, setLiveDiagnosis] = useState<AgentDiagnosis | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);

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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const canComplete = documentos.length > 0 && documentos.every(d =>
    d.category !== 'otro' || d.customCategory.trim() !== ''
  );

  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const maxSize = 20 * 1024 * 1024;

    fileArray.forEach(file => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (ext !== 'pdf' && ext !== 'csv') {
        toast.error(`Formato no permitido: .${ext}`, {
          description: 'Solo se aceptan archivos PDF o CSV.',
        });
        return;
      }
      if (file.size > maxSize) { toast.error(`${file.name} supera el límite de 20MB`); return; }
      const doc: Documento = {
        id: `d${Date.now()}_${Math.random()}`,
        name: file.name,
        size: file.size,
        type: file.type,
        category: 'plan_proyecto',
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

  const handleDelete = (id: string) => {
    setDocumentos(prev => prev.filter(d => d.id !== id));
    toast.success('Documento eliminado');
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
        toast.success('¡Fase 1 completada!', { description: 'El Agente  finalizó el análisis documental.' });
        await fetchInitialData(); // Refrescar IDs de DB reales
      }
    } catch {
      updatePhaseStatus(projectId!, 1, 'disponible');
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
                <span className={`w-1.5 h-1.5 rounded-full ${isCompleted ? 'bg-emerald-500' : canComplete ? 'bg-neutral-900' : 'bg-amber-500'}`} />
                <p className="text-neutral-900 text-[13px]" style={{ fontWeight: 500 }}>
                  {isCompleted ? 'Completada' : canComplete ? 'Lista para enviar' : 'En preparación'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {!isCompleted && (
          <>
            {/* PDF-only notice */}
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
                  {dragActive ? 'Suelte los archivos PDF o CSV aquí' : 'Arrastre archivos PDF o CSV'}
                </p>
                <p className={`text-[12px] ${dragActive ? 'text-white/70' : 'text-neutral-500'}`}>
                  o <span className="underline decoration-neutral-300 underline-offset-4">haga clic para explorar</span> · Máx. 20 MB
                </p>
              </motion.div>
            </div>
          </>
        )}

        {/* Document List */}
        {documentos.length > 0 && (
          <div className="bg-white rounded-2xl border border-neutral-200/70 overflow-hidden mb-6" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
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
                        {doc.category === 'otro' && (
                          <motion.input
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: '10rem', opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            type="text"
                            value={doc.customCategory}
                            onChange={e => updateCustomCategory(doc.id, e.target.value)}
                            placeholder="Especifique…"
                            className={`px-2.5 py-1.5 border rounded-full text-[12px] outline-none transition-all bg-white
                              ${!doc.customCategory.trim() ? 'border-amber-400 focus:ring-2 focus:ring-amber-100' : 'border-neutral-200/80 focus:border-neutral-300'}
                            `}
                          />
                        )}
                      </AnimatePresence>

                      <button title="Reemplazar" className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors">
                        <RefreshCw size={12} strokeWidth={1.75} />
                      </button>
                      <button onClick={() => handleDelete(doc.id)} title="Eliminar"
                        className="w-7 h-7 rounded-full flex items-center justify-center text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                        <Trash2 size={12} strokeWidth={1.75} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 bg-neutral-100 text-neutral-700 text-[11px] rounded-full" style={{ fontWeight: 500 }}>
                        {CATEGORIES.find(c => c.value === doc.category)?.label || doc.customCategory}
                      </span>
                      <button className="inline-flex items-center gap-1 text-[12px] text-neutral-700 hover:text-neutral-900 hover:underline" style={{ fontWeight: 500 }}>
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
              Marcar fase como completada
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
                    <span className={`ml-auto px-2.5 py-1 rounded-full text-[11px] ${d.calidad_documental.resultado_consolidado === 'Alta' ? 'bg-emerald-50 text-emerald-700' :
                        d.calidad_documental.resultado_consolidado === 'Media' ? 'bg-amber-50 text-amber-700' :
                          'bg-rose-50 text-rose-700'
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
                        <Sparkles size={14} className="text-violet-500 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
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
                        <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
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
                        <ShieldAlert size={14} className={`flex-shrink-0 mt-0.5 ${brecha.impacto === 'Alto' ? 'text-rose-500' :
                            brecha.impacto === 'Medio' ? 'text-amber-500' : 'text-neutral-400'
                          }`} strokeWidth={1.75} />
                        <div className="flex-1 min-w-0">
                          <p className="text-neutral-800 text-[13px]" style={{ fontWeight: 500 }}>{brecha.dimension_o_area}</p>
                          <p className="text-neutral-500 text-[12px] mt-0.5 leading-relaxed">{brecha.descripcion}</p>
                        </div>
                        <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] ${brecha.impacto === 'Alto' ? 'bg-rose-50 text-rose-600' :
                            brecha.impacto === 'Medio' ? 'bg-amber-50 text-amber-600' :
                              'bg-neutral-100 text-neutral-500'
                          }`} style={{ fontWeight: 500 }}>{brecha.impacto}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recomendaciones */}
              {d.recommendations && d.recommendations.length > 0 && (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-6">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-indigo-500 mb-4" style={{ fontWeight: 500 }}>Recomendaciones</p>
                  <ul className="space-y-3">
                    {d.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-3 text-neutral-700 text-[13px] leading-relaxed">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Documentos faltantes & Limitaciones */}
              <div className="grid grid-cols-2 gap-5">
                {d.missing_documents && d.missing_documents.length > 0 && (
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle size={14} className="text-amber-600" strokeWidth={1.75} />
                      <p className="text-[11px] uppercase tracking-[0.14em] text-amber-700" style={{ fontWeight: 500 }}>Doc. Faltantes</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {d.missing_documents.map((doc, i) => (
                        <span key={i} className="px-2.5 py-1 bg-white border border-amber-200 text-amber-700 text-[12px] rounded-full" style={{ fontWeight: 500 }}>{doc}</span>
                      ))}
                    </div>
                  </div>
                )}

                {d.limitaciones && d.limitaciones.length > 0 && (
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-100/50 p-5">
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
              </div>
            </motion.div>
          );
        })()}
      </div>



      <NextPhaseButton projectId={projectId!} nextPhase={2} show={isCompleted} />
    </div>
  );
}