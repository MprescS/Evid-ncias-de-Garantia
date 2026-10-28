import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  Cloud,
  HardDrive,
  Download,
  Upload,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Server,
  Layers,
  Lock,
  FileCode2,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { warrantyDb } from '../utils/storage';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  testSupabaseConnection,
  isSupabaseConfigured,
  ConnectionTestResult,
  DEFAULT_STORAGE_BUCKET
} from '../lib/supabase';

interface DatabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataImported: () => void;
}

export const DatabaseConfigModal: React.FC<DatabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onDataImported
}) => {
  const [activeTab, setActiveTab] = useState<'connection' | 'sql' | 'sync' | 'backup'>('connection');
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedQuickFix, setCopiedQuickFix] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Supabase form fields
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [configSource, setConfigSource] = useState<'env' | 'storage' | 'none'>('none');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Test connection state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const cfg = getSupabaseConfig();
      setSupabaseUrl(cfg.url);
      setSupabaseKey(cfg.publishableKey);
      setConfigSource(cfg.source);
      setTestResult(null);
      setSyncStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveConfig = () => {
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      setTestResult({
        success: false,
        message: 'Por favor, informe a URL do Projeto (Project URL) e a Chave Anon (Publishable Key) do seu projeto Supabase antes de salvar e conectar.'
      });
      return;
    }
    saveSupabaseConfig(supabaseUrl.trim(), supabaseKey.trim());
    const updated = getSupabaseConfig();
    setConfigSource(updated.source);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    // Auto-run connection test
    handleTestConnection();
  };

  const handleClearConfig = () => {
    if (confirm('Deseja desconectar o Supabase? O aplicativo continuará funcionando no modo local (IndexedDB).')) {
      clearSupabaseConfig();
      setSupabaseUrl('');
      setSupabaseKey('');
      setConfigSource('none');
      setTestResult(null);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection();
      setTestResult(res);
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e.message || 'Erro ao conectar ao Supabase'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncLocalToCloud = async () => {
    if (!isSupabaseConfigured()) {
      alert('Configure a URL e a Chave Publicável do Supabase antes de sincronizar.');
      return;
    }
    setIsSyncing(true);
    setSyncStatus('Iniciando sincronização de evidências e registros para o Supabase...');
    try {
      const result = await warrantyDb.syncAllLocalToSupabase();
      if (result.errors.length === 0) {
        setSyncStatus(`Sucesso! ${result.successCount} registros e suas evidências foram enviados para o Supabase.`);
      } else {
        setSyncStatus(`${result.successCount} registros enviados. Falhas em ${result.errors.length} itens.`);
      }
      onDataImported();
    } catch (err: any) {
      setSyncStatus(`Erro na sincronização: ${err.message || 'Falha de comunicação'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncCloudToLocal = async () => {
    if (!isSupabaseConfigured()) {
      alert('Configure o Supabase primeiro.');
      return;
    }
    setIsSyncing(true);
    setSyncStatus('Baixando dados do Supabase PostgreSQL para o cache local...');
    try {
      const count = await warrantyDb.syncAllSupabaseToLocal();
      setSyncStatus(`${count} registros baixados da nuvem com sucesso!`);
      onDataImported();
    } catch (err: any) {
      setSyncStatus(`Falha ao baixar dados da nuvem: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      const json = await warrantyDb.exportFullDatabaseBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_completo_garantia_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Erro ao exportar dados de backup.');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const res = await warrantyDb.importFullDatabaseBackup(text);
        setImportStatus(`Sucesso! ${res.importedRecords} registros e ${res.importedTechs} técnicos importados com êxito.`);
        onDataImported();
        setTimeout(() => setImportStatus(null), 5000);
      } catch (err: any) {
        setImportStatus(`Falha na importação: ${err.message || 'Arquivo corrompido'}`);
      }
    };
    reader.readAsText(file);
  };

  const supabaseSqlSchema = `-- ==============================================================================
-- SISTEMA DE EVIDÊNCIAS DE REPAROS EM GARANTIA AUTOMOTIVA
-- Migração PostgreSQL / Supabase Oficial
-- ==============================================================================

-- 1. Habilitar extensões UUID e PGCrypto
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tabela de Registros de Garantia
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

-- Garantir que created_by seja anulável (para compatibilidade com uso por chave de navegador/workshop)
ALTER TABLE public.warranty_records ALTER COLUMN created_by DROP NOT NULL;

-- Índices de consulta de alto desempenho
CREATE INDEX IF NOT EXISTS idx_warranty_records_os ON public.warranty_records(os_number);
CREATE INDEX IF NOT EXISTS idx_warranty_records_vin ON public.warranty_records(vin);
CREATE INDEX IF NOT EXISTS idx_warranty_records_technician ON public.warranty_records(technician);
CREATE INDEX IF NOT EXISTS idx_warranty_records_repair_date ON public.warranty_records(repair_date);
CREATE INDEX IF NOT EXISTS idx_warranty_records_status ON public.warranty_records(status);
CREATE INDEX IF NOT EXISTS idx_warranty_records_created_at ON public.warranty_records(created_at DESC);

-- 3. Tabela de Anexos e Evidências Técnicas
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

-- 4. Tabela de Técnicos da Concessionária
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

-- 5. Tabela de Configurações da Concessionária
CREATE TABLE IF NOT EXISTS public.app_settings (
    id TEXT PRIMARY KEY DEFAULT 'current_settings',
    dealer_name TEXT DEFAULT 'Porsche Center New Center / São Paulo',
    dealer_code TEXT DEFAULT 'PC-BR-011',
    warranty_manager_name TEXT DEFAULT 'Marcelo Silva',
    warranty_manager_email TEXT DEFAULT 'marcelo.silva@porschenewcenter.com.br',
    contact_phone TEXT,
    require_admin_pin BOOLEAN DEFAULT false,
    admin_pin TEXT DEFAULT '1948',
    strict_audit_validation BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inserir configuração inicial
INSERT INTO public.app_settings (id, dealer_name, dealer_code, warranty_manager_name, warranty_manager_email, admin_pin)
VALUES ('current_settings', 'Porsche Center New Center / São Paulo', 'PC-BR-011', 'Marcelo Silva', 'marcelo.silva@porschenewcenter.com.br', '1948')
ON CONFLICT (id) DO NOTHING;

-- 6. Trigger para atualização de updated_at
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

-- 7. Configuração do Bucket Privado no Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'warranty-evidence',
    'warranty-evidence',
    false,
    104857600, -- 100 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 104857600;

-- 8. Row Level Security (RLS) nas Tabelas
ALTER TABLE public.warranty_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para warranty_records
DROP POLICY IF EXISTS "warranty_records_all" ON public.warranty_records;
CREATE POLICY "warranty_records_all"
ON public.warranty_records
FOR ALL
USING (auth.role() IN ('authenticated', 'anon'))
WITH CHECK (auth.role() IN ('authenticated', 'anon'));

-- Políticas de acesso para warranty_attachments
DROP POLICY IF EXISTS "warranty_attachments_all" ON public.warranty_attachments;
CREATE POLICY "warranty_attachments_all"
ON public.warranty_attachments
FOR ALL
USING (auth.role() IN ('authenticated', 'anon'))
WITH CHECK (auth.role() IN ('authenticated', 'anon'));

-- Políticas para technicians e settings
DROP POLICY IF EXISTS "technicians_all" ON public.technicians;
CREATE POLICY "technicians_all" ON public.technicians FOR ALL USING (auth.role() IN ('authenticated', 'anon'));

DROP POLICY IF EXISTS "app_settings_all" ON public.app_settings;
CREATE POLICY "app_settings_all" ON public.app_settings FOR ALL USING (auth.role() IN ('authenticated', 'anon'));

-- 9. Políticas de Segurança do Storage (warranty-evidence)
DROP POLICY IF EXISTS "storage_warranty_select" ON storage.objects;
CREATE POLICY "storage_warranty_select" ON storage.objects FOR SELECT
USING (bucket_id = 'warranty-evidence' AND auth.role() IN ('authenticated', 'anon'));

DROP POLICY IF EXISTS "storage_warranty_insert" ON storage.objects;
CREATE POLICY "storage_warranty_insert" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'warranty-evidence' AND auth.role() IN ('authenticated', 'anon'));

DROP POLICY IF EXISTS "storage_warranty_update" ON storage.objects;
CREATE POLICY "storage_warranty_update" ON storage.objects FOR UPDATE
USING (bucket_id = 'warranty-evidence' AND auth.role() IN ('authenticated', 'anon'));

DROP POLICY IF EXISTS "storage_warranty_delete" ON storage.objects;
CREATE POLICY "storage_warranty_delete" ON storage.objects FOR DELETE
USING (bucket_id = 'warranty-evidence' AND auth.role() IN ('authenticated', 'anon'));
`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(supabaseSqlSchema);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const isConfigured = Boolean(supabaseUrl && supabaseKey);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
      <div className="relative w-full max-w-4xl bg-[#161619] border border-[#2E2E38] text-white shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#26262E] bg-[#121214]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#202028] border border-[#30303C]">
              <Database className="w-5 h-5 text-[#D5001C]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Integração Supabase & Banco de Dados
                </h3>
                {isConfigured ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    Supabase Ativo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-semibold bg-amber-950/80 text-amber-400 border border-amber-500/40">
                    Modo Local (IndexedDB)
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400">
                PostgreSQL, Supabase Storage (Bucket privado), Row Level Security e sincronização multiplataforma
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-6 bg-[#18181D] border-b border-[#26262E] overflow-x-auto text-xs font-semibold uppercase tracking-wider">
          <button
            onClick={() => setActiveTab('connection')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'connection'
                ? 'border-[#D5001C] text-white bg-[#202027]'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-[#D5001C]" />
            <span>Conexão & Credenciais</span>
          </button>

          <button
            onClick={() => setActiveTab('sql')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'sql'
                ? 'border-[#D5001C] text-white bg-[#202027]'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Migração SQL & RLS</span>
          </button>

          <button
            onClick={() => setActiveTab('sync')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'sync'
                ? 'border-[#D5001C] text-white bg-[#202027]'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sincronização em Nuvem</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'backup'
                ? 'border-[#D5001C] text-white bg-[#202027]'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-neutral-400" />
            <span>Backup Local JSON</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-sm">
          {/* TAB 1: CONNECTION */}
          {activeTab === 'connection' && (
            <div className="space-y-6">
              {/* Architecture Info Banner */}
              <div className="p-4 bg-[#1B1B22] border border-[#2B2B36] flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-white">
                    Arquitetura Híbrida Segura: PostgreSQL + Supabase Storage + IndexedDB Offline
                  </h4>
                  <p className="text-xs text-neutral-300 leading-relaxed">
                    Os registros de OS são salvos na tabela <code>warranty_records</code>, os anexos são cadastrados em <code>warranty_attachments</code> e as imagens e vídeos originais são armazenados no bucket privado <code>warranty-evidence</code>. Para máxima segurança e privacidade, são geradas URLs assinadas com tempo de expiração temporário.
                  </p>
                </div>
              </div>

              {/* Step-by-step guide when not configured */}
              {!isConfigured && (
                <div className="p-4 bg-[#1F1B18] border border-amber-600/40 text-amber-200 text-xs space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-amber-400 uppercase tracking-wider text-[11px]">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Como obter e conectar suas credenciais Supabase:</span>
                  </div>
                  <ol className="list-decimal pl-5 space-y-1.5 text-neutral-300 leading-relaxed text-xs">
                    <li>
                      Acesse o painel do Supabase em{' '}
                      <a
                        href="https://app.supabase.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 font-mono"
                      >
                        app.supabase.com <ExternalLink className="w-3 h-3" />
                      </a>{' '}
                      e selecione seu projeto.
                    </li>
                    <li>
                      No menu lateral esquerdo, clique no ícone de engrenagem <strong>Project Settings</strong> &gt; <strong>API</strong>.
                    </li>
                    <li>
                      Copie o <strong>Project URL</strong> (ex: <code className="text-white bg-black/50 px-1.5 py-0.5 font-mono text-[11px]">https://seu-id.supabase.co</code>) e cole no campo abaixo.
                    </li>
                    <li>
                      Em <strong>Project API Keys</strong>, copie a chave <strong>anon / public</strong> (começa com <code className="text-white bg-black/50 px-1 py-0.5 font-mono text-[11px]">eyJ...</code>) e cole no campo abaixo.
                    </li>
                    <li>
                      Clique em <strong>Salvar &amp; Conectar</strong>. A aplicação testará a comunicação e validará a tabela PostgreSQL e o Storage automaticamente.
                    </li>
                  </ol>
                  <p className="text-[11px] text-neutral-400 pt-1 border-t border-amber-600/20">
                    💡 Enquanto não conectar, você pode continuar trabalhando normalmente: todos os registros, fotos e vídeos continuam salvos de forma 100% segura no cache local (IndexedDB) deste dispositivo.
                  </p>
                </div>
              )}

              {/* Credentials Form */}
              <div className="border border-[#2B2B36] bg-[#141417] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-white flex items-center gap-2">
                    <Server className="w-4 h-4 text-[#D5001C]" />
                    Credenciais do Projeto Supabase
                  </h4>
                  {configSource === 'env' && (
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 border border-emerald-500/30">
                      Configurado via Variáveis de Ambiente (.env)
                    </span>
                  )}
                  {configSource === 'storage' && (
                    <span className="text-[10px] font-mono text-blue-400 bg-blue-950/60 px-2 py-0.5 border border-blue-500/30">
                      Configurado no Navegador
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-300 mb-1">
                      Project URL (VITE_SUPABASE_URL) <span className="text-[#D5001C]">*</span>
                    </label>
                    <input
                      type="url"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      placeholder="https://exemplo-id.supabase.co"
                      className="w-full px-3 py-2 bg-[#1C1C22] border border-[#33333F] text-white text-xs font-mono focus:border-[#D5001C] focus:outline-hidden"
                    />
                    <p className="text-[10px] text-neutral-400 mt-1">
                      Encontre no painel do Supabase em: <strong>Project Settings &gt; API &gt; Project URL</strong>
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-300 mb-1">
                      Publishable / Anon Key (VITE_SUPABASE_PUBLISHABLE_KEY) <span className="text-[#D5001C]">*</span>
                    </label>
                    <input
                      type="password"
                      value={supabaseKey}
                      onChange={(e) => setSupabaseKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full px-3 py-2 bg-[#1C1C22] border border-[#33333F] text-white text-xs font-mono focus:border-[#D5001C] focus:outline-hidden"
                    />
                    <p className="text-[10px] text-neutral-400 mt-1">
                      Utilize a chave <strong>anon / public</strong>. Nunca utilize a chave <code className="text-[#D5001C]">service_role</code> no navegador.
                    </p>
                  </div>

                  {saveSuccess && (
                    <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Credenciais salvas com sucesso!
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleSaveConfig}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#D5001C] hover:bg-[#b00017] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer active:scale-98"
                    >
                      <Check className="w-4 h-4" />
                      Salvar & Conectar
                    </button>

                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTesting || !supabaseUrl || !supabaseKey}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#22222A] hover:bg-[#2C2C36] border border-[#3A3A48] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 active:scale-98"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                      {isTesting ? 'Testando Conexão...' : 'Testar Conexão em Tempo Real'}
                    </button>

                    {configSource === 'storage' && (
                      <button
                        type="button"
                        onClick={handleClearConfig}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-neutral-400 hover:text-rose-400 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ml-auto"
                      >
                        <X className="w-3.5 h-3.5" />
                        Desconectar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Test Result Display */}
              {testResult && (
                <div
                  className={`p-4 border ${
                    testResult.success
                      ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
                      : 'bg-rose-950/50 border-rose-500/50 text-rose-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {testResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <h4 className="font-bold text-xs uppercase tracking-wider">
                        {testResult.success ? 'Conexão Supabase Validada com Êxito' : 'Falha na Validação da Conexão'}
                      </h4>
                      <p className="text-xs leading-relaxed">{testResult.message}</p>

                      {testResult.details && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                          <div className="p-2 bg-black/40 border border-white/10">
                            PostgreSQL warranty_records: <span className="font-bold text-emerald-400">Ativo ({testResult.details.recordsCount} registros)</span>
                          </div>
                          <div className="p-2 bg-black/40 border border-white/10">
                            Storage Bucket ({testResult.details.bucketName}): <span className="font-bold text-emerald-400">Configurado</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SQL MIGRATION */}
          {activeTab === 'sql' && (
            <div className="space-y-4">
              {/* Quick Fix Box for created_by NOT NULL */}
              <div className="p-4 bg-amber-950/30 border border-amber-600/50 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <h4 className="font-bold text-xs uppercase tracking-wider text-amber-300">
                      Correção Rápida: Erro "created_by violates not-null constraint"
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const fix = `ALTER TABLE public.warranty_records ALTER COLUMN created_by DROP NOT NULL;\nALTER TABLE public.warranty_attachments ALTER COLUMN created_by DROP NOT NULL;`;
                      navigator.clipboard.writeText(fix);
                      setCopiedQuickFix(true);
                      setTimeout(() => setCopiedQuickFix(false), 3000);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#D5001C] hover:bg-[#b00017] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0"
                  >
                    {copiedQuickFix ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedQuickFix ? 'Copiado!' : 'Copiar Correção (1 clique)'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  Se você recebeu o erro <em>null value in column "created_by" violates not-null constraint</em>, basta executar este comando de 2 linhas no <strong>SQL Editor</strong> do Supabase:
                </p>
                <pre className="p-2.5 bg-black/50 border border-amber-500/30 font-mono text-xs text-amber-200 select-all overflow-x-auto">
{`ALTER TABLE public.warranty_records ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.warranty_attachments ALTER COLUMN created_by DROP NOT NULL;`}
                </pre>
              </div>

              <div className="p-4 bg-[#1B1B22] border border-[#2B2B36] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-white">
                    Script Oficial de Migração SQL Supabase (Completo)
                  </h4>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Cria as tabelas <code>warranty_records</code>, <code>warranty_attachments</code>, <code>technicians</code>, <code>app_settings</code>, bucket de Storage e políticas RLS.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={copySqlToClipboard}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#D5001C] hover:bg-[#b00017] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0 active:scale-98"
                >
                  {copiedSql ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedSql ? 'Copiado para Área de Transferência!' : 'Copiar SQL Completo'}</span>
                </button>
              </div>

              {/* Instructions steps */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-[#141417] border border-[#26262E]">
                  <div className="w-5 h-5 bg-[#D5001C] text-white flex items-center justify-center font-bold text-[10px] mb-1.5">
                    1
                  </div>
                  <strong className="text-white block mb-0.5">Acesse o Supabase</strong>
                  <span className="text-neutral-400 text-[11px]">
                    Abra seu projeto em app.supabase.com e vá em <strong>SQL Editor</strong> no menu lateral esquerdo.
                  </span>
                </div>
                <div className="p-3 bg-[#141417] border border-[#26262E]">
                  <div className="w-5 h-5 bg-[#D5001C] text-white flex items-center justify-center font-bold text-[10px] mb-1.5">
                    2
                  </div>
                  <strong className="text-white block mb-0.5">Cole e Execute o Script</strong>
                  <span className="text-neutral-400 text-[11px]">
                    Clique em <strong>New Query</strong>, cole o código SQL abaixo e clique no botão verde <strong>Run</strong>.
                  </span>
                </div>
                <div className="p-3 bg-[#141417] border border-[#26262E]">
                  <div className="w-5 h-5 bg-[#D5001C] text-white flex items-center justify-center font-bold text-[10px] mb-1.5">
                    3
                  </div>
                  <strong className="text-white block mb-0.5">Conecte o App</strong>
                  <span className="text-neutral-400 text-[11px]">
                    Em <strong>Project Settings &gt; API</strong>, copie a URL e chave <code>anon / public</code> e salve na aba Conexão.
                  </span>
                </div>
              </div>

              {/* SQL Code View */}
              <div className="relative border border-[#2A2A34] bg-[#0E0E11]">
                <div className="flex items-center justify-between px-4 py-2 border-b border-[#22222A] bg-[#141418] text-xs font-mono text-neutral-400">
                  <span>supabase/migrations/20261027_warranty_system.sql</span>
                  <button
                    onClick={copySqlToClipboard}
                    className="text-neutral-300 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar</span>
                  </button>
                </div>
                <pre className="p-4 text-xs font-mono text-neutral-300 max-h-80 overflow-y-auto leading-relaxed select-all">
                  {supabaseSqlSchema}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: SYNC */}
          {activeTab === 'sync' && (
            <div className="space-y-5">
              <div className="p-4 bg-[#1B1B22] border border-[#2B2B36] space-y-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-white flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-emerald-400" />
                  Sincronização de Dados entre Dispositivos
                </h4>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Permite sincronizar os registros e anexos criados neste computador ou tablet com o projeto Supabase na nuvem, disponibilizando-os instantaneamente para outros técnicos e analistas da concessionária.
                </p>
              </div>

              {syncStatus && (
                <div className="p-3 bg-[#202028] border border-[#353545] text-xs font-semibold text-neutral-200">
                  {syncStatus}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-[#141417] border border-[#2A2A34] flex flex-col justify-between">
                  <div>
                    <h5 className="font-bold text-xs uppercase tracking-wider text-white mb-1 flex items-center gap-2">
                      <Upload className="w-4 h-4 text-[#D5001C]" />
                      Enviar Registros Locais para a Nuvem
                    </h5>
                    <p className="text-xs text-neutral-400 mb-4">
                      Faz o upload de todos os registros e arquivos locais (fotos e vídeos) para o PostgreSQL e Storage do Supabase.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSyncLocalToCloud}
                    disabled={isSyncing || !isConfigured}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#D5001C] hover:bg-[#b00017] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 active:scale-98"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Sincronizando...' : 'Enviar Dados para o Supabase'}
                  </button>
                </div>

                <div className="p-4 bg-[#141417] border border-[#2A2A34] flex flex-col justify-between">
                  <div>
                    <h5 className="font-bold text-xs uppercase tracking-wider text-white mb-1 flex items-center gap-2">
                      <Download className="w-4 h-4 text-emerald-400" />
                      Baixar Registros da Nuvem
                    </h5>
                    <p className="text-xs text-neutral-400 mb-4">
                      Baixa todos os registros e URLs de evidências do Supabase para o cache IndexedDB deste dispositivo para acesso offline.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSyncCloudToLocal}
                    disabled={isSyncing || !isConfigured}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#22222A] hover:bg-[#2C2C36] border border-[#3A3A48] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 active:scale-98"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Baixando...' : 'Atualizar com Dados do Supabase'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BACKUP LOCAL */}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#141417] border border-[#2A2A34] space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-neutral-400" />
                  Backup Completo do Sistema (Auditoria Offline)
                </h4>
                <p className="text-xs text-neutral-300">
                  Gere uma cópia de segurança em formato JSON contendo todos os registros de OS, evidências, equipe técnica e configurações da concessionária:
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#25252F] hover:bg-[#30303C] border border-[#3A3A48] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer active:scale-98"
                  >
                    <Download className="w-4 h-4 text-[#D5001C]" />
                    Exportar Backup Completo (.json)
                  </button>

                  <label className="inline-flex items-center gap-2 px-4 py-2 border border-[#3A3A48] bg-[#202028] hover:bg-[#282834] text-neutral-200 hover:text-white text-xs font-semibold uppercase tracking-wider cursor-pointer transition-colors active:scale-98">
                    <Upload className="w-4 h-4 text-neutral-400" />
                    Restaurar Backup
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleImportFile}
                      className="hidden"
                    />
                  </label>
                </div>

                {importStatus && (
                  <div className="p-3 bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs font-semibold mt-3">
                    {importStatus}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#26262E] bg-[#121214] text-xs text-neutral-400">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="w-1.5 h-1.5 bg-[#D5001C]" />
            <span>STORAGE BUCKET: {DEFAULT_STORAGE_BUCKET} (PRIVADO)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#25252F] hover:bg-[#30303C] border border-[#3A3A48] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
