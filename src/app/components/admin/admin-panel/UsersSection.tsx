import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Ban, Calendar, CheckCircle2, ChevronDown, ChevronUp, Edit2, Loader2, Mail, MoreVertical, Plus, Save, Search, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminUsers, type AuditorUser, type UserRole } from '../../../hooks/useAdmin';
import { RoleBadge, StatusDot } from './shared';

function CreateUserDrawer({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (name: string, email: string, password: string, role: UserRole) => Promise<void> }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'auditor' as UserRole, password: '' });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name || !form.email || !form.password) {
      toast.error('Completa todos los campos requeridos.');
      return;
    }
    setIsSaving(true);
    try {
      await onSave(form.name, form.email, form.password, form.role as UserRole);
      onClose();
      toast.success(`Auditor "${form.name}" creado exitosamente.`);
    } catch (err) {
      toast.error('Error creando el usuario. Verifica que el email no esté registrado.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="flex-1 bg-black/30 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-96 bg-white h-full shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h3 className="text-gray-900" style={{ fontWeight: 700 }}>Crear Auditor</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div>
                <label className="block text-gray-700 text-sm mb-1.5" style={{ fontWeight: 600 }}>Nombre completo *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ej: María Pérez"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm mb-1.5" style={{ fontWeight: 600 }}>Correo institucional *</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="usuario@icesi.edu.co"
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-gray-700 text-sm mb-1.5" style={{ fontWeight: 600 }}>Contraseña inicial *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm mb-1.5" style={{ fontWeight: 600 }}>Rol asignado</label>
                <select
                  value={form.role}
                  onChange={e => setForm(p => ({ ...p, role: e.target.value as UserRole }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all bg-white"
                >
                  <option value="Auditor">Auditor</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 text-sm hover:bg-gray-50 transition-colors" style={{ fontWeight: 500 }}>
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-xl text-white text-sm flex items-center justify-center gap-2 disabled:opacity-70"
                style={{ background: '#5454e9', fontWeight: 600 }}
              >
                {isSaving ? <><Loader2 size={14} className="animate-spin" /> Creando...</> : <><Plus size={14} /> Crear Auditor</>}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function EditUserDrawer({ user, onClose, onSave }: { user: AuditorUser | null; onClose: () => void; onSave: (id: string, name: string, role: UserRole) => Promise<void> }) {
  const [form, setForm] = useState({ name: user?.name || '', role: user?.role || 'auditor' as UserRole });
  const [isSaving, setIsSaving] = useState(false);

  // Sync form when user prop changes
  // We can just rely on the key prop changing to remount or use an effect
  // useEffect is already imported at the top of the file
  
  const handleSave = async () => {
    if (!form.name || !user) {
      toast.error('El nombre es requerido.');
      return;
    }
    setIsSaving(true);
    try {
      await onSave(user.id, form.name, form.role as UserRole);
      onClose();
      toast.success(`Usuario actualizado exitosamente.`);
    } catch (err) {
      toast.error('Error al actualizar el usuario.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} className="flex-1 bg-black/30 backdrop-blur-sm"
        />
        <motion.div
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-96 bg-white h-full shadow-2xl flex flex-col"
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <h3 className="text-gray-900" style={{ fontWeight: 700 }}>Editar Usuario</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div>
              <label className="block text-gray-700 text-sm mb-1.5" style={{ fontWeight: 600 }}>Nombre completo *</label>
              <input
                type="text"
                defaultValue={user.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all"
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm mb-1.5" style={{ fontWeight: 600 }}>Rol asignado</label>
              <select
                defaultValue={user.role}
                onChange={e => setForm(p => ({ ...p, role: e.target.value as UserRole }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all bg-white"
              >
                <option value="auditor">Auditor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="p-5 border-t border-gray-100 flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 text-sm hover:bg-gray-50 transition-colors" style={{ fontWeight: 500 }}>
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl text-white text-sm flex items-center justify-center gap-2 disabled:opacity-70"
              style={{ background: '#5454e9', fontWeight: 600 }}
            >
              {isSaving ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : <><Save size={14} /> Guardar</>}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

/* ── Users Section ── */
function UsersSection() {
  const { users, isLoading: loadingUsers, createUser, toggleUserActive, updateUser } = useAdminUsers();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<AuditorUser | null>(null);
  const [sortField, setSortField] = useState<'name' | 'role' | 'lastAccess'>('name');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(p => !p);
    else { setSortField(field); setSortAsc(true); }
  };

  const handleToggleActive = async (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    try {
      await toggleUserActive(id, user.active);
      toast.success(`Cuenta de ${user.name} ${user.active ? 'desactivada' : 'activada'}.`);
    } catch (err) {
      toast.error('Error al cambiar el estado del usuario.');
    }
  };

  const filtered = users
    .filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const va = a[sortField]; const vb = b[sortField];
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ChevronDown size={12} className="text-gray-300" />;
    return sortAsc ? <ChevronUp size={12} className="text-zinc-700" /> : <ChevronDown size={12} className="text-zinc-700" />;
  };

  return (
    <>
      {loadingUsers && (
        <div className="flex items-center gap-2 text-gray-400 text-sm mb-4">
          <Loader2 size={14} className="animate-spin" /> Cargando usuarios...
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-gray-900" style={{ fontWeight: 700 }}>Gestión de Auditores</h2>
          <p className="text-gray-500 text-sm mt-0.5">{users.length} usuarios registrados · {users.filter(u => u.active).length} activos</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm hover:opacity-90 transition-opacity"
          style={{ background: '#5454e9', fontWeight: 600 }}
        >
          <Plus size={15} />+ Crear Auditor
        </button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o email..."
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all bg-white"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {[
                { label: 'Nombre', field: 'name' as const },
                { label: 'Email', field: null },
                { label: 'Rol', field: 'role' as const },
                { label: 'Último acceso', field: 'lastAccess' as const },
                { label: 'Estado', field: null },
                { label: 'Acciones', field: null },
              ].map(col => (
                <th
                  key={col.label}
                  className={`text-left px-4 py-3 text-gray-500 text-xs uppercase tracking-wide ${col.field ? 'cursor-pointer hover:text-gray-700 select-none' : ''}`}
                  style={{ fontWeight: 600 }}
                  onClick={() => col.field && handleSort(col.field)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.field && <SortIcon field={col.field} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((user, i) => (
              <tr
                key={user.id}
                className={`border-b border-gray-100 hover:bg-gray-50/60 transition-colors ${!user.active ? 'opacity-60' : ''}`}
              >
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs flex-shrink-0"
                      style={{ background: ['#5454e9', '#059669', '#7c3aed', '#dc2626', '#d97706'][i % 5], fontWeight: 700 }}
                    >
                      {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <span className="text-gray-800" style={{ fontWeight: 500 }}>{user.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-gray-500 text-xs">{user.email}</td>
                <td className="px-4 py-3.5"><RoleBadge role={user.role} /></td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                    <Calendar size={11} />
                    {user.lastAccess}
                  </div>
                </td>
                <td className="px-4 py-3.5"><StatusDot active={user.active} /></td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingUser(user)}
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleToggleActive(user.id)}
                      className={`p-1.5 rounded-lg transition-colors ${user.active ? 'hover:bg-red-50 text-gray-400 hover:text-red-500' : 'hover:bg-green-50 text-gray-400 hover:text-green-600'}`}
                      title={user.active ? 'Desactivar' : 'Activar'}
                    >
                      {user.active ? <Ban size={13} /> : <CheckCircle2 size={13} />}
                    </button>
                    <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                      <MoreVertical size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No se encontraron auditores</p>
          </div>
        )}
      </div>

      <CreateUserDrawer open={showCreate} onClose={() => setShowCreate(false)} onSave={createUser} />
      <EditUserDrawer key={editingUser?.id || 'empty'} user={editingUser} onClose={() => setEditingUser(null)} onSave={updateUser} />
    </>
  );
}


export { UsersSection };