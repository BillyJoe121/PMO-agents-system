import { Loader2 } from 'lucide-react';

export function DocumentacionLoadingView() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center h-screen bg-[#f7f8ff] gap-3">
      <Loader2 className="animate-spin text-neutral-400" size={24} />
      <span className="text-neutral-500 text-[13px]" style={{ fontWeight: 500 }}>Cargando datos de la fase...</span>
    </div>
  );
}
