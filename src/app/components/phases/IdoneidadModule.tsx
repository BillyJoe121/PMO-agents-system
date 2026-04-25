import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Link2, QrCode, Copy, ClipboardEdit, Globe, CheckCircle2,
  Loader2, AlertTriangle, Users, Send, X, Eye, TrendingUp, UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import SurveyRespondentOverlay from '../survey/SurveyRespondentOverlay';

type EntryMethod = null | 'survey' | 'manual';
type ModuleState = 'selection' | 'data-entry' | 'processing' | 'completed';

const MOCK_DIAGNOSIS = {
  score: 78,
  category: 'Alta Idoneidad',
  observations: [
    'La organización presenta una estructura organizacional bien definida con roles y responsabilidades claros.',
    'Se evidencia compromiso de la alta dirección con la implementación de la PMO.',
    'Existe cultura organizacional orientada a la mejora continua y gestión de proyectos.',
    'Se detectaron oportunidades de mejora en la estandarización de procesos transversales.',
  ],
  recommendations: [
    'Iniciar con una PMO de tipo "Apoyo" antes de avanzar a estructuras más robustas.',
    'Invertir en capacitación en metodologías ágiles e híbridas para los equipos.',
    'Establecer un comité de gobernanza de proyectos en los próximos 30 días.',
  ],
};

const SURVEY_RESPONDENTS = [
  { name: 'María González', role: 'Gerente de Proyectos', completed: true },
  { name: 'Carlos Reyes', role: 'Director Financiero', completed: true },
  { name: 'Ana Martínez', role: 'CTO', completed: false },
  { name: 'Pedro Suárez', role: 'VP Operaciones', completed: true },
];

interface ConfirmModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

