-- ==============================================================================
-- CORREÇÃO DE RESTRIÇÃO DE CATEGORIA E CHAVES DE ANEXOS (SUPABASE)
-- Execute este script no SQL Editor do seu projeto Supabase para permitir
-- qualquer quantidade de fotos e vídeos extras sem erro de restrição.
-- ==============================================================================

-- 1. Remover restrição limitante de categoria da tabela de anexos
ALTER TABLE IF EXISTS public.warranty_attachments 
  DROP CONSTRAINT IF EXISTS warranty_attachments_category_check;

-- 2. Garantir que a coluna created_by continue anulável (sem exigir login obrigatório)
ALTER TABLE IF EXISTS public.warranty_records 
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE IF EXISTS public.warranty_attachments 
  ALTER COLUMN created_by DROP NOT NULL;

-- 3. Garantir que a restrição de status em warranty_records aceite os formatos usados
ALTER TABLE IF EXISTS public.warranty_records 
  DROP CONSTRAINT IF EXISTS warranty_records_status_check;

ALTER TABLE IF EXISTS public.warranty_records 
  ADD CONSTRAINT warranty_records_status_check 
  CHECK (status IN ('draft', 'finalized', 'em_preenchimento', 'finalizado'));

-- 4. Adicionar colunas opcionais de rastreamento de PDF gerado
ALTER TABLE IF EXISTS public.warranty_records 
  ADD COLUMN IF NOT EXISTS last_pdf_generated_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS public.warranty_records 
  ADD COLUMN IF NOT EXISTS last_pdf_file_name TEXT;
