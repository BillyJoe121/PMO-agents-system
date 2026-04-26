import { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Upload, X, FileText, FileSpreadsheet, Presentation, Image,
  Trash2, RefreshCw, ChevronDown, Send, Loader2, AlertTriangle,
  CheckCircle2, FolderOpen, Brain, BarChart2, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';

type DocCategory = 'acta_constitucion' | 'plan_proyecto' | 'organigrama' | 'politica_interna' | 'otro';

interface Documento {
  id: string;
  name: string;
  size: number;
  type: string;
  category: DocCategory;
  customCategory: string;
  file?: File;
}

const CATEGORIES: { value: DocCategory; label: string }[] = [
  { value: 'acta_constitucion', label: 'Acta de constitución' },
  { value: 'plan_proyecto', label: 'Plan de proyecto' },
  { value: 'organigrama', label: 'Organigrama' },
  { value: 'politica_interna', label: 'Política interna' },
  { value: 'otro', label: 'Otro' },
];

const MOCK_AGENT_DIAGNOSIS = {
  completitud: 82,
  documentosEvaluados: 5,
  hallazgos: [
    'Actas de constitución presentan información incompleta en secciones de alcance y riesgos.',
    'El organigrama no refleja la estructura actual post-reorganización de 2023.',
    'Políticas internas están desactualizadas (última revisión: 2021).',
    'El plan de proyecto tiene un nivel de detalle adecuado para la fase de diagnóstico.',
  ],
  puntajes: [
    { categoria: 'Completitud documental', puntaje: 82 },
    { categoria: 'Actualización', puntaje: 65 },
    { categoria: 'Calidad del contenido', puntaje: 78 },
    { categoria: 'Alineación estratégica', puntaje: 71 },
  ],
};

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['xlsx', 'xls', 'csv'].includes(ext || '')) return <FileSpreadsheet size={18} className="text-green-600" />;
  if (['pptx', 'ppt'].includes(ext || '')) return <Presentation size={18} className="text-orange-600" />;
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) return <Image size={18} className="text-purple-600" />;
  return <FileText size={18} className="text-red-600" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
                <h3 className="text-gray-900 mb-1" style={{ fontWeight: 600 }}>Enviar al Agente 3</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Se enviarán <strong>{count} documentos</strong> al Agente 3 para análisis de completitud.
                  Los archivos quedarán en <strong>modo lectura</strong>.
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

const MOCK_DOCS: Documento[] = [
  { id: 'd1', name: 'Acta_Constitucion_PMO_2024.pdf', size: 2457600, type: 'application/pdf', category: 'acta_constitucion', customCategory: '' },
  { id: 'd2', name: 'Plan_Proyecto_Q1.xlsx', size: 856320, type: 'application/xlsx', category: 'plan_proyecto', customCategory: '' },
  { id: 'd3', name: 'Organigrama_Corp_2023.png', size: 358400, type: 'image/png', category: 'organigrama', customCategory: '' },
];

