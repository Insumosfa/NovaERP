import { useEffect, useState } from 'react';
import {
  TrendingUp, DollarSign, ShoppingCart,
  Package, AlertTriangle, Users, Wallet, ArrowRight,
} from 'lucide-react';
import { supabase, formatCurrency, formatDate } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import type { Module } from '../lib/permissions';
import { LoadingScreen } from '../components/ui';

interface Kpi {
  label: string;
  value: string;
  delta?: string;
  icon: typeof DollarSign;
  color: string;
  bg: string;
}

export function Dashboard({ onNavigate }: { onNavigate: (m: Module) => void }) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [arAging, setArAging] = useState({ vigente: 0, vencida: 0, total: 0 });

  useEffect(() => {
    (async () => {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

      const [
        salesMonth, purchasesMonth, productsCount, clientsCount,
        recent, ar,
      ] = await Promise.all([
        supabase.from('ventas').select('total, estado, fecha').gte('fecha', monthStart.slice(0, 10)).neq('estado', 'CANCELADA'),
        supabase.from('compras').select('total, fecha').gte('fecha', monthStart.slice(0, 10)).neq('estado', 'CANCELADA'),
        supabase.from('productos').select('id, stock, stock_minimo, precio, costo', { count: 'exact', head: false }),
        supabase.from('clientes').select('id', { count: 'exact', head: true }),
        supabase.from('ventas').select('id, numero, cliente:clientes(nombre), total, saldo, estado, fecha').order('created_at', { ascending: false }).limit(6),
        supabase.from('cuentas_por_cobrar').select('saldo, estado, dias_mora'),
      ]);

      const monthSales = (salesMonth.data ?? []).reduce((s, r) => s + Number(r.total), 0);
      const monthPurchases = (purchasesMonth.data ?? []).reduce((s, r) => s + Number(r.total), 0);
      const inventoryValue = (productsCount.data ?? []).reduce((s, p) => s + Number(p.stock) * Number(p.costo), 0);
      const lowStockItems = (productsCount.data ?? []).filter((p) => Number(p.stock) <= Number(p.stock_minimo) && Number(p.stock_minimo) > 0);

      const vigente = (ar.data ?? []).filter(r => r.estado === 'VIGENTE').reduce((s, r) => s + Number(r.saldo), 0);
      const vencida = (ar.data ?? []).filter(r => r.estado === 'VENCIDA').reduce((s, r) => s + Number(r.saldo), 0);

      setKpis([
        { label: 'Ventas del mes', value: formatCurrency(monthSales), icon: TrendingUp, color: 'text-sky-700', bg: 'bg-sky-50' },
        { label: 'Compras del mes', value: formatCurrency(monthPurchases), icon: ShoppingCart, color: 'text-violet-700', bg: 'bg-violet-50' },
        { label: 'Valor de inventario', value: formatCurrency(inventoryValue), icon: Package, color: 'text-amber-700', bg: 'bg-amber-50' },
        { label: 'Cuentas por cobrar', value: formatCurrency(vigente + vencida), icon: Wallet, color: 'text-emerald-700', bg: 'bg-emerald-50' },
        { label: 'Clientes activos', value: String(clientsCount.count ?? 0), icon: Users, color: 'text-blue-700', bg: 'bg-blue-50' },
        { label: 'Productos en stock bajo', value: String(lowStockItems.length), icon: AlertTriangle, color: 'text-red-700', bg: 'bg-red-50' },
      ]);

      setRecentSales(recent.data ?? []);
      setLowStock(lowStockItems.slice(0, 5));
      setArAging({ vigente, vencida, total: vigente + vencida });
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingScreen label="Cargando indicadores..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Hola, {usuario?.nombre?.split(' ')[0] ?? 'Usuario'} 👋
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">Resumen del negocio en tiempo real.</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="card p-5 transition hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{k.label}</p>
                  <p className="mt-2 font-display text-2xl font-bold text-slate-900">{k.value}</p>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${k.bg} ${k.color}`}>
                  <Icon size={20} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent sales */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h3 className="font-display text-base font-semibold text-slate-900">Ventas recientes</h3>
            <button onClick={() => onNavigate('ventas')} className="flex items-center gap-1 text-sm font-semibold text-sky-700 hover:text-sky-800">
              Ver todas <ArrowRight size={14} />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentSales.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No hay ventas registradas.</p>
            ) : (
              recentSales.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{s.numero}</p>
                    <p className="text-xs text-slate-500">{s.cliente?.nombre ?? '—'} · {formatDate(s.fecha)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{formatCurrency(s.total)}</p>
                    <EstadoBadge estado={s.estado} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AR aging */}
        <div className="card">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="font-display text-base font-semibold text-slate-900">Cartera por cobrar</h3>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Vigente</span>
                <span className="font-semibold text-emerald-700">{formatCurrency(arAging.vigente)}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-emerald-500" style={{ width: `${arAging.total ? (arAging.vigente / arAging.total) * 100 : 0}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Vencida</span>
                <span className="font-semibold text-red-700">{formatCurrency(arAging.vencida)}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-red-500" style={{ width: `${arAging.total ? (arAging.vencida / arAging.total) * 100 : 0}%` }} />
              </div>
            </div>
            <button onClick={() => onNavigate('cuentas_por_cobrar')} className="btn-secondary w-full">
              Ver detalle
            </button>
          </div>
        </div>
      </div>

      {/* Low stock */}
      {lowStock.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h3 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" /> Productos con stock bajo
            </h3>
            <button onClick={() => onNavigate('inventario')} className="text-sm font-semibold text-sky-700 hover:text-sky-800">
              Ver inventario
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{p.nombre}</p>
                  <p className="text-xs text-slate-500">SKU: {p.sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-600">{Number(p.stock)} {p.unidad ?? ''}</p>
                  <p className="text-xs text-slate-500">Mín: {Number(p.stock_minimo)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { color: any; label: string }> = {
    PENDIENTE: { color: 'slate', label: 'Pendiente' },
    PENDIENTE_ENTREGA: { color: 'amber', label: 'Pend. Entrega' },
    ENTREGADA: { color: 'blue', label: 'Entregada' },
    PARCIALMENTE_PAGADA: { color: 'amber', label: 'Parcial' },
    PAGADA: { color: 'green', label: 'Pagada' },
    POR_COBRAR: { color: 'purple', label: 'Por Cobrar' },
    CANCELADA: { color: 'red', label: 'Cancelada' },
  };
  const cfg = map[estado] ?? { color: 'slate', label: estado };
  return <span className={`badge bg-${cfg.color}-100 text-${cfg.color}-700`}>{cfg.label}</span>;
}
