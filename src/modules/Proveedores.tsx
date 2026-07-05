import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Truck, Phone, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { logAudit } from '../lib/audit';
import type { Proveedor } from '../lib/types';
import { Modal, Badge, EmptyState, PageHeader, ConfirmDialog, Toast } from '../components/ui';

export function Proveedores() {
  const { user } = useAuth();
  const [items, setItems] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Proveedor | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Proveedor | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Proveedor>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('proveedores').select('*').order('created_at', { ascending: false });
    setItems((data as Proveedor[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter((c) =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) || (c.numero_documento ?? '').includes(search)
  );

  const openNew = () => { setEditing(null); setForm({ activo: true }); setModalOpen(true); };
  const openEdit = (c: Proveedor) => { setEditing(c); setForm(c); setModalOpen(true); };

  const save = async () => {
    if (!form.nombre?.trim()) { setToast('El nombre es obligatorio'); return; }
    if (editing) {
      const prev = editing;
      const { error } = await supabase.from('proveedores').update({
        nombre: form.nombre, numero_documento: form.numero_documento, direccion: form.direccion,
        telefono: form.telefono, email: form.email, contacto: form.contacto,
        condiciones_comerciales: form.condiciones_comerciales, activo: form.activo, updated_by: user?.id,
      }).eq('id', editing.id);
      if (error) { setToast(error.message); return; }
      await logAudit({ modulo: 'proveedores', accion: 'UPDATE', tabla_afectada: 'proveedores', registro_id: editing.id, valor_previo: prev as any, valor_nuevo: form as any });
      setToast('Proveedor actualizado');
    } else {
      const { data, error } = await supabase.from('proveedores').insert({
        nombre: form.nombre, numero_documento: form.numero_documento, direccion: form.direccion,
        telefono: form.telefono, email: form.email, contacto: form.contacto,
        condiciones_comerciales: form.condiciones_comerciales, activo: true, created_by: user?.id,
      }).select().single();
      if (error) { setToast(error.message); return; }
      await logAudit({ modulo: 'proveedores', accion: 'INSERT', tabla_afectada: 'proveedores', registro_id: data.id, valor_nuevo: data as any });
      setToast('Proveedor creado');
    }
    setModalOpen(false);
    load();
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    await supabase.from('proveedores').delete().eq('id', confirmDelete.id);
    await logAudit({ modulo: 'proveedores', accion: 'DELETE', tabla_afectada: 'proveedores', registro_id: confirmDelete.id, valor_previo: confirmDelete as any });
    setToast('Proveedor eliminado');
    load();
  };

  return (
    <div>
      <PageHeader
        title="Proveedores"
        subtitle={`${items.length} proveedores registrados`}
        action={<button onClick={openNew} className="btn-primary"><Plus size={16} /> Nuevo proveedor</button>}
      />

      <div className="card">
        <div className="border-b border-slate-200 p-4">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Buscar por nombre o documento..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Cargando...</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Truck size={28} />} title="Sin proveedores" subtitle="Registre su primer proveedor." action={<button onClick={openNew} className="btn-primary"><Plus size={16} /> Nuevo proveedor</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Proveedor</th>
                  <th className="px-4 py-3 text-left font-semibold">Documento</th>
                  <th className="px-4 py-3 text-left font-semibold">Contacto</th>
                  <th className="px-4 py-3 text-left font-semibold">Condiciones</th>
                  <th className="px-4 py-3 text-center font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="table-row">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{c.nombre}</p>
                      {c.contacto && <p className="text-xs text-slate-500">{c.contacto}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.numero_documento ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.email && <p className="flex items-center gap-1 text-xs"><Mail size={12} /> {c.email}</p>}
                      {c.telefono && <p className="flex items-center gap-1 text-xs"><Phone size={12} /> {c.telefono}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{c.condiciones_comerciales ?? '—'}</td>
                    <td className="px-4 py-3 text-center"><Badge color={c.activo ? 'green' : 'slate'}>{c.activo ? 'Activo' : 'Inactivo'}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(c)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-sky-700"><Pencil size={15} /></button>
                        <button onClick={() => setConfirmDelete(c)} className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar proveedor' : 'Nuevo proveedor'}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Nombre / Razón social *</label>
            <input className="input" value={form.nombre ?? ''} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </div>
          <div>
            <label className="label">Número de documento</label>
            <input className="input" value={form.numero_documento ?? ''} onChange={(e) => setForm({ ...form, numero_documento: e.target.value })} />
          </div>
          <div>
            <label className="label">Contacto</label>
            <input className="input" value={form.contacto ?? ''} onChange={(e) => setForm({ ...form, contacto: e.target.value })} />
          </div>
          <div>
            <label className="label">Teléfono</label>
            <input className="input" value={form.telefono ?? ''} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Dirección</label>
            <input className="input" value={form.direccion ?? ''} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Condiciones comerciales</label>
            <input className="input" value={form.condiciones_comerciales ?? ''} onChange={(e) => setForm({ ...form, condiciones_comerciales: e.target.value })} placeholder="Contado / 30 días / Crédito 60 días" />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
          <button onClick={save} className="btn-primary">{editing ? 'Guardar cambios' : 'Crear proveedor'}</button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Eliminar proveedor"
        message={`¿Eliminar a "${confirmDelete?.nombre}"?`}
        confirmLabel="Eliminar"
        danger
      />

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
