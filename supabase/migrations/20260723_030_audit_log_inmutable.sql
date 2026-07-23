-- =====================================================================
-- 20260723_030_audit_log_inmutable.sql
--
-- FASE 1.1 — Bitacora de auditoria inmutable (NOM-024-SSA3-2012 §7)
--
-- Registra automaticamente toda operacion INSERT/UPDATE/DELETE sobre las
-- tablas clinicas. La bitacora NO se puede editar ni borrar por nadie,
-- ni siquiera por el propietario de la cuenta.
--
-- Idempotente: se puede correr varias veces sin daño.
-- =====================================================================

BEGIN;

-- pgcrypto provee digest() para el hash de integridad
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- 1) Tabla de bitacora
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id             BIGSERIAL PRIMARY KEY,
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id       UUID,                    -- quien ejecuto la accion
  actor_email    TEXT,                    -- snapshot: sobrevive si se borra el usuario
  actor_role     TEXT,
  action         TEXT NOT NULL,           -- INSERT | UPDATE | DELETE
  table_name     TEXT NOT NULL,
  record_id      TEXT,                    -- id del registro afectado
  patient_id     UUID,                    -- paciente involucrado (si aplica)
  old_data       JSONB,                   -- estado anterior
  new_data       JSONB,                   -- estado nuevo
  ip_address     TEXT,
  user_agent     TEXT,
  integrity_hash TEXT                     -- SHA-256 del contenido del registro
);

CREATE INDEX IF NOT EXISTS idx_audit_log_occurred   ON public.audit_log(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor      ON public.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_patient    ON public.audit_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table      ON public.audit_log(table_name);

COMMENT ON TABLE public.audit_log IS
  'Bitacora inmutable de acciones sobre datos clinicos. NOM-024-SSA3-2012. No editable ni eliminable.';

-- ---------------------------------------------------------------------
-- 2) Funcion de auditoria (SECURITY DEFINER: escribe aunque haya RLS)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id    UUID;
  v_actor_email TEXT;
  v_actor_role  TEXT;
  v_record_id   TEXT;
  v_patient_id  UUID;
  v_old         JSONB;
  v_new         JSONB;
  v_ip          TEXT;
  v_ua          TEXT;
  v_headers     JSON;
BEGIN
  -- Identidad del actor
  BEGIN
    v_actor_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_actor_id := NULL;
  END;

  IF v_actor_id IS NOT NULL THEN
    SELECT email, role INTO v_actor_email, v_actor_role
    FROM public.profiles WHERE id = v_actor_id;
  END IF;

  -- Datos de la peticion (headers que PostgREST expone)
  BEGIN
    v_headers := current_setting('request.headers', true)::json;
    v_ip := COALESCE(v_headers->>'x-forwarded-for', v_headers->>'x-real-ip');
    v_ua := v_headers->>'user-agent';
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
    v_ua := NULL;
  END;

  -- Snapshots
  IF (TG_OP = 'DELETE') THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
    v_record_id := (to_jsonb(OLD)->>'id');
  ELSIF (TG_OP = 'UPDATE') THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := (to_jsonb(NEW)->>'id');
  ELSE
    v_old := NULL;
    v_new := to_jsonb(NEW);
    v_record_id := (to_jsonb(NEW)->>'id');
  END IF;

  -- Paciente involucrado: en 'patients' es el propio id; en las demas, patient_id
  IF TG_TABLE_NAME = 'patients' THEN
    v_patient_id := v_record_id::UUID;
  ELSE
    BEGIN
      v_patient_id := COALESCE(v_new->>'patient_id', v_old->>'patient_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_patient_id := NULL;
    END;
  END IF;

  INSERT INTO public.audit_log (
    actor_id, actor_email, actor_role, action, table_name, record_id,
    patient_id, old_data, new_data, ip_address, user_agent, integrity_hash
  ) VALUES (
    v_actor_id, v_actor_email, v_actor_role, TG_OP, TG_TABLE_NAME, v_record_id,
    v_patient_id, v_old, v_new, v_ip, v_ua,
    encode(
      digest(
        COALESCE(v_actor_id::text,'') || TG_OP || TG_TABLE_NAME ||
        COALESCE(v_record_id,'') || COALESCE(v_old::text,'') ||
        COALESCE(v_new::text,'') || NOW()::text,
        'sha256'
      ),
      'hex'
    )
  );

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- 3) Aplicar triggers a las tablas clinicas
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  tablas TEXT[] := ARRAY[
    'patients',
    'consultations',
    'prescriptions',
    'prescription_items',
    'patient_files',
    'appointments',
    'patient_allergies',
    'patient_antecedents',
    'patient_chronic_diseases'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=t
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I;', t, t);
      EXECUTE format(
        'CREATE TRIGGER trg_audit_%I
           AFTER INSERT OR UPDATE OR DELETE ON public.%I
           FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();',
        t, t
      );
      RAISE NOTICE 'Trigger de auditoria aplicado a: %', t;
    ELSE
      RAISE NOTICE 'Tabla no encontrada (se omite): %', t;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 4) INMUTABILIDAD: nadie puede modificar ni borrar la bitacora
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_block_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'La bitacora de auditoria es inmutable (NOM-024-SSA3-2012). Operacion % denegada.', TG_OP
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_no_update ON public.audit_log;
CREATE TRIGGER trg_audit_no_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_audit_mutation();

DROP TRIGGER IF EXISTS trg_audit_no_delete ON public.audit_log;
CREATE TRIGGER trg_audit_no_delete
  BEFORE DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_audit_mutation();

DROP TRIGGER IF EXISTS trg_audit_no_truncate ON public.audit_log;
CREATE TRIGGER trg_audit_no_truncate
  BEFORE TRUNCATE ON public.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.fn_block_audit_mutation();

-- ---------------------------------------------------------------------
-- 5) RLS: cada usuario solo LEE lo que le corresponde. Nadie escribe.
-- ---------------------------------------------------------------------
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select_own" ON public.audit_log;
CREATE POLICY "audit_select_own"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (
    actor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = audit_log.patient_id AND p.user_id = auth.uid()
    )
  );

-- Sin politicas de INSERT/UPDATE/DELETE: solo el trigger (SECURITY DEFINER) escribe.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_log FROM authenticated, anon;
GRANT SELECT ON public.audit_log TO authenticated;

COMMIT;

-- =====================================================================
-- VERIFICACION (correr aparte):
--
-- 1) Confirmar triggers instalados:
--    SELECT event_object_table, trigger_name FROM information_schema.triggers
--    WHERE trigger_name LIKE 'trg_audit%' ORDER BY event_object_table;
--
-- 2) Generar un evento (edita cualquier paciente desde la app) y ver:
--    SELECT occurred_at, actor_email, action, table_name, record_id
--    FROM public.audit_log ORDER BY occurred_at DESC LIMIT 10;
--
-- 3) PRUEBA DE INMUTABILIDAD — ambas DEBEN fallar:
--    DELETE FROM public.audit_log WHERE id = (SELECT MIN(id) FROM public.audit_log);
--    UPDATE public.audit_log SET action = 'ALTERADO' WHERE id = (SELECT MIN(id) FROM public.audit_log);
--
--    Esperado: ERROR 42501 "La bitacora de auditoria es inmutable..."
-- =====================================================================
