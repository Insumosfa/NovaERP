import { supabase } from './supabase';

export async function logAudit(entry: {
  modulo: string;
  accion: string;
  tabla_afectada?: string;
  registro_id?: string;
  valor_previo?: Record<string, unknown> | null;
  valor_nuevo?: Record<string, unknown> | null;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from('auditoria').insert({
    usuario_id: user?.id ?? null,
    modulo: entry.modulo,
    accion: entry.accion,
    tabla_afectada: entry.tabla_afectada ?? null,
    registro_id: entry.registro_id ?? null,
    valor_previo: entry.valor_previo ?? null,
    valor_nuevo: entry.valor_nuevo ?? null,
  });
}
