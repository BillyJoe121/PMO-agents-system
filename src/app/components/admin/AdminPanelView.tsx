/**
 * AdminPanelView — Módulo 12: Panel de Administración
 * Conectado a Supabase: profiles (usuarios) + banco_preguntas
 */

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, BookOpen, Cpu } from 'lucide-react';
import IcesiLogo from '../brand/IcesiLogo';
import { ModelsSection } from './admin-panel/ModelsSection';
import { QuestionsSection } from './admin-panel/QuestionsSection';
import { UsersSection } from './admin-panel/UsersSection';
import type { AdminSection } from './admin-panel/types';
export default function AdminPanelView() {
  const [activeSection, setActiveSection] = useState<AdminSection>('usuarios');

  const navItems: { id: AdminSection; label: string; icon: ReactNode; count?: number }[] = [
    { id: 'usuarios', label: 'Gestión de Usuarios', icon: <Users size={16} /> },
    { id: 'preguntas', label: 'Banco de Preguntas', icon: <BookOpen size={16} /> },
    { id: 'modelos', label: 'Modelos de IA', icon: <Cpu size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Admin Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <IcesiLogo variant="positive" className="brand-logo-mark h-9 w-auto" />
            <div>
              <p className="text-gray-900 text-sm" style={{ fontWeight: 700 }}>Panel Admin</p>
              <p className="text-gray-400 text-xs">PMO Intelligence</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                activeSection === item.id
                  ? 'text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              style={activeSection === item.id ? { background: '#5454e9', fontWeight: 600 } : { fontWeight: 500 }}
            >
              <span className={activeSection === item.id ? 'text-white' : 'text-gray-400'}>
                {item.icon}
              </span>
              <span className="flex-1 text-sm">{item.label}</span>
              {item.count !== undefined && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    activeSection === item.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                  style={{ fontWeight: 600 }}
                >
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-amber-700 text-xs leading-relaxed" style={{ fontWeight: 500 }}>
              Las acciones de administración requieren permisos de nivel Admin.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="px-8 py-8 max-w-5xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {activeSection === 'usuarios' && <UsersSection />}
              {activeSection === 'preguntas' && <QuestionsSection />}
              {activeSection === 'modelos' && <ModelsSection />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
