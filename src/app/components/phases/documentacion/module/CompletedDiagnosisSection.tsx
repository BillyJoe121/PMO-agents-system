import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import type { AgentDiagnosis } from '../../../../hooks/useDocumentacion';
import DocumentacionDiagnosisView from '../DocumentacionDiagnosisView';
import { Agent9QuestionBank } from './Agent9QuestionBank';

type CompletedDiagnosisSectionProps = {
  diagnosis: AgentDiagnosis | null;
  agent9Status: 'idle' | 'processing' | 'done' | 'error';
  agent9Data: any;
  expandedDim: string | null;
  setExpandedDim: (dim: string | null) => void;
  triggerAgent9: () => void;
};

export function CompletedDiagnosisSection({
  diagnosis,
  agent9Status,
  agent9Data,
  expandedDim,
  setExpandedDim,
  triggerAgent9,
}: CompletedDiagnosisSectionProps) {
  if (!diagnosis) {
    return (
      <div className="rounded-2xl border border-neutral-200/70 bg-white p-7 text-center">
        <Sparkles size={20} className="text-neutral-300 mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-neutral-500 text-[13px]">El diagnóstico se cargará aquí una vez completado.</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <DocumentacionDiagnosisView diagnosis={diagnosis} />
      <div className="mt-2">
        <Agent9QuestionBank
          agent9Status={agent9Status}
          agent9Data={agent9Data}
          expandedDim={expandedDim}
          setExpandedDim={setExpandedDim}
          triggerAgent9={triggerAgent9}
        />
      </div>
    </motion.div>
  );
}
