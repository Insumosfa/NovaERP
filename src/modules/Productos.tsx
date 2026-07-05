import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Package, Barcode, Tag } from 'lucide-react';
import { supabase, formatCurrency } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { logAudit } from '../lib/audit';
import type { Producto, Categoria, Marca } from '../lib/types';
import { Modal, EmptyState, PageHeader, ConfirmDialog, Toast } from '../components/ui';

export function Productos() {
  const { user } = useAuth();
  const [items, setItems] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editing, setEditing] = useState<Producto | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Producto | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Producto>>({});

  const load = async () => {
    setLoading(true);
    const [p, c, m] = await Promise.all([
      supabase.from('productos').select('*, categoria:categorias(*), marca:marcas(*)').order('created_at', { ascending: false }),
      supabase.from('categorias').select('*').order('nombre'),
      supabase.from('marcas').select('*').order('nombre'),
    ]);
    setItems((p.data as Producto[]) ?? []);
    setCategorias((c.data as Categoria[]) ?? []);
    setMarcas((m.data as Marca[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter((p) =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    (p.codigo_barras ?? '').includes(search)
  );

  const openNew = () => {
    setEditing(null);
    setForm({ unidad: 'UND', activo: true, costo: 0, precio: 0, stock: 0, stock_minimo: 0 });
    setModalOpen(true);
  };

  const openEdit = (p: Producto) => { setEditing(p); setForm(p); setModalOpen(true); };

  const save = async () => {
    if (!form.nombre?.trim()) { setToast('El nombre es obligatorio'); return; }
    if (!form.sku?.trim()) { setToast('El SKU es obligatorio'); return; }
    const payload = {
      nombre: form.nombre, sku: form.sku, codigo_barras: form.codigo_barras,
      descripcion: form.descripcion, categoria_id: form.categoria_id, marca_id: form.marca_id,
      unidad: form.unidad, costo: Number(form.costo) || 0, precio: Number(form.precio) || 0,
      stock: Number(form.stock) || 0, stock_minimo: Number(form.stock_minimo) || 0,
      activo: form.activo,
    };
    if (editing) {
      const { error } = await supabase.from('productos').update({ ...payload, updated_by: user?.id }).eq('id', editing.id);
      if (error) { setToast(error.message); return; }
      await logAudit({ modulo: 'productos', accion: 'UPDATE', tabla_afectada: 'productos', registro_id: editing.id, valor_previo: editing as any, valor_nuevo: payload as any });
      setToast('Producto actualizado');
    } else {
      const { data, error } = await supabase.from('productos').insert({ ...payload, created_by: user?.id }).select().single();
      if (error) { setToast(error.message); return; }
      await logAudit({ modulo: 'productos', accion: 'INSERT', tabla_afectada: 'productos', registro_id: data.id, valor_nuevo: data as any });
      setToast('Producto creado');
    }
    setModalOpen(false);
    load();
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase.from('productos').delete().eq('id', confirmDelete.id);
    if (error) { setToast(error.message); setConfirmDelete(null); return; }
    await logAudit({ modulo: 'productos', accion: 'DELETE', tabla_afectada: 'productos', registro_id: confirmDelete.id, valor_previo: confirmDelete as any });
    setToast('Producto eliminado');
    load();
  };

  const addCategoria = async (nombre: string) => {
    if (!nombre.trim()) return;
    const { data, error } = await supabase.from('categorias').insert({ nombre: nombre.trim() }).select().single();
    if (error) { setToast(error.message); return; }
    setCategorias([...categorias, data as Categoria]);
  };

  const addMarca = async (nombre: string) => {
    if (!nombre.trim()) return;
    const { data, error } = await supabase.from('marcas').insert({ nombre: nombre.trim() }).select().single();
    if (error) { setToast(error.message); return; }
    setMarcas([...marcas, data as Marca]);
  };

  return (
    <div>
      <PageHeader
        title="Productos"
        subtitle={`${items.length} productos en catálogo`}
        action={
          <div className="flex gap-2">
            <button onClick={() => setCatModalOpen(true)} className="btn-secondary"><Tag size={16} /> Categorías / Marcas</button>
            <button onClick={openNew} className="btn-primary"><Plus size={16} /> Nuevo producto</button>
          </div>
        }
      />

      <div className="card">
        <div className="border-b border-slate-200 p-4">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Buscar por nombre, SKU o código de barras..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Cargando...</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Package size={28} />} title="Sin productos" subtitle="Registre su primer producto." action={<button onClick={openNew} className="btn-primary"><Plus size={16} /> Nuevo producto</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Producto</th>
                  <th className="px-4 py-3 text-left font-semibold">SKU</th>
                  <th className="px-4 py-3 text-left font-semibold">Categoría</th>
                  <th className="px-4 py-3 text-left font-semibold">Marca</th>
                  <th className="px-4 py-3 text-right font-semibold">Costo</th>
                  <th className="px-4 py-3 text-right font-semibold">Precio</th>
                  <th className="px-4 py-3 text-right font-semibold">Stock</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const lowStock = Number(p.stock) <= Number(p.stock_minimo) && Number(p.stock_minimo) > 0;
                  return (
                    <tr key={p.id} className="table-row">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{p.nombre}</p>
                        {p.codigo_barras && <p className="flex items-center gap-1 text-xs text-slate-500"><Barcode size={11} /> {p.codigo_barras}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs">{p.sku}</td>
                      <td className="px-4 py-3 text-slate-600">{p.categoria?.nombre ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{p.marca?.nombre ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(p.costo)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(p.precio)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold ${lowStock ? 'text-red-600' : 'text-slate-900'}`}>{Number(p.stock)} {p.unidad}</span>
                        {lowStock && <p className="text-xs text-red-500">Stock bajo</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(p)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-sky-700"><Pencil size={15} /></button>
                          <button onClick={() => setConfirmDelete(p)} className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stock is managed exclusively via Inventario adjustments — the edit form
          intentionally omits the 'Stock actual' field to preserve the kardex audit trail */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar producto' : 'Nuevo producto'} size="lg">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="label">Nombre *</label>
            <input className="input" value={form.nombre ?? ''} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </div>
          <div>
            <label className="label">Unidad</label>
            <select className="input" value={form.unidad ?? 'UND'} onChange={(e) => setForm({ ...form, unidad: e.target.value })}>
              <option>UND</option><option>KG</option><option>LT</option><option>M</option><option>CAJA</option>
            </select>
          </div>
          <div>
            <label className="label">SKU *</label>
            <input className="input font-mono" value={form.sku ?? ''} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
          <div>
            <label className="label">Código de barras</label>
            <input className="input font-mono" value={form.codigo_barras ?? ''} onChange={(e) => setForm({ ...form, codigo_barras: e.target.value })} />
          </div>
          <div>
            <label className="label">Categoría</label>
            <select className="input" value={form.categoria_id ?? ''} onChange={(e) => setForm({ ...form, categoria_id: e.target.value || null })}>
              <option value="">Sin categoría</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Marca</label>
            <select className="input" value={form.marca_id ?? ''} onChange={(e) => setForm({ ...form, marca_id: e.target.value || null })}>
              <option value="">Sin marca</option>
              {marcas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Costo (S/)</label>
            <input type="number" step="0.01" className="input" value={form.costo ?? 0} onChange={(e) => setForm({ ...form, costo: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Precio (S/)</label>
            <input type="number" step="0.01" className="input" value={form.precio ?? 0} onChange={(e) => setForm({ ...form, precio: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Stock mínimo</label>
            <input type="number" step="0.01" className="input" value={form.stock_minimo ?? 0} onChange={(e) => setForm({ ...form, stock_minimo: Number(e.target.value) })} />
          </div>
          <div className="sm:col-span-3">
            <label className="label">Descripción</label>
            <textarea className="input" rows={2} value={form.descripcion ?? ''} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
          <button onClick={save} className="btn-primary">{editing ? 'Guardar cambios' : 'Crear producto'}</button>
        </div>
      </Modal>

      <CategoriaMarcaModal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        categorias={categorias}
        marcas={marcas}
        onAddCat={addCategoria}
        onAddMarca={addMarca}
        onReload={load}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Eliminar producto"
        message={`¿Eliminar "${confirmDelete?.nombre}"?`}
        confirmLabel="Eliminar"
        danger
      />

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

function CategoriaMarcaModal({
  open, onClose, categorias, marcas, onAddCat, onAddMarca, onReload,
}: {
  open: boolean;
  onClose: () => void;
  categorias: Categoria[];
  marcas: Marca[];
  onAddCat: (n: string) => void;
  onAddMarca: (n: string) => void;
  onReload: () => void;
}) {
  const [newCat, setNewCat] = useState('');
  const [newMar, setNewMar] = useState('');

  const deleteCat = async (id: string) => {
    await supabase.from('categorias').delete().eq('id', id);
    onReload();
  };
  const deleteMar = async (id: string) => {
    await supabase.from('marcas').delete().eq('id', id);
    onReload();
  };

  return (
    <Modal open={open} onClose={onClose} title="Categorías y Marcas">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-700">Categorías</h4>
          <div className="flex gap-2 mb-3">
            <input className="input" placeholder="Nueva categoría" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
            <button onClick={() => { onAddCat(newCat); setNewCat(''); }} className="btn-primary shrink-0"><Plus size={16} /></button>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {categorias.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5 text-sm">
                <span>{c.nombre}</span>
                <button onClick={() => deleteCat(c.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            ))}
            {categorias.length === 0 && <p className="text-xs text-slate-400">Sin categorías</p>}
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-700">Marcas</h4>
          <div className="flex gap-2 mb-3">
            <input className="input" placeholder="Nueva marca" value={newMar} onChange={(e) => setNewMar(e.target.value)} />
            <button onClick={() => { onAddMarca(newMar); setNewMar(''); }} className="btn-primary shrink-0"><Plus size={16} /></button>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {marcas.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5 text-sm">
                <span>{m.nombre}</span>
                <button onClick={() => deleteMar(m.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            ))}
            {marcas.length === 0 && <p className="text-xs text-slate-400">Sin marcas</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