function ConfirmModal({ open, onCancel, onConfirm, isLoading }: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onCancel} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 p-6"
          >
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <div>
                <h3 className="text-gray-900 mb-1" style={{ fontWeight: 600 }}>Confirmar envío al Agente IA</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Al confirmar, los datos de la encuesta se <strong>bloquearán</strong> y serán enviados al Agente 2 para análisis.
                  Esta acción no puede deshacerse.
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
                {isLoading ? <><Loader2 size={14} className="animate-spin" /> Enviando...</> : <><Send size={14} /> Confirmar y Enviar</>}
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

  const project = getProject(projectId!);
  const phase = project?.phases.find(p => p.number === 1);

  const initialState: ModuleState = phase?.status === 'completado' ? 'completed' : 'selection';

  const [moduleState, setModuleState] = useState<ModuleState>(initialState);
  const [entryMethod, setEntryMethod] = useState<EntryMethod>(null);
  const [manualData, setManualData] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showRespondentView, setShowRespondentView] = useState(false);

  // RF-F1-01: Generar UUID de encuesta para el link externo
  const surveyLink = `https://pmo.icesi.edu.co/survey/${projectId}/f1/enc_${projectId?.slice(-6)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(surveyLink).catch(() => {});
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
    setIsSending(true);
    // TODO: axios.post(N8N_WEBHOOK_AGENTE_2, { proyecto_id, datos_encuesta })
    // TODO: fetch('banco_preguntas').where('tipo_encuesta', 'idoneidad')
    await new Promise(r => setTimeout(r, 500));
    setIsSending(false);
    setShowConfirm(false);
    setModuleState('processing');
    updatePhaseStatus(projectId!, 1, 'procesando');

    // Simulate agent response
    setTimeout(() => {
      setModuleState('completed');
      // RF-F1-08: Aplicar 'pointer-events-none' o 'disabled' a los inputs tras aprobación
      updatePhaseStatus(projectId!, 1, 'completado', `Score de idoneidad: ${MOCK_DIAGNOSIS.score}/100. ${MOCK_DIAGNOSIS.observations[0]}`);
      toast.success('¡Fase 1 completada!', { description: 'El Agente 2 ha finalizado el diagnóstico de idoneidad.' });
    }, 4000);
  };

  if (!project || !phase) return null;

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
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs" style={{ background: '#030213', fontWeight: 700 }}>1</div>
              <span className="text-gray-700 text-sm" style={{ fontWeight: 600 }}>Diagnóstico de Idoneidad</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Respondent entry button — always visible in this module */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowRespondentView(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm transition-all"
              style={{ borderColor: '#030213', color: '#030213', fontWeight: 600, background: 'transparent' }}
            >
              <UserCheck size={15} />
              Ingresar como encuestado
            </motion.button>
            <button onClick={() => navigate(`/dashboard/project/${projectId}`)}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8">
        <AnimatePresence mode="wait">

          {/* STATE: Selection */}
          {moduleState === 'selection' && (
            <motion.div key="selection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-8">
                <h1 className="text-gray-900 mb-2" style={{ fontWeight: 700, fontSize: '1.5rem' }}>
                  Fase 1: Diagnóstico de Idoneidad
                </h1>
                <p className="text-gray-500 text-sm">Seleccione el método de recolección de datos para esta fase.</p>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <motion.button
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setEntryMethod('survey'); setModuleState('data-entry'); }}
                  className="bg-white border-2 border-gray-200 hover:border-blue-400 rounded-2xl p-8 text-left transition-all group shadow-sm hover:shadow-md"
                >
                  <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center mb-5 group-hover:bg-blue-100 transition-colors">
                    <Globe size={26} className="text-blue-600" />
                  </div>
                  <h3 className="text-gray-900 mb-2" style={{ fontWeight: 600, fontSize: '1.0625rem' }}>
                    Gestionar Encuesta en Línea
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    Genere un enlace único y código QR para enviar la encuesta a los colaboradores de la organización.
                  </p>
                  <div className="mt-4 text-xs text-blue-600 flex items-center gap-1" style={{ fontWeight: 500 }}>
                    Recomendado <span className="ml-1">→</span>
                  </div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setEntryMethod('manual'); setModuleState('data-entry'); }}
                  className="bg-white border-2 border-gray-200 hover:border-blue-400 rounded-2xl p-8 text-left transition-all group shadow-sm hover:shadow-md"
                >
                  <div className="w-14 h-14 rounded-xl bg-purple-50 flex items-center justify-center mb-5 group-hover:bg-purple-100 transition-colors">
                    <ClipboardEdit size={26} className="text-purple-600" />
                  </div>
                  <h3 className="text-gray-900 mb-2" style={{ fontWeight: 600, fontSize: '1.0625rem' }}>
                    Ingreso Manual de Datos
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    Cargue masivamente o pegue los resultados de encuestas realizadas fuera de la plataforma.
                  </p>
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* STATE: Data Entry */}
          {moduleState === 'data-entry' && (
            <motion.div key="data-entry" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <button onClick={() => setModuleState('selection')} className="text-sm text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1">
                    <ArrowLeft size={13} /> Cambiar método
                  </button>
                  <h1 className="text-gray-900" style={{ fontWeight: 700, fontSize: '1.5rem' }}>
                    {entryMethod === 'survey' ? 'Encuesta en Línea' : 'Ingreso Manual de Datos'}
                  </h1>
                </div>
              </div>

              {entryMethod === 'survey' && (
                <div className="grid grid-cols-3 gap-6">
                  {/* Survey access panel */}
                  <div className="col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-gray-800 mb-1" style={{ fontWeight: 600 }}>Enlace de Acceso</h3>
                    <p className="text-gray-500 text-sm mb-4">Comparta este enlace con los colaboradores de la organización.</p>

                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 truncate">
                        {surveyLink}
                      </div>
                      <button
                        onClick={handleCopyLink}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all flex-shrink-0
                          ${linkCopied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                        `}
                        style={{ fontWeight: 500 }}
                      >
                        {linkCopied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                        {linkCopied ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>

                    {/* QR Code placeholder */}
                    <div className="flex items-center gap-5 p-4 bg-gray-50 rounded-xl">
                      <div className="w-24 h-24 bg-white border-2 border-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
                        <QrCode size={48} className="text-gray-400" />
                      </div>
                      <div>
                        <p className="text-gray-700 text-sm mb-1" style={{ fontWeight: 500 }}>Código QR</p>
                        <p className="text-gray-500 text-xs leading-relaxed">
                          Escanee este código para acceder directamente a la encuesta desde dispositivos móviles.
                        </p>
                        <button className="mt-2 text-xs text-blue-600 hover:underline" style={{ fontWeight: 500 }}>
                          Descargar QR →
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Response monitor */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Users size={16} className="text-gray-500" />
                      <h3 className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>Monitor de Respuestas</h3>
                    </div>
                    <div className="text-center mb-4 py-3 bg-blue-50 rounded-xl">
                      <p className="text-3xl text-blue-700" style={{ fontWeight: 700 }}>
                        {SURVEY_RESPONDENTS.filter(r => r.completed).length}
                      </p>
                      <p className="text-blue-500 text-xs">de {SURVEY_RESPONDENTS.length} respondieron</p>
                    </div>
                    <div className="space-y-2">
                      {SURVEY_RESPONDENTS.map((r, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${r.completed ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-700 truncate" style={{ fontWeight: 500 }}>{r.name}</p>
                            <p className="text-xs text-gray-400 truncate">{r.role}</p>
                          </div>
                          {r.completed && <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {entryMethod === 'manual' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-gray-800 mb-1" style={{ fontWeight: 600 }}>Datos de la Encuesta</h3>
                  <p className="text-gray-500 text-sm mb-4">
                    Pegue o ingrese las respuestas recolectadas. Puede usar texto libre, JSON o formato CSV.
                  </p>
                  <textarea
                    value={manualData}
                    onChange={e => setManualData(e.target.value)}
                    placeholder="Pegue aquí los datos de la encuesta de idoneidad...&#10;&#10;Ejemplo:&#10;Pregunta 1: ¿Tiene la organización una PMO formal?&#10;Respuesta: Sí, existe una PMO establecida desde 2021...&#10;&#10;Pregunta 2: ¿Cuántos proyectos se gestionan simultáneamente?&#10;Respuesta: Entre 15 y 20 proyectos por trimestre..."
                    rows={14}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all resize-y leading-relaxed"
                    style={{ fontFamily: 'monospace' }}
                  />
                  <p className="text-gray-400 text-xs mt-2 text-right">
                    {manualData.length} caracteres
                  </p>
                </div>
              )}

              {/* Mark complete button */}
              <div className="mt-6 flex justify-end">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleMarkComplete}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm shadow-sm hover:shadow-md transition-all"
                  style={{ background: '#030213', fontWeight: 600 }}
                >
                  <Send size={15} />
                  Marcar como completa y Enviar al Agente
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* STATE: Processing */}
          {moduleState === 'processing' && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="relative mb-8">
                <div className="w-24 h-24 rounded-full border-4 border-blue-100 flex items-center justify-center">
                  <Loader2 size={40} className="text-blue-600 animate-spin" />
                </div>
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 rounded-full border-4 border-blue-200 opacity-30"
                />
              </div>
              <h2 className="text-gray-900 mb-3" style={{ fontWeight: 700, fontSize: '1.375rem' }}>
                Analizando Idoneidad
              </h2>
              <p className="text-gray-500 text-sm max-w-sm leading-relaxed">
                El <strong>Agente 2</strong> está procesando los datos de idoneidad y generando el diagnóstico organizacional...
              </p>
              <div className="mt-6 flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-xl">
                <Loader2 size={13} className="animate-spin" />
                <span className="text-xs" style={{ fontWeight: 500 }}>Esto puede tomar unos momentos</span>
              </div>
            </motion.div>
          )}

          {/* STATE: Completed */}
          {moduleState === 'completed' && (
            <motion.div key="completed" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 size={18} className="text-green-500" />
                    <span className="text-green-600 text-sm" style={{ fontWeight: 600 }}>Fase completada</span>
                  </div>
                  <h1 className="text-gray-900" style={{ fontWeight: 700, fontSize: '1.5rem' }}>
                    Diagnóstico de Idoneidad
                  </h1>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Left: Data summary */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-gray-800 mb-4" style={{ fontWeight: 600 }}>Datos Recopilados</h3>
                  <div className="space-y-3">
                    {SURVEY_RESPONDENTS.filter(r => r.completed).map((r, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs" style={{ background: '#030213', fontWeight: 600 }}>
                          {r.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="text-gray-700 text-sm" style={{ fontWeight: 500 }}>{r.name}</p>
                          <p className="text-gray-400 text-xs">{r.role}</p>
                        </div>
                        <CheckCircle2 size={14} className="text-green-500 ml-auto" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                    <p className="text-gray-500 text-xs" style={{ fontWeight: 500 }}>Tasa de respuesta</p>
                    <p className="text-gray-800 text-lg mt-0.5" style={{ fontWeight: 700 }}>
                      {Math.round((SURVEY_RESPONDENTS.filter(r => r.completed).length / SURVEY_RESPONDENTS.length) * 100)}%
                    </p>
                  </div>
                </div>

                {/* Right: Agent diagnosis */}
                <div className="rounded-2xl border-2 shadow-sm p-6" style={{ borderColor: '#030213', background: 'linear-gradient(135deg, #f5f5f7 0%, #ffffff 100%)' }}>
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{ background: '#030213' }}>
                      <TrendingUp size={14} />
                    </div>
                    <span className="text-sm" style={{ fontWeight: 700, color: '#030213' }}>Diagnóstico — Agente 2</span>
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-5 mb-5 p-4 bg-white rounded-xl shadow-sm">
                    <div className="relative w-20 h-20">
                      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#030213" strokeWidth="3"
                          strokeDasharray={`${MOCK_DIAGNOSIS.score} 100`} strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg" style={{ fontWeight: 800, color: '#030213' }}>{MOCK_DIAGNOSIS.score}</span>
                        <span className="text-xs text-gray-400">/100</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs mb-0.5">Puntuación de Idoneidad</p>
                      <p className="text-gray-900" style={{ fontWeight: 700, fontSize: '1rem' }}>{MOCK_DIAGNOSIS.category}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full" style={{ fontWeight: 500 }}>
                        Apta para PMO
                      </span>
                    </div>
                  </div>

                  {/* Observations */}
                  <div className="mb-4">
                    <p className="text-gray-700 text-xs uppercase tracking-wider mb-2" style={{ fontWeight: 700 }}>Observaciones</p>
                    <ul className="space-y-2">
                      {MOCK_DIAGNOSIS.observations.map((obs, i) => (
                        <li key={i} className="flex items-start gap-2 text-gray-600 text-sm">
                          <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#030213' }} />
                          {obs}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Recommendations */}
                  <div>
                    <p className="text-gray-700 text-xs uppercase tracking-wider mb-2" style={{ fontWeight: 700 }}>Recomendaciones</p>
                    <ul className="space-y-2">
                      {MOCK_DIAGNOSIS.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2 text-gray-600 text-sm">
                          <span className="text-xs mt-0.5 flex-shrink-0" style={{ color: '#030213', fontWeight: 700 }}>{i + 1}.</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
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

      {/* Respondent overlay — full viewport, no app access */}
      <AnimatePresence>
        {showRespondentView && (
          <SurveyRespondentOverlay
            companyName={project.companyName}
            onClose={() => setShowRespondentView(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}