export default function DocumentacionModule() {
  // useParams() extrae :id desde la URL dinámica (TODO: usar para queries a Supabase)
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updatePhaseStatus } = useApp();

  const project = getProject(projectId!);
  const phase = project?.phases.find(p => p.number === 3);

  const isCompleted = phase?.status === 'completado';

  const [documentos, setDocumentos] = useState<Documento[]>(MOCK_DOCS);
  const [dragActive, setDragActive] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // TODO: Integrar supabase.storage.from('pmo_docs').upload()
  // TODO: Enviar URLs firmadas (signedUrls) al webhook del Agente 3 en n8n
  // RF-F3-02: Manejar el estado local para el input condicional 'Otro'

  const canComplete = documentos.length > 0 && documentos.every(d =>
    d.category !== 'otro' || d.customCategory.trim() !== ''
  );

  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const maxSize = 20 * 1024 * 1024;
    const allowed = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'jpg', 'jpeg', 'png'];

    fileArray.forEach(file => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!allowed.includes(ext)) { toast.error(`Formato no soportado: .${ext}`); return; }
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
    // RF-F3-05: Validar listArchivos.length > 0
    if (!canComplete) {
      toast.error('Complete todos los campos de categoría antes de continuar.');
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setIsSending(true);
    await new Promise(r => setTimeout(r, 700));
    setIsSending(false);
    setShowConfirm(false);
    setIsProcessing(true);
    updatePhaseStatus(projectId!, 3, 'procesando');

    setTimeout(() => {
      setIsProcessing(false);
      updatePhaseStatus(projectId!, 3, 'completado', `Documentación evaluada: ${documentos.length} artefactos. Completitud del ${MOCK_AGENT_DIAGNOSIS.completitud}%. Brechas identificadas en actas de constitución y políticas internas.`);
      toast.success('¡Fase 3 completada!', { description: 'El Agente 3 ha finalizado el análisis documental.' });
    }, 5000);
  };

  if (!project) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/dashboard/project/${projectId}`)}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm transition-colors group">
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              {project.companyName}
            </button>
            <span className="text-gray-300">/</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs" style={{ background: '#030213', fontWeight: 700 }}>3</div>
              <span className="text-gray-700 text-sm" style={{ fontWeight: 600 }}>Gestión Documental</span>
            </div>
          </div>
          {!isCompleted && !isProcessing && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleMarkComplete}
              disabled={!canComplete}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#030213', fontWeight: 600 }}
            >
              <Send size={14} />
              Marcar Fase como Completa
            </motion.button>
          )}
        </div>
      </div>

      {/* Processing overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="text-center">
              <div className="relative w-20 h-20 mx-auto mb-5">
                <div className="w-20 h-20 rounded-full border-4 border-blue-100 flex items-center justify-center">
                  <Loader2 size={36} className="text-blue-600 animate-spin" />
                </div>
                <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 rounded-full border-4 border-blue-200 opacity-30" />
              </div>
              <h2 className="text-gray-900 mb-2" style={{ fontWeight: 700, fontSize: '1.25rem' }}>Procesando documentos</h2>
              <p className="text-gray-500 text-sm">El Agente 3 está analizando la completitud documental...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="mb-6">
          <h1 className="text-gray-900 mb-1" style={{ fontWeight: 700, fontSize: '1.5rem' }}>
            {isCompleted ? 'Documentación Analizada' : 'Fase 3: Gestión Documental'}
          </h1>
          <p className="text-gray-500 text-sm">
            {isCompleted
              ? 'Resultados del análisis documental por el Agente 3.'
              : 'Cargue y categorice los documentos de la PMO para análisis.'}
          </p>
        </div>

        {!isCompleted && (
          <>
            {/* Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all mb-6
                ${dragActive
                  ? 'border-zinc-500 bg-zinc-50'
                  : 'border-gray-300 bg-white hover:border-zinc-400 hover:bg-zinc-50/30'}
              `}
            >
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput}
                accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.jpg,.jpeg,.png" />
              <motion.div animate={dragActive ? { scale: 1.05 } : { scale: 1 }}>
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors ${dragActive ? 'bg-zinc-100' : 'bg-gray-100'}`}>
                  <Upload size={28} className={dragActive ? 'text-zinc-700' : 'text-gray-500'} />
                </div>
                <p className="text-gray-700 mb-1" style={{ fontWeight: 600, fontSize: '1rem' }}>
                  {dragActive ? 'Suelte los archivos aquí' : 'Arrastre documentos aquí o haga clic para explorar'}
                </p>
                <p className="text-gray-400 text-sm">
                  Formatos: PDF, DOCX, XLSX, PPTX, JPEG · Máx. 20 MB por archivo
                </p>
              </motion.div>
            </div>
          </>
        )}

        {/* Document List */}
        {documentos.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
            <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
              <FolderOpen size={15} className="text-gray-500" />
              <span className="text-gray-700 text-sm" style={{ fontWeight: 600 }}>
                Documentos ({documentos.length})
              </span>
            </div>

            <div className="divide-y divide-gray-50">
              {documentos.map(doc => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="px-5 py-4 flex items-center gap-4"
                >
                  {/* File icon */}
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                    {getFileIcon(doc.name)}
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 text-sm truncate" style={{ fontWeight: 500 }}>{doc.name}</p>
                    <p className="text-gray-400 text-xs">{formatSize(doc.size)}</p>
                  </div>

                  {/* Category selector */}
                  {!isCompleted ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="relative">
                        <select
                          value={doc.category}
                          onChange={e => updateCategory(doc.id, e.target.value as DocCategory)}
                          className="appearance-none pl-3 pr-7 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:border-gray-400 transition-all text-gray-600 cursor-pointer bg-white"
                        >
                          {CATEGORIES.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>

                      {/* RF-F3-02: Conditional input for 'Otro' */}
                      <AnimatePresence>
                        {doc.category === 'otro' && (
                          <motion.input
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: '10rem', opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            type="text"
                            value={doc.customCategory}
                            onChange={e => updateCustomCategory(doc.id, e.target.value)}
                            placeholder="Especifique..."
                            className={`px-2.5 py-2 border rounded-lg text-xs outline-none transition-all bg-white
                              ${!doc.customCategory.trim() ? 'border-orange-400 focus:ring-2 focus:ring-orange-100' : 'border-gray-200 focus:border-gray-400'}
                            `}
                          />
                        )}
                      </AnimatePresence>

                      {/* Actions */}
                      <button title="Reemplazar" className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors">
                        <RefreshCw size={13} />
                      </button>
                      <button onClick={() => handleDelete(doc.id)} title="Eliminar"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg" style={{ fontWeight: 500 }}>
                        {CATEGORIES.find(c => c.value === doc.category)?.label || doc.customCategory}
                      </span>
                      <button className="flex items-center gap-1 text-xs text-zinc-600 hover:underline" style={{ fontWeight: 500 }}>
                        <Eye size={12} /> Ver
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {documentos.length === 0 && !isCompleted && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
            <FolderOpen size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No hay documentos cargados. Use la zona de arrastre superior.</p>
          </div>
        )}

        {/* Completed: Agent Diagnosis */}
        {isCompleted && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border-2 shadow-sm p-6" style={{ borderColor: '#030213', background: 'linear-gradient(135deg, #f5f5f7 0%, #ffffff 100%)' }}>
            <div className="flex items-center gap-2 mb-5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{ background: '#030213' }}>
                <Brain size={14} />
              </div>
              <span className="text-sm" style={{ fontWeight: 700, color: '#030213' }}>Diagnóstico — Agente 3</span>
            </div>

            {/* Completeness score */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {MOCK_AGENT_DIAGNOSIS.puntajes.map((p, i) => (
                <div key={i} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
                  <div className="text-xl mb-1" style={{ fontWeight: 800, color: '#030213' }}>{p.puntaje}%</div>
                  <p className="text-gray-500 text-xs leading-tight">{p.categoria}</p>
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${p.puntaje}%` }}
                      transition={{ duration: 0.8, delay: i * 0.15 }}
                      className="h-full rounded-full"
                      style={{ background: p.puntaje >= 75 ? '#16a34a' : p.puntaje >= 60 ? '#f59e0b' : '#dc2626' }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <p className="text-gray-700 text-xs uppercase tracking-wider mb-2" style={{ fontWeight: 700 }}>Hallazgos</p>
                <ul className="space-y-2">
                  {MOCK_AGENT_DIAGNOSIS.hallazgos.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-gray-600 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#030213' }} />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-4 bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center text-center">
                <BarChart2 size={32} className="mb-2" style={{ color: '#030213' }} />
                <p className="text-gray-500 text-xs mb-1">Completitud Global</p>
                <p className="text-4xl" style={{ fontWeight: 800, color: '#030213' }}>
                  {MOCK_AGENT_DIAGNOSIS.completitud}%
                </p>
                <p className="text-green-600 text-xs mt-1 flex items-center gap-1" style={{ fontWeight: 500 }}>
                  <CheckCircle2 size={11} /> Nivel Aceptable
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <ConfirmModal
        open={showConfirm}
        count={documentos.length}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        isLoading={isSending}
      />
    </div>
  );
}