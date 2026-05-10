import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, CheckCircle2, ChevronRight, Edit2, Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminQuestions, type BankQuestion, type QuestionType } from '../../../hooks/useAdmin';
import type { Fase5SubTab, FaseCategory } from './types';
import { DIMENSIONS, QUESTION_TYPE_CONFIG, QuestionTypeBadge } from './shared';

type SurveyType = string;

function QuestionEditForm({
  q,
  isSaving,
  onChange,
  onSave,
  onCancel,
}: {
  q: BankQuestion;
  isSaving: boolean;
  onChange: (patch: Partial<BankQuestion>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const currentType = q.editType ?? q.type;
  const currentOptions = q.editOptions ?? q.options ?? [''];

  const addOption = () => onChange({ editOptions: [...currentOptions, ''] });
  const updateOption = (idx: number, val: string) => {
    const next = [...currentOptions];
    next[idx] = val;
    onChange({ editOptions: next });
  };
  const removeOption = (idx: number) => {
    if (currentOptions.length <= 2) return;
    onChange({ editOptions: currentOptions.filter((_, i) => i !== idx) });
  };

  return (
    <div className="p-4 space-y-3 bg-gray-50/50">
      {/* Row 1: Type selector + Dimension + Survey */}
      <div className="grid grid-cols-3 gap-3">
        {/* Question Type */}
        <div>
          <label className="block text-gray-500 text-xs mb-1.5" style={{ fontWeight: 600 }}>TIPO DE PREGUNTA</label>
          <div className="flex flex-col gap-1.5">
            {(Object.entries(QUESTION_TYPE_CONFIG) as [QuestionType, typeof QUESTION_TYPE_CONFIG[QuestionType]][]).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => onChange({ editType: key, editOptions: key === 'multiple' ? (currentOptions.length >= 2 ? currentOptions : ['Opción 1', 'Opción 2']) : undefined })}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs text-left transition-all ${
                  currentType === key
                    ? 'border-gray-400 bg-white shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
                style={{ fontWeight: currentType === key ? 600 : 500, color: currentType === key ? cfg.color : '#6b7280' }}
              >
                <span style={{ color: cfg.color }}>{cfg.icon}</span>
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dimension */}
        <div>
          <label className="block text-gray-500 text-xs mb-1.5" style={{ fontWeight: 600 }}>DIMENSIÓN</label>
          <select
            value={q.editDimension ?? q.dimension}
            onChange={e => onChange({ editDimension: e.target.value })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-gray-400 bg-white"
          >
            {DIMENSIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <label className="block text-gray-500 text-xs mb-1.5 mt-3" style={{ fontWeight: 600 }}>TIPO DE ENCUESTA</label>
          <select
            value={q.surveyType}
            onChange={e => onChange({ surveyType: e.target.value as SurveyType })}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-gray-400 bg-white"
          >
            <option value="Idoneidad">Idoneidad (Fase 1)</option>
            <option value="Madurez Predictiva">Madurez Predictiva (Fase 5)</option>
            <option value="Madurez Ágil">Madurez Ágil (Fase 5)</option>
          </select>
        </div>

        {/* Type description + options preview */}
        <div>
          <label className="block text-gray-500 text-xs mb-1.5" style={{ fontWeight: 600 }}>VISTA PREVIA</label>
          <div className="border border-dashed border-gray-200 rounded-lg p-3 bg-white h-[calc(100%-24px)] flex flex-col justify-start gap-1.5">
            {currentType === 'abierta' && (
              <>
                <p className="text-gray-400 text-xs italic">Área de texto libre</p>
                <div className="w-full h-10 bg-gray-100 rounded border border-gray-200" />
              </>
            )}
            {currentType === 'si_no' && (
              <>
                <p className="text-gray-400 text-xs italic">Respuesta binaria</p>
                <div className="flex gap-2">
                  <div className="flex-1 py-1.5 bg-green-50 border border-green-200 rounded text-center text-xs text-green-700" style={{ fontWeight: 600 }}>Sí</div>
                  <div className="flex-1 py-1.5 bg-red-50 border border-red-200 rounded text-center text-xs text-red-700" style={{ fontWeight: 600 }}>No</div>
                </div>
              </>
            )}
            {currentType === 'multiple' && (
              <>
                <p className="text-gray-400 text-xs italic">Opciones de selección</p>
                {currentOptions.slice(0, 3).map((opt, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0" />
                    <span className="text-gray-600 text-xs truncate">{opt || `Opción ${i + 1}`}</span>
                  </div>
                ))}
                {currentOptions.length > 3 && <p className="text-gray-300 text-xs">+{currentOptions.length - 3} más</p>}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Question text */}
      <div>
        <label className="block text-gray-500 text-xs mb-1" style={{ fontWeight: 600 }}>TEXTO DE LA PREGUNTA</label>
        <textarea
          value={q.editText ?? q.text}
          onChange={e => onChange({ editText: e.target.value })}
          placeholder="Escribe el texto de la pregunta..."
          rows={2}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 resize-none transition-all"
        />
      </div>

      {/* Multiple choice options */}
      {currentType === 'multiple' && (
        <div>
          <label className="block text-gray-500 text-xs mb-1.5" style={{ fontWeight: 600 }}>OPCIONES DE RESPUESTA <span className="text-gray-300">(mínimo 2)</span></label>
          <div className="space-y-1.5">
            {currentOptions.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center text-gray-400 text-xs flex-shrink-0" style={{ fontWeight: 700 }}>
                  {String.fromCharCode(65 + idx)}
                </div>
                <input
                  type="text"
                  value={opt}
                  onChange={e => updateOption(idx, e.target.value)}
                  placeholder={`Opción ${idx + 1}`}
                  className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-gray-400 transition-all"
                />
                <button
                  onClick={() => removeOption(idx)}
                  disabled={currentOptions.length <= 2}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 disabled:opacity-30 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <button
              onClick={addOption}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mt-1 transition-colors"
              style={{ fontWeight: 500 }}
            >
              <Plus size={12} /> Agregar opción
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 text-xs hover:bg-gray-50 transition-colors"
          style={{ fontWeight: 500 }}
        >
          Cancelar
        </button>
        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs disabled:opacity-70 transition-opacity"
          style={{ background: '#5454e9', fontWeight: 600 }}
        >
          {isSaving ? <><Loader2 size={12} className="animate-spin" /> Guardando...</> : <><Save size={12} /> Guardar</>}
        </button>
      </div>
    </div>
  );
}

/* ── Questions List for a given survey type ── */
function QuestionList({ questions, surveyType, onUpdate, onSaveQuestion, onDeleteQuestion, onInsertQuestion }: {
  questions: BankQuestion[];
  surveyType: string;
  onUpdate: (updated: BankQuestion[]) => void;
  onSaveQuestion: (id: string, text: string, dimension: string) => Promise<void>;
  onDeleteQuestion: (id: string) => Promise<void>;
  onInsertQuestion: (text: string, dimension: string, surveyType: string) => Promise<BankQuestion>;
}) {
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const list = questions.filter(q => q.surveyType?.toLowerCase() === surveyType?.toLowerCase());
  const others = questions.filter(q => q.surveyType?.toLowerCase() !== surveyType?.toLowerCase());

  const startEdit = (id: string) => {
    const updated = questions.map(q =>
      q.id === id
        ? { ...q, isEditing: true, editText: q.text, editDimension: q.dimension, editType: q.type, editOptions: q.options ? [...q.options] : undefined }
        : { ...q, isEditing: false }
    );
    onUpdate(updated);
  };

  const cancelEdit = (id: string) => {
    const q = questions.find(x => x.id === id);
    if (q?.isNew) {
      onUpdate(questions.filter(x => x.id !== id));
    } else {
      onUpdate(questions.map(x => x.id === id ? { ...x, isEditing: false } : x));
    }
  };

  const saveEdit = async (id: string) => {
    const q = questions.find(x => x.id === id);
    if (!q) return;
    const newText = (q.editText ?? q.text).trim();
    const newDimension = q.editDimension ?? q.dimension;
    if (!newText) {
      if (q.isNew) {
        onUpdate(questions.filter(x => x.id !== id));
      } else {
        onUpdate(questions.map(x => x.id === id ? { ...x, isEditing: false } : x));
      }
      toast.error('La pregunta no puede estar vacía. Se descartaron los cambios.');
      return;
    }
    const newType = q.editType ?? q.type;
    if (newType === 'multiple') {
      const opts = q.editOptions ?? q.options ?? [];
      if (opts.filter(o => o.trim()).length < 2) {
        toast.error('Debes definir al menos 2 opciones de respuesta.');
        return;
      }
    }
    setIsSaving(id);
    try {
      if (q.isNew) {
        // Persist new question to DB
        const saved = await onInsertQuestion(newText, newDimension, surveyType);
        // Replace temp question with the real one from DB
        onUpdate([...others, { ...saved, surveyType, type: newType }]);
        toast.success('Pregunta creada y guardada correctamente.');
      } else {
        // Update existing question in DB
        await onSaveQuestion(id, newText, newDimension);
        onUpdate(questions.map(x => x.id === id
          ? {
              ...x,
              text: newText,
              dimension: newDimension,
              type: newType,
              options: newType === 'multiple' ? (x.editOptions ?? x.options) : undefined,
              isEditing: false,
              isNew: false,
              editText: undefined,
              editDimension: undefined,
              editType: undefined,
              editOptions: undefined,
            }
          : x
        ));
        toast.success('Pregunta actualizada correctamente.');
      }
    } catch (err: any) {
      toast.error('Error guardando la pregunta.', { description: err?.message });
    } finally {
      setIsSaving(null);
    }
  };

  const deleteQuestion = async (id: string) => {
    const q = questions.find(x => x.id === id);
    if (!q) return;
    // Optimistic: remove from UI immediately
    onUpdate(questions.filter(x => x.id !== id));
    setIsDeleting(id);
    try {
      await onDeleteQuestion(id);
      toast.success('Pregunta eliminada permanentemente.');
    } catch (err: any) {
      // Rollback
      onUpdate(questions);
      toast.error('Error al eliminar la pregunta.', { description: err?.message });
    } finally {
      setIsDeleting(null);
    }
  };

  const patchQuestion = (id: string, patch: Partial<BankQuestion>) => {
    onUpdate(questions.map(x => x.id === id ? { ...x, ...patch } : x));
  };

  if (list.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">No hay preguntas para esta categoría</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {list.map((q, i) => (
        <motion.div
          key={q.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ delay: i * 0.03 }}
          className="bg-white rounded-xl border border-gray-200 overflow-hidden"
        >
          {q.isEditing ? (
            <QuestionEditForm
              q={q}
              isSaving={isSaving === q.id}
              onChange={patch => patchQuestion(q.id, patch)}
              onSave={() => saveEdit(q.id)}
              onCancel={() => cancelEdit(q.id)}
            />
          ) : (
            <div className="flex items-start gap-4 px-4 py-3.5 hover:bg-gray-50/60 transition-colors group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <QuestionTypeBadge type={q.type} />
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: '#e9ebef', color: '#5454e9', fontWeight: 600 }}
                  >
                    {q.dimension}
                  </span>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {q.text || <span className="text-gray-400 italic">Sin texto</span>}
                </p>
                {q.type === 'multiple' && q.options && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {q.options.map((opt, oi) => (
                      <span key={oi} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        {String.fromCharCode(65 + oi)}. {opt}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                <button
                  onClick={() => startEdit(q.id)}
                  className="p-1.5 rounded-lg hover:bg-zinc-100 text-gray-400 hover:text-zinc-700 transition-all"
                  title="Editar"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  onClick={() => deleteQuestion(q.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
                  title="Eliminar"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

/* ── Questions Bank Section ── */
function QuestionsSection() {
  const { questions, isLoading: loadingQ, setQuestions, updateQuestion, insertQuestion, deleteQuestion, patchLocal } = useAdminQuestions();
  const [faseTab, setFaseTab] = useState<FaseCategory>('fase1');
  const [fase5SubTab, setFase5SubTab] = useState<Fase5SubTab>('madurez_predictiva');

  const activeSurveyType = faseTab === 'fase1' ? 'Idoneidad' : (fase5SubTab === 'madurez_predictiva' ? 'Madurez Predictiva' : 'Madurez Ágil');

  const countFor = (st: string) => questions.filter(q => q.surveyType?.toLowerCase() === st?.toLowerCase()).length;

  const addQuestion = () => {
    const newQ: BankQuestion = {
      id: `q${Date.now()}`,
      text: '',
      dimension: 'Procesos',
      surveyType: activeSurveyType,
      type: 'si_no',
      isEditing: true,
      isNew: true,
      editText: '',
      editDimension: 'Procesos',
      editType: 'si_no',
    };
    setQuestions(prev => [...prev, newQ]);
    // Scroll to bottom after adding
    setTimeout(() => {
      const els = document.querySelectorAll('[data-question-list]');
      if (els.length) els[els.length - 1].scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-gray-900" style={{ fontWeight: 700 }}>Banco de Preguntas</h2>
          <p className="text-gray-500 text-sm mt-0.5">{questions.length} preguntas en el catálogo</p>
        </div>
        <button
          onClick={addQuestion}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm hover:opacity-90 transition-opacity"
          style={{ background: '#5454e9', fontWeight: 600 }}
        >
          <Plus size={15} />+ Agregar Pregunta
        </button>
      </div>

      {/* ── Fase-level tabs ── */}
      <div className="flex items-stretch gap-3 mb-5">
        {/* Fase 1 */}
        <button
          onClick={() => setFaseTab('fase1')}
          className={`flex-1 flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
            faseTab === 'fase1' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs flex-shrink-0"
            style={{ background: faseTab === 'fase1' ? '#5454e9' : '#e5e7eb', color: faseTab === 'fase1' ? '#fff' : '#6b7280', fontWeight: 700 }}
          >
            1
          </div>
          <div>
            <p className="text-sm" style={{ fontWeight: faseTab === 'fase1' ? 700 : 500, color: faseTab === 'fase1' ? '#5454e9' : '#6b7280' }}>
              Fase 1 — Idoneidad
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{countFor('Idoneidad')} preguntas</p>
          </div>
          {faseTab === 'fase1' && <ChevronRight size={14} className="ml-auto text-gray-400" />}
        </button>

        {/* Fase 5 */}
        <button
          onClick={() => setFaseTab('fase5')}
          className={`flex-1 flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
            faseTab === 'fase5' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-xs flex-shrink-0"
            style={{ background: faseTab === 'fase5' ? '#5454e9' : '#e5e7eb', color: faseTab === 'fase5' ? '#fff' : '#6b7280', fontWeight: 700 }}
          >
            5
          </div>
          <div>
            <p className="text-sm" style={{ fontWeight: faseTab === 'fase5' ? 700 : 500, color: faseTab === 'fase5' ? '#5454e9' : '#6b7280' }}>
              Fase 5 — Madurez
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{countFor('Madurez Predictiva') + countFor('Madurez Ágil')} preguntas</p>
          </div>
          {faseTab === 'fase5' && <ChevronRight size={14} className="ml-auto text-gray-400" />}
        </button>
      </div>

      {/* ── Fase 5 sub-tabs ── */}
      <AnimatePresence>
        {faseTab === 'fase5' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="flex items-center gap-2">
              {([['madurez_predictiva', 'Madurez Predictiva'], ['madurez_agil', 'Madurez Ágil']] as [Fase5SubTab, string][]).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setFase5SubTab(value)}
                  className={`px-4 py-2 rounded-xl text-xs transition-all ${
                    fase5SubTab === value
                      ? 'text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                  style={fase5SubTab === value ? { background: '#5454e9', fontWeight: 600 } : { fontWeight: 500 }}
                >
                  {label}
                  <span className="ml-1.5 opacity-70">({countFor(label)})</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Legend: question types ── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="text-gray-400 text-xs">Tipos:</span>
        {(Object.entries(QUESTION_TYPE_CONFIG) as [QuestionType, typeof QUESTION_TYPE_CONFIG[QuestionType]][]).map(([key, cfg]) => (
          <span key={key} className="inline-flex items-center gap-1 text-xs" style={{ color: cfg.color, fontWeight: 500 }}>
            {cfg.icon} {cfg.label}
          </span>
        ))}
      </div>

      {/* ── Question list ── */}
      <div data-question-list>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSurveyType}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <QuestionList
              questions={questions}
              surveyType={activeSurveyType}
              onUpdate={setQuestions}
              onSaveQuestion={updateQuestion}
              onDeleteQuestion={deleteQuestion}
              onInsertQuestion={insertQuestion}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}


export { QuestionsSection };