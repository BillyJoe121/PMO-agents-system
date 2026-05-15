import { Cpu, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAiModelSettings, type AiModelId } from '../../../hooks/useAdmin';

const OPENAI_FALLBACK_MODEL = 'gpt-5.4-mini';
const ANTHROPIC_FALLBACK_MODEL = 'claude-haiku-4-5';

const MODEL_OPTIONS: Array<{
  id: AiModelId;
  provider: 'openai' | 'anthropic';
  name: string;
  description: string;
  cost: string;
}> = [
  {
    id: 'gpt-5.5',
    provider: 'openai',
    name: 'GPT-5.5',
    description: 'Modelo frontier para pruebas puntuales de mayor capacidad. Usar con cuidado por costo.',
    cost: 'OpenAI premium',
  },
  {
    id: 'gpt-5.4',
    provider: 'openai',
    name: 'GPT-5.4',
    description: 'Modelo principal para coding y trabajo profesional con buen balance de costo y capacidad.',
    cost: 'OpenAI principal',
  },
  {
    id: 'gpt-5.4-mini',
    provider: 'openai',
    name: 'GPT-5.4 mini',
    description: 'Opcion mas rapida y economica para fases ligeras, subagentes o reprocesos.',
    cost: 'OpenAI costo eficiente',
  },
  {
    id: 'claude-sonnet-4-6',
    provider: 'anthropic',
    name: 'Claude Sonnet 4.6',
    description: 'Balance recomendado entre calidad, velocidad y costo.',
    cost: 'Claude balanceado',
  },
  {
    id: 'claude-haiku-4-5',
    provider: 'anthropic',
    name: 'Claude Haiku 4.5',
    description: 'Claude rapido para tareas mas acotadas y menor latencia.',
    cost: 'Claude rapido',
  },
];

function ModelsSection() {
  const { settings, isLoading, isSaving, updateSelectedModel } = useAiModelSettings();

  const handleModelChange = async (model: AiModelId) => {
    try {
      await updateSelectedModel(model);
      const option = MODEL_OPTIONS.find(item => item.id === model);
      toast.success('Modelo principal actualizado', {
        description: option?.provider === 'openai'
          ? `${option?.name ?? model}. GPT queda sin fallback temporalmente.`
          : `${option?.name ?? model}. El fallback sera GPT-5.4 mini.`,
      });
    } catch (err: any) {
      toast.error('No se pudo actualizar el modelo', { description: err.message });
    }
  };

  const updatedAt = settings.updatedAt
    ? new Date(settings.updatedAt).toLocaleString('es-CO', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : 'Sin registro';

  const activeOption = MODEL_OPTIONS.find(option => option.id === settings.selectedModel);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-gray-900" style={{ fontWeight: 700 }}>Modelos de IA</h2>
          <p className="text-gray-500 text-sm mt-0.5">Modelo global para todos los agentes PMO</p>
        </div>
        {(isLoading || isSaving) && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 size={14} className="animate-spin" />
            {isSaving ? 'Guardando...' : 'Cargando...'}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
        <div className="flex items-start gap-3 p-4 rounded-xl border border-[#5454e9]/20 bg-[#5454e9]/[0.06] mb-5">
          <Sparkles size={17} className="text-[#5454e9] mt-0.5" />
          <div>
            <p className="text-gray-900 text-sm" style={{ fontWeight: 700 }}>
              {activeOption ? `${activeOption.name} activo` : 'Modelo activo no reconocido'}
            </p>
            <p className="text-gray-500 text-xs mt-1">
              Si eliges ChatGPT, no se usara fallback temporalmente. Si eliges Claude, el fallback automatico sera GPT-5.4 mini.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {(['openai', 'anthropic'] as const).map(provider => (
            <section key={provider} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Cpu size={14} className="text-gray-500" />
                <p className="text-xs uppercase tracking-wide text-gray-400" style={{ fontWeight: 800 }}>
                  {provider === 'openai' ? 'ChatGPT' : 'Claude'}
                </p>
              </div>

              <div className="space-y-3">
                {MODEL_OPTIONS.filter(option => option.provider === provider).map(option => {
                  const active = settings.selectedModel === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleModelChange(option.id)}
                      disabled={isLoading || isSaving || active}
                      className={`w-full text-left rounded-xl border p-4 transition-all disabled:cursor-default ${
                        active
                          ? 'border-[#5454e9] bg-[#5454e9]/[0.08] shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-gray-900 text-sm" style={{ fontWeight: 750 }}>{option.name}</p>
                          <p className="text-gray-500 text-xs mt-1 leading-relaxed">{option.description}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-[10px] border ${
                          active ? 'bg-[#5454e9] text-white border-[#5454e9]' : 'bg-gray-50 text-gray-500 border-gray-200'
                        }`} style={{ fontWeight: 750 }}>
                          {active ? 'Activo' : option.cost}
                        </span>
                      </div>
                      <p className="text-gray-400 text-xs mt-3 font-mono">{option.id}</p>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
          <span>
            Fallback actual:{' '}
            <span className="text-gray-700" style={{ fontWeight: 700 }}>
              {settings.provider === 'openai' ? 'Sin fallback' : OPENAI_FALLBACK_MODEL}
            </span>
          </span>
          <span>Ultima actualizacion: {updatedAt}</span>
        </div>
      </div>
    </>
  );
}

export { ModelsSection };
