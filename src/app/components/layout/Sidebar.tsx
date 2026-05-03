import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import {
  LayoutDashboard,
  Settings,
  LogOut,
  ChevronRight,
  Shield,
  Trash2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SoundToggleButton } from '../ui/SoundToggleButton';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { icon: <LayoutDashboard size={20} />, label: 'Inicio', path: '/dashboard' },
  { icon: <Settings size={20} />, label: 'Ajustes', path: '/dashboard/admin' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useApp();

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    // TODO: Supabase Auth - Manejar sesión de 8h en componentes de login.
    navigate('/');
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-[72px] flex flex-col items-center py-6 z-50 border-r border-gray-100 bg-white shadow-sm print:hidden">
      {/* Logo */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-8 flex-shrink-0 cursor-pointer"
        style={{ background: '#030213' }}
        onClick={() => navigate('/dashboard')}
      >
        <span className="text-white text-sm" style={{ fontWeight: 700 }}>IC</span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 flex-1 w-full px-2">
        {navItems.map(item => {
          const active = isActive(item.path);
          return (
            <motion.button
              key={item.path}
              onClick={() => navigate(item.path)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title={item.label}
              className={`relative w-full h-12 rounded-xl flex items-center justify-center transition-all group
                ${active
                  ? 'text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                }`}
              style={active ? { background: '#030213' } : {}}
            >
              {item.icon}
              {active && (
                <motion.div
                  layoutId="sidebar-indicator"
                  className="absolute right-0 w-1 h-6 rounded-l-full"
                  style={{ background: '#030213' }}
                />
              )}
              {/* Tooltip */}
              <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                {item.label}
                <ChevronRight size={10} className="inline ml-1" />
              </div>
            </motion.button>
          );
        })}

        <>
          <div className="w-8 h-px bg-gray-100 my-2 mx-auto" />
          <motion.button
            onClick={() => navigate('/dashboard/papelera')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Papelera"
            className={`relative w-full h-12 rounded-xl flex items-center justify-center transition-all group
              ${isActive('/dashboard/papelera')
                ? 'text-white shadow-md'
                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
              }`}
            style={isActive('/dashboard/papelera') ? { background: '#030213' } : {}}
          >
            <Trash2 size={20} />
            <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
              Papelera
              <ChevronRight size={10} className="inline ml-1" />
            </div>
          </motion.button>
        </>
      </nav>

      {/* User avatar + Logout */}
      <div className="flex flex-col items-center gap-3 w-full px-2">
        {/* Sound toggle */}
        <SoundToggleButton variant="sidebar" className="w-full" />

        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0"
          style={{ background: currentUser.color, fontWeight: 600 }}
          title={currentUser.name}
        >
          {currentUser.initials}
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleLogout}
          title="Cerrar sesión"
          className="w-full h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all group"
        >
          <LogOut size={18} />
          <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            Cerrar sesión
          </div>
        </motion.button>
      </div>
    </aside>
  );
}