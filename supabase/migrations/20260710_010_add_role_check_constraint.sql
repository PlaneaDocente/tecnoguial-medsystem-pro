-- =====================================================================
-- 20260710_010_add_role_check_constraint.sql
--
-- Fix pendiente confirmado por la verificacion:
--   role_tiene_check_constraint = FALSE
--
-- Sin CHECK constraint, la columna `role` acepta cualquier string. Aunque
-- el trigger corregido `handle_new_user` ya solo asigna 'doctor', un
-- service_role directo o un INSERT desde el SQL Editor podria meter
-- valores como 'superadmin', 'root', 'system'. El CHECK lo prohibe a
-- nivel de base.
--
-- Idempotente: se puede correr multiples veces.
-- Se ejecuta en transaccion; hace rollback si algun perfil existente
-- tiene un valor invalido (te avisa cual).
-- =====================================================================

BEGIN;

-- Paso 1: chequear si hay perfiles con valores invalidos antes de agregar el constraint.
DO $$
DECLARE
  v_bad_count INTEGER;
  v_examples TEXT;
BEGIN
  SELECT COUNT(*), string_agg(DISTINCT role, ', ')
    INTO v_bad_count, v_examples
  FROM public.profiles
  WHERE role IS NULL OR role NOT IN ('doctor', 'psicologo', 'admin');

  IF v_bad_count > 0 THEN
    RAISE EXCEPTION 'Existen % perfiles con roles invalidos (ejemplos: %). Corrigelos antes de agregar el CHECK. UPDATE public.profiles SET role=''doctor'' WHERE role NOT IN (''doctor'',''psicologo'',''admin'');', v_bad_count, v_examples;
  END IF;
END $$;

-- Paso 2: agregar el CHECK (o reemplazarlo si existiera uno viejo).
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('doctor', 'psicologo', 'admin'));

-- Paso 3: verificar que quedo aplicado.
DO $$
DECLARE
  v_ok BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_role_check'
  ) INTO v_ok;

  IF v_ok THEN
    RAISE NOTICE 'OK: constraint profiles_role_check aplicado correctamente.';
  ELSE
    RAISE EXCEPTION 'FALLO: el constraint no quedo aplicado.';
  END IF;
END $$;

COMMIT;

-- =====================================================================
-- Prueba de humo despues de aplicar:
--
--   INSERT INTO public.profiles (id, email, role)
--   VALUES (gen_random_uuid(), 'test@x.com', 'superadmin');
--
--   DEBE fallar con:
--   ERROR:  new row for relation "profiles" violates check constraint "profiles_role_check"
--
--   INSERT INTO public.profiles (id, email, role)
--   VALUES (gen_random_uuid(), 'test@x.com', 'doctor');
--
--   DEBE tener exito.
--   (Recuerda borrar la fila de prueba: DELETE FROM public.profiles WHERE email='test@x.com';)
-- =====================================================================
