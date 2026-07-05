import { useEffect, useState } from 'react';
import { UsersRound, Search, Pencil, Lock, Unlock } from 'lucide-react';
import { supabase, formatDate } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { logAudit } from '../lib/audit';
import type { Usuario, Rol } from '../lib/types';
import { Modal, Badge, EmptyState, PageHeader, Toast } from '../components/ui';

export function Usuarios() {
  const { usuario: currentUser } = useAuth();
  const [items, setItems] = useState<Usuario[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editOpen, setEditOpen] = useState<Usuario | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState<{ rol_id: string; nombre: string; activo: boolean }>({ rol_id: '', nombre: '', activo: true });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('usuarios').select('*, rol:roles(*)').order('created_at', { ascending: false });
    const { data: r } = await supabase.from('roles').select('*').order('nombre');
    setItems((data as Usuario[]) ?? []);
    setRoles((r as Rol[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter((u) =>
    u.nombre.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (u: Usuario) => {
    setEditOpen(u);
    setForm({ rol_id: u.rol_id ?? '', nombre: u.nombre, activo: u.activo });
  };

  const save = async () => {
    if (!editOpen) return;
    const prev = editOpen;
    const { error } = await supabase.from('usuarios').update({
      rol_id: form.rol_id || null, nombre: form.nombre, activo: form.activo,
    }).eq('id', editOpen.id);
    if (error) { setToast(error.message); return; }
    await logAudit({ modulo: 'usuarios', accion: 'UPDATE', tabla_afectada: 'usuarios', registro_id: editOpen.id, valor_previo: prev as any, valor_nuevo: form as any });
    setToast('Usuario actualizado');
    setEditOpen(null);
    load();
  };

  const toggleActive = async (u: Usuario) => {
    await supabase.from('usuarios').update({ activo: !u.activo }).eq('id', u.id);
    await logAudit({ modulo: 'usuarios', accion: u.activo ? 'LOCK' : 'UNLOCK', tabla_afectada: 'usuarios', registro_id: u.id, valor_previo: { activo: u.activo }, valor_nuevo: { activo: !u.activo } });
    setToast(u.activo ? 'Usuario bloqueado' : 'Usuario desbloqueado');
    load();
  };

  return (
    <div>
      <PageHeader title="Usuarios" subtitle={`${items.length} usuarios registrados`} />

      <div className="card">
        <div className="border-b border-slate-200 p-4">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Buscar por nombre o email..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Cargando...</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<UsersRound size={28} />} title="Sin usuarios" subtitle="Los usuarios registrados aparecerán aquí." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Usuario</th>
                  <th className="px-4 py-3 text-left font-semibold">Email</th>
                  <th className="px-4 py-3 text-left font-semibold">Rol</th>
                  <th className="px-4 py-3 text-left font-semibold">Registro</th>
                  <th className="px-4 py-3 text-center font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="table-row">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">{u.nombre.charAt(0).toUpperCase()}</div>
                        <span className="font-semibold text-slate-800">{u.nombre}</span>
                        {u.id === currentUser?.id && <Badge color="sky">Tú</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3"><Badge color="purple">{u.rol?.nombre ?? 'Sin rol'}</Badge></td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-center"><Badge color={u.activo ? 'green' : 'red'}>{u.activo ? 'Activo' : 'Bloqueado'}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(u)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-sky-700"><Pencil size={15} /></button>
                        <button onClick={() => toggleActive(u)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-amber-600" title={u.activo ? 'Bloquear' : 'Desbloquear'}>
                          {u.activo ? <Lock size={15} /> : <Unlock size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!editOpen} onClose={() => setEditOpen(null)} title="Editar usuario">
        <div className="space-y-4">
          <div>
            <label className="label">Nombre</label>
            <input className="input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </div>
          <div>
            <label className="label">Rol</label>
            <select className="input" value={form.rol_id} onChange={(e) => setForm({ ...form, rol_id: e.target.value })}>
              <option value="">Sin rol</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre} — {r.descripcion ?? ''}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Estado</label>
            <select className="input" value={form.activo ? '1' : '0'} onChange={(e) => setForm({ ...form, activo: e.target.value === '1' })}>
              <option value="1">Activo</option>
              <option value="0">Bloqueado</option>
            </select>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setEditOpen(null)} className="btn-secondary">Cancelar</button>
          <button onClick={save} className="btn-primary">Guardar</button>
        </div>
      </Modal>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
