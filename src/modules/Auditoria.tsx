import { useEffect, useState } from 'react';
import { Search, ScrollText, Filter } from 'lucide-react';
import { supabase, formatDateTime } from '../lib/supabase';
import type { Auditoria } from '../lib/types';
import { Badge, EmptyState, PageHeader } from '../components/ui';

export function Auditoria() {
  const [items, setItems] = useState<Auditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [moduloFilter, setModuloFilter] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('auditoria').select('*, usuario:usuarios(nombre, email)').order('fecha', { ascending: false }).limit(500);
    setItems((data as Auditoria[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const modulos = Array.from(new Set(items.map((i) => i.modulo))).sort();

  const filtered = items.filter((a) => {
    const matchSearch = !search ||
      a.accion.toLowerCase().includes(search.toLowerCase()) ||
      a.modulo.toLowerCase().includes(search.toLowerCase()) ||
      (a.usuario?.nombre ?? '').toLowerCase().includes(search.toLowerCase());
    const matchModulo = !moduloFilter || a.modulo === moduloFilter;
    return matchSearch && matchModulo;
  });

  return (
    <div>
      <PageHeader title="Auditoría" subtitle="Bitácora completa de acciones del sistema" />

      <div className="card">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Buscar por acción, módulo o usuario..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select className="input" value={moduloFilter} onChange={(e) => setModuloFilter(e.target.value)}>
              <option value="">Todos los módulos</option>
              {modulos.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Cargando...</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<ScrollText size={28} />} title="Sin registros de auditoría" subtitle="Las acciones del sistema se registrarán aquí automáticamente." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                  <th className="px-4 py-3 text-left font-semibold">Usuario</th>
                  <th className="px-4 py-3 text-left font-semibold">Módulo</th>
                  <th className="px-4 py-3 text-left font-semibold">Acción</th>
                  <th className="px-4 py-3 text-left font-semibold">Tabla</th>
                  <th className="px-4 py-3 text-left font-semibold">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="table-row">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDateTime(a.fecha)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{a.usuario?.nombre ?? '—'}</td>
                    <td className="px-4 py-3"><Badge color="sky">{a.modulo}</Badge></td>
                    <td className="px-4 py-3"><Badge color={actionColor(a.accion)}>{a.accion}</Badge></td>
                    <td className="px-4 py-3 text-slate-600 text-xs font-mono">{a.tabla_afectada ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-md">
                      {a.valor_nuevo ? <pre className="whitespace-pre-wrap break-words">{JSON.stringify(a.valor_nuevo).slice(0, 200)}</pre> : '—'}
                    </td>
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

function actionColor(a: string): 'green' | 'sky' | 'amber' | 'red' | 'slate' {
  if (a.includes('INSERT') || a === 'ENTRADA') return 'green';
  if (a.includes('UPDATE') || a === 'AJUSTE') return 'sky';
  if (a.includes('DELETE') || a.includes('CANCEL') || a === 'SALIDA') return 'red';
  if (a.includes('CONFIRM')) return 'amber';
  return 'slate';
}
