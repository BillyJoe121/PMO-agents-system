import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Plus, Pencil, Trash2, X, Save, Loader2, AlertTriangle, Send,
  User, Briefcase, FileText, CheckCircle2, MessageSquare, Brain, ChevronDown,
  Calendar, Clock, MousePointerClick, Upload, Paperclip, FileUp
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';

interface Entrevista {
  id: string;
  nombre: string;
  cargo: string;
  area: string;
  notas: string;
  createdAt: string;
}

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
            onClick={onCancel} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <div>
                <h3 className="text-gray-900 mb-1" style={{ fontWeight: 600 }}>Enviar al Agente 1</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Se enviarán <strong>{count} entrevistas</strong> al Agente 1 para análisis consolidado.
                  La edición quedará <strong>bloqueada</strong> una vez confirmado.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={onCancel} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 text-sm hover:bg-gray-50 transition-colors" style={{ fontWeight: 500 }}>
                Cancelar
              </button>
              <button onClick={onConfirm} disabled={isLoading}
                className="flex-1 py-2.5 rounded-xl text-white text-sm flex items-center justify-center gap-2 disabled:opacity-70"
                style={{ background: '#030213', fontWeight: 600 }}>
                {isLoading ? <><Loader2 size={14} className="animate-spin" /> Enviando...</> : <><Send size={14} /> Confirmar</>}
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
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-5">
        <MousePointerClick size={28} className="text-gray-400" />
      </div>
      <p className="text-gray-700 mb-1" style={{ fontWeight: 600 }}>Selecciona una entrevista</p>
      <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
        Haz clic en cualquier entrevistado de la lista para ver el contenido completo aquí.
      </p>
      <div className="mt-6 flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 border border-dashed border-gray-200">
        <Plus size={14} className="text-gray-400" />
        <span className="text-gray-400 text-xs">O crea una nueva con el botón de la izquierda</span>
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
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center flex-shrink-0">
            <User size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-gray-900" style={{ fontWeight: 700, fontSize: '1.1rem' }}>
              {entrevista.nombre}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1.5 text-gray-500 text-sm">
                <Briefcase size={12} />
                {entrevista.cargo}
              </span>
              {entrevista.area && (
                <span className="text-gray-300">·</span>
              )}
              {entrevista.area && (
                <span className="text-gray-400 text-sm">{entrevista.area}</span>
              )}
            </div>
          </div>
        </div>
        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 hover:border-gray-300 transition-all"
            style={{ fontWeight: 500 }}
          >
            <Pencil size={13} />
            Editar
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-100 text-red-500 text-sm hover:bg-red-50 hover:border-red-200 transition-all"
            style={{ fontWeight: 500 }}
          >
            <Trash2 size={13} />
            Eliminar
          </button>
        </div>
      </div>

      {/* Metadata strip */}
      <div className="flex items-center gap-4 mb-5 pb-5 border-b border-gray-100">
        <div className="flex items-center gap-1.5 text-gray-400 text-xs">
          <Calendar size={12} />
          <span>Registrada: <strong className="text-gray-600">{entrevista.createdAt}</strong></span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-400 text-xs">
          <Clock size={12} />
          <span><strong className="text-gray-600">{entrevista.notas.length}</strong> caracteres</span>
        </div>
      </div>

      {/* Notes body */}
      <div className="flex-1">
        <div className="flex items-center gap-1.5 mb-3">
          <FileText size={14} className="text-gray-400" />
          <p className="text-gray-500 text-xs uppercase tracking-wider" style={{ fontWeight: 700 }}>
            Notas / Transcripción
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 min-h-[200px]">
          <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
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
  const title = mode === 'edit' ? `Editando: ${formData.nombre || 'Entrevista'}` : 'Nueva Entrevista';

  // ---- File upload state ----
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: number; parsed: boolean } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isReading, setIsReading] = useState(false);

  const READABLE_TYPES = ['text/plain', 'text/markdown', 'text/x-markdown'];
  const ACCEPTED = '.txt,.md,.pdf,.doc,.docx';

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const processFile = (file: File) => {
    const canRead = READABLE_TYPES.includes(file.type) || file.name.endsWith('.txt') || file.name.endsWith('.md');
    setAttachedFile({ name: file.name, size: file.size, parsed: canRead });

    if (canRead) {
      setIsReading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        onChange('notas', text);
        setIsReading(false);
      };
      reader.onerror = () => setIsReading(false);
      reader.readAsText(file, 'UTF-8');
    }
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
    onChange('notas', '');
  };

  return (
    <motion.div
      key={`form-${mode}`}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      className="flex flex-col h-full"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-gray-800" style={{ fontWeight: 600 }}>{title}</h3>
        <button
          onClick={onCancel}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-col gap-4 flex-1">
        {/* Nombre */}
        <div className="flex flex-col gap-1.5">
          <label className="text-gray-600 text-sm flex items-center gap-1.5" style={{ fontWeight: 500 }}>
            <User size={13} /> Nombre del entrevistado
          </label>
          <input
            type="text"
            value={formData.nombre}
            onChange={e => onChange('nombre', e.target.value)}
            placeholder="Ej: Juan Carlos Restrepo"
            className={`w-full px-3 py-2.5 border rounded-xl text-sm outline-none transition-all bg-white
              ${formErrors.nombre ? 'border-red-400 focus:ring-2 focus:ring-red-100' : 'border-gray-200 focus:border-gray-400 focus:ring-2 focus:ring-gray-100'}
            `}
          />
          {formErrors.nombre && <p className="text-red-500 text-xs">{formErrors.nombre}</p>}
        </div>

        {/* Cargo + Área */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-gray-600 text-sm flex items-center gap-1.5" style={{ fontWeight: 500 }}>
              <Briefcase size={13} /> Cargo / Rol
            </label>
            <input
              type="text"
              value={formData.cargo}
              onChange={e => onChange('cargo', e.target.value)}
              placeholder="Ej: Gerente de Operaciones"
              className={`w-full px-3 py-2.5 border rounded-xl text-sm outline-none transition-all bg-white
                ${formErrors.cargo ? 'border-red-400 focus:ring-2 focus:ring-red-100' : 'border-gray-200 focus:border-gray-400 focus:ring-2 focus:ring-gray-100'}
              `}
            />
            {formErrors.cargo && <p className="text-red-500 text-xs">{formErrors.cargo}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-gray-600 text-sm" style={{ fontWeight: 500 }}>Área / Departamento</label>
            <input
              type="text"
              value={formData.area}
              onChange={e => onChange('area', e.target.value)}
              placeholder="Ej: TI, Finanzas…"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none transition-all bg-white focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
            />
          </div>
        </div>

        {/* Notes + Upload */}
        <div className="flex flex-col gap-1.5 flex-1">
          {/* Label row */}
          <div className="flex items-center justify-between">
            <label className="text-gray-600 text-sm flex items-center gap-1.5" style={{ fontWeight: 500 }}>
              <FileText size={13} /> Notas / Transcripción
            </label>
            {/* Upload button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all text-xs"
              style={{ fontWeight: 500 }}
            >
              <FileUp size={12} />
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
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                  attachedFile.parsed
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}>
                  <Paperclip size={11} className="flex-shrink-0" />
                  <span className="flex-1 truncate" style={{ fontWeight: 500 }}>{attachedFile.name}</span>
                  <span className="opacity-60 flex-shrink-0">{formatSize(attachedFile.size)}</span>
                  {attachedFile.parsed ? (
                    <span className="flex-shrink-0 opacity-70">· Texto extraído</span>
                  ) : (
                    <span className="flex-shrink-0 opacity-70">· Solo referencia</span>
                  )}
                  <button
                    onClick={handleRemoveFile}
                    className="flex-shrink-0 w-4 h-4 rounded flex items-center justify-center hover:opacity-70 transition-opacity"
                  >
                    <X size={10} />
                  </button>
                </div>
                {!attachedFile.parsed && (
                  <p className="text-amber-600 text-xs mt-1 pl-1">
                    Los archivos PDF y Word no se pueden extraer automáticamente. Pegue el texto manualmente o cargue un archivo .txt.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dropzone + Textarea */}
          <div
            className={`relative flex-1 rounded-xl border-2 transition-all ${
              isDragging
                ? 'border-zinc-400 bg-zinc-50'
                : formErrors.notas
                  ? 'border-red-400'
                  : 'border-gray-200'
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
              placeholder="Escriba o pegue aquí la transcripción, o arrastre un archivo .txt sobre este campo…"
              rows={8}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-y bg-white leading-relaxed border-0 focus:ring-0"
            />
          </div>

          {formErrors.notas && <p className="text-red-500 text-xs">{formErrors.notas}</p>}
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-xs flex items-center gap-1">
              <Upload size={10} />
              Soporta .txt · .md · .pdf · .doc · .docx — o arrastra aquí
            </p>
            <p className="text-gray-400 text-xs">{formData.notas.length} caracteres</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
            style={{ fontWeight: 500 }}
          >
            <X size={14} /> Cancelar
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onSave}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm transition-all"
            style={{ background: '#030213', fontWeight: 600 }}
          >
            <Save size={14} />
            {mode === 'edit' ? 'Actualizar Entrevista' : 'Guardar Entrevista'}
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
  // useParams() extrae :id desde la URL dinámica (TODO: usar para queries a Supabase)
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updatePhaseStatus } = useApp();

  const project = getProject(projectId!);
  const phase = project?.phases.find(p => p.number === 2);
  const isCompleted = phase?.status === 'completado';

  // ---- Interviews data ----
  const [entrevistas, setEntrevistas] = useState<Entrevista[]>([
    {
      id: 'e1', nombre: 'Ricardo Montoya', cargo: 'Director de Proyectos', area: 'PMO',
      notas: 'La organización no cuenta con una metodología estándar. Cada equipo trabaja con sus propias herramientas y criterios de éxito independientes.\n\nHay una necesidad urgente de unificación: al menos tres iniciativas en curso están duplicando esfuerzos en definición de requerimientos.\n\nEl entrevistado considera que una PMO centralizada podría reducir el tiempo de entrega en un 30%.',
      createdAt: '10/03/2024',
    },
    {
      id: 'e2', nombre: 'Claudia Herrera', cargo: 'Gerente de TI', area: 'Tecnología',
      notas: 'Los proyectos tecnológicos carecen de seguimiento formal. Las fechas de entrega raramente se cumplen por falta de visibilidad del portafolio.\n\nSe identificaron al menos 5 proyectos con scope creep no documentado. La ausencia de un PMO impacta directamente la calidad del software entregado.\n\nSugiere comenzar con un piloto de gestión de proyectos en el área de infraestructura.',
      createdAt: '11/03/2024',
    },
  ]);

  // ---- Master-Detail state ----
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>('empty');

  // ---- Form state ----
  const EMPTY_FORM = { nombre: '', cargo: '', area: '', notas: '' };
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ---- Send & processing state ----
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // ---- Completed view accordion ----
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // TODO: fetch('public.iteraciones_agente').filter('fase_numero', 2)

  // ---- Handlers ----
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

  const handleEdit = () => {
    const entrevista = entrevistas.find(e => e.id === selectedId);
    if (!entrevista) return;
    setFormData({ nombre: entrevista.nombre, cargo: entrevista.cargo, area: entrevista.area, notas: entrevista.notas });
    setFormErrors({});
    setPanelMode('edit');
  };

  const handleDelete = (id: string) => {
    setEntrevistas(prev => prev.filter(e => e.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
      setPanelMode('empty');
    }
    toast.success('Entrevista eliminada');
  };

  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFormErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!formData.nombre.trim()) errs.nombre = 'El nombre es requerido.';
    if (!formData.cargo.trim()) errs.cargo = 'El cargo es requerido.';
    if (!formData.notas.trim()) errs.notas = 'Las notas de la entrevista son requeridas.';
    return errs;
  };

  const handleSave = () => {
    const errs = validateForm();
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }

    if (panelMode === 'edit' && selectedId) {
      setEntrevistas(prev =>
        prev.map(e => e.id === selectedId ? { ...e, ...formData } : e)
      );
      toast.success('Entrevista actualizada');
      setPanelMode('detail'); // return to detail view
    } else {
      const newE: Entrevista = {
        id: `e${Date.now()}`,
        ...formData,
        createdAt: new Date().toLocaleDateString('es-CO'),
      };
      setEntrevistas(prev => [...prev, newE]);
      setSelectedId(newE.id);
      setPanelMode('detail'); // show new entry as selected detail
      toast.success('Entrevista guardada');
    }
    setFormErrors({});
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
    // TODO: axios.post(N8N_WEBHOOK_AGENTE_1, { proyecto_id, entrevistas: arrayData })
    // TODO: Supabase Realtime para detectar cuando output_json de Fase 2 esté listo
    await new Promise(r => setTimeout(r, 600));
    setIsSending(false);
    setShowConfirm(false);
    setIsProcessing(true);
    updatePhaseStatus(projectId!, 2, 'procesando');

    setTimeout(() => {
      setIsProcessing(false);
      updatePhaseStatus(projectId!, 2, 'completado', 'Análisis consolidado de entrevistas completado. Temas recurrentes identificados: falta de estandarización, comunicación interdepartamental deficiente, y necesidad urgente de gobernanza.');
      toast.success('¡Fase 2 completada!', { description: 'El Agente 1 ha finalizado el análisis de entrevistas.' });
    }, 4500);
  };

  if (!project) return null;

  // Derive currently selected interview object
  const selectedEntrevista = entrevistas.find(e => e.id === selectedId) ?? null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ------------------------------------------------------------------ */}
      {/* Header */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/dashboard/project/${projectId}`)}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm transition-colors group">
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              {project.companyName}
            </button>
            <span className="text-gray-300">/</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs" style={{ background: '#030213', fontWeight: 700 }}>2</div>
              <span className="text-gray-700 text-sm" style={{ fontWeight: 600 }}>Registro de Entrevistas</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-sm">
              <strong style={{ color: '#030213' }}>{entrevistas.length}</strong> entrevistas registradas
            </span>
            {!isCompleted && !isProcessing && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleMarkComplete}
                disabled={entrevistas.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: '#030213', fontWeight: 600 }}
              >
                <Send size={14} />
                Marcar como completo
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Processing overlay */}
      {/* ------------------------------------------------------------------ */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full border-4 border-blue-100 flex items-center justify-center mx-auto mb-5">
                <Loader2 size={36} className="text-blue-600 animate-spin" />
              </div>
              <h2 className="text-gray-900 mb-2" style={{ fontWeight: 700, fontSize: '1.25rem' }}>
                Agente 1 en proceso
              </h2>
              <p className="text-gray-500 text-sm">El Agente 1 está consolidando el análisis de las entrevistas...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------------ */}
      {/* Main content */}
      {/* ------------------------------------------------------------------ */}
      <div className="max-w-6xl mx-auto px-8 py-8">
        {isCompleted ? (
          /* ======================================================= */
          /* COMPLETED VIEW                                           */
          /* ======================================================= */
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center gap-2 mb-6">
              <CheckCircle2 size={18} className="text-green-500" />
              <h1 className="text-gray-900" style={{ fontWeight: 700, fontSize: '1.5rem' }}>Entrevistas Analizadas</h1>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Read-only accordion list */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="text-gray-800 mb-4" style={{ fontWeight: 600 }}>Entrevistas Registradas ({entrevistas.length})</h3>
                <div className="space-y-3">
                  {entrevistas.map(e => (
                    <div key={e.id}>
                      <button
                        onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3 text-left">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <User size={14} className="text-blue-600" />
                          </div>
                          <div>
                            <p className="text-gray-700 text-sm" style={{ fontWeight: 500 }}>{e.nombre}</p>
                            <p className="text-gray-400 text-xs">{e.cargo} · {e.area}</p>
                          </div>
                        </div>
                        <ChevronDown size={14} className={`text-gray-400 transition-transform ${expandedId === e.id ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {expandedId === e.id && (
                          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                            <p className="text-gray-600 text-sm p-3 leading-relaxed bg-gray-50 rounded-b-xl border-t border-gray-100 whitespace-pre-wrap">
                              {e.notas}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>

              {/* Agent diagnosis */}
              <div className="rounded-2xl border-2 shadow-sm p-6" style={{ borderColor: '#030213', background: 'linear-gradient(135deg, #f5f5f7 0%, #ffffff 100%)' }}>
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{ background: '#030213' }}>
                    <Brain size={14} />
                  </div>
                  <span className="text-sm" style={{ fontWeight: 700, color: '#030213' }}>Diagnóstico — Agente 1</span>
                </div>

                <div className="mb-4">
                  <p className="text-gray-700 text-xs uppercase tracking-wider mb-2" style={{ fontWeight: 700 }}>Temas Recurrentes</p>
                  <div className="flex flex-wrap gap-2">
                    {MOCK_AGENT_DIAGNOSIS.temas.map((t, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-full text-xs" style={{ background: '#e9ebef', color: '#030213', fontWeight: 500 }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-gray-700 text-xs uppercase tracking-wider mb-2" style={{ fontWeight: 700 }}>Hallazgos Principales</p>
                  <ul className="space-y-2">
                    {MOCK_AGENT_DIAGNOSIS.hallazgos.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-600 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#030213' }} />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-white rounded-xl border border-gray-200">
                  <p className="text-gray-700 text-xs uppercase tracking-wider mb-2" style={{ fontWeight: 700 }}>Análisis Estratégico</p>
                  <p className="text-gray-600 text-sm leading-relaxed">{MOCK_AGENT_DIAGNOSIS.analisis}</p>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          /* ======================================================= */
          /* ACTIVE VIEW — Master-Detail                              */
          /* ======================================================= */
          <div className="grid grid-cols-5 gap-6">
            {/* ---- LEFT: Interview list ---- */}
            <div className="col-span-2 flex flex-col">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleNewInterview}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm mb-4 transition-all hover:bg-zinc-50 hover:border-zinc-400"
                style={{ borderColor: '#030213', color: '#030213', fontWeight: 600 }}
              >
                <Plus size={16} />
                Agregar Nueva Entrevista
              </motion.button>

              {/* List */}
              <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {entrevistas.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <MessageSquare size={28} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No hay entrevistas aún</p>
                  </div>
                )}
                {entrevistas.map(e => {
                  const isSelected = selectedId === e.id;
                  return (
                    <motion.div
                      key={e.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={() => handleSelectInterview(e)}
                      className={`bg-white rounded-xl border p-4 cursor-pointer transition-all shadow-sm
                        ${isSelected
                          ? 'border-zinc-800 ring-2 ring-zinc-100 shadow-md'
                          : 'border-gray-100 hover:border-gray-300 hover:shadow-md'
                        }
                      `}
                    >
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-zinc-900' : 'bg-gray-100'}`}>
                            <User size={14} className={isSelected ? 'text-white' : 'text-gray-500'} />
                          </div>
                          <div>
                            <p className="text-gray-800 text-sm" style={{ fontWeight: isSelected ? 700 : 600 }}>
                              {e.nombre}
                            </p>
                            <p className="text-gray-500 text-xs flex items-center gap-1 mt-0.5">
                              <Briefcase size={10} /> {e.cargo}
                            </p>
                          </div>
                        </div>
                        {/* Quick delete — stops propagation */}
                        <button
                          onClick={(ev) => { ev.stopPropagation(); handleDelete(e.id); }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {/* Notes preview */}
                      <p className="text-gray-400 text-xs line-clamp-2 leading-relaxed pl-10">
                        {e.notas}
                      </p>

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-2 pl-10">
                        <p className="text-gray-300 text-xs">{e.createdAt}</p>
                        {isSelected && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#030213', color: '#fff', fontWeight: 600 }}>
                            Seleccionado
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
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sticky top-24 min-h-[480px] flex flex-col">
                <AnimatePresence mode="wait">
                  {panelMode === 'empty' && (
                    <EmptyStatePanel key="empty" />
                  )}

                  {panelMode === 'detail' && selectedEntrevista && (
                    <DetailPanel
                      key={`detail-${selectedEntrevista.id}`}
                      entrevista={selectedEntrevista}
                      onEdit={handleEdit}
                      onDelete={() => handleDelete(selectedEntrevista.id)}
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
      {/* Confirm Modal */}
      {/* ------------------------------------------------------------------ */}
      <ConfirmModal
        open={showConfirm}
        count={entrevistas.length}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleConfirmSend}
        isLoading={isSending}
      />
    </div>
  );
}