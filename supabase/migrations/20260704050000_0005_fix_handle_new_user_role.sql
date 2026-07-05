-- =============================================================
-- Fix handle_new_user: assign rol_id automatically on signup
-- - First user ever → Administrador
-- - Subsequent users → Vendedor
-- This runs as SECURITY DEFINER so it bypasses RLS restrictions.
-- =============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rol_id uuid;
  v_target_role text;
  v_count int;
BEGIN
  -- Count existing users (before this insert commits, so count = 0 means first user)
  SELECT COUNT(*) INTO v_count FROM public.usuarios;
  v_target_role := CASE WHEN v_count = 0 THEN 'Administrador' ELSE 'Vendedor' END;

  SELECT id INTO v_rol_id FROM public.roles WHERE nombre = v_target_role LIMIT 1;

  INSERT INTO public.usuarios (id, email, nombre, rol_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email),
    v_rol_id
  )
  ON CONFLICT (id) DO UPDATE
    SET
      nombre  = COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email),
      rol_id  = COALESCE(public.usuarios.rol_id, v_rol_id),
      email   = NEW.email;

  RETURN NEW;
END;
$$;

-- Ensure the trigger is still in place (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
