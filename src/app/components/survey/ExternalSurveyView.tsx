/**
 * ExternalSurveyView — Módulo 11: Vista Externa de Encuestas
 * Interfaz pública "Distraction-Free" para recolección de datos de clientes.
 * TODO: fetch('banco_preguntas') usando el 'id_encuesta' de la URL (useParams)
 * TODO: Mutación insert en 'respuestas_encuesta' por cada respuesta confirmada
 * TODO: Manejar estado local 'currentStep' para la navegación entre preguntas
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, CheckCircle2, X } from 'lucide-react';

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
  { value: 1, label: 'Nunca', description: 'No existe ninguna práctica al respecto' },
  { value: 2, label: 'Raramente', description: 'Ocurre de forma esporádica y no sistemática' },
  { value: 3, label: 'A veces', description: 'Se aplica en algunos proyectos o áreas' },
  { value: 4, label: 'Frecuentemente', description: 'Es una práctica habitual en la mayoría de casos' },
  { value: 5, label: 'Siempre', description: 'Está institucionalizado y se aplica consistentemente' },
];

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
  // TODO: const { surveyId } = useParams(); para obtener banco de preguntas
  const [currentStep, setCurrentStep] = useState(0); // TODO: estado para navegación
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isFinished, setIsFinished] = useState(false);

  const totalQuestions = MOCK_QUESTIONS.length;
  const question = MOCK_QUESTIONS[currentStep];
  const selectedAnswer = question ? answers[question.id] : null;
  const isLastQuestion = currentStep === totalQuestions - 1;

  const handleSelect = (value: number) => {
    if (!question) return;
    setAnswers(prev => ({ ...prev, [question.id]: value }));
  };

  const handleNext = () => {
    if (isLastQuestion) {
      // TODO: Mutación insert en 'respuestas_encuesta'
      setIsFinished(true);
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
            ¡Gracias por su participación!
          </h1>
          <p className="text-gray-500 leading-relaxed mb-8">
            Sus respuestas han sido registradas correctamente. Gracias por contribuir al diagnóstico de la PMO.
            Sus aportes son fundamentales para el análisis de madurez organizacional.
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
      <main className="flex-1 flex items-center justify-center px-4 py-12">
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
              <div className="mb-4">
                <span
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs uppercase tracking-wide"
                  style={{ background: '#e9ebef', color: '#030213', fontWeight: 600 }}
                >
                  {question.dimension}
                </span>
              </div>

              {/* Question text */}
              <h2
                className="text-gray-900 mb-8 leading-snug"
                style={{ fontSize: '1.375rem', fontWeight: 600 }}
              >
                {question.text}
              </h2>

              {/* Likert Options */}
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
                        minHeight: '44px',
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
                        <p
                          className="text-gray-800"
                          style={{ fontWeight: isSelected ? 600 : 500 }}
                        >
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

          <div className="flex gap-1.5">
            {MOCK_QUESTIONS.map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full transition-all"
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
            disabled={!selectedAnswer}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            style={{ background: '#030213', fontWeight: 600, minHeight: '44px' }}
          >
            {isLastQuestion ? 'Finalizar' : 'Siguiente'}
            {!isLastQuestion && <ChevronRight size={16} />}
          </motion.button>
        </div>
      </footer>
    </div>
  );
}