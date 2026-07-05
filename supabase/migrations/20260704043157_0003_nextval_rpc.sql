/*
# Helper RPC: nextval_wrapper

## Purpose
Exposes `nextval()` for named sequences so the frontend can generate
sequential document numbers (COMP-000001, VENT-000001) without leaking
raw sequence access. Returns the new integer value.

## Security
- SECURITY DEFINER so the anon/authenticated role can call it.
- Only accepts the two known sequence names used by the ERP.
*/

CREATE OR REPLACE FUNCTION public.nextval_wrapper(seq_name text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result bigint;
BEGIN
  IF seq_name NOT IN ('seq_compras_numero', 'seq_ventas_numero') THEN
    RAISE EXCEPTION 'Secuencia no permitida: %', seq_name;
  END IF;
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.nextval_wrapper(text) TO authenticated, anon;
