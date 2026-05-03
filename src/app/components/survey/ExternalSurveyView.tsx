/**
 * ExternalSurveyView — Módulo 11: Vista Externa de Encuestas
 * Interfaz pública "Distraction-Free" para recolección de datos de clientes.
 * TODO: fetch('banco_preguntas') usando el 'id_encuesta' de la URL (useParams)
 * TODO: Mutación insert en 'respuestas_encuesta' por cada respuesta confirmada
 * TODO: Manejar estado local 'currentStep' para la navegación entre preguntas
 */

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, CheckCircle2, X, AlertTriangle, Loader2 } from 'lucide-react';
import { useEncuestaExterna } from '../../hooks/useEncuestaExterna';

const INTERPRETATION_MAP: Record<number, string> = {
  0: 'Altamente ágil',
  1: 'Altamente ágil',
  2: 'Predominantemente ágil',
  3: 'Predominantemente ágil',
  4: 'Híbrido',
  5: 'Híbrido',
  6: 'Híbrido',
  7: 'Híbrido',
  8: 'Predominantemente predictivo',
  9: 'Predominantemente predictivo',
  10: 'Altamente predictivo',
};

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = ((current) / total) * 100;
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

export default function ExternalSurveyView() {
  const { surveyId } = useParams();
  const { preguntas, isLoading, error, submitRespuestas } = useEncuestaExterna(surveyId || '');
  
  const [hasStarted, setHasStarted] = useState(false);
  const [userInfo, setUserInfo] = useState({ nombre: '', cargo: '', area: '' });
  
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const totalQuestions = preguntas.length;
  const question = preguntas[currentStep];
  const selectedAnswer = answers[question?.id];
  const isLastQuestion = currentStep === totalQuestions - 1;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Solo actuar si ya empezó la encuesta, hay una respuesta seleccionada y no está cargando/terminada
      if (e.key === 'Enter' && hasStarted && !isFinished && !isSubmitting && selectedAnswer !== undefined) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        // Usamos document.getElementById para forzar el click en next o lo llamamos directo
        if (isLastQuestion) {
           setIsSubmitting(true);
           submitRespuestas(userInfo.nombre, userInfo.cargo, userInfo.area, answers)
             .then(() => setIsFinished(true))
             .catch(() => alert('Hubo un error.'))
             .finally(() => setIsSubmitting(false));
        } else {
           setCurrentStep(prev => prev + 1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAnswer, currentStep, hasStarted, isFinished, isSubmitting, isLastQuestion, userInfo, answers, submitRespuestas]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-neutral-400 mb-4" size={24} />
        <p className="text-neutral-500 font-medium">Cargando encuesta...</p>
      </div>
    );
  }

  if (error || preguntas.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mb-6">
          <AlertTriangle size={30} className="text-rose-500" />
        </div>
        <h1 className="text-gray-900 mb-4" style={{ fontWeight: 600, fontSize: '1.5rem' }}>Enlace inválido</h1>
        <p className="text-gray-500 text-center max-w-sm">{error || 'No se encontraron preguntas en el banco de encuestas.'}</p>
      </div>
    );
  }

  const handleSelect = (value: number) => {
    if (!question) return;
    setAnswers(prev => ({ ...prev, [question.id]: value }));

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // Auto-avanzar después de un breve delay para que vean el texto descriptivo
    if (!isLastQuestion) {
      timeoutRef.current = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, 700);
    }
  };

  const handleNext = async () => {
    if (isLastQuestion) {
      setIsSubmitting(true);
      try {
        await submitRespuestas(userInfo.nombre, userInfo.cargo, userInfo.area, answers);
        setIsFinished(true);
      } catch (err) {
        alert('Hubo un error enviando la encuesta. Inténtalo de nuevo.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  /* ── Thank-you Screen ── */
  if (isFinished) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-lg"
        >
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} className="text-green-500" />
          </div>
          <h1 className="text-gray-900 mb-4" style={{ fontWeight: 700, fontSize: '1.75rem' }}>
            ¡Gracias por su participación, {userInfo.nombre.split(' ')[0]}!
          </h1>
          <p className="text-gray-500 leading-relaxed mb-8">
            Sus respuestas han sido registradas y nos ayudarán a determinar el modelo óptimo de gestión de proyectos para la organización.
          </p>
          <button
            onClick={() => window.close()}
            className="flex items-center gap-2 mx-auto px-6 py-3 border border-gray-200 rounded-xl text-gray-600 text-sm hover:bg-gray-100 transition-colors"
            style={{ fontWeight: 500 }}
          >
            <X size={15} />
            Cerrar esta pestaña
          </button>
        </motion.div>
      </div>
    );
  }

  /* ── Intro Screen ── */
  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{ background: '#030213' }}>
              <span style={{ fontWeight: 800, fontSize: '0.75rem' }}>PMO</span>
            </div>
            <div>
              <p className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>Idoneidad Organizacional</p>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center px-4 py-6">
          <div className="w-full max-w-xl bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Encuesta de Madurez y Enfoque</h1>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">
                Este instrumento evalúa las características críticas de la organización para determinar el enfoque de gestión más eficiente (Predictivo, Ágil o Híbrido) basado en el Apéndice X3 de la Guía Práctica de Ágil del PMI®.
              </p>
              <div className="bg-indigo-50/50 text-indigo-800 text-xs p-3 rounded-xl border border-indigo-100/50 space-y-1">
                <p><strong>Instrucciones:</strong></p>
                <ul className="list-disc pl-4 space-y-0.5 opacity-90">
                  <li>Responda según la situación actual, no según cómo debería ser.</li>
                  <li>La escala va del 0 (Altamente Ágil) al 10 (Altamente Predictivo).</li>
                  <li>No existen respuestas correctas o incorrectas.</li>
                </ul>
              </div>
            </div>
            
            <div className="p-6 bg-gray-50/50">
              <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">Tus Datos</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre Completo</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-500 text-sm bg-white"
                    value={userInfo.nombre}
                    onChange={(e) => setUserInfo({...userInfo, nombre: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Cargo / Rol</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-500 text-sm bg-white"
                      value={userInfo.cargo}
                      onChange={(e) => setUserInfo({...userInfo, cargo: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Área o Departamento</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-500 text-sm bg-white"
                      value={userInfo.area}
                      onChange={(e) => setUserInfo({...userInfo, area: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => setHasStarted(true)}
                disabled={!userInfo.nombre.trim() || !userInfo.cargo.trim()}
                className="w-full mt-5 flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                style={{ background: '#030213', fontWeight: 600 }}
              >
                Comenzar Evaluación
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          {/* Logo + Survey name */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{ background: '#030213' }}>
              <span style={{ fontWeight: 800, fontSize: '0.75rem' }}>PMO</span>
            </div>
            <div>
              <p className="text-gray-400 text-xs" style={{ fontWeight: 500 }}>Universidad ICESI · PMO Intelligence Platform</p>
              <p className="text-gray-800 text-sm" style={{ fontWeight: 600 }}>Encuesta de Madurez de la PMO</p>
            </div>
          </div>
          {/* Progress Bar */}
          <ProgressBar current={currentStep + 1} total={totalQuestions} />
        </div>
      </header>

      {/* Question Area */}
      <main className="flex-1 flex items-center justify-center px-4 py-4">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={question.id}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              {/* Dimension badge */}
              <div className="mb-2">
                <span
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs uppercase tracking-wide"
                  style={{ background: '#e9ebef', color: '#030213', fontWeight: 600 }}
                >
                  {question.categoria}
                </span>
              </div>
              {/* Question text */}
              {(() => {
                const parts = { question: question.texto_pregunta, evaluation: '', scale: '' };
                const evalIndex = question.texto_pregunta.indexOf('Evaluación:');
                const scaleIndex = question.texto_pregunta.indexOf('Escala:');

                if (evalIndex !== -1) {
                  parts.question = question.texto_pregunta.slice(0, evalIndex).trim();
                  if (scaleIndex !== -1) {
                    parts.evaluation = question.texto_pregunta.slice(evalIndex + 'Evaluación:'.length, scaleIndex).trim();
                    parts.scale = question.texto_pregunta.slice(scaleIndex + 'Escala:'.length).trim();
                  } else {
                    parts.evaluation = question.texto_pregunta.slice(evalIndex + 'Evaluación:'.length).trim();
                  }
                } else if (scaleIndex !== -1) {
                  parts.question = question.texto_pregunta.slice(0, scaleIndex).trim();
                  parts.scale = question.texto_pregunta.slice(scaleIndex + 'Escala:'.length).trim();
                }

                return (
                  <>
                    <h2
                      className="text-gray-900 mb-2 leading-snug"
                      style={{ fontSize: '1.3rem', fontWeight: 600 }}
                    >
                      {parts.question}
                    </h2>

                    {parts.evaluation && (
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-2 text-sm text-slate-600">
                        <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          ¿Qué se está evaluando y cómo responder?
                        </span>
                        {parts.evaluation}
                      </div>
                    )}

                    {parts.scale && (
                      <div className="bg-indigo-50/40 border border-indigo-100/60 rounded-xl p-3 mb-3">
                        <span className="block text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">
                          Escala y Criterios de Calificación
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {parts.scale.split(';').map((s, idx) => (
                            <span key={idx} className="bg-white border border-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-medium shadow-sm">
                              {s.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
              <p className="text-gray-500 text-sm mb-3">Mueve el selector para calificar del 1 (Ágil) al 10 (Predictivo).</p>

              {/* Likert Scale UI (1-10) */}
              <div className="mt-2 relative pt-3 pb-6">
                {/* Visual labels */}
                <div className="flex justify-between text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
                  <span>← Más Ágil</span>
                  <span>Más Predictivo →</span>
                </div>

                {/* The 1-10 Buttons Row */}
                <div className="flex justify-between items-center w-full relative">
                  {/* Track line behind buttons */}
                  <div className="absolute left-0 right-0 h-1 bg-gray-200 rounded-full z-0 top-1/2 -translate-y-1/2 mx-4" />
                  
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => {
                    const isSelected = selectedAnswer === val;
                    return (
                      <button
                        key={val}
                        onClick={() => handleSelect(val)}
                        className="relative z-10 w-10 h-10 md:w-12 md:h-12 rounded-full border-2 transition-all flex items-center justify-center font-bold text-sm md:text-base hover:scale-110 focus:outline-none"
                        style={{
                          borderColor: isSelected ? '#030213' : '#e5e7eb',
                          background: isSelected ? '#030213' : '#fff',
                          color: isSelected ? '#fff' : '#6b7280',
                          transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                          boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
                        }}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>

                {/* Interpretation helper */}
                <div className="text-center mt-4 min-h-[32px]">
                  <AnimatePresence mode="wait">
                    {selectedAnswer !== undefined ? (
                      <motion.p
                        key={selectedAnswer}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="text-indigo-600 font-semibold"
                      >
                        {selectedAnswer}: {INTERPRETATION_MAP[selectedAnswer]}
                      </motion.p>
                    ) : (
                      <p className="text-gray-400 text-sm">Selecciona un valor para continuar</p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Navigation Footer */}
      <footer className="bg-white border-t border-gray-200 px-4 py-4">
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

          <div className="flex gap-1.5 flex-1 max-w-[200px] mx-auto overflow-hidden">
            {preguntas.map((_, i) => (
              <div
                key={i}
                className="flex-1 h-1.5 rounded-full transition-all"
                style={{
                  background: i < currentStep
                    ? '#030213'
                    : i === currentStep
                    ? '#030213'
                    : '#e5e7eb',
                  opacity: i === currentStep ? 1 : i < currentStep ? 0.6 : 0.35,
                }}
              />
            ))}
          </div>

          <motion.button
            whileHover={selectedAnswer ? { scale: 1.02 } : {}}
            whileTap={selectedAnswer ? { scale: 0.98 } : {}}
            onClick={handleNext}
            disabled={selectedAnswer === undefined || isSubmitting}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            style={{ background: '#030213', fontWeight: 600, minHeight: '44px' }}
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : (isLastQuestion ? 'Finalizar' : 'Siguiente')}
            {!isLastQuestion && !isSubmitting && <ChevronRight size={16} />}
          </motion.button>
        </div>
      </footer>
    </div>
  );
}
