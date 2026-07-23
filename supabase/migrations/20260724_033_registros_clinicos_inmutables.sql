-- ============================================================
-- 20260724_033_registros_clinicos_inmutables.sql
-- TecnoGuiAI MedSystem Pro — Fase 1.2
-- NOM-004-SSA3-2012 §5.4: los registros del expediente clinico
-- no se borran ni se alteran; las correcciones se hacen por
-- ADENDA (nueva nota ligada a la original).
--
-- Reglas que implementa:
--   1. consultations: DELETE prohibido siempre.
--   2. consultations: UPDATE prohibido si status='completed'
--      (los borradores 'draft' siguen siendo editables).
--   3. prescriptions: DELETE prohibido; UPDATE solo permite
--      la transicion active -> cancelled (nada mas cambia).
--   4. prescription_items: UPDATE y DELETE prohibidos.
--   5. Doble candado: REVOKE de permisos + triggers.
--   6. Bitacora conectada a las 3 tablas (si falta).
-- Ejecutar completo en Supabase > SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- PARTE A: columna closed_at + respaldo de fecha de cierre
-- (ANTES de crear los triggers, para poder hacer el backfill)
-- ------------------------------------------------------------

ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

UPDATE public.consultations
SET closed_at = COALESCE(closed_at, updated_at, created_at)
WHERE status = 'completed' AND closed_at IS NULL;

-- ------------------------------------------------------------
-- PARTE B: funciones guardianas
-- ------------------------------------------------------------

-- B1. Bloqueo total de DELETE en registros clinicos
CREATE OR REPLACE FUNCTION public.fn_block_clinical_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'Los registros clinicos no pueden eliminarse (NOM-004-SSA3-2012; conservacion minima 5 anos, NOM-024). Tabla: %',
    TG_TABLE_NAME
    USING ERRCODE = '42501';
END;
$$;

-- B2. Consultas: cerradas = inalterables; borradores editables.
--     Al cerrar (draft -> completed) se sella closed_at.
CREATE OR REPLACE FUNCTION public.fn_guard_consultation_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'completed' THEN
    RAISE EXCEPTION
      'La consulta esta cerrada y es inalterable (NOM-004-SSA3-2012). Las correcciones se registran mediante una adenda.'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.status = 'draft' AND NEW.status = 'completed' THEN
    NEW.closed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

-- B3. Recetas: emitida = inalterable; unica transicion valida
--     es cancelarla (active -> cancelled) sin tocar nada mas.
CREATE OR REPLACE FUNCTION public.fn_guard_prescription_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'active'
     AND NEW.status = 'cancelled'
     AND (to_jsonb(OLD) - 'status' - 'updated_at' - 'cancellation_reason' - 'cancelled_at')
       = (to_jsonb(NEW) - 'status' - 'updated_at' - 'cancellation_reason' - 'cancelled_at')
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Las recetas emitidas son inalterables (NOM-004-SSA3-2012). Solo se permite cancelarlas (active -> cancelled).'
    USING ERRCODE = '42501';
END;
$$;

-- B4. Partidas de receta: nunca se alteran ni se borran
CREATE OR REPLACE FUNCTION public.fn_block_prescription_item_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'Los medicamentos de una receta emitida son inalterables (NOM-004-SSA3-2012). Para corregir, cancele la receta y emita una nueva.'
    USING ERRCODE = '42501';
END;
$$;

-- ------------------------------------------------------------
-- PARTE C: triggers
-- ------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_block_delete_consultations ON public.consultations;
CREATE TRIGGER trg_block_delete_consultations
  BEFORE DELETE ON public.consultations
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_clinical_delete();

DROP TRIGGER IF EXISTS trg_guard_update_consultations ON public.consultations;
CREATE TRIGGER trg_guard_update_consultations
  BEFORE UPDATE ON public.consultations
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_consultation_update();

DROP TRIGGER IF EXISTS trg_block_delete_prescriptions ON public.prescriptions;
CREATE TRIGGER trg_block_delete_prescriptions
  BEFORE DELETE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_clinical_delete();

DROP TRIGGER IF EXISTS trg_guard_update_prescriptions ON public.prescriptions;
CREATE TRIGGER trg_guard_update_prescriptions
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_prescription_update();

DROP TRIGGER IF EXISTS trg_block_mutation_prescription_items ON public.prescription_items;
CREATE TRIGGER trg_block_mutation_prescription_items
  BEFORE UPDATE OR DELETE ON public.prescription_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_prescription_item_mutation();

-- ------------------------------------------------------------
-- PARTE D: segundo candado — revocar permisos directos
-- ------------------------------------------------------------

REVOKE DELETE ON public.consultations       FROM authenticated, anon;
REVOKE DELETE ON public.prescriptions       FROM authenticated, anon;
REVOKE DELETE ON public.prescription_items  FROM authenticated, anon;
REVOKE UPDATE ON public.prescription_items  FROM authenticated, anon;

-- ------------------------------------------------------------
-- PARTE E: asegurar bitacora en las 3 tablas clinicas
-- (detecta la funcion de auditoria de la migracion 030)
-- ------------------------------------------------------------

DO $$
DECLARE
  fn text;
  t  text;
BEGIN
  SELECT p.oid::regprocedure::text INTO fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prorettype = 'trigger'::regtype
    AND p.prosrc ILIKE '%audit_log%'
  LIMIT 1;

  IF fn IS NULL THEN
    RAISE WARNING 'No se encontro la funcion de auditoria. Verifica la migracion 030.';
    RETURN;
  END IF;

  FOREACH t IN ARRAY ARRAY['consultations','prescriptions','prescription_items']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%I
       AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION %s',
      t, t, fn
    );
    RAISE NOTICE 'Bitacora conectada a: %', t;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- VERIFICACION (esperado: 5 triggers guardianes)
-- ------------------------------------------------------------
SELECT event_object_table AS tabla, trigger_name, event_manipulation AS evento
FROM information_schema.triggers
WHERE trigger_name LIKE 'trg_block%' OR trigger_name LIKE 'trg_guard%'
ORDER BY tabla, trigger_name, evento;
