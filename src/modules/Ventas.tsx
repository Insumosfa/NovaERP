import { useEffect, useState } from 'react';
import { Plus, Search, Receipt, Eye, Trash2, X } from 'lucide-react';
import { supabase, formatCurrency, formatDate, IGV_RATE } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { logAudit } from '../lib/audit';
import { adjustInventory, nextDocNumber } from '../lib/inventory';
import type { Venta, Cliente, Producto, DetalleVenta, VentaEstado } from '../lib/types';
import { Modal, Badge, EmptyState, PageHeader, ConfirmDialog, Toast } from '../components/ui';

interface LineItem { producto_id: string; cantidad: number; precio_unitario: number; costo_unitario: number; }

const ESTADO_LABEL: Record<VentaEstado, { label: string; color: 'slate' | 'sky' | 'green' | 'amber' | 'red' | 'blue' | 'purple' }> = {
  PENDIENTE: { label: 'Pendiente', color: 'slate' },
  PENDIENTE_ENTREGA: { label: 'Pend. Entrega', color: 'amber' },
  ENTREGADA: { label: 'Entregada', color: 'blue' },
  PARCIALMENTE_PAGADA: { label: 'Parcial', color: 'amber' },
  PAGADA: { label: 'Pagada', color: 'green' },
  POR_COBRAR: { label: 'Por Cobrar', color: 'purple' },
  CANCELADA: { label: 'Cancelada', color: 'red' },
};

