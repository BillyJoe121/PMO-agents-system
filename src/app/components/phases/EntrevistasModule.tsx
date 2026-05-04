import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Pencil, Trash2, X, Save, Loader2, AlertTriangle, Send,
  User, Briefcase, FileText, CheckCircle2, MessageSquare, Sparkles, ChevronDown,
  Calendar, Clock, MousePointerClick, Upload, Paperclip, FileUp, Download
} from 'lucide-react';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { useApp } from '../../context/AppContext';
import { useEntrevistas, type EntrevistaLocal as Entrevista, type EntrevistasDiagnosis } from '../../hooks/useEntrevistas';
import { useSoundManager } from '../../hooks/useSoundManager';
import { supabase } from '../../lib/supabase';
import PhaseHeader from './_shared/PhaseHeader';
import NextPhaseButton from './_shared/NextPhaseButton';

// Using Entrevista from hook now

// ---------------------------------------------------------------------------
// Panel mode type
// ---------------------------------------------------------------------------
type PanelMode = 'empty' | 'detail' | 'edit' | 'new';

// ---------------------------------------------------------------------------
// Confirm Modal
// ---------------------------------------------------------------------------
interface ConfirmModalProps {
  open: boolean;
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

function ConfirmModal({ open, count, onCancel, onConfirm, isLoading }: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onCancel} className="absolute inset-0 bg-neutral-900/30 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative bg-white rounded-2xl w-full max-w-md z-10 p-6 border border-neutral-200/70" style={{ boxShadow: '0 24px 64px -16px rgba(0,0,0,0.18)' }}>
            <div className="flex items-start gap-4 mb-6">
              <div>
                <h3 className="text-neutral-900 mb-1.5 tracking-tight" style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>¿Enviar al Agente 2?</h3>
                <p className="text-neutral-500 text-[13px] leading-relaxed">
                  Se enviarán <span className="text-neutral-900" style={{ fontWeight: 500 }}>{count} entrevistas</span> al Agente 2 para análisis consolidado. La edición quedará bloqueada una vez confirmado.
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

// ---------------------------------------------------------------------------
// Empty State Panel
// ---------------------------------------------------------------------------
function EmptyStatePanel() {
  return (
    <motion.div
      key="empty"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col items-center justify-center h-full min-h-[420px] text-center px-8"
    >
      <div className="w-14 h-14 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex items-center justify-center mb-5">
        <MousePointerClick size={20} className="text-neutral-400" strokeWidth={1.5} />
      </div>
      <p className="text-neutral-900 mb-1.5 tracking-tight" style={{ fontWeight: 500, letterSpacing: '-0.005em' }}>Selecciona una entrevista</p>
      <p className="text-neutral-500 text-[13px] leading-relaxed max-w-xs">
        Haz clic en cualquier entrevistado de la lista para ver el contenido completo aquí.
      </p>
      <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-dashed border-neutral-200">
        <Plus size={12} className="text-neutral-400" strokeWidth={1.75} />
        <span className="text-neutral-400 text-[11px]">O crea una nueva con el botón de la izquierda</span>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Detail Panel
// ---------------------------------------------------------------------------
interface DetailPanelProps {
  entrevista: Entrevista;
  onEdit: () => void;
  onDelete: () => void;
}

function DetailPanel({ entrevista, onEdit, onDelete }: DetailPanelProps) {
  return (
    <motion.div
      key={`detail-${entrevista.id}`}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-neutral-900 flex items-center justify-center flex-shrink-0">
            <User size={16} className="text-white" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h2 className="text-neutral-900 tracking-tight truncate" style={{ fontWeight: 500, fontSize: '1.0625rem', letterSpacing: '-0.01em' }}>
              {entrevista.nombre}
            </h2>
            <div className="flex items-center gap-2 mt-1 text-[12px]">
              <span className="flex items-center gap-1.5 text-neutral-500">
                <Briefcase size={11} strokeWidth={1.75} />
                {entrevista.cargo}
              </span>
              {entrevista.area && <><span className="text-neutral-300">·</span><span className="text-neutral-400">{entrevista.area}</span></>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200/80 text-neutral-700 text-[12px] hover:border-neutral-300 hover:bg-neutral-50 transition-all"
            style={{ fontWeight: 500 }}
          >
            <Pencil size={11} strokeWidth={1.75} />
            Editar
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-rose-100 text-rose-600 text-[12px] hover:bg-rose-50 hover:border-rose-200 transition-all"
            style={{ fontWeight: 500 }}
          >
            <Trash2 size={11} strokeWidth={1.75} />
            Eliminar
          </button>
        </div>
      </div>

      {/* Metadata strip */}
      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-neutral-100 text-[11px] text-neutral-400">
        <div className="flex items-center gap-1.5">
          <Calendar size={11} strokeWidth={1.75} />
          <span>Registrada · <span className="text-neutral-700 tabular-nums" style={{ fontWeight: 500 }}>{entrevista.createdAt}</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={11} strokeWidth={1.75} />
          <span className="tabular-nums"><span className="text-neutral-700" style={{ fontWeight: 500 }}>{entrevista.notas.length}</span> caracteres</span>
        </div>
      </div>

      {entrevista.fileName && (
        <div className="mb-6">
          <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400 mb-2.5" style={{ fontWeight: 500 }}>Archivo adjunto</p>
          <button
            onClick={async () => {
              try {
                let url = entrevista.storagePath || '';
                if (url && url.includes('token=')) {
                  const match = url.match(/documentos-pmo\/(.+?)(?:\?token=|$)/);
                  if (match && match[1]) {
                    const rawPath = decodeURIComponent(match[1]);
                    const { data } = await supabase.storage.from('documentos-pmo').createSignedUrl(rawPath, 3600);
                    if (data?.signedUrl) url = data.signedUrl;
                  }
                }
                if (url) {
                  window.open(url, '_blank', 'noopener,noreferrer');
                }
              } catch (err) {
                console.error('Error al abrir archivo:', err);
              }
            }}
            className="inline-flex items-center gap-2 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl hover:bg-indigo-50 transition-colors w-full group text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-white border border-indigo-100/50 flex items-center justify-center flex-shrink-0 group-hover:border-indigo-200 transition-colors">
              <FileText size={14} className="text-indigo-500" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-neutral-900 text-[13px] truncate" style={{ fontWeight: 500 }}>{entrevista.fileName}</p>
              <p className="text-indigo-500 text-[11px]">Ver documento original ↗</p>
            </div>
          </button>
        </div>
      )}

      {/* Notes body */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={12} className="text-neutral-400" strokeWidth={1.75} />
          <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400" style={{ fontWeight: 500 }}>
            Notas / Transcripción
          </p>
        </div>
        <div className="bg-neutral-50 rounded-xl border border-neutral-200/70 p-4 min-h-[200px]">
          <p className="text-neutral-700 text-[13px] leading-relaxed whitespace-pre-wrap">
            {entrevista.notas}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Form Panel (New / Edit)
// ---------------------------------------------------------------------------
interface FormPanelProps {
  mode: 'new' | 'edit';
  formData: { nombre: string; cargo: string; area: string; notas: string };
  formErrors: Record<string, string>;
  onChange: (field: string, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

function FormPanel({ mode, formData, formErrors, onChange, onSave, onCancel }: FormPanelProps) {
  const isBanco = formData.cargo === 'No aplica' && formData.area === 'No aplica';
  const title = mode === 'edit' 
    ? (isBanco ? `Editando Banco: ${formData.nombre || 'Documento'}` : `Editando: ${formData.nombre || 'Entrevista'}`) 
    : (isBanco ? 'Nuevo Banco de Entrevistas' : 'Nueva Entrevista');

  // ---- File upload state ----
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: number; parsed: boolean } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isReading, setIsReading] = useState(false);

  const READABLE_TYPES = ['text/csv'];
  const ACCEPTED = '.csv,.pdf';

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const processFile = (file: File) => {
    if (file.name.match(/\.(pdf)$/i)) {
      // Es un PDF, lo adjuntamos para enviarlo al agente directamente
      setAttachedFile({ name: file.name, size: file.size, parsed: false });
      onChange('file', file);
      toast.success('Archivo PDF adjuntado para análisis');
      return;
    }

    if (!READABLE_TYPES.includes(file.type) && !file.name.match(/\.(csv)$/i)) {
      toast.error('Formato no permitido', { description: 'Sube un archivo .pdf o .csv.' });
      return;
    }

    setIsReading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      onChange('notas', text);
      setAttachedFile({ name: file.name, size: file.size, parsed: true });
      setIsReading(false);
      toast.success('Texto extraído correctamente');
    };
    reader.onerror = () => {
      toast.error('Error al leer el archivo');
      setIsReading(false);
    };
    reader.readAsText(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset so same file can be re-selected
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleRemoveFile = () => {
    setAttachedFile(null);
    onChange('file', null);
  };

  return (
    <motion.div
      key={`form-${mode}`}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      className="flex flex-col h-full"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, letterSpacing: '-0.005em' }}>{title}</h3>
        <button
          onClick={onCancel}
          className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex flex-col gap-4 flex-1">
        {/* Nombre */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] uppercase tracking-[0.14em] text-neutral-500 flex items-center gap-1.5" style={{ fontWeight: 500 }}>
            {isBanco ? <FileUp size={11} strokeWidth={1.75} /> : <User size={11} strokeWidth={1.75} />} 
            {isBanco ? 'Nombre del documento o lote' : 'Nombre del entrevistado'}
          </label>
          <input
            type="text"
            value={formData.nombre}
            onChange={e => onChange('nombre', e.target.value)}
            placeholder={isBanco ? 'Ej: Transcripciones Grupo Operaciones' : 'Ej: Juan Carlos Restrepo'}
            className={`w-full px-3.5 py-2.5 border rounded-xl text-[13px] outline-none transition-all bg-white placeholder:text-neutral-400
              ${formErrors.nombre ? 'border-rose-400 focus:ring-4 focus:ring-rose-100' : 'border-neutral-200/80 focus:border-neutral-300 focus:ring-4 focus:ring-neutral-100'}
            `}
          />
          {formErrors.nombre && <p className="text-rose-500 text-[11px]">{formErrors.nombre}</p>}
        </div>

        {/* Cargo + Área */}
        {!isBanco && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-[0.14em] text-neutral-500 flex items-center gap-1.5" style={{ fontWeight: 500 }}>
                <Briefcase size={11} strokeWidth={1.75} /> Cargo / Rol
              </label>
              <input
                type="text"
                value={formData.cargo}
                onChange={e => onChange('cargo', e.target.value)}
                placeholder="Ej: Gerente de Operaciones"
                className={`w-full px-3.5 py-2.5 border rounded-xl text-[13px] outline-none transition-all bg-white placeholder:text-neutral-400
                  ${formErrors.cargo ? 'border-rose-400 focus:ring-4 focus:ring-rose-100' : 'border-neutral-200/80 focus:border-neutral-300 focus:ring-4 focus:ring-neutral-100'}
                `}
              />
              {formErrors.cargo && <p className="text-rose-500 text-[11px]">{formErrors.cargo}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-[0.14em] text-neutral-500" style={{ fontWeight: 500 }}>Área / Departamento</label>
              <input
                type="text"
                value={formData.area}
                onChange={e => onChange('area', e.target.value)}
                placeholder="Ej: TI, Finanzas…"
                className="w-full px-3.5 py-2.5 border border-neutral-200/80 rounded-xl text-[13px] outline-none transition-all bg-white focus:border-neutral-300 focus:ring-4 focus:ring-neutral-100 placeholder:text-neutral-400"
              />
            </div>
          </div>
        )}

        {/* Notes + Upload */}
        <div className="flex flex-col gap-1.5 flex-1">
          {/* Label row */}
          <div className="flex items-center justify-between">
            <label className="text-[11px] uppercase tracking-[0.14em] text-neutral-500 flex items-center gap-1.5" style={{ fontWeight: 500 }}>
              <FileText size={11} strokeWidth={1.75} /> Notas / Transcripción
            </label>
            {/* Upload button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-neutral-300 text-neutral-600 hover:border-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 transition-all text-[11px]"
              style={{ fontWeight: 500 }}
            >
              <FileUp size={11} strokeWidth={1.75} />
              Cargar transcripción
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={handleFileInput}
            />
          </div>

          {/* Attached file badge */}
          <AnimatePresence>
            {attachedFile && (
              <motion.div
                initial={{ opacity: 0, y: -4, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                className="overflow-hidden"
              >
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${attachedFile.parsed
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
                  }`}>
                  <Paperclip size={11} className="flex-shrink-0" />
                  <span className="flex-1 truncate" style={{ fontWeight: 500 }}>{attachedFile.name}</span>
                  <span className="opacity-60 flex-shrink-0">{formatSize(attachedFile.size)}</span>
                  {attachedFile.parsed ? (
                    <span className="flex-shrink-0 opacity-70">· Texto extraído con éxito</span>
                  ) : (
                    <span className="flex-shrink-0 opacity-70 text-indigo-600">· PDF Adjunto para Agente</span>
                  )}
                  <button
                    onClick={handleRemoveFile}
                    className="flex-shrink-0 w-4 h-4 rounded flex items-center justify-center hover:opacity-70 transition-opacity"
                  >
                    <X size={10} />
                  </button>
                </div>
                {!attachedFile.parsed && (
                  <p className="text-indigo-600 text-[11px] mt-1.5 pl-1 leading-relaxed">
                    El agente 1 analizará este PDF automáticamente junto con las notas adicionales que escribas.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dropzone + Textarea */}
          <div
            className={`relative flex-1 rounded-xl border transition-all ${isDragging
              ? 'border-neutral-400 bg-neutral-50'
              : formErrors.notas
                ? 'border-rose-400'
                : 'border-neutral-200/80'
              }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {/* Drag overlay */}
            <AnimatePresence>
              {isDragging && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-10 rounded-xl flex flex-col items-center justify-center gap-2 bg-zinc-50/95 pointer-events-none"
                >
                  <Upload size={22} className="text-zinc-500" />
                  <p className="text-zinc-600 text-sm" style={{ fontWeight: 600 }}>Suelta el archivo aquí</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Loading overlay */}
            <AnimatePresence>
              {isReading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-10 rounded-xl flex flex-col items-center justify-center gap-2 bg-white/90"
                >
                  <Loader2 size={20} className="text-zinc-500 animate-spin" />
                  <p className="text-zinc-500 text-xs">Leyendo archivo…</p>
                </motion.div>
              )}
            </AnimatePresence>

            <textarea
              value={formData.notas}
              onChange={e => onChange('notas', e.target.value)}
              placeholder="Escriba o pegue aquí la transcripción, o arrastre un archivo .csv sobre este campo…"
              rows={8}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-y bg-white leading-relaxed border-0 focus:ring-0"
            />
          </div>

          {formErrors.notas && <p className="text-red-500 text-xs">{formErrors.notas}</p>}
          <div className="flex items-center justify-between">
            <p className="text-neutral-400 text-xs flex items-center gap-1">
              <Upload size={10} />
              Soporta archivos .pdf o .csv
            </p>
            <p className="text-neutral-400 text-xs">{formData.notas.length} caracteres</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-neutral-200/80 text-neutral-700 text-[13px] hover:bg-neutral-50 transition-colors"
            style={{ fontWeight: 500 }}
          >
            <X size={13} /> Cancelar
          </button>
          <motion.button
            whileHover={{ y: -1 }} whileTap={{ y: 0 }}
            onClick={onSave}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-full text-white text-[13px] transition-all"
            style={{ background: '#0a0a0a', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}
          >
            <Save size={13} />
            {mode === 'edit' ? 'Actualizar entrevista' : 'Guardar entrevista'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Mock agent diagnosis (used in completed view)
// ---------------------------------------------------------------------------
const MOCK_AGENT_DIAGNOSIS = {
  hallazgos: [
    'Existe una percepción generalizada de falta de estandarización en la gestión de proyectos.',
    'La comunicación entre áreas estratégicas y operativas presenta brechas significativas.',
    'El 80% de los entrevistados reporta duplicidad de esfuerzos en proyectos interdepartamentales.',
    'Hay disposición alta hacia la implementación de una PMO formal según los directivos.',
  ],
  temas: ['Gobernanza', 'Comunicación', 'Estandarización', 'Cultura organizacional', 'Recursos'],
  analisis: 'Basado en el análisis de las entrevistas, la organización presenta madurez organizacional en etapa de estandarización (Nivel 2-3 en escala CMMI). Los hallazgos indican una necesidad urgente de establecer un marco de gobernanza de proyectos con roles claros y métricas compartidas.',
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function EntrevistasModule() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updatePhaseStatus } = useApp();
  const { playAgentSuccess, playProcessError, playPhaseComplete } = useSoundManager();

  const project = getProject(projectId!);
  const phase = project?.phases.find(p => p.number === 2);
  const isCompleted = phase?.status === 'completado';

  // ---- Real hook state ----
  const {
    entrevistas,
    setEntrevistas,
    isLoadingData,
    isProcessing,
    diagnosis,
    fetchInitialData,
    saveEntrevista,
    deleteEntrevista,
    processPhase,
  } = useEntrevistas(projectId!);

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

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

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
        updatePhaseStatus(projectId!, 2, 'completado', 'Análisis consolidado de entrevistas completado.');
        playPhaseComplete();
        toast.success('¡Fase 2 completada!', { description: 'El Agente ha finalizado el análisis de entrevistas.' });
        await fetchInitialData();
      }
    } catch {
      updatePhaseStatus(projectId!, 2, 'disponible');
      playProcessError();
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

  // Derive currently selected interview object
  const selectedEntrevista = entrevistas.find(e => e.id === selectedId) ?? null;

  return (
    <div className="min-h-screen bg-[#fafaf9]">
      <PhaseHeader
        projectId={projectId!}
        companyName={project.companyName}
        phaseNumber={2}
        phaseName="Registro de Entrevistas"
        eyebrow={isCompleted ? 'Completada' : `${entrevistas.length} entrevistas`}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Processing overlay */}
      {/* ------------------------------------------------------------------ */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-[#fafaf9]/85 backdrop-blur-md flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full border border-neutral-200 bg-white flex items-center justify-center mb-5" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <Loader2 size={22} className="text-neutral-700 animate-spin" strokeWidth={1.75} />
            </div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 mb-2" style={{ fontWeight: 500 }}>Procesando</p>
            <h2 className="text-neutral-900 tracking-tight" style={{ fontWeight: 500, fontSize: '1.25rem', letterSpacing: '-0.01em' }}>
              Consolidando entrevistas
            </h2>
            <p className="text-neutral-500 text-[13px] mt-2">El Agente está analizando los registros…</p>
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
        {isCompleted ? (
          /* ======================================================= */
          /* COMPLETED VIEW                                           */
          /* ======================================================= */
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex flex-col gap-5">

              {/* Agent diagnosis */}
              {diagnosis && (
                <div className="flex flex-col gap-5">

                  {/* Top Summary Card */}
                  <div className="rounded-2xl border border-neutral-200/70 bg-white p-6" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                    <div className="flex items-center gap-2.5 mb-5">
                      <div className="w-7 h-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
                        <Sparkles size={13} strokeWidth={1.75} />
                      </div>
                      <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-500" style={{ fontWeight: 500 }}>Diagnóstico — Agente 1 · Entrevistas</span>
                    </div>

                    <p className="text-neutral-700 text-[14px] leading-relaxed mb-6">
                      {diagnosis.summary || 'El Agente 1 ha consolidado los hallazgos de las entrevistas.'}
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      {diagnosis.numero_entrevistados !== undefined && (
                        <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-100 flex flex-col justify-center">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400 mb-1" style={{ fontWeight: 500 }}>Entrevistados Analizados</p>
                          <p className="text-neutral-900 text-xl" style={{ fontWeight: 500 }}>{typeof diagnosis.numero_entrevistados === 'number' ? Number(diagnosis.numero_entrevistados.toFixed(1)) : diagnosis.numero_entrevistados}</p>
                        </div>
                      )}
                      {diagnosis.advertencia_fuente_unica && (
                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex flex-col justify-center">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-amber-600 mb-1" style={{ fontWeight: 500 }}>Advertencia</p>
                          <p className="text-amber-800 text-[12px] leading-relaxed">Fuente única detectada. Perspectiva limitada de la organización.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Recurring Themes */}
                  {diagnosis.recurring_themes && diagnosis.recurring_themes.length > 0 && (
                    <div className="rounded-2xl border border-neutral-200/70 bg-white p-6" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400 mb-4" style={{ fontWeight: 500 }}>Temas Recurrentes</p>
                      <div className="space-y-4">
                        {diagnosis.recurring_themes.map((theme, i) => (
                          <div key={i} className="border-b border-neutral-100 pb-3 last:border-0 last:pb-0">
                            <p className="text-neutral-900 text-[13px] mb-1" style={{ fontWeight: 500 }}>{theme.theme}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 text-[10px]" style={{ fontWeight: 500 }}>{theme.frequency}</span>
                              <span className="text-neutral-400 text-[11px] truncate">Por: {theme.mentioned_by.join(', ')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key Findings */}
                  {diagnosis.key_findings && diagnosis.key_findings.length > 0 && (
                    <div className="rounded-2xl border border-neutral-200/70 bg-white p-6" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-400 mb-4" style={{ fontWeight: 500 }}>Hallazgos Clave</p>
                      <ul className="space-y-3">
                        {diagnosis.key_findings.map((finding, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-neutral-700 text-[13px] leading-relaxed">
                            <span className="w-1.5 h-1.5 rounded-full mt-2 bg-neutral-900 flex-shrink-0" />
                            {finding}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Critical Voices */}
                  {diagnosis.critical_voices && diagnosis.critical_voices.length > 0 && (
                    <div className="rounded-2xl border border-neutral-200/70 bg-neutral-50/50 p-6">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500 mb-4" style={{ fontWeight: 500 }}>Voces Críticas</p>
                      <div className="space-y-4">
                        {diagnosis.critical_voices.map((voice, i) => (
                          <div key={i} className="p-5 bg-white rounded-xl border border-neutral-200/70">
                            <p className="text-neutral-900 text-[13px] mb-1.5" style={{ fontWeight: 600 }}>{voice.interviewee_name}</p>
                            <p className="text-neutral-700 text-[13px] leading-relaxed mb-3">"{voice.key_insight}"</p>
                            <span className="inline-block px-2.5 py-1 bg-neutral-50 border border-neutral-100 text-neutral-500 rounded-md text-[10px]" style={{ fontWeight: 500 }}>Relevancia: {voice.relevance}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recomendaciones */}
                  {diagnosis.recommendations && diagnosis.recommendations.length > 0 && (
                    <div className="rounded-2xl border border-neutral-200/70 bg-neutral-50 p-6">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500 mb-4" style={{ fontWeight: 500 }}>Recomendaciones</p>
                      <ul className="space-y-3">
                        {diagnosis.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-3 text-neutral-700 text-[13px] leading-relaxed">
                            <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 mt-2 flex-shrink-0" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                </div>
              )}

              {/* Read-only accordion list */}
              <div className="bg-white rounded-2xl border border-neutral-200/70 p-6" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-neutral-900 text-[13px]" style={{ fontWeight: 500 }}>Entrevistas registradas</h3>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleDownloadZip}
                      disabled={isDownloadingZip}
                      className="flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-neutral-900 transition-colors disabled:opacity-50"
                      style={{ fontWeight: 500 }}
                    >
                      {isDownloadingZip ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                      Descargar todo
                    </button>
                    <span className="text-[11px] text-neutral-400 tabular-nums">{entrevistas.length}</span>
                  </div>
                </div>
                <div className="space-y-2">
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
      {!isCompleted && !isProcessing && (
        <div className="max-w-[1100px] mx-auto px-10 pb-12">
          <div className="flex justify-end pt-8 border-t border-neutral-200/60">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ y: 0 }}
              onClick={handleMarkComplete}
              disabled={entrevistas.length === 0}
              className="px-6 py-3 rounded-full text-white text-[13px] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{ background: '#0a0a0a', fontWeight: 500, boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)' }}
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