-- ============================================================
-- 20260724_035_consentimientos_y_aviso_privacidad.sql
-- TecnoGuiAI MedSystem Pro — Fase 2
--
-- Marco legal que atiende:
--   LFPDPPP art. 8 y 9: los datos de salud son SENSIBLES y
--   requieren consentimiento EXPRESO y por escrito del titular.
--   NOM-004-SSA3-2012: consentimiento informado en el expediente.
--   LFPDPPP art. 15-17: aviso de privacidad puesto a disposicion
--   del titular, con constancia de que fue conocido.
--
-- Que crea:
--   1. privacy_notices  — versiones del aviso de privacidad.
--                         Una vez publicada, una version NO se
--                         edita ni se borra (solo se desactiva al
--                         publicar una nueva). Asi se prueba QUE
--                         texto acepto cada paciente y CUANDO.
--   2. patient_consents — consentimientos otorgados. Inmutables:
--                         no se borran; solo pueden REVOCARSE
--                         (derecho del titular, LFPDPPP art. 8).
--   3. Funcion de apoyo para saber si un paciente tiene
--      consentimiento vigente.
--
-- IMPORTANTE: este archivo crea la MECANICA. El TEXTO del aviso
-- de privacidad y del consentimiento debe redactarlo o validarlo
-- un abogado especializado en proteccion de datos / derecho
-- sanitario. Un aviso mal redactado no protege aunque el sistema
-- funcione perfecto.
--
-- Ejecutar completo en Supabase > SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- PARTE A: tabla de avisos de privacidad (versionados)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.privacy_notices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version        text NOT NULL,
  title          text NOT NULL,
  content        text NOT NULL,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  is_active      boolean NOT NULL DEFAULT true,
  content_hash   text,
  published_by   uuid DEFAULT auth.uid(),
  published_at   timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_privacy_notices_active
  ON public.privacy_notices(is_active) WHERE is_active;

-- Sellar hash del texto al publicar: prueba de integridad del aviso
CREATE OR REPLACE FUNCTION public.fn_hash_privacy_notice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  NEW.content_hash := encode(digest(NEW.content, 'sha256'), 'hex');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hash_privacy_notice ON public.privacy_notices;
CREATE TRIGGER trg_hash_privacy_notice
  BEFORE INSERT ON public.privacy_notices
  FOR EACH ROW EXECUTE FUNCTION public.fn_hash_privacy_notice();

-- Un aviso publicado es inalterable; solo puede activarse/desactivarse
CREATE OR REPLACE FUNCTION public.fn_guard_privacy_notice_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (to_jsonb(OLD) - 'is_active') = (to_jsonb(NEW) - 'is_active') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'El aviso de privacidad publicado es inalterable. Para cambiar el texto publique una nueva version (LFPDPPP art. 18).'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_update_privacy_notices ON public.privacy_notices;
CREATE TRIGGER trg_guard_update_privacy_notices
  BEFORE UPDATE ON public.privacy_notices
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_privacy_notice_update();

DROP TRIGGER IF EXISTS trg_block_delete_privacy_notices ON public.privacy_notices;
CREATE TRIGGER trg_block_delete_privacy_notices
  BEFORE DELETE ON public.privacy_notices
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_clinical_delete();

-- ------------------------------------------------------------
-- PARTE B: consentimientos otorgados por los pacientes
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.patient_consents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id          uuid NOT NULL REFERENCES public.patients(id),
  privacy_notice_id   uuid NOT NULL REFERENCES public.privacy_notices(id),
  consent_type        text NOT NULL DEFAULT 'datos_y_tratamiento'
                      CHECK (consent_type IN ('datos_personales','tratamiento_medico','datos_y_tratamiento')),
  method              text NOT NULL DEFAULT 'presencial_firmado'
                      CHECK (method IN ('presencial_firmado','digital_en_app','verbal_con_testigo')),
  signer_name         text NOT NULL,
  signer_relationship text NOT NULL DEFAULT 'titular'
                      CHECK (signer_relationship IN ('titular','tutor','representante_legal')),
  signature_data      text,
  evidence_hash       text,
  notes               text,
  granted_at          timestamptz NOT NULL DEFAULT now(),
  granted_by          uuid DEFAULT auth.uid(),
  revoked_at          timestamptz,
  revoked_reason      text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_consents_patient
  ON public.patient_consents(patient_id);