export function Ventas() {
  const { user } = useAuth();
  const [items, setItems] = useState<Venta[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<Venta | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<Venta | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState<{ cliente_id: string; fecha: string; tipo: string; observaciones: string; lines: LineItem[] }>({ cliente_id: '', fecha: new Date().toISOString().slice(0, 10), tipo: 'VENTA', observaciones: '', lines: [] });

  const load = async () => {
    setLoading(true);
    const [v, c, p] = await Promise.all([
      supabase.from('ventas').select('*, cliente:clientes(*)').order('created_at', { ascending: false }),
      supabase.from('clientes').select('*').eq('activo', true).order('nombre'),
      supabase.from('productos').select('*').eq('activo', true).order('nombre'),
    ]);
    setItems((v.data as Venta[]) ?? []);
    setClientes((c.data as Cliente[]) ?? []);
    setProductos((p.data as Producto[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter((v) =>
    v.numero.toLowerCase().includes(search.toLowerCase()) ||
    (v.cliente?.nombre ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setForm({ cliente_id: '', fecha: new Date().toISOString().slice(0, 10), tipo: 'VENTA', observaciones: '', lines: [] });
    setModalOpen(true);
  };

  const addLine = () => setForm({ ...form, lines: [...form.lines, { producto_id: '', cantidad: 1, precio_unitario: 0, costo_unitario: 0 }] });
  const updateLine = (i: number, patch: Partial<LineItem>) => setForm({ ...form, lines: form.lines.map((l, idx) => idx === i ? { ...l, ...patch } : l) });
  const removeLine = (i: number) => setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) });

  const subtotal = form.lines.reduce((s, l) => s + (l.cantidad * l.precio_unitario), 0);
  const igv = subtotal * IGV_RATE;
  const total = subtotal + igv;

  const save = async () => {
    if (!form.cliente_id) { setToast('Seleccione un cliente'); return; }
    if (form.lines.length === 0) { setToast('Agregue al menos un producto'); return; }
    if (form.lines.some((l) => !l.producto_id || l.cantidad <= 0)) { setToast('Revise las líneas'); return; }

    // Real-time stock check against DB (not stale local state)
    if (form.tipo === 'VENTA') {
      for (const l of form.lines) {
        const { data: prod } = await supabase.from('productos').select('stock, nombre').eq('id', l.producto_id).maybeSingle();
        if (prod && Number(prod.stock) < l.cantidad) {
          setToast(`Stock insuficiente para ${prod.nombre} (disponible: ${prod.stock})`);
          return;
        }
      }
    }

    const numero = await nextDocNumber('VENT');
    const estado: VentaEstado = form.tipo === 'COTIZACION' ? 'PENDIENTE' : 'PENDIENTE_ENTREGA';
    const { data: venta, error } = await supabase.from('ventas').insert({
      numero, cliente_id: form.cliente_id, vendedor_id: user?.id, fecha: form.fecha,
      estado, tipo: form.tipo, subtotal, igv, total, monto_pagado: 0, saldo: total,
      observaciones: form.observaciones, created_by: user?.id,
    }).select().single();
    if (error) { setToast(error.message); return; }

    const detalles = form.lines.map((l) => ({
      venta_id: venta.id, producto_id: l.producto_id,
      cantidad: l.cantidad, precio_unitario: l.precio_unitario,
      costo_unitario: l.costo_unitario, subtotal: l.cantidad * l.precio_unitario,
    }));
    const { error: detErr } = await supabase.from('detalle_ventas').insert(detalles);
    if (detErr) { setToast(detErr.message); return; }

    // Inventory effect only for VENTA (not cotización)
    if (form.tipo === 'VENTA') {
      const processedLines: string[] = [];
      let inventoryError: string | null = null;
      for (const l of form.lines) {
        const { error: invErr } = await adjustInventory(l.producto_id, -Math.abs(l.cantidad), {
          tipo: 'SALIDA', documento_tipo: 'VENTA', documento_id: venta.id,
          motivo: `Venta ${numero}`,
        });
        if (invErr) {
          inventoryError = invErr;
          break;
        }
        processedLines.push(l.producto_id);
      }
      if (inventoryError) {
        // Revert already-processed lines
        for (const pid of processedLines) {
          const line = form.lines.find((l) => l.producto_id === pid)!;
          await adjustInventory(pid, Math.abs(line.cantidad), {
            tipo: 'ENTRADA', documento_tipo: 'DEVOLUCION', documento_id: venta.id,
            motivo: `Reversa por error en venta ${numero}`,
          });
        }
        setToast(`Error inventario: ${inventoryError}`);
        return;
      }

      // Create AR record
      const cliente = clientes.find((c) => c.id === form.cliente_id);
      const venc = new Date(); venc.setDate(venc.getDate() + 30);
      await supabase.from('cuentas_por_cobrar').insert({
        venta_id: venta.id, cliente_id: form.cliente_id,
        monto_total: total, monto_pagado: 0, saldo: total,
        fecha_emision: form.fecha, fecha_vencimiento: venc.toISOString().slice(0, 10),
        estado: 'VIGENTE', dias_mora: 0,
      });
      // Update client saldo
      if (cliente) {
        await supabase.from('clientes').update({ saldo: Number(cliente.saldo) + total }).eq('id', cliente.id);
      }
    }

    await logAudit({ modulo: 'ventas', accion: 'INSERT', tabla_afectada: 'ventas', registro_id: venta.id, valor_nuevo: { numero, total, tipo: form.tipo, estado } as any });
    setToast(`${form.tipo === 'COTIZACION' ? 'Cotización' : 'Venta'} ${numero} registrada`);
    setModalOpen(false);
    load();
  };

  const cancelVenta = async () => {
    if (!confirmCancel) return;
    if (confirmCancel.tipo === 'VENTA' && confirmCancel.estado !== 'CANCELADA') {
      // Reverse inventory
      const { data: detalles } = await supabase.from('detalle_ventas').select('*, producto:productos(*)').eq('venta_id', confirmCancel.id);
      for (const d of (detalles ?? []) as DetalleVenta[]) {
        await adjustInventory(d.producto_id, Math.abs(d.cantidad), {
          tipo: 'ENTRADA', documento_tipo: 'DEVOLUCION', documento_id: confirmCancel.id,
          motivo: `Cancelación venta ${confirmCancel.numero}`,
        });
      }
      // Reverse client saldo
      const { data: cli } = await supabase.from('clientes').select('saldo').eq('id', confirmCancel.cliente_id).maybeSingle();
      if (cli) {
        await supabase.from('clientes').update({ saldo: Math.max(0, Number(cli.saldo) - Number(confirmCancel.total)) }).eq('id', confirmCancel.cliente_id);
      }
      // Update AR — mark as CANCELADA (not VENCIDA)
      await supabase.from('cuentas_por_cobrar').update({ estado: 'CANCELADA', saldo: 0 }).eq('venta_id', confirmCancel.id);
    }
    await supabase.from('ventas').update({ estado: 'CANCELADA', saldo: 0, updated_by: user?.id }).eq('id', confirmCancel.id);
    await logAudit({ modulo: 'ventas', accion: 'CANCEL', tabla_afectada: 'ventas', registro_id: confirmCancel.id, valor_previo: { estado: confirmCancel.estado }, valor_nuevo: { estado: 'CANCELADA' } });
    setToast('Venta cancelada — inventario revertido');
    load();
  };

  return (
    <div>
      <PageHeader
        title="Ventas"
        subtitle={`${items.length} documentos (ventas y cotizaciones)`}
        action={<button onClick={openNew} className="btn-primary"><Plus size={16} /> Nueva venta</button>}
      />

      <div className="card">
        <div className="border-b border-slate-200 p-4">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Buscar por número o cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Cargando...</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Receipt size={28} />} title="Sin ventas" subtitle="Registre su primera venta o cotización." action={<button onClick={openNew} className="btn-primary"><Plus size={16} /> Nueva venta</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Número</th>
                  <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                  <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                  <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 text-right font-semibold">Pagado</th>
                  <th className="px-4 py-3 text-center font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => {
                  const e = ESTADO_LABEL[v.estado];
                  return (
                    <tr key={v.id} className="table-row">
                      <td className="px-4 py-3 font-mono font-semibold text-slate-800">{v.numero}</td>
                      <td className="px-4 py-3 text-slate-700">{v.cliente?.nombre ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(v.fecha)}</td>
                      <td className="px-4 py-3"><Badge color={v.tipo === 'COTIZACION' ? 'slate' : 'sky'}>{v.tipo === 'COTIZACION' ? 'Cotización' : 'Venta'}</Badge></td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(v.total)}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(v.monto_pagado)}</td>
                      <td className="px-4 py-3 text-center"><Badge color={e.color}>{e.label}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setViewing(v)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-sky-700"><Eye size={15} /></button>
                          {v.estado !== 'CANCELADA' && (
                            <button onClick={() => setConfirmCancel(v)} className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                          )}
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

      {/* New sale modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva venta / cotización" size="lg">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Cliente *</label>
            <select className="input" value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
              <option value="">Seleccione...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Fecha</label>
            <input type="date" className="input" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select className="input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option value="VENTA">Venta</option>
              <option value="COTIZACION">Cotización</option>
            </select>
          </div>
          <div className="sm:col-span-3">
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
                    updateLine(i, { producto_id: e.target.value, precio_unitario: p ? Number(p.precio) : 0, costo_unitario: p ? Number(p.costo) : 0 });
                  }}>
                    <option value="">Producto...</option>
                    {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre} (Stock: {Number(p.stock)} {p.unidad})</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <input type="number" step="0.01" className="input" placeholder="Cant." value={l.cantidad} onChange={(e) => updateLine(i, { cantidad: Number(e.target.value) })} />
                </div>
                <div className="col-span-3">
                  <input type="number" step="0.01" className="input" placeholder="Precio" value={l.precio_unitario} onChange={(e) => updateLine(i, { precio_unitario: Number(e.target.value) })} />
                </div>
                <div className="col-span-1 text-right text-sm font-semibold text-slate-700">{formatCurrency(l.cantidad * l.precio_unitario)}</div>
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
          <button onClick={save} className="btn-primary">Registrar {form.tipo === 'COTIZACION' ? 'cotización' : 'venta'}</button>
        </div>
      </Modal>

      <ViewVentaModal venta={viewing} onClose={() => setViewing(null)} />

      <ConfirmDialog
        open={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        onConfirm={cancelVenta}
        title="Cancelar venta"
        message={`¿Cancelar la venta ${confirmCancel?.numero}? El inventario será revertido.`}
        confirmLabel="Cancelar venta"
        danger
      />

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

function ViewVentaModal({ venta, onClose }: { venta: Venta | null; onClose: () => void }) {
  const [detalles, setDetalles] = useState<DetalleVenta[]>([]);
  const [entregas, setEntregas] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!venta) return;
    setLoading(true);
    Promise.all([
      supabase.from('detalle_ventas').select('*, producto:productos(nombre, sku)').eq('venta_id', venta.id),
      supabase.from('entregas_ventas').select('*').eq('venta_id', venta.id),
      supabase.from('pagos_ventas').select('*').eq('venta_id', venta.id).order('fecha_pago', { ascending: false }),
    ]).then(([d, e, p]) => {
      setDetalles((d.data as DetalleVenta[]) ?? []);
      setEntregas(e.data ?? []);
      setPagos(p.data ?? []);
      setLoading(false);
    });
  }, [venta]);

  if (!venta) return null;
  const e = ESTADO_LABEL[venta.estado];
  return (
    <Modal open={!!venta} onClose={onClose} title={`${venta.tipo === 'COTIZACION' ? 'Cotización' : 'Venta'} ${venta.numero}`} size="lg">
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div><span className="text-slate-500">Cliente:</span> <span className="font-semibold">{venta.cliente?.nombre ?? '—'}</span></div>
        <div><span className="text-slate-500">Fecha:</span> <span className="font-semibold">{formatDate(venta.fecha)}</span></div>
        <div><span className="text-slate-500">Estado:</span> <Badge color={e.color}>{e.label}</Badge></div>
        <div><span className="text-slate-500">Saldo:</span> <span className="font-semibold">{formatCurrency(venta.saldo)}</span></div>
      </div>

      {loading ? <p className="text-center text-sm py-4">Cargando...</p> : (
        <>
          <h4 className="mb-2 text-sm font-semibold text-slate-700">Productos</h4>
          <table className="w-full text-sm mb-4">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Producto</th>
                <th className="px-3 py-2 text-right">Cant.</th>
                <th className="px-3 py-2 text-right">Precio</th>
                <th className="px-3 py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {detalles.map((d) => (
                <tr key={d.id} className="border-b border-slate-100">
                  <td className="px-3 py-2">{d.producto?.nombre ?? '—'} <span className="text-xs text-slate-400">({d.producto?.sku})</span></td>
                  <td className="px-3 py-2 text-right">{Number(d.cantidad)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(d.precio_unitario)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(d.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50"><td colSpan={3} className="px-3 py-2 text-right font-semibold">Subtotal</td><td className="px-3 py-2 text-right">{formatCurrency(venta.subtotal)}</td></tr>
              <tr className="bg-slate-50"><td colSpan={3} className="px-3 py-2 text-right font-semibold">IGV</td><td className="px-3 py-2 text-right">{formatCurrency(venta.igv)}</td></tr>
              <tr className="bg-slate-100"><td colSpan={3} className="px-3 py-2 text-right font-bold">Total</td><td className="px-3 py-2 text-right font-bold text-sky-700">{formatCurrency(venta.total)}</td></tr>
              <tr className="bg-slate-50"><td colSpan={3} className="px-3 py-2 text-right font-semibold">Pagado</td><td className="px-3 py-2 text-right text-emerald-700">{formatCurrency(venta.monto_pagado)}</td></tr>
              <tr className="bg-slate-50"><td colSpan={3} className="px-3 py-2 text-right font-bold">Saldo</td><td className="px-3 py-2 text-right font-bold text-red-700">{formatCurrency(venta.saldo)}</td></tr>
            </tfoot>
          </table>

          {pagos.length > 0 && (
            <>
              <h4 className="mb-2 text-sm font-semibold text-slate-700">Pagos registrados</h4>
              <div className="mb-4 space-y-1">
                {pagos.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-md bg-emerald-50 px-3 py-1.5 text-sm">
                    <span><Badge color="green">{p.metodo}</Badge> <span className="text-slate-600 ml-2">{formatDate(p.fecha_pago)}</span> {p.referencia && <span className="text-xs text-slate-400">· {p.referencia}</span>}</span>
                    <span className="font-semibold text-emerald-700">{formatCurrency(p.monto)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {entregas.length > 0 && (
            <>
              <h4 className="mb-2 text-sm font-semibold text-slate-700">Entregas</h4>
              <div className="space-y-1">
                {entregas.map((en) => (
                  <div key={en.id} className="flex items-center justify-between rounded-md bg-blue-50 px-3 py-1.5 text-sm">
                    <span><Badge color="blue">{en.estado}</Badge> <span className="text-slate-600 ml-2">{en.evidencia_tipo ?? '—'}</span></span>
                    <span className="text-xs text-slate-500">{formatDate(en.fecha_entrega)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
