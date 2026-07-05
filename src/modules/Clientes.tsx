import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Users, Phone, Mail } from 'lucide-react';
import { supabase, formatCurrency } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { logAudit } from '../lib/audit';
import type { Cliente } from '../lib/types';
import { Modal, Badge, EmptyState, PageHeader, ConfirmDialog, Toast } from '../components/ui';

export function Clientes() {
  const { user } = useAuth();
  const [items, setItems] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Cliente | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Cliente>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('clientes').select('*').order('created_at', { ascending: false });
    setItems((data as Cliente[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter((c) =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (c.numero_documento ?? '').includes(search) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditing(null);
    setForm({ tipo_documento: 'RUC', activo: true, limite_credito: 0, saldo: 0 });
    setModalOpen(true);
  };

  const openEdit = (c: Cliente) => {
    setEditing(c);
    setForm(c);
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.nombre || !form.nombre.trim()) { setToast('El nombre es obligatorio'); return; }
    if (editing) {
      const prev = editing;
      const { error } = await supabase.from('clientes').update({
        nombre: form.nombre, tipo_documento: form.tipo_documento, numero_documento: form.numero_documento,
        direccion: form.direccion, telefono: form.telefono, email: form.email,
        limite_credito: Number(form.limite_credito) || 0, condiciones_pago: form.condiciones_pago,
        contacto: form.contacto, activo: form.activo, updated_by: user?.id,
      }).eq('id', editing.id);
      if (error) { setToast(error.message); return; }
      await logAudit({ modulo: 'clientes', accion: 'UPDATE', tabla_afectada: 'clientes', registro_id: editing.id, valor_previo: prev as any, valor_nuevo: form as any });
      setToast('Cliente actualizado');
    } else {
      const { data, error } = await supabase.from('clientes').insert({
        nombre: form.nombre, tipo_documento: form.tipo_documento, numero_documento: form.numero_documento,
        direccion: form.direccion, telefono: form.telefono, email: form.email,
        limite_credito: Number(form.limite_credito) || 0, saldo: 0, condiciones_pago: form.condiciones_pago,
        contacto: form.contacto, activo: true, created_by: user?.id,
      }).select().single();
      if (error) { setToast(error.message); return; }
      await logAudit({ modulo: 'clientes', accion: 'INSERT', tabla_afectada: 'clientes', registro_id: data.id, valor_nuevo: data as any });
      setToast('Cliente creado');
    }
    setModalOpen(false);
    load();
  };

  const toggleActive = async (c: Cliente) => {
    await supabase.from('clientes').update({ activo: !c.activo, updated_by: user?.id }).eq('id', c.id);
    await logAudit({ modulo: 'clientes', accion: 'UPDATE', tabla_afectada: 'clientes', registro_id: c.id, valor_previo: { activo: c.activo }, valor_nuevo: { activo: !c.activo } });
    load();
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase.from('clientes').delete().eq('id', confirmDelete.id);
    if (error) { setToast(error.message); setConfirmDelete(null); return; }
    await logAudit({ modulo: 'clientes', accion: 'DELETE', tabla_afectada: 'clientes', registro_id: confirmDelete.id, valor_previo: confirmDelete as any });
    setToast('Cliente eliminado');
    load();
  };

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={`${items.length} clientes registrados`}
        action={<button onClick={openNew} className="btn-primary"><Plus size={16} /> Nuevo cliente</button>}
      />

      <div className="card">
        <div className="border-b border-slate-200 p-4">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Buscar por nombre, documento o email..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Cargando...</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Users size={28} />} title="Sin clientes" subtitle="Registre su primer cliente para comenzar." action={<button onClick={openNew} className="btn-primary"><Plus size={16} /> Nuevo cliente</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                  <th className="px-4 py-3 text-left font-semibold">Documento</th>
                  <th className="px-4 py-3 text-left font-semibold">Contacto</th>
                  <th className="px-4 py-3 text-right font-semibold">Límite crédito</th>
                  <th className="px-4 py-3 text-right font-semibold">Saldo</th>
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
                    <td className="px-4 py-3 text-slate-600">{c.tipo_documento}: {c.numero_documento ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.email && <p className="flex items-center gap-1 text-xs"><Mail size={12} /> {c.email}</p>}
                      {c.telefono && <p className="flex items-center gap-1 text-xs"><Phone size={12} /> {c.telefono}</p>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">{formatCurrency(c.limite_credito)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(c.saldo)}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleActive(c)}>
                        <Badge color={c.activo ? 'green' : 'slate'}>{c.activo ? 'Activo' : 'Inactivo'}</Badge>
                      </button>
                    </td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar cliente' : 'Nuevo cliente'}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Nombre / Razón social *</label>
            <input className="input" value={form.nombre ?? ''} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </div>
          <div>
            <label className="label">Tipo documento</label>
            <select className="input" value={form.tipo_documento ?? 'RUC'} onChange={(e) => setForm({ ...form, tipo_documento: e.target.value })}>
              <option>RUC</option><option>DNI</option><option>CE</option><option>Pasaporte</option>
            </select>
          </div>
          <div>
            <label className="label">Número documento</label>
            <input className="input" value={form.numero_documento ?? ''} onChange={(e) => setForm({ ...form, numero_documento: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Dirección</label>
            <input className="input" value={form.direccion ?? ''} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
          </div>
          <div>
            <label className="label">Teléfono</label>
            <input className="input" value={form.telefono ?? ''} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Contacto</label>
            <input className="input" value={form.contacto ?? ''} onChange={(e) => setForm({ ...form, contacto: e.target.value })} />
          </div>
          <div>
            <label className="label">Condiciones de pago</label>
            <input className="input" value={form.condiciones_pago ?? ''} onChange={(e) => setForm({ ...form, condiciones_pago: e.target.value })} placeholder="Contado / 30 días" />
          </div>
          <div>
            <label className="label">Límite de crédito</label>
            <input type="number" className="input" value={form.limite_credito ?? 0} onChange={(e) => setForm({ ...form, limite_credito: Number(e.target.value) })} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
          <button onClick={save} className="btn-primary">{editing ? 'Guardar cambios' : 'Crear cliente'}</button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Eliminar cliente"
        message={`¿Eliminar a "${confirmDelete?.nombre}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
      />

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
