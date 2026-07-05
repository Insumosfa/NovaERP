import { useEffect, useState } from 'react';
import { Search, Truck, CheckCircle2, XCircle, MapPin, PenLine, Camera, FileText } from 'lucide-react';
import { supabase, formatCurrency, formatDateTime } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { logAudit } from '../lib/audit';
import type { Venta, Entrega } from '../lib/types';
import { Modal, Badge, EmptyState, PageHeader, Toast } from '../components/ui';

export function Entregas() {
  const { user, usuario } = useAuth();
  const [items, setItems] = useState<Venta[]>([]);
  const [entregasMap, setEntregasMap] = useState<Record<string, Entrega[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirmOpen, setConfirmOpen] = useState<Venta | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState<{ direccion: string; evidencia_tipo: string; evidencia_url: string; evidencia_nota: string }>({ direccion: '', evidencia_tipo: 'FIRMA', evidencia_url: '', evidencia_nota: '' });

  const load = async () => {
    setLoading(true);
    const [v, e] = await Promise.all([
      supabase.from('ventas').select('*, cliente:clientes(nombre)').in('estado', ['PENDIENTE_ENTREGA', 'ENTREGADA']).order('created_at', { ascending: false }),
      supabase.from('entregas_ventas').select('*'),
    ]);
    const ventas = (v.data as Venta[]) ?? [];
    setItems(ventas);
    const map: Record<string, Entrega[]> = {};
    (e.data ?? []).forEach((en: Entrega) => {
      if (!map[en.venta_id]) map[en.venta_id] = [];
      map[en.venta_id].push(en);
    });
    setEntregasMap(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter((v) =>
    v.numero.toLowerCase().includes(search.toLowerCase()) ||
    (v.cliente?.nombre ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const openConfirm = (v: Venta) => {
    setConfirmOpen(v);
    setForm({ direccion: '', evidencia_tipo: 'FIRMA', evidencia_url: '', evidencia_nota: '' });
  };

  const confirm = async () => {
    if (!confirmOpen) return;
    // Business rule: delivery must be confirmed by a different user than the vendedor
    if (confirmOpen.vendedor_id === user?.id) {
      setToast('La entrega debe ser confirmada por un usuario diferente al vendedor.');
      return;
    }
    const { data: entrega, error } = await supabase.from('entregas_ventas').insert({
      venta_id: confirmOpen.id,
      confirmado_por: user?.id,
      fecha_entrega: new Date().toISOString(),
      direccion_entrega: form.direccion,
      evidencia_tipo: form.evidencia_tipo,
      evidencia_url: form.evidencia_url || null,
      evidencia_nota: form.evidencia_nota || null,
      estado: 'CONFIRMADA',
    }).select().single();
    if (error) { setToast(error.message); return; }

    // Update sale state to ENTREGADA
    await supabase.from('ventas').update({ estado: 'ENTREGADA', updated_by: user?.id }).eq('id', confirmOpen.id);
    await logAudit({ modulo: 'entregas', accion: 'CONFIRM', tabla_afectada: 'entregas_ventas', registro_id: entrega.id, valor_nuevo: { venta_id: confirmOpen.id, confirmado_por: user?.id, evidencia_tipo: form.evidencia_tipo } as any });
    setToast(`Entrega confirmada para ${confirmOpen.numero}`);
    setConfirmOpen(null);
    load();
  };

  const reject = async (v: Venta) => {
    if (v.vendedor_id === user?.id) {
      setToast('La entrega debe ser rechazada por un usuario diferente al vendedor.');
      return;
    }
    const { data: entrega } = await supabase.from('entregas_ventas').insert({
      venta_id: v.id, confirmado_por: user?.id, estado: 'RECHAZADA', evidencia_nota: 'Rechazado',
    }).select().single();
    await logAudit({ modulo: 'entregas', accion: 'REJECT', tabla_afectada: 'entregas_ventas', registro_id: entrega?.id, valor_nuevo: { venta_id: v.id, estado: 'RECHAZADA' } as any });
    setToast('Entrega rechazada');
    load();
  };

  return (
    <div>
      <PageHeader
        title="Entregas"
        subtitle="Confirmación de entregas (debe ser por usuario distinto al vendedor)"
      />

      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Regla de negocio:</strong> La entrega debe ser confirmada por un usuario diferente al vendedor que registró la venta. Evidencia requerida (firma, foto o guía).
      </div>

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
          <EmptyState icon={<Truck size={28} />} title="Sin entregas pendientes" subtitle="Las ventas con estado 'Pendiente de Entrega' aparecerán aquí." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Número</th>
                  <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 text-center font-semibold">Estado</th>
                  <th className="px-4 py-3 text-left font-semibold">Entregas previas</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => {
                  const entregas = entregasMap[v.id] ?? [];
                  const isOwn = v.vendedor_id === user?.id;
                  return (
                    <tr key={v.id} className="table-row">
                      <td className="px-4 py-3 font-mono font-semibold text-slate-800">{v.numero}</td>
                      <td className="px-4 py-3 text-slate-700">{v.cliente?.nombre ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(v.total)}</td>
                      <td className="px-4 py-3 text-center"><Badge color={v.estado === 'ENTREGADA' ? 'blue' : 'amber'}>{v.estado === 'ENTREGADA' ? 'Entregada' : 'Pend. Entrega'}</Badge></td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {entregas.length === 0 ? '—' : entregas.map((e, i) => (
                          <div key={i}><Badge color={e.estado === 'CONFIRMADA' ? 'green' : 'red'}>{e.estado}</Badge> {formatDateTime(e.fecha_entrega)}</div>
                        ))}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {v.estado === 'PENDIENTE_ENTREGA' && (
                            <>
                              <button onClick={() => openConfirm(v)} className="btn-primary text-xs" disabled={isOwn} title={isOwn ? 'No puede confirmar su propia venta' : ''}>
                                <CheckCircle2 size={14} /> Confirmar
                              </button>
                              <button onClick={() => reject(v)} className="btn-secondary text-xs" disabled={isOwn}>
                                <XCircle size={14} />
                              </button>
                            </>
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

      <Modal open={!!confirmOpen} onClose={() => setConfirmOpen(null)} title={`Confirmar entrega — ${confirmOpen?.numero}`}>
        <div className="space-y-4">
          <div className="rounded-lg bg-sky-50 p-3 text-sm text-sky-800">
            <p><strong>Cliente:</strong> {confirmOpen?.cliente?.nombre ?? '—'}</p>
            <p><strong>Total:</strong> {formatCurrency(confirmOpen?.total ?? 0)}</p>
            <p><strong>Confirmado por:</strong> {usuario?.nombre} ({usuario?.email})</p>
          </div>
          <div>
            <label className="label"><MapPin size={14} className="inline mr-1" /> Dirección de entrega</label>
            <input className="input" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Av. Principal 123, Lima" />
          </div>
          <div>
            <label className="label">Tipo de evidencia *</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: 'FIRMA', label: 'Firma', icon: PenLine },
                { v: 'FOTO', label: 'Foto', icon: Camera },
                { v: 'GUIA', label: 'Guía', icon: FileText },
              ].map((o) => {
                const Icon = o.icon;
                const active = form.evidencia_tipo === o.v;
                return (
                  <button
                    key={o.v}
                    onClick={() => setForm({ ...form, evidencia_tipo: o.v })}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-sm transition ${active ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Icon size={20} />
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="label">URL / referencia de evidencia</label>
            <input className="input" value={form.evidencia_url} onChange={(e) => setForm({ ...form, evidencia_url: e.target.value })} placeholder="https://... o código de guía" />
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} value={form.evidencia_nota} onChange={(e) => setForm({ ...form, evidencia_nota: e.target.value })} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setConfirmOpen(null)} className="btn-secondary">Cancelar</button>
          <button onClick={confirm} className="btn-primary"><CheckCircle2 size={16} /> Confirmar entrega</button>
        </div>
      </Modal>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
