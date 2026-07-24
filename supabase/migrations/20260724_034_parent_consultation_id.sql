-- ============================================================
-- 20260724_034_parent_consultation_id.sql
-- TecnoGuiAI MedSystem Pro — Fase 1.2 (complemento)
--
-- Corrige: error 400 al consultar adendas.
-- Causa: la tabla public.consultations NO tiene la columna
--        parent_consultation_id (src/lib/types.ts si la declara,
--        pero la base de datos real nunca la tuvo).
-- Sin esta columna el flujo de adendas no puede funcionar:
--   - la consulta de adendas devuelve 400
--   - guardar una adenda fallaria al insertar
--
-- Nota: ALTER TABLE ADD COLUMN no dispara los triggers de fila,
--       por lo que los candados de la migracion 033 no se activan
--       ni se ven afectados.
-- Ejecutar completo en Supabase > SQL Editor
-- ============================================================

-- 1. Agregar la columna (autorreferencia a la consulta original)
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS parent_consultation_id uuid;

-- 2. Llave foranea hacia la misma tabla.
--    Sin ON DELETE CASCADE a proposito: los registros clinicos
--    no se eliminan (NOM-004), y una cascada seria justo lo contrario.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'consultations_parent_consultation_id_fkey'
  ) THEN
    ALTER TABLE public.consultations
      ADD CONSTRAINT consultations_parent_consultation_id_fkey
      FOREIGN KEY (parent_consultation_id)
      REFERENCES public.consultations(id);
    RAISE NOTICE 'Llave foranea de adendas creada.';
  END IF;
END $$;

-- 3. Indice: cada detalle de consulta busca sus adendas por esta columna
CREATE INDEX IF NOT EXISTS idx_consultations_parent
  ON public.consultations(parent_consultation_id)
  WHERE parent_consultation_id IS NOT NULL;

-- ------------------------------------------------------------
-- VERIFICACION (esperado: 1 fila -> parent_consultation_id | uuid)
-- ------------------------------------------------------------
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'consultations'
  AND column_name = 'parent_consultation_id';
