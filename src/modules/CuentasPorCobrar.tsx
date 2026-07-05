import { useEffect, useState } from 'react';
import { Search, FileText, AlertCircle } from 'lucide-react';
import { supabase, formatCurrency, formatDate } from '../lib/supabase';
import type { CuentaPorCobrar } from '../lib/types';
import { Badge, EmptyState, PageHeader } from '../components/ui';

export function CuentasPorCobrar() {
  const [items, setItems] = useState<CuentaPorCobrar[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('cuentas_por_cobrar').select('*, cliente:clientes(nombre), venta:ventas(numero)').order('fecha_emision', { ascending: false });
    setItems((data as CuentaPorCobrar[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter((c) =>
    (c.cliente?.nombre ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.venta?.numero ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const total = items.reduce((s, c) => s + Number(c.saldo), 0);
  const vigente = items.filter((c) => c.estado === 'VIGENTE').reduce((s, c) => s + Number(c.saldo), 0);
  const vencida = items.filter((c) => c.estado === 'VENCIDA').reduce((s, c) => s + Number(c.saldo), 0);
  const pagada = items.filter((c) => c.estado === 'PAGADA').reduce((s, c) => s + Number(c.monto_total), 0);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader title="Cuentas por Cobrar" subtitle="Saldos pendientes, vencimientos y seguimiento" />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Saldo total</p>
          <p className="mt-1 font-display text-xl font-bold text-slate-900">{formatCurrency(total)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Vigente</p>
          <p className="mt-1 font-display text-xl font-bold text-emerald-700">{formatCurrency(vigente)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Vencida</p>
          <p className="mt-1 font-display text-xl font-bold text-red-700">{formatCurrency(vencida)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Pagado (histórico)</p>
          <p className="mt-1 font-display text-xl font-bold text-sky-700">{formatCurrency(pagada)}</p>
        </div>
      </div>

      <div className="card">
        <div className="border-b border-slate-200 p-4">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Buscar por cliente o venta..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Cargando...</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<FileText size={28} />} title="Sin cuentas por cobrar" subtitle="Las cuentas se generan automáticamente al registrar ventas." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Venta</th>
                  <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                  <th className="px-4 py-3 text-right font-semibold">Monto total</th>
                  <th className="px-4 py-3 text-right font-semibold">Pagado</th>
                  <th className="px-4 py-3 text-right font-semibold">Saldo</th>
                  <th className="px-4 py-3 text-left font-semibold">Emisión</th>
                  <th className="px-4 py-3 text-left font-semibold">Vencimiento</th>
                  <th className="px-4 py-3 text-center font-semibold">Dias mora</th>
                  <th className="px-4 py-3 text-center font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const isVencida = c.fecha_vencimiento && today > c.fecha_vencimiento && c.saldo > 0.01;
                  return (
                    <tr key={c.id} className="table-row">
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{c.venta?.numero ?? '—'}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{c.cliente?.nombre ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(c.monto_total)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{formatCurrency(c.monto_pagado)}</td>
                      <td className="px-4 py-3 text-right font-bold text-red-700">{formatCurrency(c.saldo)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(c.fecha_emision)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(c.fecha_vencimiento)}</td>
                      <td className="px-4 py-3 text-center">
                        {isVencida ? <span className="font-bold text-red-600">{c.dias_mora || Math.ceil((new Date(today).getTime() - new Date(c.fecha_vencimiento!).getTime()) / 86400000)}</span> : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.saldo <= 0.01 ? <Badge color="green">Pagada</Badge> : isVencida ? <Badge color="red"><AlertCircle size={11} className="mr-1" />Vencida</Badge> : <Badge color="amber">Vigente</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
