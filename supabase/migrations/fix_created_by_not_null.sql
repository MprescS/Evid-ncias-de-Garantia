-- ==============================================================================
-- CORREÇÃO COMPLETA: created_by NOT NULL + warranty_records_status_check
-- Execute este script no SQL Editor do seu painel Supabase
-- ==============================================================================

-- 1. Permitir que warranty_records seja salvo mesmo sem usuário autenticado no Auth
ALTER TABLE IF EXISTS public.warranty_records 
    ALTER COLUMN created_by DROP NOT NULL;

-- 2. Permitir que warranty_attachments seja salvo mesmo sem usuário autenticado no Auth
ALTER TABLE IF EXISTS public.warranty_attachments 
    ALTER COLUMN created_by DROP NOT NULL;

-- 3. Atualizar a restrição de status para aceitar tanto inglês quanto português
ALTER TABLE IF EXISTS public.warranty_records 
    DROP CONSTRAINT IF EXISTS warranty_records_status_check;

ALTER TABLE IF EXISTS public.warranty_records 
    ADD CONSTRAINT warranty_records_status_check 
    CHECK (status IN ('draft', 'finalized', 'em_preenchimento', 'finalizado'));

-- 4. Garantir que as permissões com chave pública (anon) estejam concedidas
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Verificação:
DO $$
BEGIN
    RAISE NOTICE 'Ajustes aplicados com sucesso! created_by e status_check prontos para salvar.';
END $$;