-- Sello de evidencia: hash de quien firmo, que version acepto y cuando
CREATE OR REPLACE FUNCTION public.fn_hash_consent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  NEW.evidence_hash := encode(
    digest(
      COALESCE(NEW.patient_id::text,'') ||
      COALESCE(NEW.privacy_notice_id::text,'') ||
      COALESCE(NEW.signer_name,'') ||
      COALESCE(NEW.method,'') ||
      COALESCE(NEW.granted_at::text,'') ||
      COALESCE(NEW.signature_data,''),
      'sha256'),
    'hex');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hash_consent ON public.patient_consents;
CREATE TRIGGER trg_hash_consent
  BEFORE INSERT ON public.patient_consents
  FOR EACH ROW EXECUTE FUNCTION public.fn_hash_consent();

-- Un consentimiento no se borra ni se edita: solo se REVOCA una vez.
CREATE OR REPLACE FUNCTION public.fn_guard_consent_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.revoked_at IS NULL
     AND NEW.revoked_at IS NOT NULL
     AND (to_jsonb(OLD) - 'revoked_at' - 'revoked_reason')
       = (to_jsonb(NEW) - 'revoked_at' - 'revoked_reason')
  THEN
    RETURN NEW;
  END IF;

  IF OLD.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION
      'Este consentimiento ya fue revocado; el registro es inalterable. Para reanudar el tratamiento de datos registre un consentimiento nuevo.'
      USING ERRCODE = '42501';
  END IF;

  RAISE EXCEPTION
    'El consentimiento otorgado es inalterable (LFPDPPP art. 8). Solo puede revocarse.'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_update_consents ON public.patient_consents;
CREATE TRIGGER trg_guard_update_consents
  BEFORE UPDATE ON public.patient_consents
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_consent_update();

DROP TRIGGER IF EXISTS trg_block_delete_consents ON public.patient_consents;
CREATE TRIGGER trg_block_delete_consents
  BEFORE DELETE ON public.patient_consents
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_clinical_delete();

-- ------------------------------------------------------------
-- PARTE C: funcion de apoyo — consentimiento vigente por paciente
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_patient_has_consent(p_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patient_consents
    WHERE patient_id = p_patient_id
      AND revoked_at IS NULL
  );
$$;

-- ------------------------------------------------------------
-- PARTE D: RLS
-- ------------------------------------------------------------

ALTER TABLE public.privacy_notices  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sel_privacy_notices ON public.privacy_notices;
DROP POLICY IF EXISTS ins_privacy_notices ON public.privacy_notices;
DROP POLICY IF EXISTS upd_privacy_notices ON public.privacy_notices;

CREATE POLICY sel_privacy_notices ON public.privacy_notices
  FOR SELECT TO authenticated USING (true);
CREATE POLICY ins_privacy_notices ON public.privacy_notices
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY upd_privacy_notices ON public.privacy_notices
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sel_patient_consents ON public.patient_consents;
DROP POLICY IF EXISTS ins_patient_consents ON public.patient_consents;
DROP POLICY IF EXISTS upd_patient_consents ON public.patient_consents;

CREATE POLICY sel_patient_consents ON public.patient_consents
  FOR SELECT TO authenticated
  USING (patient_id IN (SELECT id FROM public.patients));
CREATE POLICY ins_patient_consents ON public.patient_consents
  FOR INSERT TO authenticated
  WITH CHECK (patient_id IN (SELECT id FROM public.patients));
CREATE POLICY upd_patient_consents ON public.patient_consents
  FOR UPDATE TO authenticated
  USING (patient_id IN (SELECT id FROM public.patients))
  WITH CHECK (patient_id IN (SELECT id FROM public.patients));

REVOKE DELETE ON public.privacy_notices  FROM authenticated, anon;
REVOKE DELETE ON public.patient_consents FROM authenticated, anon;

-- ------------------------------------------------------------
-- PARTE E: bitacora en las dos tablas nuevas
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

  FOREACH t IN ARRAY ARRAY['privacy_notices','patient_consents']
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
-- VERIFICACION (esperado: 2 tablas y 6 triggers guardianes)
-- ------------------------------------------------------------
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name IN ('privacy_notices','patient_consents')
ORDER BY table_name;

SELECT event_object_table AS tabla, trigger_name, event_manipulation AS evento
FROM information_schema.triggers
WHERE event_object_table IN ('privacy_notices','patient_consents')
ORDER BY tabla, trigger_name, evento;
