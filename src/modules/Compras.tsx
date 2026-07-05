import { useEffect, useState } from 'react';
import { Plus, Search, ShoppingCart, Eye, Trash2, X } from 'lucide-react';
import { supabase, formatCurrency, formatDate, IGV_RATE } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { logAudit } from '../lib/audit';
import { adjustInventory, nextDocNumber } from '../lib/inventory';
import type { Compra, Proveedor, Producto, DetalleCompra } from '../lib/types';
import { Modal, Badge, EmptyState, PageHeader, ConfirmDialog, Toast } from '../components/ui';

interface LineItem { producto_id: string; cantidad: number; costo_unitario: number; }

export function Compras() {
  const { user } = useAuth();
  const [items, setItems] = useState<Compra[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<Compra | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<Compra | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState<{ proveedor_id: string; fecha: string; observaciones: string; lines: LineItem[] }>({ proveedor_id: '', fecha: new Date().toISOString().slice(0, 10), observaciones: '', lines: [] });

  const load = async () => {
    setLoading(true);
    const [c, p, prod] = await Promise.all([
      supabase.from('compras').select('*, proveedor:proveedores(*)').order('created_at', { ascending: false }),
      supabase.from('proveedores').select('*').eq('activo', true).order('nombre'),
      supabase.from('productos').select('*').eq('activo', true).order('nombre'),
    ]);
    setItems((c.data as Compra[]) ?? []);
    setProveedores((p.data as Proveedor[]) ?? []);
    setProductos((prod.data as Producto[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter((c) =>
    c.numero.toLowerCase().includes(search.toLowerCase()) ||
    (c.proveedor?.nombre ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setForm({ proveedor_id: '', fecha: new Date().toISOString().slice(0, 10), observaciones: '', lines: [] });
    setModalOpen(true);
  };

  const addLine = () => setForm({ ...form, lines: [...form.lines, { producto_id: '', cantidad: 1, costo_unitario: 0 }] });
  const updateLine = (i: number, patch: Partial<LineItem>) => setForm({ ...form, lines: form.lines.map((l, idx) => idx === i ? { ...l, ...patch } : l) });
  const removeLine = (i: number) => setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) });

  const subtotal = form.lines.reduce((s, l) => s + (l.cantidad * l.costo_unitario), 0);
  const igv = subtotal * IGV_RATE;
  const total = subtotal + igv;

  const save = async () => {
    if (!form.proveedor_id) { setToast('Seleccione un proveedor'); return; }
    if (form.lines.length === 0) { setToast('Agregue al menos un producto'); return; }
    if (form.lines.some((l) => !l.producto_id || l.cantidad <= 0)) { setToast('Revise las líneas: producto y cantidad son obligatorios'); return; }

    const numero = await nextDocNumber('COMP');
    const { data: compra, error } = await supabase.from('compras').insert({
      numero, proveedor_id: form.proveedor_id, fecha: form.fecha,
      estado: 'REGISTRADA', subtotal, igv, total,
      observaciones: form.observaciones, created_by: user?.id,
    }).select().single();
    if (error) { setToast(error.message); return; }

    const detalles = form.lines.map((l) => ({
      compra_id: compra.id, producto_id: l.producto_id,
      cantidad: l.cantidad, costo_unitario: l.costo_unitario,
      subtotal: l.cantidad * l.costo_unitario,
    }));
    const { error: detErr } = await supabase.from('detalle_compras').insert(detalles);
    if (detErr) { setToast(detErr.message); return; }

    // Inventory effect: each line adds stock (with rollback on error)
    const processedLines: string[] = [];
    let inventoryError: string | null = null;
    for (const l of form.lines) {
      const { error: invErr } = await adjustInventory(l.producto_id, Math.abs(l.cantidad), {
        tipo: 'ENTRADA', documento_tipo: 'COMPRA', documento_id: compra.id,
        motivo: `Compra ${numero}`,
      });
      if (invErr) {
        inventoryError = invErr;
        break;
      }
      processedLines.push(l.producto_id);
      // Update product cost to last purchase cost
      await supabase.from('productos').update({ costo: l.costo_unitario }).eq('id', l.producto_id);
    }

    if (inventoryError) {
      // Revert already-processed lines
      for (const pid of processedLines) {
        const line = form.lines.find((l) => l.producto_id === pid)!;
        await adjustInventory(pid, -Math.abs(line.cantidad), {
          tipo: 'SALIDA', documento_tipo: 'DEVOLUCION', documento_id: compra.id,
          motivo: `Reversa por error en compra ${numero}`,
        });
      }
      setToast(`Error inventario: ${inventoryError}`);
      return;
    }

    await logAudit({ modulo: 'compras', accion: 'INSERT', tabla_afectada: 'compras', registro_id: compra.id, valor_nuevo: { numero, total, proveedor_id: form.proveedor_id } as any });
    setToast(`Compra ${numero} registrada`);
    setModalOpen(false);
    load();
  };

  const cancelCompra = async () => {
    if (!confirmCancel) return;
    // Reverse inventory: load detail and subtract
    const { data: detalles } = await supabase.from('detalle_compras').select('*, producto:productos(*)').eq('compra_id', confirmCancel.id);
    for (const d of (detalles ?? []) as DetalleCompra[]) {
      await adjustInventory(d.producto_id, -Math.abs(d.cantidad), {
        tipo: 'SALIDA', documento_tipo: 'DEVOLUCION', documento_id: confirmCancel.id,
        motivo: `Cancelación compra ${confirmCancel.numero}`,
      });
    }
    await supabase.from('compras').update({ estado: 'CANCELADA', updated_by: user?.id }).eq('id', confirmCancel.id);
    await logAudit({ modulo: 'compras', accion: 'CANCEL', tabla_afectada: 'compras', registro_id: confirmCancel.id, valor_previo: { estado: confirmCancel.estado }, valor_nuevo: { estado: 'CANCELADA' } });
    setToast('Compra cancelada — inventario revertido');
    load();
  };

  return (
    <div>
      <PageHeader
        title="Compras"
        subtitle={`${items.length} órdenes de compra`}
        action={<button onClick={openNew} className="btn-primary"><Plus size={16} /> Nueva compra</button>}
      />

      <div className="card">
        <div className="border-b border-slate-200 p-4">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Buscar por número o proveedor..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Cargando...</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<ShoppingCart size={28} />} title="Sin compras" subtitle="Registre su primera orden de compra." action={<button onClick={openNew} className="btn-primary"><Plus size={16} /> Nueva compra</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Número</th>
                  <th className="px-4 py-3 text-left font-semibold">Proveedor</th>
                  <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 text-center font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="table-row">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800">{c.numero}</td>
                    <td className="px-4 py-3 text-slate-700">{c.proveedor?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(c.fecha)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(c.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge color={c.estado === 'REGISTRADA' ? 'green' : c.estado === 'CANCELADA' ? 'red' : 'amber'}>{c.estado}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setViewing(c)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-sky-700"><Eye size={15} /></button>
                        {c.estado === 'REGISTRADA' && (
                          <button onClick={() => setConfirmCancel(c)} className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New purchase modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva compra" size="lg">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Proveedor *</label>
            <select className="input" value={form.proveedor_id} onChange={(e) => setForm({ ...form, proveedor_id: e.target.value })}>
              <option value="">Seleccione...</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Fecha</label>
            <input type="date" className="input" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Observaciones</label>
            <input className="input" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-700">Detalle de productos</h4>
            <button onClick={addLine} className="btn-secondary text-xs"><Plus size={14} /> Agregar línea</button>
          </div>
          <div className="space-y-2">
            {form.lines.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">Sin productos. Agregue una línea.</p>}
            {form.lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <select className="input" value={l.producto_id} onChange={(e) => {
                    const p = productos.find((x) => x.id === e.target.value);
                    updateLine(i, { producto_id: e.target.value, costo_unitario: p ? Number(p.costo) : 0 });
                  }}>
                    <option value="">Producto...</option>
                    {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.sku})</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <input type="number" step="0.01" className="input" placeholder="Cant." value={l.cantidad} onChange={(e) => updateLine(i, { cantidad: Number(e.target.value) })} />
                </div>
                <div className="col-span-3">
                  <input type="number" step="0.01" className="input" placeholder="Costo unit." value={l.costo_unitario} onChange={(e) => updateLine(i, { costo_unitario: Number(e.target.value) })} />
                </div>
                <div className="col-span-1 text-right text-sm font-semibold text-slate-700">{formatCurrency(l.cantidad * l.costo_unitario)}</div>
                <div className="col-span-1 text-right">
                  <button onClick={() => removeLine(i)} className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><X size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <div className="w-64 space-y-1.5 rounded-lg bg-slate-50 p-4 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Subtotal</span><span className="font-semibold">{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">IGV (18%)</span><span className="font-semibold">{formatCurrency(igv)}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5"><span className="font-bold text-slate-800">Total</span><span className="font-bold text-sky-700">{formatCurrency(total)}</span></div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
          <button onClick={save} className="btn-primary">Registrar compra</button>
        </div>
      </Modal>

      {/* View purchase detail */}
      <ViewCompraModal compra={viewing} onClose={() => setViewing(null)} />

      <ConfirmDialog
        open={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        onConfirm={cancelCompra}
        title="Cancelar compra"
        message={`¿Cancelar la compra ${confirmCancel?.numero}? El inventario será revertido.`}
        confirmLabel="Cancelar compra"
        danger
      />

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

function ViewCompraModal({ compra, onClose }: { compra: Compra | null; onClose: () => void }) {
  const [detalles, setDetalles] = useState<DetalleCompra[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!compra) return;
    setLoading(true);
    supabase.from('detalle_compras').select('*, producto:productos(nombre, sku)').eq('compra_id', compra.id)
      .then(({ data }) => { setDetalles((data as DetalleCompra[]) ?? []); setLoading(false); });
  }, [compra]);

  if (!compra) return null;
  return (
    <Modal open={!!compra} onClose={onClose} title={`Compra ${compra.numero}`} size="lg">
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div><span className="text-slate-500">Proveedor:</span> <span className="font-semibold">{compra.proveedor?.nombre ?? '—'}</span></div>
        <div><span className="text-slate-500">Fecha:</span> <span className="font-semibold">{formatDate(compra.fecha)}</span></div>
        <div><span className="text-slate-500">Estado:</span> <Badge color={compra.estado === 'REGISTRADA' ? 'green' : 'red'}>{compra.estado}</Badge></div>
        <div><span className="text-slate-500">Observaciones:</span> <span>{compra.observaciones ?? '—'}</span></div>
      </div>
      {loading ? <p className="text-center text-sm py-4">Cargando...</p> : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Producto</th>
              <th className="px-3 py-2 text-right">Cant.</th>
              <th className="px-3 py-2 text-right">Costo</th>
              <th className="px-3 py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {detalles.map((d) => (
              <tr key={d.id} className="border-b border-slate-100">
                <td className="px-3 py-2">{d.producto?.nombre ?? '—'} <span className="text-xs text-slate-400">({d.producto?.sku})</span></td>
                <td className="px-3 py-2 text-right">{Number(d.cantidad)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(d.costo_unitario)}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatCurrency(d.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50">
              <td colSpan={3} className="px-3 py-2 text-right font-semibold">Subtotal</td>
              <td className="px-3 py-2 text-right">{formatCurrency(compra.subtotal)}</td>
            </tr>
            <tr className="bg-slate-50">
              <td colSpan={3} className="px-3 py-2 text-right font-semibold">IGV</td>
              <td className="px-3 py-2 text-right">{formatCurrency(compra.igv)}</td>
            </tr>
            <tr className="bg-slate-100">
              <td colSpan={3} className="px-3 py-2 text-right font-bold">Total</td>
              <td className="px-3 py-2 text-right font-bold text-sky-700">{formatCurrency(compra.total)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </Modal>
  );
}
