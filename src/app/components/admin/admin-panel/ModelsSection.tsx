import { Cpu, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAiModelSettings, type AiModelMode } from '../../../hooks/useAdmin';

function ModelsSection() {
  const { settings, isLoading, isSaving, updateMode } = useAiModelSettings();

  const handleModeChange = async (mode: AiModelMode) => {
    try {
      await updateMode(mode);
      const labels: Record<AiModelMode, string> = {
        high_with_fallback: 'Modo High + fallback activado',
        low: 'Modo Low + fallback activado',
        kimi: 'Modo Kimi solamente activado',
      };
      toast.success(labels[mode]);
    } catch (err: any) {
      toast.error('No se pudo actualizar el modo de modelos', { description: err.message });
    }
  };

  const updatedAt = settings.updatedAt
    ? new Date(settings.updatedAt).toLocaleString('es-CO', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : 'Sin registro';

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-gray-900" style={{ fontWeight: 700 }}>Modelos de IA</h2>
          <p className="text-gray-500 text-sm mt-0.5">Modo global para todos los agentes PMO</p>
        </div>
        {(isLoading || isSaving) && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 size={14} className="animate-spin" />
            {isSaving ? 'Guardando...' : 'Cargando...'}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
        <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1 mb-5">
          {[
            { mode: 'high_with_fallback' as AiModelMode, label: 'High + fallback' },
            { mode: 'low' as AiModelMode, label: 'Low + fallback' },
            { mode: 'kimi' as AiModelMode, label: 'Kimi' },
          ].map(option => {
            const active = settings.mode === option.mode;
            return (
              <button
                key={option.mode}
                onClick={() => handleModeChange(option.mode)}
                disabled={isLoading || isSaving || active}
                className={`px-4 py-2 rounded-lg text-sm transition-all disabled:cursor-default ${
                  active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
                style={{ fontWeight: active ? 700 : 500 }}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Cpu size={14} className="text-gray-500" />
              <p className="text-xs uppercase tracking-wide text-gray-400" style={{ fontWeight: 700 }}>High</p>
            </div>
            <p className="text-gray-900 text-sm font-mono">{settings.highModel}</p>
            <p className="text-gray-500 text-xs mt-2">Se intenta primero cuando el modo High + fallback está activo.</p>
            <p className="text-gray-700 text-xs mt-1" style={{ fontWeight: 600 }}>Precios: Input $4.00 / Output $18.00</p>
          </div>

          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Cpu size={14} className="text-gray-500" />
              <p className="text-xs uppercase tracking-wide text-gray-400" style={{ fontWeight: 700 }}>Low</p>
            </div>
            <p className="text-gray-900 text-sm font-mono">{settings.lowModel}</p>
            <p className="text-gray-500 text-xs mt-2">Se intenta primero en Low + fallback y segundo en High + fallback.</p>
            <p className="text-gray-700 text-xs mt-1" style={{ fontWeight: 600 }}>Precios: Input $0.10 / Output $0.40</p>
          </div>

          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Cpu size={14} className="text-gray-500" />
              <p className="text-xs uppercase tracking-wide text-gray-400" style={{ fontWeight: 700 }}>Kimi</p>
            </div>
            <p className="text-gray-900 text-sm font-mono">{settings.kimiModel}</p>
            <p className="text-gray-500 text-xs mt-2">Se usa como tercer respaldo o como modelo unico si el modo Kimi esta activo.</p>
            <p className="text-gray-700 text-xs mt-1" style={{ fontWeight: 600 }}>Precios: Input cache hit $0.16 / miss $0.95 / Output $4.00</p>
            <p className="text-gray-500 text-xs mt-1">Contexto: 262,144 tokens</p>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <span>Modo actual: <span className="text-gray-700" style={{ fontWeight: 700 }}>{settings.mode === 'kimi' ? 'Kimi solamente' : settings.mode === 'low' ? 'Low + fallback' : 'High + fallback'}</span></span>
          <span>Última actualización: {updatedAt}</span>
        </div>
      </div>
    </>
  );
}

export { ModelsSection };