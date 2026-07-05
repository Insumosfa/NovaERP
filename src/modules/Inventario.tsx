import { useEffect, useState } from 'react';
import { Search, Boxes, ArrowUpCircle, ArrowDownCircle, Sliders, TrendingUp } from 'lucide-react';
import { supabase, formatCurrency, formatDateTime } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import { adjustInventory } from '../lib/inventory';
import type { Producto, InventarioMovimiento } from '../lib/types';
import { Modal, Badge, EmptyState, PageHeader, Toast } from '../components/ui';

export function Inventario() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [movimientos, setMovimientos] = useState<InventarioMovimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'stock' | 'kardex' | 'ajustes'>('stock');
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [ajusteForm, setAjusteForm] = useState<{ producto_id: string; tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE'; cantidad: number; motivo: string }>({ producto_id: '', tipo: 'AJUSTE', cantidad: 0, motivo: '' });
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [p, m] = await Promise.all([
      supabase.from('productos').select('*, categoria:categorias(*), marca:marcas(*)').order('nombre'),
      supabase.from('inventario_movimientos').select('*, producto:productos(nombre, sku)').order('created_at', { ascending: false }).limit(200),
    ]);
    setProductos((p.data as Producto[]) ?? []);
    setMovimientos((m.data as InventarioMovimiento[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = productos.filter((p) =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = productos.reduce((s, p) => s + Number(p.stock) * Number(p.costo), 0);
  const totalItems = productos.reduce((s, p) => s + Number(p.stock), 0);
  const lowStock = productos.filter((p) => Number(p.stock) <= Number(p.stock_minimo) && Number(p.stock_minimo) > 0);

  // Movimientos de tipo AJUSTE para la pestaña Ajustes
  const ajustes = movimientos.filter((m) => m.tipo_movimiento === 'AJUSTE');

  const applyAjuste = async () => {
    if (!ajusteForm.producto_id) { setToast('Seleccione un producto'); return; }
    if (!ajusteForm.cantidad) { setToast('Ingrese una cantidad válida'); return; }
    // Para AJUSTE se permite positivo o negativo según lo ingresado.
    // Para ENTRADA siempre positivo, para SALIDA siempre negativo.
    let delta: number;
    if (ajusteForm.tipo === 'ENTRADA') {
      delta = Math.abs(ajusteForm.cantidad);
    } else if (ajusteForm.tipo === 'SALIDA') {
      delta = -Math.abs(ajusteForm.cantidad);
    } else {
      delta = ajusteForm.cantidad; // AJUSTE: respeta el signo ingresado
    }
    const { error } = await adjustInventory(ajusteForm.producto_id, delta, {
      tipo: ajusteForm.tipo,
      documento_tipo: 'AJUSTE',
      documento_id: ajusteForm.producto_id,
      motivo: ajusteForm.motivo || `Ajuste manual (${ajusteForm.tipo})`,
    });
    if (error) { setToast(error); return; }
    await logAudit({ modulo: 'inventario', accion: 'AJUSTE', tabla_afectada: 'productos', registro_id: ajusteForm.producto_id, valor_nuevo: ajusteForm as any });
    setToast('Ajuste registrado');
    setAjusteOpen(false);
    setAjusteForm({ producto_id: '', tipo: 'AJUSTE', cantidad: 0, motivo: '' });
    load();
  };

  return (
    <div>
      <PageHeader
        title="Inventario"
        subtitle="Kardex, valorización y ajustes"
        action={<button onClick={() => setAjusteOpen(true)} className="btn-primary"><Sliders size={16} /> Nuevo ajuste</button>}
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Valor de inventario</p>
          <p className="mt-1 font-display text-xl font-bold text-slate-900">{formatCurrency(totalValue)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Unidades en stock</p>
          <p className="mt-1 font-display text-xl font-bold text-slate-900">{totalItems.toLocaleString('es-PE')}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Productos con stock bajo</p>
          <p className="mt-1 font-display text-xl font-bold text-red-600">{lowStock.length}</p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {(['stock', 'kardex', 'ajustes'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${tab === t ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {t === 'stock' ? 'Stock actual' : t === 'kardex' ? 'Kardex' : 'Ajustes'}
              </button>
            ))}
          </div>
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Buscar producto..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Cargando...</div>
        ) : tab === 'stock' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Producto</th>
                  <th className="px-4 py-3 text-left font-semibold">SKU</th>
                  <th className="px-4 py-3 text-right font-semibold">Stock</th>
                  <th className="px-4 py-3 text-right font-semibold">Mínimo</th>
                  <th className="px-4 py-3 text-right font-semibold">Costo</th>
                  <th className="px-4 py-3 text-right font-semibold">Valor</th>
                  <th className="px-4 py-3 text-center font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const low = Number(p.stock) <= Number(p.stock_minimo) && Number(p.stock_minimo) > 0;
                  return (
                    <tr key={p.id} className="table-row">
                      <td className="px-4 py-3 font-semibold text-slate-800">{p.nombre}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.sku}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">{Number(p.stock)} {p.unidad}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{Number(p.stock_minimo)}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(p.costo)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(Number(p.stock) * Number(p.costo))}</td>
                      <td className="px-4 py-3 text-center">
                        {low ? <Badge color="red">Stock bajo</Badge> : Number(p.stock) === 0 ? <Badge color="slate">Agotado</Badge> : <Badge color="green">OK</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : tab === 'kardex' ? (
          movimientos.length === 0 ? (
            <EmptyState icon={<Boxes size={28} />} title="Sin movimientos" subtitle="Los movimientos de inventario aparecerán aquí." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                    <th className="px-4 py-3 text-left font-semibold">Producto</th>
                    <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                    <th className="px-4 py-3 text-right font-semibold">Cantidad</th>
                    <th className="px-4 py-3 text-right font-semibold">Stock resultante</th>
                    <th className="px-4 py-3 text-left font-semibold">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((m) => {
                    const positive = Number(m.cantidad) >= 0;
                    return (
                      <tr key={m.id} className="table-row">
                        <td className="px-4 py-3 text-slate-600">{formatDateTime(m.created_at)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{m.producto?.nombre ?? '—'} <span className="text-xs text-slate-400 font-mono">({m.producto?.sku})</span></td>
                        <td className="px-4 py-3">
                          <span className={`badge ${positive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {positive ? <ArrowUpCircle size={12} /> : <ArrowDownCircle size={12} />} {m.tipo_movimiento}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-bold ${positive ? 'text-emerald-700' : 'text-red-700'}`}>{positive ? '+' : ''}{Number(m.cantidad)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{Number(m.stock_resultante)}</td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{m.motivo ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          ajustes.length === 0 ? (
            <EmptyState icon={<TrendingUp size={28} />} title="Sin ajustes registrados" subtitle="Use el botón 'Nuevo ajuste' para registrar entradas, salidas o correcciones." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                    <th className="px-4 py-3 text-left font-semibold">Producto</th>
                    <th className="px-4 py-3 text-right font-semibold">Cantidad</th>
                    <th className="px-4 py-3 text-right font-semibold">Stock resultante</th>
                    <th className="px-4 py-3 text-left font-semibold">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {ajustes.map((m) => {
                    const positive = Number(m.cantidad) >= 0;
                    return (
                      <tr key={m.id} className="table-row">
                        <td className="px-4 py-3 text-slate-600">{formatDateTime(m.created_at)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{m.producto?.nombre ?? '—'} <span className="text-xs text-slate-400 font-mono">({m.producto?.sku})</span></td>
                        <td className={`px-4 py-3 text-right font-bold ${positive ? 'text-emerald-700' : 'text-red-700'}`}>{positive ? '+' : ''}{Number(m.cantidad)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{Number(m.stock_resultante)}</td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{m.motivo ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <Modal open={ajusteOpen} onClose={() => setAjusteOpen(false)} title="Ajuste de inventario">
        <div className="space-y-4">
          <div>
            <label className="label">Producto *</label>
            <select className="input" value={ajusteForm.producto_id} onChange={(e) => setAjusteForm({ ...ajusteForm, producto_id: e.target.value })}>
              <option value="">Seleccione...</option>
              {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.sku}) — Stock: {Number(p.stock)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tipo de movimiento</label>
              <select className="input" value={ajusteForm.tipo} onChange={(e) => setAjusteForm({ ...ajusteForm, tipo: e.target.value as any })}>
                <option value="ENTRADA">Entrada (+)</option>
                <option value="SALIDA">Salida (-)</option>
                <option value="AJUSTE">Ajuste (±)</option>
              </select>
            </div>
            <div>
              <label className="label">
                Cantidad{ajusteForm.tipo === 'AJUSTE' ? ' (negativo para reducir)' : ''}
              </label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={ajusteForm.cantidad}
                onChange={(e) => setAjusteForm({ ...ajusteForm, cantidad: Number(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <label className="label">Motivo</label>
            <input className="input" value={ajusteForm.motivo} onChange={(e) => setAjusteForm({ ...ajusteForm, motivo: e.target.value })} placeholder="Conteo físico, merma, devolución, etc." />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setAjusteOpen(false)} className="btn-secondary">Cancelar</button>
          <button onClick={applyAjuste} className="btn-primary">Aplicar ajuste</button>
        </div>
      </Modal>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
