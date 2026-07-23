-- ============================================================
-- 20260723_032_tablas_clinicas_y_pgcrypto.sql
-- TecnoGuiAI MedSystem Pro
-- REEMPLAZA a la migración 031 (no ejecutes la 031; si ya la
-- ejecutaste, esta la corrige — las tablas estaban vacías).
--
-- Corrige:
--   A) ERROR 42883: function digest(text, unknown) does not exist
--   B) 404 en las 4 tablas clínicas faltantes
--   C) Columnas alineadas EXACTAMENTE con src/lib/types.ts
-- Ejecutar completo en Supabase > SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- PARTE A: habilitar pgcrypto y hacer visible digest()
-- ------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Fijar search_path en toda función de public que use digest(),
-- sin importar su nombre exacto
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosrc ILIKE '%digest(%'
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path = public, extensions',
      r.fn
    );
    RAISE NOTICE 'search_path corregido en: %', r.fn;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- PARTE B: crear las 4 tablas con las columnas que usa el código
-- (se eliminan primero por si corriste la 031 — estaban vacías)
-- ------------------------------------------------------------

DROP TABLE IF EXISTS public.patient_allergies CASCADE;
DROP TABLE IF EXISTS public.patient_antecedents CASCADE;
DROP TABLE IF EXISTS public.patient_chronic_diseases CASCADE;
DROP TABLE IF EXISTS public.patient_files CASCADE;

-- 1. Alergias  (types.ts: PatientAllergy)
CREATE TABLE public.patient_allergies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  allergen      text NOT NULL,
  severity      text NOT NULL DEFAULT 'moderate'
                CHECK (severity IN ('mild','moderate','severe')),
  reaction_type text,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 2. Antecedentes  (types.ts: PatientAntecedent)
CREATE TABLE public.patient_antecedents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  type           text NOT NULL DEFAULT 'personal'
                 CHECK (type IN ('family','personal','surgical')),
  condition      text NOT NULL,
  relationship   text,
  diagnosed_date date,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 3. Enfermedades crónicas  (types.ts: PatientChronicDisease)
CREATE TABLE public.patient_chronic_diseases (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  disease_id     uuid,
  disease_name   text NOT NULL,
  diagnosis_date date,
  status         text NOT NULL DEFAULT 'controlled'
                 CHECK (status IN ('controlled','uncontrolled')),
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 4. Archivos  (types.ts: PatientFile; binarios en Storage)
CREATE TABLE public.patient_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  file_name     text NOT NULL,
  file_type     text,
  file_url      text NOT NULL,
  storage_path  text,
  file_category text NOT NULL DEFAULT 'other'
                CHECK (file_category IN ('laboratory','imaging','clinical','prescription','other')),
  file_size     bigint,
  notes         text,
  uploaded_by   uuid DEFAULT auth.uid(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Índices por paciente
CREATE INDEX idx_pat_allergies_patient   ON public.patient_allergies(patient_id);
CREATE INDEX idx_pat_antecedents_patient ON public.patient_antecedents(patient_id);
CREATE INDEX idx_pat_chronic_patient     ON public.patient_chronic_diseases(patient_id);
CREATE INDEX idx_pat_files_patient       ON public.patient_files(patient_id);

-- ------------------------------------------------------------
-- PARTE C: RLS — hereda el acceso de la tabla patients
-- (solo ves registros de pacientes que tú puedes ver)
-- ------------------------------------------------------------

ALTER TABLE public.patient_allergies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_antecedents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_chronic_diseases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_files            ENABLE ROW LEVEL SECURITY;

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
    EXECUTE format(
      'CREATE POLICY sel_%I ON public.%I FOR SELECT TO authenticated
       USING (patient_id IN (SELECT id FROM public.patients))', t, t);
    EXECUTE format(
      'CREATE POLICY ins_%I ON public.%I FOR INSERT TO authenticated
       WITH CHECK (patient_id IN (SELECT id FROM public.patients))', t, t);
    EXECUTE format(
      'CREATE POLICY upd_%I ON public.%I FOR UPDATE TO authenticated
       USING (patient_id IN (SELECT id FROM public.patients))
       WITH CHECK (patient_id IN (SELECT id FROM public.patients))', t, t);
    EXECUTE format(
      'CREATE POLICY del_%I ON public.%I FOR DELETE TO authenticated
       USING (patient_id IN (SELECT id FROM public.patients))', t, t);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- PARTE D: conectar las 4 tablas a la bitácora de auditoría
-- (detecta automáticamente la función de auditoría de la mig. 030)
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
    RAISE WARNING 'No se encontró la función de auditoría. Verifica que la migración 030 se aplicó.';
    RETURN;
  END IF;

  FOREACH t IN ARRAY ARRAY[
    'patient_allergies',
    'patient_antecedents',
    'patient_chronic_diseases',
    'patient_files'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%I
       AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION %s',
      t, t, fn
    );
    RAISE NOTICE 'Trigger de auditoría creado en: %', t;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- PARTE E: bucket de Storage para archivos de pacientes
-- (el código sube a 'patient-files'; si no existe, los archivos fallan)
-- ------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-files', 'patient-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "patient_files_select" ON storage.objects;
DROP POLICY IF EXISTS "patient_files_insert" ON storage.objects;
DROP POLICY IF EXISTS "patient_files_delete" ON storage.objects;

CREATE POLICY "patient_files_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'patient-files');

CREATE POLICY "patient_files_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'patient-files');

CREATE POLICY "patient_files_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'patient-files');

-- ------------------------------------------------------------
-- VERIFICACIÓN (debe regresar: pgcrypto | extensions, y 4 tablas)
-- ------------------------------------------------------------
SELECT extname AS extension, extnamespace::regnamespace AS esquema
FROM pg_extension WHERE extname = 'pgcrypto';

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('patient_allergies','patient_antecedents','patient_chronic_diseases','patient_files')
ORDER BY table_name;
