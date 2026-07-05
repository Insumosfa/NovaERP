import { supabase } from './supabase';
import { logAudit } from './audit';

export async function nextDocNumber(prefix: 'COMP' | 'VENT'): Promise<string> {
  const seq = prefix === 'COMP' ? 'seq_compras_numero' : 'seq_ventas_numero';
  const { data, error } = await supabase.rpc('nextval_wrapper', { seq_name: seq });
  if (error) {
    // Fallback: derive from count
    const table = prefix === 'COMP' ? 'compras' : 'ventas';
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    const n = (count ?? 0) + 1;
    return `${prefix}-${String(n).padStart(6, '0')}`;
  }
  return `${prefix}-${String(data as number).padStart(6, '0')}`;
}

export async function adjustInventory(
  producto_id: string,
  cantidadDelta: number,
  opts: { tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'DEVOLUCION'; documento_tipo: string; documento_id: string; motivo?: string }
): Promise<{ error: string | null }> {
  const { data: prod, error: pErr } = await supabase
    .from('productos')
    .select('id, stock, sku, nombre')
    .eq('id', producto_id)
    .maybeSingle();
  if (pErr || !prod) return { error: 'Producto no encontrado' };
  const newStock = Number(prod.stock) + cantidadDelta;
  if (newStock < 0) return { error: `Stock insuficiente para ${prod.sku}` };

  const { error: updErr } = await supabase
    .from('productos')
    .update({ stock: newStock })
    .eq('id', producto_id);
  if (updErr) return { error: updErr.message };

  const { error: movErr } = await supabase.from('inventario_movimientos').insert({
    producto_id,
    tipo_movimiento: opts.tipo,
    cantidad: cantidadDelta,
    stock_resultante: newStock,
    motivo: opts.motivo ?? null,
    documento_tipo: opts.documento_tipo,
    documento_id: opts.documento_id,
  });
  if (movErr) return { error: movErr.message };

  await logAudit({
    modulo: 'inventario',
    accion: opts.tipo,
    tabla_afectada: 'inventario_movimientos',
    registro_id: producto_id,
    valor_nuevo: { stock: newStock, delta: cantidadDelta, documento: opts.documento_tipo, documento_id: opts.documento_id },
  });

  return { error: null };
}
