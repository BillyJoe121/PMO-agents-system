import { motion } from 'motion/react';
import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-sm"
      >
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: '#e9ebef' }}>
          <Construction size={28} style={{ color: '#030213' }} />
        </div>
        <h1 className="text-gray-900 mb-2" style={{ fontWeight: 700, fontSize: '1.375rem' }}>
          {title}
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs" style={{ background: '#e9ebef', color: '#030213', fontWeight: 500 }}>
          Próximamente disponible
        </div>
      </motion.div>
    </div>
  );
}