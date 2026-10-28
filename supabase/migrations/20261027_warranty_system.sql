-- ==============================================================================
-- SISTEMA DE EVIDÊNCIAS DE REPAROS EM GARANTIA AUTOMOTIVA
-- Migração PostgreSQL / Supabase Oficial
-- Projeto: Evidências de Garantia
-- ==============================================================================

-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABELA PRINCIPAL: warranty_records
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.warranty_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    os_number TEXT NOT NULL,
    vin TEXT NOT NULL,
    technician TEXT NOT NULL,
    repair_date DATE NOT NULL,
    technical_report TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'em_preenchimento', 'finalizado')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finalized_at TIMESTAMPTZ,
    last_pdf_generated_at TIMESTAMPTZ,
    last_pdf_file_name TEXT
);

-- Garantir que created_by seja anulável (para compatibilidade com uso por chave anônima/workshop)
ALTER TABLE public.warranty_records ALTER COLUMN created_by DROP NOT NULL;

-- Índices de alta performance para consulta e filtros
CREATE INDEX IF NOT EXISTS idx_warranty_records_os ON public.warranty_records(os_number);
CREATE INDEX IF NOT EXISTS idx_warranty_records_vin ON public.warranty_records(vin);
CREATE INDEX IF NOT EXISTS idx_warranty_records_technician ON public.warranty_records(technician);
CREATE INDEX IF NOT EXISTS idx_warranty_records_repair_date ON public.warranty_records(repair_date);
CREATE INDEX IF NOT EXISTS idx_warranty_records_status ON public.warranty_records(status);
CREATE INDEX IF NOT EXISTS idx_warranty_records_created_at ON public.warranty_records(created_at DESC);

-- ==============================================================================
-- 3. TABELA DE ANEXOS: warranty_attachments
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.warranty_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES public.warranty_records(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('video', 'diagnostic_photo', 'new_part', 'replaced_part')),
    field_key TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_record_field UNIQUE (record_id, field_key)
);

-- Garantir que created_by seja anulável em anexos
ALTER TABLE public.warranty_attachments ALTER COLUMN created_by DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_warranty_attachments_record_id ON public.warranty_attachments(record_id);
CREATE INDEX IF NOT EXISTS idx_warranty_attachments_field ON public.warranty_attachments(field_key);

-- ==============================================================================
-- 4. TABELA DE TÉCNICOS: technicians
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.technicians (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    registration TEXT,
    specialty TEXT,
    email TEXT,
    phone TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_technicians_name ON public.technicians(name);
CREATE INDEX IF NOT EXISTS idx_technicians_active ON public.technicians(active);

-- ==============================================================================
-- 5. TABELA DE CONFIGURAÇÕES: app_settings
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
    id TEXT PRIMARY KEY DEFAULT 'current_settings',
    dealer_name TEXT DEFAULT 'Porsche Center',
    dealer_code TEXT DEFAULT 'PC-BR-011',
    warranty_manager_name TEXT DEFAULT 'Marcelo Silva',
    warranty_manager_email TEXT DEFAULT 'marcelo.silva@porschenewcenter.com.br',
    contact_phone TEXT,
    require_admin_pin BOOLEAN DEFAULT false,
    admin_pin TEXT DEFAULT '1948',
    strict_audit_validation BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inserir configuração padrão inicial caso não exista
INSERT INTO public.app_settings (id, dealer_name, dealer_code, warranty_manager_name, warranty_manager_email, admin_pin)
VALUES ('current_settings', 'Porsche Center New Center / São Paulo', 'PC-BR-011', 'Marcelo Silva', 'marcelo.silva@porschenewcenter.com.br', '1948')
ON CONFLICT (id) DO NOTHING;

-- Inserir técnicos padrão da equipe caso a tabela esteja vazia
INSERT INTO public.technicians (id, name, registration, specialty, email, phone, active)
VALUES 
  ('tech_marcelo_silva', 'Marcelo Silva', 'P-1001', 'Diagnóstico Alta Tensão & E-Performance (Master)', 'marcelo.silva@porschenewcenter.com.br', '(11) 98765-4321', true),
  ('tech_carlos_mendes', 'Carlos Eduardo Mendes', 'P-2045', 'Powertrain, Câmbio PDK & Motor Boxer', 'carlos.mendes@porschenewcenter.com.br', '(11) 98123-4567', true),
  ('tech_rodrigo_bittencourt', 'Rodrigo Bittencourt', 'P-3102', 'Chassi, Suspensão Ativa (PASM) & Freios PCCB', 'rodrigo.bittencourt@porschenewcenter.com.br', '(11) 98234-5678', true),
  ('tech_guilherme_siqueira', 'Guilherme Siqueira', 'P-4410', 'Mecatrônica Geral & Redes CAN/FlexRay', 'guilherme.siqueira@porschenewcenter.com.br', '(11) 98345-6789', true),
  ('tech_lucas_fernandes', 'Lucas Fernandes', 'P-5120', 'Diagnóstico Eletroeletrônico & Módulos PIWIS', 'lucas.fernandes@porschenewcenter.com.br', '(11) 98456-7890', true),
  ('tech_alexandre_prado', 'Alexandre Prado', 'P-6034', 'Carroceria, Acabamento & Aerodinâmica Ativa', 'alexandre.prado@porschenewcenter.com.br', '(11) 98567-8901', true)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 6. TRIGGER PARA ATUALIZAÇÃO AUTOMÁTICA DE updated_at
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_warranty_records_updated_at ON public.warranty_records;
CREATE TRIGGER trigger_warranty_records_updated_at
    BEFORE UPDATE ON public.warranty_records
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_technicians_updated_at ON public.technicians;
CREATE TRIGGER trigger_technicians_updated_at
    BEFORE UPDATE ON public.technicians
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 7. CONFIGURAÇÃO DO BUCKET PRIVADO NO STORAGE
-- ==============================================================================
-- Cria o bucket 'warranty-evidence' com visibilidade privada (public = false)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'warranty-evidence',
    'warranty-evidence',
    false,
    104857600, -- 100 MB por anexo (para acomodar vídeos técnicos e fotos de alta resolução)
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 104857600;

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) NAS TABELAS
-- ==============================================================================
ALTER TABLE public.warranty_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Políticas para warranty_records:
-- Permite leitura e escrita tanto para usuários autenticados quanto para o anon_key
-- caso o aplicativo esteja operando com a chave pública do projeto da concessionária
DROP POLICY IF EXISTS "warranty_records_select_policy" ON public.warranty_records;
CREATE POLICY "warranty_records_select_policy"
ON public.warranty_records
FOR SELECT
USING (auth.role() IN ('authenticated', 'anon'));

