import { useEffect, useState } from 'react';
import { Search, Wallet, Plus, X, CheckCircle2 } from 'lucide-react';
import { supabase, formatCurrency, formatDateTime } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { logAudit } from '../lib/audit';
import type { Venta, PagoVenta } from '../lib/types';
import { Modal, Badge, EmptyState, PageHeader, Toast } from '../components/ui';

interface PagoLine { monto: number; metodo: string; referencia: string; }

export function Cobranza() {
  const { user } = useAuth();
  const [items, setItems] = useState<Venta[]>([]);
  const [pagosMap, setPagosMap] = useState<Record<string, PagoVenta[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [payOpen, setPayOpen] = useState<Venta | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lines, setLines] = useState<PagoLine[]>([{ monto: 0, metodo: 'EFECTIVO', referencia: '' }]);

  const load = async () => {
    setLoading(true);
    const [v, p] = await Promise.all([
      supabase.from('ventas').select('*, cliente:clientes(nombre)').in('estado', ['PENDIENTE_ENTREGA', 'ENTREGADA', 'PARCIALMENTE_PAGADA', 'POR_COBRAR']).neq('tipo', 'COTIZACION').order('created_at', { ascending: false }),
      supabase.from('pagos_ventas').select('*').order('fecha_pago', { ascending: false }),
    ]);
    const ventas = (v.data as Venta[]) ?? [];
    setItems(ventas);
    const map: Record<string, PagoVenta[]> = {};
    (p.data ?? []).forEach((pg: PagoVenta) => {
      if (!map[pg.venta_id]) map[pg.venta_id] = [];
      map[pg.venta_id].push(pg);
    });
    setPagosMap(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter((v) =>
    v.numero.toLowerCase().includes(search.toLowerCase()) ||
    (v.cliente?.nombre ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const openPay = (v: Venta) => {
    setPayOpen(v);
    setLines([{ monto: v.saldo, metodo: 'EFECTIVO', referencia: '' }]);
  };

  const addLine = () => setLines([...lines, { monto: 0, metodo: 'EFECTIVO', referencia: '' }]);
  const updateLine = (i: number, patch: Partial<PagoLine>) => setLines(lines.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));

  const totalPago = lines.reduce((s, l) => s + (Number(l.monto) || 0), 0);

  const registerPayment = async () => {
    if (!payOpen) return;
    if (lines.length === 0 || totalPago <= 0) { setToast('Ingrese un monto válido'); return; }
    if (totalPago > payOpen.saldo + 0.01) { setToast(`El monto excede el saldo (${formatCurrency(payOpen.saldo)})`); return; }

    for (const l of lines) {
      if (l.monto <= 0) continue;
      const metodo = lines.length > 1 ? 'MIXTO' : l.metodo;
      const { error } = await supabase.from('pagos_ventas').insert({
        venta_id: payOpen.id, monto: l.monto, metodo, fecha_pago: new Date().toISOString(),
        referencia: l.referencia || null, created_by: user?.id,
      });
      if (error) { setToast(error.message); return; }
    }

    const newPagado = Number(payOpen.monto_pagado) + totalPago;
    const newSaldo = Number(payOpen.total) - newPagado;
    const newEstado = newSaldo <= 0.01 ? 'PAGADA' : 'PARCIALMENTE_PAGADA';

    await supabase.from('ventas').update({
      monto_pagado: newPagado, saldo: newSaldo, estado: newEstado, updated_by: user?.id,
    }).eq('id', payOpen.id);

    // Update AR record
    await supabase.from('cuentas_por_cobrar').update({
      monto_pagado: newPagado, saldo: newSaldo,
      estado: newSaldo <= 0.01 ? 'PAGADA' : 'PARCIAL',
    }).eq('venta_id', payOpen.id);

    // Update client saldo
    const { data: cli } = await supabase.from('clientes').select('saldo').eq('id', payOpen.cliente_id).maybeSingle();
    if (cli) {
      await supabase.from('clientes').update({ saldo: Math.max(0, Number(cli.saldo) - totalPago) }).eq('id', payOpen.cliente_id);
    }

    await logAudit({ modulo: 'cobranza', accion: 'INSERT', tabla_afectada: 'pagos_ventas', registro_id: payOpen.id, valor_nuevo: { total_pago: totalPago, metodo: lines.length > 1 ? 'MIXTO' : lines[0].metodo } as any });
    setToast(`Pago registrado: ${formatCurrency(totalPago)}`);
    setPayOpen(null);
    load();
  };

  return (
    <div>
      <PageHeader title="Cobranza" subtitle="Registro de pagos, abonos y pagos mixtos" />

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
          <EmptyState icon={<Wallet size={28} />} title="Sin cuentas por cobrar" subtitle="Las ventas con saldo pendiente aparecerán aquí." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Número</th>
                  <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 text-right font-semibold">Pagado</th>
                  <th className="px-4 py-3 text-right font-semibold">Saldo</th>
                  <th className="px-4 py-3 text-center font-semibold">Estado</th>
                  <th className="px-4 py-3 text-left font-semibold">Pagos previos</th>
                  <th className="px-4 py-3 text-right font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => {
                  const pagos = pagosMap[v.id] ?? [];
                  return (
                    <tr key={v.id} className="table-row">
                      <td className="px-4 py-3 font-mono font-semibold text-slate-800">{v.numero}</td>
                      <td className="px-4 py-3 text-slate-700">{v.cliente?.nombre ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(v.total)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{formatCurrency(v.monto_pagado)}</td>
                      <td className="px-4 py-3 text-right font-bold text-red-700">{formatCurrency(v.saldo)}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge color={v.estado === 'PAGADA' ? 'green' : v.estado === 'PARCIALMENTE_PAGADA' ? 'amber' : 'sky'}>{v.estado.replace('_', ' ')}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {pagos.length === 0 ? '—' : pagos.slice(0, 2).map((p, i) => (
                          <div key={i}><Badge color="green">{p.metodo}</Badge> {formatCurrency(p.monto)} · {formatDateTime(p.fecha_pago)}</div>
                        ))}
                        {pagos.length > 2 && <div className="text-slate-400">+{pagos.length - 2} más</div>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {v.saldo > 0.01 && (
                          <button onClick={() => openPay(v)} className="btn-primary text-xs"><Wallet size={14} /> Registrar pago</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!payOpen} onClose={() => setPayOpen(null)} title={`Registrar pago — ${payOpen?.numero}`}>
        {payOpen && (
          <>
            <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Total</p>
                <p className="font-bold text-slate-900">{formatCurrency(payOpen.total)}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="text-xs text-slate-500">Pagado</p>
                <p className="font-bold text-emerald-700">{formatCurrency(payOpen.monto_pagado)}</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3">
                <p className="text-xs text-slate-500">Saldo</p>
                <p className="font-bold text-red-700">{formatCurrency(payOpen.saldo)}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-700">Métodos de pago</h4>
                <button onClick={addLine} className="btn-secondary text-xs"><Plus size={14} /> Agregar método</button>
              </div>
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4">
                    <select className="input" value={l.metodo} onChange={(e) => updateLine(i, { metodo: e.target.value })}>
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="BANCO">Banco</option>
                      <option value="CREDITO">Crédito</option>
                    </select>
                  </div>
                  <div className="col-span-3">
                    <input type="number" step="0.01" className="input" placeholder="Monto" value={l.monto} onChange={(e) => updateLine(i, { monto: Number(e.target.value) })} />
                  </div>
                  <div className="col-span-4">
                    <input className="input" placeholder="Referencia" value={l.referencia} onChange={(e) => updateLine(i, { referencia: e.target.value })} />
                  </div>
                  <div className="col-span-1 text-right">
                    {lines.length > 1 && (
                      <button onClick={() => removeLine(i)} className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><X size={16} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-lg bg-sky-50 p-3">
              <span className="text-sm font-semibold text-slate-700">Total a pagar:</span>
              <span className="font-display text-lg font-bold text-sky-700">{formatCurrency(totalPago)}</span>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setPayOpen(null)} className="btn-secondary">Cancelar</button>
              <button onClick={registerPayment} className="btn-primary"><CheckCircle2 size={16} /> Registrar pago</button>
            </div>
          </>
        )}
      </Modal>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
