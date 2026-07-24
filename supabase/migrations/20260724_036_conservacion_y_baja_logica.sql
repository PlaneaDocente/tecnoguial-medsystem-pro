-- ============================================================
-- 20260724_036_conservacion_y_baja_logica.sql
-- TecnoGuiAI MedSystem Pro — Fase 3
--
-- Marco legal:
--   NOM-004-SSA3-2012 §5.5: el expediente clinico debe
--   conservarse por un minimo de 5 anos contados a partir de la
--   fecha del ULTIMO ACTO MEDICO.
--   NOM-024-SSA3-2012: integridad y disponibilidad del ECE.
--   LFPDPPP art. 11: los datos deben suprimirse cuando dejen de
--   ser necesarios, una vez cumplidos los plazos legales.
--
-- Problema que corrige:
--   Hoy las 4 tablas clinicas (alergias, antecedentes,
--   enfermedades cronicas, archivos) se pueden BORRAR de forma
--   permanente desde la app. Una alergia borrada por error se
--   pierde para siempre: eso es informacion clinica critica y
--   contradice la conservacion obligatoria.
--
-- Solucion: BAJA LOGICA.
--   El medico puede seguir "eliminando" registros equivocados,
--   pero el dato no desaparece: se marca con fecha, autor y
--   motivo, deja de mostrarse en la app y queda en la bitacora.
--   El borrado fisico queda prohibido.
--
-- Ejecutar completo en Supabase > SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- PARTE A: columnas de baja logica en las 4 tablas clinicas
-- ------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'patient_allergies',
    'patient_antecedents',
    'patient_chronic_diseases',
    'patient_files'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at timestamptz', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_by uuid', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_reason text', t);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%s_activos ON public.%I(patient_id) WHERE deleted_at IS NULL',
      t, t);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- PARTE B: prohibir borrado fisico en las 4 tablas clinicas
-- ------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'patient_allergies',
    'patient_antecedents',
    'patient_chronic_diseases',
    'patient_files'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_block_delete_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_block_delete_%I
       BEFORE DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.fn_block_clinical_delete()',
      t, t);
    EXECUTE format('REVOKE DELETE ON public.%I FROM authenticated, anon', t);
  END LOOP;
END $$;

-- Una baja logica no se revierte ni se re-escribe: es definitiva.
CREATE OR REPLACE FUNCTION public.fn_guard_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION
      'Este registro ya fue dado de baja; la baja es definitiva y no puede revertirse (NOM-004-SSA3-2012). Registre un dato nuevo si corresponde.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    NEW.deleted_by := COALESCE(NEW.deleted_by, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'patient_allergies',
    'patient_antecedents',
    'patient_chronic_diseases',
    'patient_files'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_guard_soft_delete_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_guard_soft_delete_%I
       BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.fn_guard_soft_delete()',
      t, t);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- PARTE C: el paciente es el expediente — no se borra
-- ------------------------------------------------------------

ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS archive_reason text;

DROP TRIGGER IF EXISTS trg_block_delete_patients ON public.patients;
CREATE TRIGGER trg_block_delete_patients
  BEFORE DELETE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_clinical_delete();

REVOKE DELETE ON public.patients FROM authenticated, anon;

-- Bitacora en patients (si aun no la tenia)
DO $$
DECLARE
  fn text;
BEGIN
  SELECT p.oid::regprocedure::text INTO fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prorettype = 'trigger'::regtype
    AND p.prosrc ILIKE '%audit_log%'
  LIMIT 1;

  IF fn IS NOT NULL THEN
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_patients ON public.patients');
    EXECUTE format(
      'CREATE TRIGGER trg_audit_patients
       AFTER INSERT OR UPDATE OR DELETE ON public.patients
       FOR EACH ROW EXECUTE FUNCTION %s', fn);
  END IF;
END $$;

-- ------------------------------------------------------------
-- PARTE D: calculo de conservacion (5 anos desde el ultimo acto)
-- ------------------------------------------------------------

-- Ultimo acto medico registrado para un paciente
CREATE OR REPLACE FUNCTION public.fn_last_clinical_activity(p_patient_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT GREATEST(
    COALESCE((SELECT MAX(consultation_date) FROM public.consultations WHERE patient_id = p_patient_id), '-infinity'::timestamptz),
    COALESCE((SELECT MAX(prescription_date) FROM public.prescriptions  WHERE patient_id = p_patient_id), '-infinity'::timestamptz),
    COALESCE((SELECT MAX(created_at) FROM public.patient_files          WHERE patient_id = p_patient_id), '-infinity'::timestamptz),
    COALESCE((SELECT created_at FROM public.patients WHERE id = p_patient_id), '-infinity'::timestamptz)
  );
$$;

-- Vista de estado de conservacion por paciente
CREATE OR REPLACE VIEW public.v_patient_retention AS
SELECT
  p.id                AS patient_id,
  p.user_id,
  p.first_name,
  p.last_name,
  p.archived_at,
  p.archive_reason,
  public.fn_last_clinical_activity(p.id)                        AS last_activity,
  public.fn_last_clinical_activity(p.id) + INTERVAL '5 years'   AS retention_until,
  (now() > public.fn_last_clinical_activity(p.id) + INTERVAL '5 years') AS retention_expired,
  GREATEST(
    0,
    EXTRACT(DAY FROM (public.fn_last_clinical_activity(p.id) + INTERVAL '5 years' - now()))
  )::int AS days_remaining
FROM public.patients p;

-- ------------------------------------------------------------
-- VERIFICACION
-- ------------------------------------------------------------

-- 1) columnas de baja logica creadas (esperado: 12 filas)
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema='public'
  AND column_name IN ('deleted_at','deleted_by','deleted_reason')
  AND table_name IN ('patient_allergies','patient_antecedents','patient_chronic_diseases','patient_files')
ORDER BY table_name, column_name;

-- 2) estado de conservacion de tus pacientes
SELECT last_name, first_name, last_activity::date, retention_until::date, days_remaining
FROM public.v_patient_retention
ORDER BY retention_until;