DROP POLICY IF EXISTS "warranty_records_insert_policy" ON public.warranty_records;
CREATE POLICY "warranty_records_insert_policy"
ON public.warranty_records
FOR INSERT
WITH CHECK (auth.role() IN ('authenticated', 'anon'));

DROP POLICY IF EXISTS "warranty_records_update_policy" ON public.warranty_records;
CREATE POLICY "warranty_records_update_policy"
ON public.warranty_records
FOR UPDATE
USING (auth.role() IN ('authenticated', 'anon'))
WITH CHECK (auth.role() IN ('authenticated', 'anon'));

DROP POLICY IF EXISTS "warranty_records_delete_policy" ON public.warranty_records;
CREATE POLICY "warranty_records_delete_policy"
ON public.warranty_records
FOR DELETE
USING (auth.role() IN ('authenticated', 'anon'));

-- Políticas para warranty_attachments:
DROP POLICY IF EXISTS "warranty_attachments_select_policy" ON public.warranty_attachments;
CREATE POLICY "warranty_attachments_select_policy"
ON public.warranty_attachments
FOR SELECT
USING (auth.role() IN ('authenticated', 'anon'));

DROP POLICY IF EXISTS "warranty_attachments_insert_policy" ON public.warranty_attachments;
CREATE POLICY "warranty_attachments_insert_policy"
ON public.warranty_attachments
FOR INSERT
WITH CHECK (auth.role() IN ('authenticated', 'anon'));

DROP POLICY IF EXISTS "warranty_attachments_update_policy" ON public.warranty_attachments;
CREATE POLICY "warranty_attachments_update_policy"
ON public.warranty_attachments
FOR UPDATE
USING (auth.role() IN ('authenticated', 'anon'))
WITH CHECK (auth.role() IN ('authenticated', 'anon'));

DROP POLICY IF EXISTS "warranty_attachments_delete_policy" ON public.warranty_attachments;
CREATE POLICY "warranty_attachments_delete_policy"
ON public.warranty_attachments
FOR DELETE
USING (auth.role() IN ('authenticated', 'anon'));

-- Políticas para technicians:
DROP POLICY IF EXISTS "technicians_select_policy" ON public.technicians;
CREATE POLICY "technicians_select_policy"
ON public.technicians
FOR SELECT
USING (auth.role() IN ('authenticated', 'anon'));

DROP POLICY IF EXISTS "technicians_all_policy" ON public.technicians;
CREATE POLICY "technicians_all_policy"
ON public.technicians
FOR ALL
USING (auth.role() IN ('authenticated', 'anon'));

-- Políticas para app_settings:
DROP POLICY IF EXISTS "app_settings_select_policy" ON public.app_settings;
CREATE POLICY "app_settings_select_policy"
ON public.app_settings
FOR SELECT
USING (auth.role() IN ('authenticated', 'anon'));

DROP POLICY IF EXISTS "app_settings_all_policy" ON public.app_settings;
CREATE POLICY "app_settings_all_policy"
ON public.app_settings
FOR ALL
USING (auth.role() IN ('authenticated', 'anon'));

-- ==============================================================================
-- 9. POLÍTICAS DE SEGURANÇA DO STORAGE (storage.objects)
-- ==============================================================================
-- Leitura e geração de URLs assinadas
DROP POLICY IF EXISTS "storage_warranty_evidence_select" ON storage.objects;
CREATE POLICY "storage_warranty_evidence_select"
ON storage.objects
FOR SELECT
USING (bucket_id = 'warranty-evidence' AND auth.role() IN ('authenticated', 'anon'));

-- Upload de evidências fotográficas e vídeos
DROP POLICY IF EXISTS "storage_warranty_evidence_insert" ON storage.objects;
CREATE POLICY "storage_warranty_evidence_insert"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'warranty-evidence' AND auth.role() IN ('authenticated', 'anon'));

-- Substituição de arquivos
DROP POLICY IF EXISTS "storage_warranty_evidence_update" ON storage.objects;
CREATE POLICY "storage_warranty_evidence_update"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'warranty-evidence' AND auth.role() IN ('authenticated', 'anon'));

-- Exclusão de arquivos ao remover anexo ou OS
DROP POLICY IF EXISTS "storage_warranty_evidence_delete" ON storage.objects;
CREATE POLICY "storage_warranty_evidence_delete"
ON storage.objects
FOR DELETE
USING (bucket_id = 'warranty-evidence' AND auth.role() IN ('authenticated', 'anon'));
