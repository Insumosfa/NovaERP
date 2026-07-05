import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, ShoppingCart, Package, Wallet, ScrollText, Download } from 'lucide-react';
import { supabase, formatCurrency } from '../lib/supabase';
import { PageHeader, LoadingScreen } from '../components/ui';

type ReportType = 'ventas' | 'compras' | 'inventario' | 'utilidades' | 'cartera' | 'auditoria';

export function Reportes() {
  const [active, setActive] = useState<ReportType>('ventas');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const load = async () => {
    setLoading(true);
    let rows: any[] = [];
    if (active === 'ventas') {
      const { data } = await supabase.from('ventas').select('numero, fecha, cliente:clientes(nombre), subtotal, igv, total, monto_pagado, saldo, estado, tipo').gte('fecha', from).lte('fecha', to).order('fecha', { ascending: false });
      rows = data ?? [];
    } else if (active === 'compras') {
      const { data } = await supabase.from('compras').select('numero, fecha, proveedor:proveedores(nombre), subtotal, igv, total, estado').gte('fecha', from).lte('fecha', to).order('fecha', { ascending: false });
      rows = data ?? [];
    } else if (active === 'inventario') {
      const { data } = await supabase.from('productos').select('sku, nombre, stock, stock_minimo, costo, precio, unidad, categoria:categorias(nombre)').order('nombre');
      rows = (data ?? []).map((p: any) => ({ ...p, valor_inventario: Number(p.stock) * Number(p.costo), valor_venta: Number(p.stock) * Number(p.precio) }));
    } else if (active === 'utilidades') {
      const { data } = await supabase.from('detalle_ventas').select('cantidad, precio_unitario, costo_unitario, subtotal, venta:ventas(numero, fecha, estado)').gte('venta.fecha', from).lte('venta.fecha', to).neq('venta.estado', 'CANCELADA');
      rows = (data ?? []).map((d: any) => ({
        numero: d.venta?.numero, fecha: d.venta?.fecha,
        ingreso: Number(d.subtotal), costo: Number(d.cantidad) * Number(d.costo_unitario),
        utilidad: Number(d.subtotal) - Number(d.cantidad) * Number(d.costo_unitario),
        margen: d.subtotal > 0 ? ((Number(d.subtotal) - Number(d.cantidad) * Number(d.costo_unitario)) / Number(d.subtotal)) * 100 : 0,
      }));
    } else if (active === 'cartera') {
      const { data } = await supabase.from('cuentas_por_cobrar').select('*, cliente:clientes(nombre), venta:ventas(numero)').order('fecha_emision', { ascending: false });
      rows = data ?? [];
    } else if (active === 'auditoria') {
      const { data } = await supabase.from('auditoria').select('fecha, modulo, accion, tabla_afectada, usuario:usuarios(nombre)').gte('fecha', from).lte('fecha', to + 'T23:59:59').order('fecha', { ascending: false }).limit(500);
      rows = data ?? [];
    }
    setData(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, [active, from, to]);

  const exportCsv = () => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map((row) => headers.map((h) => {
        const v = (row as any)[h];
        if (v && typeof v === 'object') return `"${(v as any).nombre ?? (v as any).numero ?? JSON.stringify(v)}"`;
        return `"${v ?? ''}"`;
      }).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_${active}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reports: { id: ReportType; label: string; icon: typeof BarChart3 }[] = [
    { id: 'ventas', label: 'Ventas', icon: TrendingUp },
    { id: 'compras', label: 'Compras', icon: ShoppingCart },
    { id: 'inventario', label: 'Inventario', icon: Package },
    { id: 'utilidades', label: 'Utilidades', icon: Wallet },
    { id: 'cartera', label: 'Cartera', icon: Wallet },
    { id: 'auditoria', label: 'Auditoría', icon: ScrollText },
  ];

  const totals = computeTotals(active, data);

  return (
    <div>
      <PageHeader
        title="Reportes"
        subtitle="Generación de reportes por módulo"
        action={<button onClick={exportCsv} className="btn-secondary"><Download size={16} /> Exportar CSV</button>}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {reports.map((r) => {
          const Icon = r.icon;
          return (
            <button
              key={r.id}
              onClick={() => setActive(r.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${active === r.id ? 'bg-sky-700 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
            >
              <Icon size={16} /> {r.label}
            </button>
          );
        })}
      </div>

      {active !== 'inventario' && active !== 'auditoria' && (
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Desde</label>
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      )}

      {totals && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {totals.map((t) => (
            <div key={t.label} className="card p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">{t.label}</p>
              <p className="mt-0.5 font-display text-lg font-bold text-slate-900">{t.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        {loading ? (
          <LoadingScreen label="Generando reporte..." />
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Sin datos para el período seleccionado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {Object.keys(data[0]).map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} className="table-row">
                    {Object.keys(row).map((h) => {
                      const v = (row as any)[h];
                      const display = v && typeof v === 'object' ? (v.nombre ?? v.numero ?? '—') : (v ?? '—');
                      const isCurrency = ['subtotal', 'igv', 'total', 'monto_pagado', 'saldo', 'costo', 'precio', 'ingreso', 'utilidad', 'monto_total', 'valor_inventario', 'valor_venta'].includes(h);
                      return <td key={h} className="px-3 py-2 whitespace-nowrap">{isCurrency && typeof v === 'number' ? formatCurrency(v) : String(display)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function computeTotals(active: ReportType, data: any[]): { label: string; value: string }[] | null {
  if (data.length === 0) return null;
  if (active === 'ventas') {
    return [
      { label: 'Total ventas', value: formatCurrency(data.reduce((s, r) => s + Number(r.total ?? 0), 0)) },
      { label: 'Total cobrado', value: formatCurrency(data.reduce((s, r) => s + Number(r.monto_pagado ?? 0), 0)) },
      { label: 'Saldo pendente', value: formatCurrency(data.reduce((s, r) => s + Number(r.saldo ?? 0), 0)) },
      { label: 'N° documentos', value: String(data.length) },
    ];
  }
  if (active === 'compras') {
    return [
      { label: 'Total compras', value: formatCurrency(data.reduce((s, r) => s + Number(r.total ?? 0), 0)) },
      { label: 'N° órdenes', value: String(data.length) },
    ];
  }
  if (active === 'inventario') {
    return [
      { label: 'Valor inventario', value: formatCurrency(data.reduce((s, r) => s + Number(r.valor_inventario ?? 0), 0)) },
      { label: 'Valor venta', value: formatCurrency(data.reduce((s, r) => s + Number(r.valor_venta ?? 0), 0)) },
      { label: 'Productos', value: String(data.length) },
      { label: 'Stock bajo', value: String(data.filter((r) => Number(r.stock) <= Number(r.stock_minimo) && Number(r.stock_minimo) > 0).length) },
    ];
  }
  if (active === 'utilidades') {
    return [
      { label: 'Ingresos', value: formatCurrency(data.reduce((s, r) => s + Number(r.ingreso ?? 0), 0)) },
      { label: 'Costos', value: formatCurrency(data.reduce((s, r) => s + Number(r.costo ?? 0), 0)) },
      { label: 'Utilidad', value: formatCurrency(data.reduce((s, r) => s + Number(r.utilidad ?? 0), 0)) },
      { label: 'Margen %', value: `${data.length ? (data.reduce((s, r) => s + Number(r.utilidad ?? 0), 0) / data.reduce((s, r) => s + Number(r.ingreso ?? 0), 0) * 100).toFixed(1) : 0}%` },
    ];
  }
  if (active === 'cartera') {
    return [
      { label: 'Saldo total', value: formatCurrency(data.reduce((s, r) => s + Number(r.saldo ?? 0), 0)) },
      { label: 'Vigente', value: formatCurrency(data.filter((r) => r.estado === 'VIGENTE').reduce((s, r) => s + Number(r.saldo), 0)) },
      { label: 'Vencida', value: formatCurrency(data.filter((r) => r.estado === 'VENCIDA').reduce((s, r) => s + Number(r.saldo), 0)) },
      { label: 'Cuentas', value: String(data.length) },
    ];
  }
  return null;
}
