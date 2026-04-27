import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Search, Plus, ChevronDown, FolderOpen, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useApp, MOCK_AUDITORS } from '../../context/AppContext';
import ProjectCard from './ProjectCard';
import NewProjectModal from './NewProjectModal';

type Tab = 'en_ejecucion' | 'completado';

export default function Dashboard() {
  const { projects, currentUser, addProject } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('en_ejecucion');
  const [search, setSearch] = useState('');
  const [filterAuditor, setFilterAuditor] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [showModal, setShowModal] = useState(false);

  // TODO: fetch('public.proyectos').select('*, profiles(*)')
  // TODO: Implementar búsqueda local (client-side filtering)
  // RF-HOME-05: Validar que el usuario actual esté en la lista de asignados o sea Admin

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchTab = p.status === activeTab;
      const matchSearch = !search || p.companyName.toLowerCase().includes(search.toLowerCase()) || p.projectName.toLowerCase().includes(search.toLowerCase());
      const matchAuditor = !filterAuditor || p.auditors.some(c => c.id === filterAuditor);
      const matchEstado = !filterEstado || p.status === filterEstado;
      return matchTab && matchSearch && matchAuditor && matchEstado;
    });
  }, [projects, activeTab, search, filterAuditor, filterEstado]);

  const handleNewProject = (data: { companyName: string; projectName: string; auditors: any[]; startDate: string }) => {
    // TODO: Mutación insert en public.proyectos y public.fases_estado
    addProject(data);
    toast.success('Proyecto creado exitosamente', {
      description: `${data.projectName} para ${data.companyName} ha sido registrado.`,
    });
  };

  const tabs = [
    { key: 'en_ejecucion' as Tab, label: 'En Ejecución', icon: <FolderOpen size={15} />, count: projects.filter(p => p.status === 'en_ejecucion').length },
    { key: 'completado' as Tab, label: 'Completados', icon: <CheckSquare size={15} />, count: projects.filter(p => p.status === 'completado').length },
  ];

  return (
    <div className="min-h-screen p-8">
      {/* Top Bar */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-gray-900" style={{ fontWeight: 700, fontSize: '1.5rem' }}>
            Mis Proyectos
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Bienvenido, {currentUser.name} · {projects.length} proyectos en total
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm shadow-sm hover:shadow-md transition-all flex-shrink-0"
          style={{ background: '#030213', fontWeight: 600 }}
        >
          <Plus size={16} />
          Nuevo Proyecto
        </motion.button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por empresa o proyecto..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all"
          />
        </div>

        {/* Auditor filter */}
        <div className="relative">
          <select
            value={filterAuditor}
            onChange={e => setFilterAuditor(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 transition-all text-gray-600 cursor-pointer"
          >
            <option value="">Todos los auditores</option>
            {MOCK_AUDITORS.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Estado filter */}
        <div className="relative">
          <select
            value={filterEstado}
            onChange={e => setFilterEstado(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 transition-all text-gray-600 cursor-pointer"
          >
            <option value="">Todos los estados</option>
            <option value="en_ejecucion">En ejecución</option>
            <option value="completado">Completado</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all
              ${activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
              }`}
            style={{ fontWeight: activeTab === tab.key ? 600 : 400 }}
          >
            {tab.icon}
            {tab.label}
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              activeTab === tab.key ? 'bg-zinc-100 text-zinc-800' : 'bg-gray-200 text-gray-500'
            }`} style={{ fontWeight: 600 }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Projects Grid */}
      {filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project, i) => (
            <ProjectCard key={project.id} project={project} index={i} />
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <FolderOpen size={28} className="text-gray-400" />
          </div>
          <p className="text-gray-700 mb-1" style={{ fontWeight: 600 }}>No se encontraron proyectos</p>
          <p className="text-gray-400 text-sm">
            {search ? `No hay resultados para "${search}"` : 'Cree un nuevo proyecto para comenzar.'}
          </p>
          {!search && (
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm"
              style={{ background: '#030213', fontWeight: 500 }}
            >
              <Plus size={14} /> Nuevo Proyecto
            </button>
          )}
        </motion.div>
      )}

      {/* New Project Modal */}
      <NewProjectModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleNewProject}
      />
    </div>
  );
}