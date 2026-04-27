/**
 * SurveyRespondentOverlay
 * Vista aislada de encuestado: ocupa 100% del viewport con z-index máximo,
 * bloqueando completamente el acceso al resto de la aplicación.
 * Sin navegación, sin sidebar, sin header del dashboard.
 * TODO: Recibir preguntas reales desde banco_preguntas via prop / query Supabase
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, ChevronRight, CheckCircle2, X, LogOut, ShieldCheck,
  User, Briefcase, ArrowRight,
} from 'lucide-react';

interface Question {
  id: string;
  text: string;
  dimension: string;
}

const MOCK_QUESTIONS: Question[] = [
  {
    id: 'q1',
    text: '¿En qué medida existe un proceso formal y documentado para la iniciación de proyectos en su organización?',
    dimension: 'Procesos',
  },
  {
    id: 'q2',
    text: '¿Los líderes de su organización apoyan activamente las iniciativas de gestión de proyectos?',
    dimension: 'Gobernanza',
  },
  {
    id: 'q3',
    text: '¿Dispone su empresa de herramientas tecnológicas especializadas para la gestión de proyectos?',
    dimension: 'Tecnología',
  },
  {
    id: 'q4',
    text: '¿Los equipos de trabajo cuentan con capacitación formal en metodologías de gestión de proyectos?',
    dimension: 'Personas',
  },
  {
    id: 'q5',
    text: '¿Se mide el desempeño de los proyectos con indicadores (KPIs) definidos y revisados regularmente?',
    dimension: 'Métricas',
  },
  {
    id: 'q6',
    text: '¿Existe comunicación clara y oportuna entre los equipos de proyecto y los stakeholders clave?',
    dimension: 'Comunicación',
  },
  {
    id: 'q7',
    text: '¿Su organización aplica lecciones aprendidas de proyectos anteriores en nuevos proyectos?',
    dimension: 'Cultura',
  },
];

const LIKERT_OPTIONS = [
  { value: 1, label: 'Nunca',         description: 'No existe ninguna práctica al respecto' },
  { value: 2, label: 'Raramente',     description: 'Ocurre de forma esporádica y no sistemática' },
  { value: 3, label: 'A veces',       description: 'Se aplica en algunos proyectos o áreas' },
  { value: 4, label: 'Frecuentemente',description: 'Es una práctica habitual en la mayoría de casos' },
  { value: 5, label: 'Siempre',       description: 'Está institucionalizado y se aplica consistentemente' },
];

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------
function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = (current / total) * 100;
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-400 mb-2" style={{ fontWeight: 500 }}>
        <span>Pregunta {current} de {total}</span>
        <span>{Math.round(pct)}% completado</span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: '#030213' }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exit confirm dialog (shown when respondent tries to leave mid-survey)
// ---------------------------------------------------------------------------
function ExitConfirmDialog({
  onStay,
  onExit,
}: {
  onStay: () => void;
  onExit: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onStay}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10 p-6"
      >
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
            <LogOut size={18} className="text-red-500" />
          </div>
          <div>
            <h3 className="text-gray-900 mb-1" style={{ fontWeight: 600 }}>¿Salir de la encuesta?</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Sus respuestas parciales se perderán y deberá comenzar de nuevo.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onStay}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
            style={{ fontWeight: 500 }}
          >
            Continuar encuesta
          </button>
          <button
            onClick={onExit}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm hover:bg-red-600 transition-colors"
            style={{ fontWeight: 600 }}
          >
            Salir
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main overlay
// ---------------------------------------------------------------------------
interface SurveyRespondentOverlayProps {
  companyName: string;
  onClose: () => void;
}

type OverlayStep = 'identity' | 'survey' | 'done';

export default function SurveyRespondentOverlay({
  companyName,
  onClose,
}: SurveyRespondentOverlayProps) {
  const [overlayStep, setOverlayStep] = useState<OverlayStep>('identity');

  // Identity form
  const [nombre, setNombre] = useState('');
  const [cargo, setCargo] = useState('');
  const [identityErrors, setIdentityErrors] = useState<{ nombre?: string; cargo?: string }>({});

  // Survey state
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const totalQuestions = MOCK_QUESTIONS.length;
  const question = MOCK_QUESTIONS[currentStep];
  const selectedAnswer = question ? answers[question.id] : null;
  const isLastQuestion = currentStep === totalQuestions - 1;
  const answeredCount = Object.keys(answers).length;

  // ---- Identity submit ----
  const handleIdentitySubmit = () => {
    const errors: { nombre?: string; cargo?: string } = {};
    if (!nombre.trim()) errors.nombre = 'Ingrese su nombre completo';
    if (!cargo.trim()) errors.cargo = 'Ingrese su cargo o rol';
    if (Object.keys(errors).length) { setIdentityErrors(errors); return; }
    setIdentityErrors({});
    setOverlayStep('survey');
  };

  // ---- Survey navigation ----
  const handleSelect = (value: number) => {
    if (!question) return;
    setAnswers(prev => ({ ...prev, [question.id]: value }));
  };

  const handleNext = () => {
    if (isLastQuestion) {
      setOverlayStep('done');
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  const handleExitRequest = () => {
    if (overlayStep === 'done') { onClose(); return; }
    if (overlayStep === 'identity' && !nombre && !cargo) { onClose(); return; }
    if (answeredCount === 0 && overlayStep === 'survey') { onClose(); return; }
    setShowExitConfirm(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex flex-col bg-gray-50"
      style={{ isolation: 'isolate' }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                style={{ background: '#030213' }}
              >
                <span style={{ fontWeight: 800, fontSize: '0.7rem' }}>PMO</span>
              </div>
              <div>
                <p className="text-gray-400 text-xs" style={{ fontWeight: 500 }}>
                  Universidad ICESI · PMO Intelligence Platform
                </p>
                <p className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>
                  Encuesta de Madurez — {companyName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200">
                <ShieldCheck size={12} className="text-blue-600" />
                <span className="text-blue-700 text-xs" style={{ fontWeight: 600 }}>Modo encuestado</span>
              </div>
              {overlayStep !== 'done' && (
                <button
                  onClick={handleExitRequest}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50 text-xs transition-all"
                  style={{ fontWeight: 500 }}
                >
                  <LogOut size={12} />
                  Salir
                </button>
              )}
            </div>
          </div>

          {/* Progress — only during survey */}
          {overlayStep === 'survey' && (
            <ProgressBar current={currentStep + 1} total={totalQuestions} />
          )}
          {/* Identity step indicator */}
          {overlayStep === 'identity' && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-16 rounded-full" style={{ background: '#030213' }} />
              <div className="h-1.5 flex-1 rounded-full bg-gray-200" />
              <span className="text-xs text-gray-400 ml-1" style={{ fontWeight: 500 }}>Paso 1 de 2</span>
            </div>
          )}
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Content                                                             */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex-1 flex items-center justify-center px-4 py-12 overflow-y-auto">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">

            {/* ── Step 1: Identity form ── */}
            {overlayStep === 'identity' && (
              <motion.div
                key="identity"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.25 }}
              >
                <div className="mb-8">
                  <h2 className="text-gray-900 mb-2" style={{ fontSize: '1.375rem', fontWeight: 700 }}>
                    Antes de comenzar
                  </h2>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    Por favor ingrese sus datos. Esta información quedará asociada a sus respuestas para el análisis de madurez de la PMO.
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 flex flex-col gap-5">
                  {/* Nombre */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      className="text-gray-700 text-sm flex items-center gap-1.5"
                      style={{ fontWeight: 600 }}
                    >
                      <User size={14} className="text-gray-400" />
                      Nombre completo
                      <span className="text-red-400 ml-0.5">*</span>
                    </label>
                    <input
                      type="text"
                      value={nombre}
                      onChange={e => { setNombre(e.target.value); setIdentityErrors(p => ({ ...p, nombre: undefined })); }}
                      onKeyDown={e => e.key === 'Enter' && handleIdentitySubmit()}
                      placeholder="Ej: Juan Carlos Restrepo"
                      autoFocus
                      className={`w-full px-4 py-3 border-2 rounded-xl text-sm outline-none transition-all bg-white
                        ${identityErrors.nombre
                          ? 'border-red-400 focus:ring-2 focus:ring-red-100'
                          : 'border-gray-200 focus:border-zinc-800 focus:ring-2 focus:ring-zinc-100'
                        }`}
                    />
                    {identityErrors.nombre && (
                      <p className="text-red-500 text-xs">{identityErrors.nombre}</p>
                    )}
                  </div>

                  {/* Cargo */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      className="text-gray-700 text-sm flex items-center gap-1.5"
                      style={{ fontWeight: 600 }}
                    >
                      <Briefcase size={14} className="text-gray-400" />
                      Cargo / Rol en la organización
                      <span className="text-red-400 ml-0.5">*</span>
                    </label>
                    <input
                      type="text"
                      value={cargo}
                      onChange={e => { setCargo(e.target.value); setIdentityErrors(p => ({ ...p, cargo: undefined })); }}
                      onKeyDown={e => e.key === 'Enter' && handleIdentitySubmit()}
                      placeholder="Ej: Gerente de Operaciones"
                      className={`w-full px-4 py-3 border-2 rounded-xl text-sm outline-none transition-all bg-white
                        ${identityErrors.cargo
                          ? 'border-red-400 focus:ring-2 focus:ring-red-100'
                          : 'border-gray-200 focus:border-zinc-800 focus:ring-2 focus:ring-zinc-100'
                        }`}
                    />
                    {identityErrors.cargo && (
                      <p className="text-red-500 text-xs">{identityErrors.cargo}</p>
                    )}
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleIdentitySubmit}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm mt-1 transition-all"
                    style={{ background: '#030213', fontWeight: 600 }}
                  >
                    Comenzar encuesta
                    <ArrowRight size={15} />
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Survey questions ── */}
            {overlayStep === 'survey' && (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.22 }}
              >
                {/* Respondent chip */}
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0" style={{ background: '#030213', fontWeight: 700 }}>
                    {nombre.trim().split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <span className="text-gray-500 text-sm">
                    <span className="text-gray-800" style={{ fontWeight: 600 }}>{nombre}</span>
                    {cargo && <span className="text-gray-400"> · {cargo}</span>}
                  </span>
                </div>

                <div className="mb-4">
                  <span
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs uppercase tracking-wide"
                    style={{ background: '#e9ebef', color: '#030213', fontWeight: 600 }}
                  >
                    {question.dimension}
                  </span>
                </div>

                <h2
                  className="text-gray-900 mb-8 leading-snug"
                  style={{ fontSize: '1.375rem', fontWeight: 600 }}
                >
                  {question.text}
                </h2>

                <div className="space-y-3">
                  {LIKERT_OPTIONS.map(opt => {
                    const isSelected = selectedAnswer === opt.value;
                    return (
                      <motion.button
                        key={opt.value}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => handleSelect(opt.value)}
                        className="w-full text-left px-5 py-4 rounded-2xl border-2 transition-all flex items-center gap-4"
                        style={{
                          borderColor: isSelected ? '#030213' : '#e5e7eb',
                          background: isSelected ? '#e9ebef' : '#fff',
                        }}
                      >
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 transition-all"
                          style={{
                            background: isSelected ? '#030213' : '#f3f4f6',
                            color: isSelected ? '#fff' : '#6b7280',
                            fontWeight: 700,
                          }}
                        >
                          {opt.value}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-800" style={{ fontWeight: isSelected ? 600 : 500 }}>
                            {opt.label}
                          </p>
                          <p className="text-gray-400 text-sm leading-snug mt-0.5">
                            {opt.description}
                          </p>
                        </div>
                        {isSelected && (
                          <CheckCircle2 size={18} className="text-zinc-700 flex-shrink-0" />
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Thank-you ── */}
            {overlayStep === 'done' && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="text-center"
              >
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 size={40} className="text-green-500" />
                </div>
                <h1 className="text-gray-900 mb-2" style={{ fontWeight: 700, fontSize: '1.75rem' }}>
                  ¡Gracias, {nombre.split(' ')[0]}!
                </h1>
                <p className="text-gray-500 leading-relaxed mb-2 max-w-md mx-auto">
                  Sus respuestas han sido registradas correctamente y contribuirán al análisis de madurez de{' '}
                  <strong>{companyName}</strong>.
                </p>
                <p className="text-gray-400 text-sm mb-8">{cargo}</p>

                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-600 text-sm mb-8">
                  <CheckCircle2 size={14} className="text-green-500" />
                  {answeredCount} de {totalQuestions} preguntas respondidas
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={onClose}
                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-100 transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    <X size={15} />
                    Volver al módulo
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* Navigation footer — only during survey                             */}
      {/* ------------------------------------------------------------------ */}
      {overlayStep === 'survey' && (
        <footer className="bg-white border-t border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="flex items-center gap-2 px-5 py-3 border border-gray-200 rounded-xl text-gray-600 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{ fontWeight: 500, minHeight: '44px' }}
            >
              <ChevronLeft size={16} />
              Anterior
            </button>

            <div className="flex gap-1.5">
              {MOCK_QUESTIONS.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all"
                  style={{
                    width: i === currentStep ? 20 : 8,
                    height: 8,
                    background: i <= currentStep ? '#030213' : '#e5e7eb',
                    opacity: i === currentStep ? 1 : i < currentStep ? 0.6 : 0.35,
                  }}
                />
              ))}
            </div>

            <motion.button
              whileHover={selectedAnswer ? { scale: 1.02 } : {}}
              whileTap={selectedAnswer ? { scale: 0.98 } : {}}
              onClick={handleNext}
              disabled={!selectedAnswer}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{ background: '#030213', fontWeight: 600, minHeight: '44px' }}
            >
              {isLastQuestion ? 'Finalizar y Enviar' : 'Siguiente'}
              {!isLastQuestion && <ChevronRight size={16} />}
            </motion.button>
          </div>
        </footer>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Exit confirm dialog                                                 */}
      {/* ------------------------------------------------------------------ */}
      <AnimatePresence>
        {showExitConfirm && (
          <ExitConfirmDialog
            onStay={() => setShowExitConfirm(false)}
            onExit={onClose}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}