import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  BarChart3,
  Download,
  Upload,
  Settings,
  RefreshCw,
  Search,
  Filter,
  FileSpreadsheet,
  AlertTriangle,
  Building2,
  Lock,
  Mail,
  Phone,
  BadgeCheck,
  ChevronRight,
  Database,
  ArrowLeft,
  Cloud,
  Server,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react';
import { Technician, AppSettings, WarrantyRecord } from '../types';
import { warrantyDb } from '../utils/storage';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  testSupabaseConnection,
  isSupabaseConfigured,
  DEFAULT_STORAGE_BUCKET
} from '../lib/supabase';

interface AdminPanelProps {
  onBackToRecords: () => void;
  onTechniciansUpdated: () => void;
  records: WarrantyRecord[];
}

type AdminTab = 'technicians' | 'overview' | 'supabase' | 'data' | 'settings';

const PORSCHE_SPECIALTIES = [
  'Diagnóstico Alta Tensão & E-Performance (Master)',
  'Powertrain, Câmbio PDK & Motor Boxer',
  'Chassi, Suspensão Ativa (PASM) & Freios PCCB',
  'Mecatrônica Geral & Redes CAN/FlexRay',
  'Diagnóstico Eletroeletrônico & Módulos PIWIS',
  'Carroceria, Acabamento & Aerodinâmica Ativa',
  'Inspeção Pré-Entrega & Qualidade de Garantia'
];

export const AdminPanel: React.FC<AdminPanelProps> = ({
  onBackToRecords,
  onTechniciansUpdated,
  records
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('technicians');
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);

  // Technician Search & Filter
  const [techSearch, setTechSearch] = useState('');
  const [techStatusFilter, setTechStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Technician Edit/Add Modal
  const [isTechModalOpen, setIsTechModalOpen] = useState(false);
  const [editingTech, setEditingTech] = useState<Technician | null>(null);
  const [techFormName, setTechFormName] = useState('');
  const [techFormReg, setTechFormReg] = useState('');
  const [techFormSpec, setTechFormSpec] = useState(PORSCHE_SPECIALTIES[0]);
  const [techFormCustomSpec, setTechFormCustomSpec] = useState('');
  const [techFormEmail, setTechFormEmail] = useState('');
  const [techFormPhone, setTechFormPhone] = useState('');
  const [techFormActive, setTechFormActive] = useState(true);
  const [techFormError, setTechFormError] = useState('');

  // Technician Delete Confirmation Modal
  const [techToDelete, setTechToDelete] = useState<{ tech: Technician; associatedCount: number } | null>(null);

  const [backupSuccessMessage, setBackupSuccessMessage] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState(false);

  // Supabase Integration State
  const [sbUrl, setSbUrl] = useState(() => getSupabaseConfig().url);
  const [sbKey, setSbKey] = useState(() => getSupabaseConfig().publishableKey);
  const [sbSaveSuccess, setSbSaveSuccess] = useState(false);
  const [isTestingSb, setIsTestingSb] = useState(false);
  const [sbTestResult, setSbTestResult] = useState<any>(null);
  const [isSyncingSb, setIsSyncingSb] = useState(false);
  const [sbSyncStatus, setSbSyncStatus] = useState<string | null>(null);

  // Load Technicians & Settings
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [techs, appSettings, stats] = await Promise.all([
        warrantyDb.getAllTechnicians(),
        warrantyDb.getAppSettings(),
        warrantyDb.getStorageAnalytics()
      ]);
      setTechnicians(techs);
      setSettings(appSettings);
      setAnalytics(stats);
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [records]);

  // Handle Open Add Tech
  const handleOpenAddTech = () => {
    setEditingTech(null);
    setTechFormName('');
    setTechFormReg(`P-${Math.floor(1000 + Math.random() * 9000)}`);
    setTechFormSpec(PORSCHE_SPECIALTIES[0]);
    setTechFormCustomSpec('');
    setTechFormEmail('');
    setTechFormPhone('');
    setTechFormActive(true);
    setTechFormError('');
    setIsTechModalOpen(true);
  };

  // Handle Open Edit Tech
  const handleOpenEditTech = (tech: Technician) => {
    setEditingTech(tech);
    setTechFormName(tech.name);
    setTechFormReg(tech.registration);
    if (PORSCHE_SPECIALTIES.includes(tech.specialty)) {
      setTechFormSpec(tech.specialty);
      setTechFormCustomSpec('');
    } else {
      setTechFormSpec('custom');
      setTechFormCustomSpec(tech.specialty);
    }
    setTechFormEmail(tech.email || '');
    setTechFormPhone(tech.phone || '');
    setTechFormActive(tech.active);
    setTechFormError('');
    setIsTechModalOpen(true);
  };

  // Save Technician
  const handleSaveTechnician = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!techFormName.trim()) {
      setTechFormError('O nome do técnico é obrigatório.');
      return;
    }
    if (!techFormReg.trim()) {
      setTechFormError('A matrícula/registro do técnico é obrigatória.');
      return;
    }

    const finalSpecialty =
      techFormSpec === 'custom' ? techFormCustomSpec.trim() || 'Mecatrônica Geral' : techFormSpec;

    const newOrUpdatedTech: Technician = {
      id: editingTech ? editingTech.id : `tech_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: techFormName.trim(),
      registration: techFormReg.trim().toUpperCase(),
      specialty: finalSpecialty,
      email: techFormEmail.trim() || undefined,
      phone: techFormPhone.trim() || undefined,
      active: techFormActive,
      createdAt: editingTech ? editingTech.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await warrantyDb.saveTechnician(newOrUpdatedTech);
    setIsTechModalOpen(false);
    await loadData();
    onTechniciansUpdated();
  };

  // Toggle Technician Active Status
  const handleToggleTechStatus = async (tech: Technician) => {
    await warrantyDb.toggleTechnicianStatus(tech.id);
    await loadData();
    onTechniciansUpdated();
  };

  // Check and Request Delete Technician
  const handleRequestDeleteTech = (tech: Technician) => {
    const associatedCount = records.filter(
      (r) => r.technician && r.technician.trim().toLowerCase() === tech.name.trim().toLowerCase()
    ).length;
    setTechToDelete({ tech, associatedCount });
  };

  // Confirm Delete Technician
  const handleConfirmDeleteTech = async () => {
    if (!techToDelete) return;
    await warrantyDb.deleteTechnician(techToDelete.tech.id);
    setTechToDelete(null);
    await loadData();
    onTechniciansUpdated();
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setIsSavingSettings(true);
    try {
      await warrantyDb.saveAppSettings(settings);
      setSettingsSavedMessage(true);
      setTimeout(() => setSettingsSavedMessage(false), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Export Full Backup
  const handleExportBackup = async () => {
    try {
      const backupJson = await warrantyDb.exportFullDatabaseBackup();
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `backup_porsche_garantia_completo_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupSuccessMessage('Backup completo baixado com sucesso!');
      setTimeout(() => setBackupSuccessMessage(''), 4000);
    } catch (err: any) {
      alert('Erro ao exportar backup: ' + err.message);
    }
  };

  // Import Full Backup
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportStatus('Processando backup...');
      const text = await file.text();
      const res = await warrantyDb.importFullDatabaseBackup(text);
      setImportStatus(`Importação concluída: ${res.importedRecords} OS e ${res.importedTechs} técnicos importados!`);
      await loadData();
      onTechniciansUpdated();
      setTimeout(() => setImportStatus(null), 5000);
    } catch (err: any) {
      setImportStatus('Falha ao importar backup: ' + err.message);
    } finally {
      e.target.value = '';
    }
  };

  // Export CSV of Records
  const handleExportCsv = () => {
    if (records.length === 0) {
      alert('Não há registros para exportar.');
      return;
    }

    const headers = [
      'ID Registro',
      'Numero OS',
      'Chassi VIN',
      'Tecnico',
      'Data Reparo',
      'Status',
      'Qtd Evidencias',
      'Criado Em',
      'Atualizado Em'
    ];

    const rows = records.map((r) => {
      const evidenceCount = r.evidences ? Object.values(r.evidences).filter(Boolean).length : 0;
      return [
        r.id,
        r.osNumber,
        r.chassisVin,
        `"${(r.technician || '').replace(/"/g, '""')}"`,
        r.repairDate,
        r.status === 'finalizado' ? 'Finalizado' : 'Em Preenchimento',
        evidenceCount,
        r.createdAt,
        r.updatedAt
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_auditoria_garantia_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveSbConfig = () => {
    if (!sbUrl.trim() || !sbKey.trim()) {
      setSbTestResult({
        success: false,
        message: 'Por favor, informe a URL do Projeto (Project URL) e a Chave Anon (Publishable Key) do seu projeto Supabase antes de salvar.'
      });
      return;
    }
    saveSupabaseConfig(sbUrl.trim(), sbKey.trim());
    setSbSaveSuccess(true);
    setTimeout(() => setSbSaveSuccess(false), 3000);
    handleTestSb();
  };

  const handleTestSb = async () => {
    setIsTestingSb(true);
    setSbTestResult(null);
    try {
      const res = await testSupabaseConnection();
      setSbTestResult(res);
    } catch (e: any) {
      setSbTestResult({ success: false, message: e.message || 'Erro de conexão' });
    } finally {
      setIsTestingSb(false);
    }
  };

  const handleSyncToSb = async () => {
    if (!isSupabaseConfigured()) {
      alert('Configure o Supabase primeiro.');
      return;
    }
    setIsSyncingSb(true);
    setSbSyncStatus('Sincronizando registros e evidências com o Supabase...');
    try {
      const res = await warrantyDb.syncAllLocalToSupabase();
      setSbSyncStatus(`Sincronização concluída: ${res.successCount} registros enviados para a nuvem.`);
      onTechniciansUpdated();
    } catch (e: any) {
      setSbSyncStatus('Falha na sincronização: ' + e.message);
    } finally {
      setIsSyncingSb(false);
    }
  };

  const handleSyncFromSb = async () => {
    if (!isSupabaseConfigured()) {
      alert('Configure o Supabase primeiro.');
      return;
    }
    setIsSyncingSb(true);
    setSbSyncStatus('Baixando dados do Supabase...');
    try {
      const count = await warrantyDb.syncAllSupabaseToLocal();
      setSbSyncStatus(`${count} registros baixados da nuvem.`);
      onTechniciansUpdated();
    } catch (e: any) {
      setSbSyncStatus('Erro ao baixar: ' + e.message);
    } finally {
      setIsSyncingSb(false);
    }
  };

  // Filter technicians
  const filteredTechnicians = technicians.filter((t) => {
    if (techStatusFilter === 'active' && !t.active) return false;
    if (techStatusFilter === 'inactive' && t.active) return false;
    if (techSearch) {
      const q = techSearch.toLowerCase().trim();
      const matchName = t.name.toLowerCase().includes(q);
      const matchReg = t.registration.toLowerCase().includes(q);
      const matchSpec = t.specialty.toLowerCase().includes(q);
      const matchEmail = (t.email || '').toLowerCase().includes(q);
      return matchName || matchReg || matchSpec || matchEmail;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-[#18181C] border border-[#27272E] p-4 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToRecords}
            className="w-10 h-10 flex items-center justify-center bg-[#121214] border border-[#2E2E36] text-neutral-300 hover:text-white hover:border-[#D5001C] transition-colors cursor-pointer"
            title="Voltar aos Registros"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#D5001C]" />
              <h1 className="text-base sm:text-lg font-extrabold uppercase tracking-wider text-white">
                Painel Administrativo & Gestão
              </h1>
              <span className="text-[10px] font-mono uppercase bg-[#25252D] text-neutral-300 border border-[#353540] px-2 py-0.5">
                Admin
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Gestão de técnicos autorizados, auditoria de dados e configurações da concessionária
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveTab('technicians')}
            className={`min-h-[40px] px-3.5 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'technicians'
                ? 'bg-[#D5001C] text-white shadow-xs'
                : 'bg-[#121214] border border-[#27272E] text-neutral-300 hover:text-white hover:bg-[#202026]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Técnicos ({technicians.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('overview')}
            className={`min-h-[40px] px-3.5 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-[#D5001C] text-white shadow-xs'
                : 'bg-[#121214] border border-[#27272E] text-neutral-300 hover:text-white hover:bg-[#202026]'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Visão Geral</span>
          </button>

          <button
            onClick={() => setActiveTab('supabase')}
            className={`min-h-[40px] px-3.5 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'supabase'
                ? 'bg-[#D5001C] text-white shadow-xs'
                : 'bg-[#121214] border border-[#27272E] text-neutral-300 hover:text-white hover:bg-[#202026]'
            }`}
          >
            <Cloud className="w-4 h-4 text-emerald-400" />
            <span>Supabase & Nuvem</span>
            {isSupabaseConfigured() && (
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('data')}
            className={`min-h-[40px] px-3.5 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'data'
                ? 'bg-[#D5001C] text-white shadow-xs'
                : 'bg-[#121214] border border-[#27272E] text-neutral-300 hover:text-white hover:bg-[#202026]'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Backup & Dados</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`min-h-[40px] px-3.5 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-[#D5001C] text-white shadow-xs'
                : 'bg-[#121214] border border-[#27272E] text-neutral-300 hover:text-white hover:bg-[#202026]'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Configurações</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* ABA 1: GESTÃO DE TÉCNICOS                                */}
      {/* ======================================================== */}
      {activeTab === 'technicians' && (
        <div className="space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-[#18181C] border border-[#27272E] p-3.5 sm:p-4">
              <div className="text-[10px] sm:text-[11px] font-mono uppercase text-neutral-400">Total de Técnicos</div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-white mt-1">{technicians.length}</div>
            </div>
            <div className="bg-[#18181C] border border-[#27272E] p-3.5 sm:p-4">
              <div className="text-[10px] sm:text-[11px] font-mono uppercase text-neutral-400">Técnicos Ativos</div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 mt-1">
                {technicians.filter((t) => t.active).length}
              </div>
            </div>
            <div className="bg-[#18181C] border border-[#27272E] p-3.5 sm:p-4">
              <div className="text-[10px] sm:text-[11px] font-mono uppercase text-neutral-400">Técnicos Inativos</div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-neutral-400 mt-1">
                {technicians.filter((t) => !t.active).length}
              </div>
            </div>
            <div className="bg-[#18181C] border border-[#27272E] p-3.5 sm:p-4">
              <div className="text-[10px] sm:text-[11px] font-mono uppercase text-neutral-400">Ordens de Serviço Atribuídas</div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-[#D5001C] mt-1">{records.length}</div>
            </div>
          </div>

          {/* Action and Search Bar */}
          <div className="bg-[#18181C] border border-[#27272E] p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={techSearch}
                  onChange={(e) => setTechSearch(e.target.value)}
                  placeholder="Pesquisar por nome, matrícula, especialidade ou e-mail..."
                  className="w-full pl-10 pr-4 h-11 sm:h-9 bg-[#121214] border border-[#2E2E36] text-base sm:text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-[#D5001C] focus:bg-[#151518]"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-[#121214] border border-[#2E2E36] p-1 text-xs shrink-0">
                <button
                  onClick={() => setTechStatusFilter('all')}
                  className={`px-2.5 py-1 font-semibold transition-colors cursor-pointer ${
                    techStatusFilter === 'all' ? 'bg-[#25252D] text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setTechStatusFilter('active')}
                  className={`px-2.5 py-1 font-semibold transition-colors cursor-pointer ${
                    techStatusFilter === 'active' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Ativos
                </button>
                <button
                  onClick={() => setTechStatusFilter('inactive')}
                  className={`px-2.5 py-1 font-semibold transition-colors cursor-pointer ${
                    techStatusFilter === 'inactive' ? 'bg-neutral-800 text-neutral-300' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Inativos
                </button>
              </div>
            </div>

            <button
              onClick={handleOpenAddTech}
              className="min-h-[44px] sm:min-h-[38px] px-4 py-2 bg-[#D5001C] hover:bg-[#b00017] text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs whitespace-nowrap active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Incluir Novo Técnico</span>
            </button>
          </div>

          {/* Technicians List / Cards */}
          {filteredTechnicians.length === 0 ? (
            <div className="bg-[#18181C] border border-[#27272E] p-12 text-center">
              <Users className="w-12 h-12 text-neutral-600 mx-auto mb-3 stroke-[1.2]" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Nenhum técnico encontrado</h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
                Não foram encontrados técnicos para o filtro aplicado. Clique em "Incluir Novo Técnico" para cadastrar.
              </p>
              <button
                onClick={handleOpenAddTech}
                className="mt-4 px-4 py-2 bg-[#D5001C] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Cadastrar Técnico
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTechnicians.map((tech) => {
                const assignedRecordsCount = records.filter(
                  (r) => r.technician && r.technician.trim().toLowerCase() === tech.name.trim().toLowerCase()
                ).length;

                return (
                  <div
                    key={tech.id}
                    className={`bg-[#18181C] border p-4 sm:p-5 flex flex-col justify-between transition-all ${
                      tech.active
                        ? 'border-[#27272E] hover:border-[#3A3A46]'
                        : 'border-[#27272E]/60 opacity-60 bg-[#151518]'
                    }`}
                  >
                    <div>
                      {/* Top Header of Card */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#222228] border border-[#2F2F38] text-white flex items-center justify-center font-bold text-xs font-mono">
                            {tech.name
                              .split(' ')
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </div>
                          <div>
                            <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                              {tech.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-[10px] text-neutral-400 bg-[#121214] px-1.5 py-0.5 border border-[#27272E]">
                                {tech.registration}
                              </span>
                              <span
                                className={`text-[9px] font-mono uppercase px-1.5 py-0.5 border ${
                                  tech.active
                                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                                    : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                                }`}
                              >
                                {tech.active ? 'Ativo' : 'Inativo'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* OS Count Badge */}
                        <div className="text-right shrink-0">
                          <span className="font-mono text-xs font-bold text-white block">
                            {assignedRecordsCount} OS
                          </span>
                          <span className="text-[9px] font-mono uppercase text-neutral-500">Vinculadas</span>
                        </div>
                      </div>

                      {/* Specialty Badge */}
                      <div className="mb-3">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-300 bg-[#141416] border border-[#2E2E36] px-2 py-1 block truncate">
                          {tech.specialty}
                        </span>
                      </div>

                      {/* Contact Info */}
                      <div className="space-y-1 text-xs text-neutral-400 border-t border-[#24242A] pt-2.5 mb-4 font-mono text-[11px]">
                        {tech.email && (
                          <div className="flex items-center gap-1.5 truncate">
                            <Mail className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                            <span className="truncate">{tech.email}</span>
                          </div>
                        )}
                        {tech.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                            <span>{tech.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center justify-between gap-2 border-t border-[#24242A] pt-3">
                      <button
                        type="button"
                        onClick={() => handleToggleTechStatus(tech)}
                        className={`min-h-[36px] px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider border transition-colors cursor-pointer ${
                          tech.active
                            ? 'border-[#363640] text-neutral-400 hover:text-white hover:border-neutral-500'
                            : 'border-emerald-800 text-emerald-400 hover:bg-emerald-950/40'
                        }`}
                      >
                        {tech.active ? 'Desativar' : 'Reativar'}
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditTech(tech)}
                          className="min-h-[36px] px-3 py-1 bg-[#222228] hover:bg-[#2C2C34] border border-[#33333E] text-neutral-200 hover:text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRequestDeleteTech(tech)}
                          className="min-h-[36px] w-9 flex items-center justify-center bg-transparent hover:bg-red-950/40 border border-[#363640] hover:border-[#D5001C] text-neutral-400 hover:text-[#D5001C] transition-colors cursor-pointer"
                          title="Excluir Técnico"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 2: VISÃO GERAL & MÉTRICAS                            */}
      {/* ======================================================== */}
      {activeTab === 'overview' && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#18181C] border border-[#27272E] p-4 sm:p-5">
              <span className="text-[11px] font-mono uppercase text-neutral-400 block">Total de OS no Sistema</span>
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white mt-1 block">
                {analytics.totalRecords}
              </span>
              <div className="flex items-center gap-3 text-[10px] font-mono text-neutral-400 mt-2">
                <span className="text-emerald-400">{analytics.finalizedCount} Finalizadas</span>
                <span>·</span>
                <span className="text-amber-400">{analytics.draftCount} Em Preenchimento</span>
              </div>
            </div>

            <div className="bg-[#18181C] border border-[#27272E] p-4 sm:p-5">
              <span className="text-[11px] font-mono uppercase text-neutral-400 block">Evidências Técnicas Arquivadas</span>
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[#D5001C] mt-1 block">
                {analytics.totalEvidences}
              </span>
              <span className="text-[10px] font-mono text-neutral-400 mt-2 block">
                Fotos e vídeos em alta resolução
              </span>
            </div>

            <div className="bg-[#18181C] border border-[#27272E] p-4 sm:p-5">
              <span className="text-[11px] font-mono uppercase text-neutral-400 block">Armazenamento Local IndexedDB</span>
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white mt-1 block">
                {analytics.estimatedSizeMb} MB
              </span>
              <span className="text-[10px] font-mono text-emerald-400 mt-2 block">
                100% Offline e Persistente
              </span>
            </div>

            <div className="bg-[#18181C] border border-[#27272E] p-4 sm:p-5">
              <span className="text-[11px] font-mono uppercase text-neutral-400 block">Corpo Técnico Cadastrado</span>
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white mt-1 block">
                {analytics.techniciansCount}
              </span>
              <span className="text-[10px] font-mono text-neutral-400 mt-2 block">
                Técnicos certificados ativos
              </span>
            </div>
          </div>

          {/* Technicians Productivity Ranking */}
          <div className="bg-[#18181C] border border-[#27272E] p-4 sm:p-6 shadow-sm">
            <div className="border-b border-[#27272E] pb-3 mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-[#D5001C]" />
                  Distribuição de Ordens de Serviço por Técnico
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Volume de atendimentos de garantia documentados por cada profissional
                </p>
              </div>
              <button
                onClick={handleExportCsv}
                className="px-3 py-1.5 bg-[#222228] hover:bg-[#2C2C34] border border-[#33333E] text-neutral-300 hover:text-white text-xs font-semibold uppercase font-mono flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                Exportar CSV
              </button>
            </div>

            <div className="space-y-4">
              {analytics.technicianDistribution.map((item: any) => {
                const maxCount = Math.max(...analytics.technicianDistribution.map((d: any) => d.count), 1);
                const percentage = Math.round((item.count / maxCount) * 100);

                return (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white flex items-center gap-2">
                        {item.name}
                      </span>
                      <div className="flex items-center gap-3 font-mono text-[11px]">
                        <span className="text-emerald-400">{item.finalized} finalizadas</span>
                        {item.draft > 0 && <span className="text-amber-400">{item.draft} rascunhos</span>}
                        <span className="font-bold text-white bg-[#222228] px-2 py-0.5 border border-[#2D2D36]">
                          Total: {item.count} OS
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2.5 bg-[#121214] border border-[#27272E] overflow-hidden">
                      <div
                        className="h-full bg-[#D5001C] transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA: SUPABASE & NUVEM                                    */}
      {/* ======================================================== */}
      {activeTab === 'supabase' && (
        <div className="space-y-6">
          {/* Header Info */}
          <div className="bg-[#18181C] border border-[#27272E] p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Integração com Supabase (PostgreSQL & Storage)
                </h3>
                {isSupabaseConfigured() ? (
                  <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                    Conectado
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-amber-950 text-amber-300 border border-amber-500/40">
                    Modo Local
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 mt-1 max-w-2xl leading-relaxed">
                Armazenamento de registros de OS no PostgreSQL, evidências fotográficas e vídeos originais no bucket privado <code className="text-neutral-200">{DEFAULT_STORAGE_BUCKET}</code> com políticas RLS ativas.
              </p>
            </div>
          </div>

          {/* Supabase Credentials Box */}
          <div className="bg-[#18181C] border border-[#27272E] p-5 sm:p-6 shadow-sm space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-[#D5001C]" />
              Credenciais da Concessionária
            </h4>

            {!isSupabaseConfigured() && (
              <div className="p-3.5 bg-[#1F1B18] border border-amber-600/40 text-amber-200 text-xs space-y-1.5 font-sans">
                <span className="font-bold text-amber-400 uppercase tracking-wider text-[11px] block">
                  Como preencher os campos abaixo:
                </span>
                <p className="text-neutral-300 text-xs leading-relaxed">
                  1. Acesse seu painel no Supabase (<span className="text-white font-mono">app.supabase.com</span>) e abra seu projeto.<br />
                  2. Vá em <strong>Project Settings &gt; API</strong>.<br />
                  3. Copie o <strong>Project URL</strong> e a chave <strong>anon / public</strong> e cole nos campos abaixo.<br />
                  4. Clique em <strong>Salvar Credenciais</strong>.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-300 mb-1">
                  Project URL (VITE_SUPABASE_URL)
                </label>
                <input
                  type="text"
                  value={sbUrl}
                  onChange={(e) => setSbUrl(e.target.value)}
                  placeholder="https://seu-id.supabase.co"
                  className="w-full h-10 px-3 bg-[#121214] border border-[#2E2E36] text-xs font-mono text-white focus:border-[#D5001C] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-300 mb-1">
                  Publishable Key / Anon Key (VITE_SUPABASE_PUBLISHABLE_KEY)
                </label>
                <input
                  type="password"
                  value={sbKey}
                  onChange={(e) => setSbKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full h-10 px-3 bg-[#121214] border border-[#2E2E36] text-xs font-mono text-white focus:border-[#D5001C] focus:outline-hidden"
                />
              </div>
            </div>

            {sbSaveSuccess && (
              <div className="p-3 bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Configurações do Supabase salvas com sucesso!
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSaveSbConfig}
                className="px-4 py-2 bg-[#D5001C] hover:bg-[#b00017] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer active:scale-98"
              >
                Salvar Credenciais
              </button>

              <button
                type="button"
                onClick={handleTestSb}
                disabled={isTestingSb || !sbUrl || !sbKey}
                className="px-4 py-2 bg-[#222228] hover:bg-[#2B2B34] border border-[#33333E] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 active:scale-98"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingSb ? 'animate-spin' : ''}`} />
                {isTestingSb ? 'Testando...' : 'Testar Conexão em Tempo Real'}
              </button>
            </div>

            {sbTestResult && (
              <div
                className={`p-4 border text-xs ${
                  sbTestResult.success
                    ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
                    : 'bg-rose-950/50 border-rose-500/50 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-2 font-bold mb-2">
                  {sbTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400" />
                  )}
                  <span className="text-sm font-bold uppercase tracking-wider">
                    {sbTestResult.success ? 'Conexão Supabase Estabelecida!' : 'Falha na Conexão com o Supabase'}
                  </span>
                </div>
                <p className="whitespace-pre-line leading-relaxed text-xs">
                  {sbTestResult.message}
                </p>

                {!sbTestResult.success && (
                  <div className="mt-3 pt-3 border-t border-rose-800/40 flex flex-wrap items-center gap-2">
                    <a
                      href="https://supabase.com/dashboard"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white text-[11px] font-bold uppercase tracking-wider transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir Painel do Supabase</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleTestSb}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-900/60 hover:bg-rose-800/80 border border-rose-500/50 text-rose-100 text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Testar Novamente</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cloud Sync Operations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#18181C] border border-[#27272E] p-5 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-1 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[#D5001C]" />
                  Enviar Registros Locais para a Nuvem
                </h4>
                <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
                  Exporta todas as OS, fotografias e vídeos em alta resolução salvos neste dispositivo para o PostgreSQL e Supabase Storage.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSyncToSb}
                disabled={isSyncingSb || !isSupabaseConfigured()}
                className="w-full py-2.5 bg-[#D5001C] hover:bg-[#b00017] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 active:scale-98"
              >
                {isSyncingSb ? 'Enviando...' : 'Sincronizar para a Nuvem'}
              </button>
            </div>

            <div className="bg-[#18181C] border border-[#27272E] p-5 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-1 flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-400" />
                  Baixar Registros da Nuvem
                </h4>
                <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
                  Baixa todas as OS cadastradas na nuvem para o cache local do navegador, permitindo consulta offline instantânea.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSyncFromSb}
                disabled={isSyncingSb || !isSupabaseConfigured()}
                className="w-full py-2.5 bg-[#222228] hover:bg-[#2B2B34] border border-[#33333E] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 active:scale-98"
              >
                {isSyncingSb ? 'Baixando...' : 'Atualizar com a Nuvem'}
              </button>
            </div>
          </div>

          {sbSyncStatus && (
            <div className="p-3 bg-[#202028] border border-[#3A3A48] text-white text-xs font-mono">
              {sbSyncStatus}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 3: BACKUP, DADOS & AUDITORIA                         */}
      {/* ======================================================== */}
      {activeTab === 'data' && (
        <div className="space-y-6">
          {backupSuccessMessage && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-xs font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{backupSuccessMessage}</span>
            </div>
          )}

          {importStatus && (
            <div className="p-3 bg-[#202028] border border-[#3A3A48] text-white text-xs font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{importStatus}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Backup Full System */}
            <div className="bg-[#18181C] border border-[#27272E] p-4 sm:p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Download className="w-5 h-5 text-[#D5001C]" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                    Exportar Backup Completo do Sistema
                  </h3>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed mb-4">
                  Gera um arquivo <span className="font-mono text-neutral-200">.json</span> contendo todas as Ordens de
                  Serviço, metadados de fotos e vídeos, corpo técnico cadastrado e configurações da concessionária.
                  Ideal para arquivamento externo, migração de estação ou contingência de auditoria.
                </p>
              </div>
              <button
                onClick={handleExportBackup}
                className="w-full min-h-[44px] bg-[#D5001C] hover:bg-[#b00017] text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-98"
              >
                <Download className="w-4 h-4" />
                <span>Baixar Backup Completo (.json)</span>
              </button>
            </div>

            {/* Restore Full System */}
            <div className="bg-[#18181C] border border-[#27272E] p-4 sm:p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Upload className="w-5 h-5 text-neutral-300" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                    Restaurar Backup do Sistema
                  </h3>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed mb-4">
                  Restaura registros e lista de técnicos a partir de um arquivo <span className="font-mono text-neutral-200">.json</span> gerado anteriormente. Registros existentes com os mesmos identificadores serão atualizados de forma segura.
                </p>
              </div>
              <label className="w-full min-h-[44px] bg-[#222228] hover:bg-[#2B2B34] border border-[#33333E] text-neutral-200 hover:text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-98">
                <Upload className="w-4 h-4" />
                <span>Selecionar Arquivo de Backup</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>
            </div>

            {/* Export CSV for Warranty Audit */}
            <div className="bg-[#18181C] border border-[#27272E] p-4 sm:p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                    Planilha Consolidada de Auditoria (CSV)
                  </h3>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed mb-4">
                  Exporta a tabela completa de Ordens de Serviço em formato CSV compativel com Excel e Google Sheets, incluindo número de OS, chassi (VIN), técnico responsável, status e contagem de evidências anexadas.
                </p>
              </div>
              <button
                onClick={handleExportCsv}
                className="w-full min-h-[44px] bg-[#222228] hover:bg-[#2B2B34] border border-[#33333E] text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-98"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Exportar Planilha de Auditoria (CSV)</span>
              </button>
            </div>

            {/* Safe Purge of Abandoned Drafts */}
            <div className="bg-[#18181C] border border-[#27272E] p-4 sm:p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                    Limpeza de Rascunhos Abandonados
                  </h3>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed mb-4">
                  Exclui somente os registros com status "Em preenchimento" que não foram finalizados, liberando espaço local. Todos os registros <span className="text-white font-semibold">Finalizados</span> são preservados integralmente.
                </p>
              </div>
              <button
                onClick={async () => {
                  if (confirm('Deseja realmente excluir todos os rascunhos em preenchimento? Os registros finalizados não serão afetados.')) {
                    const count = await warrantyDb.purgeDraftRecords();
                    alert(`${count} rascunho(s) excluído(s) com sucesso.`);
                    await loadData();
                    onTechniciansUpdated();
                  }
                }}
                className="w-full min-h-[44px] bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/60 text-amber-300 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Expurgar Apenas Rascunhos</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 4: CONFIGURAÇÕES DA CONCESSIONÁRIA                   */}
      {/* ======================================================== */}
      {activeTab === 'settings' && settings && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {settingsSavedMessage && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-xs font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Configurações salvas e aplicadas com sucesso!</span>
            </div>
          )}

          <div className="bg-[#18181C] border border-[#27272E] p-4 sm:p-6 shadow-sm space-y-5">
            <div className="border-b border-[#27272E] pb-3">
              <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#D5001C]" />
                Dados da Concessionária / Centro Porsche
              </h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Estas informações são impressas no cabeçalho dos relatórios técnicos em PDF
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Nome da Concessionária / Unidade
                </label>
                <input
                  type="text"
                  value={settings.dealerName}
                  onChange={(e) => setSettings({ ...settings, dealerName: e.target.value })}
                  className="w-full px-3.5 h-11 sm:h-9 bg-[#121214] border border-[#2E2E36] text-base sm:text-xs text-white focus:outline-hidden focus:border-[#D5001C]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Código do Concessionário Porsche
                </label>
                <input
                  type="text"
                  value={settings.dealerCode}
                  onChange={(e) => setSettings({ ...settings, dealerCode: e.target.value })}
                  className="w-full px-3.5 h-11 sm:h-9 bg-[#121214] border border-[#2E2E36] text-base sm:text-xs text-white font-mono focus:outline-hidden focus:border-[#D5001C]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Gestor de Garantia Responsável
                </label>
                <input
                  type="text"
                  value={settings.warrantyManagerName}
                  onChange={(e) => setSettings({ ...settings, warrantyManagerName: e.target.value })}
                  className="w-full px-3.5 h-11 sm:h-9 bg-[#121214] border border-[#2E2E36] text-base sm:text-xs text-white focus:outline-hidden focus:border-[#D5001C]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  E-mail do Gestor de Garantia
                </label>
                <input
                  type="email"
                  value={settings.warrantyManagerEmail}
                  onChange={(e) => setSettings({ ...settings, warrantyManagerEmail: e.target.value })}
                  className="w-full px-3.5 h-11 sm:h-9 bg-[#121214] border border-[#2E2E36] text-base sm:text-xs text-white font-mono focus:outline-hidden focus:border-[#D5001C]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Telefone / Ramal da Garantia
                </label>
                <input
                  type="text"
                  value={settings.contactPhone}
                  onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
                  className="w-full px-3.5 h-11 sm:h-9 bg-[#121214] border border-[#2E2E36] text-base sm:text-xs text-white font-mono focus:outline-hidden focus:border-[#D5001C]"
                />
              </div>
            </div>
          </div>

          <div className="bg-[#18181C] border border-[#27272E] p-4 sm:p-6 shadow-sm space-y-4">
            <div className="border-b border-[#27272E] pb-3">
              <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#D5001C]" />
                Segurança e Regras de Preenchimento
              </h3>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.strictAuditValidation}
                  onChange={(e) => setSettings({ ...settings, strictAuditValidation: e.target.checked })}
                  className="w-4 h-4 accent-[#D5001C]"
                />
                <span className="text-xs text-neutral-200">
                  <strong className="text-white block">Auditoria Rígida:</strong>
                  Exigir todas as 12 evidências fotográficas e de vídeo anexadas antes de permitir finalizar a OS
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoBackupNotification}
                  onChange={(e) => setSettings({ ...settings, autoBackupNotification: e.target.checked })}
                  className="w-4 h-4 accent-[#D5001C]"
                />
                <span className="text-xs text-neutral-200">
                  <strong className="text-white block">Aviso Periódico de Backup:</strong>
                  Sugerir exportação de backup semanal ao gerar relatórios em PDF
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingSettings}
              className="min-h-[44px] px-6 bg-[#D5001C] hover:bg-[#b00017] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSavingSettings ? 'Salvando...' : 'Salvar Configurações'}</span>
            </button>
          </div>
        </form>
      )}

      {/* ======================================================== */}
      {/* MODAL: INCLUIR / EDITAR TÉCNICO                          */}
      {/* ======================================================== */}
      {isTechModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#18181C] border border-[#2E2E38] w-full max-w-lg shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#27272E] pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-[#D5001C]" />
                {editingTech ? 'Editar Cadastro do Técnico' : 'Incluir Novo Técnico'}
              </h3>
              <button
                onClick={() => setIsTechModalOpen(false)}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {techFormError && (
              <div className="p-2.5 bg-red-950/60 border border-red-800 text-red-300 text-xs font-mono">
                {techFormError}
              </div>
            )}

            <form onSubmit={handleSaveTechnician} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Nome Completo <span className="text-[#D5001C]">*</span>
                </label>
                <input
                  type="text"
                  value={techFormName}
                  onChange={(e) => setTechFormName(e.target.value)}
                  placeholder="Ex: Matheus Guimarães"
                  className="w-full px-3.5 h-11 sm:h-9 bg-[#121214] border border-[#2E2E36] text-base sm:text-xs text-white focus:outline-hidden focus:border-[#D5001C]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                    Matrícula / ID Técnico <span className="text-[#D5001C]">*</span>
                  </label>
                  <input
                    type="text"
                    value={techFormReg}
                    onChange={(e) => setTechFormReg(e.target.value)}
                    placeholder="Ex: P-4091"
                    className="w-full px-3.5 h-11 sm:h-9 bg-[#121214] border border-[#2E2E36] text-base sm:text-xs text-white font-mono focus:outline-hidden focus:border-[#D5001C] uppercase"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                    Telefone / Ramal
                  </label>
                  <input
                    type="text"
                    value={techFormPhone}
                    onChange={(e) => setTechFormPhone(e.target.value)}
                    placeholder="Ex: (11) 98765-4321"
                    className="w-full px-3.5 h-11 sm:h-9 bg-[#121214] border border-[#2E2E36] text-base sm:text-xs text-white font-mono focus:outline-hidden focus:border-[#D5001C]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Especialidade Técnica Porsche
                </label>
                <select
                  value={techFormSpec}
                  onChange={(e) => setTechFormSpec(e.target.value)}
                  className="w-full px-3.5 h-11 sm:h-9 bg-[#121214] border border-[#2E2E36] text-base sm:text-xs text-neutral-200 focus:outline-hidden focus:border-[#D5001C]"
                >
                  {PORSCHE_SPECIALTIES.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                  <option value="custom">Outra Especialidade (Digitar)...</option>
                </select>
              </div>

              {techFormSpec === 'custom' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                    Especifique a Área Técnica
                  </label>
                  <input
                    type="text"
                    value={techFormCustomSpec}
                    onChange={(e) => setTechFormCustomSpec(e.target.value)}
                    placeholder="Ex: Diagnóstico Acústico e Vibrações NVH"
                    className="w-full px-3.5 h-11 sm:h-9 bg-[#121214] border border-[#2E2E36] text-base sm:text-xs text-white focus:outline-hidden focus:border-[#D5001C]"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  E-mail Corporativo
                </label>
                <input
                  type="email"
                  value={techFormEmail}
                  onChange={(e) => setTechFormEmail(e.target.value)}
                  placeholder="Ex: matheus.guimaraes@porschenewcenter.com.br"
                  className="w-full px-3.5 h-11 sm:h-9 bg-[#121214] border border-[#2E2E36] text-base sm:text-xs text-white font-mono focus:outline-hidden focus:border-[#D5001C]"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={techFormActive}
                    onChange={(e) => setTechFormActive(e.target.checked)}
                    className="w-4 h-4 accent-[#D5001C]"
                  />
                  <span className="text-xs font-semibold text-neutral-200">
                    Técnico ativo (disponível para novas Ordens de Serviço)
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#27272E]">
                <button
                  type="button"
                  onClick={() => setIsTechModalOpen(false)}
                  className="min-h-[40px] px-4 border border-[#3A3A46] text-neutral-300 hover:text-white hover:bg-[#202028] text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] px-5 bg-[#D5001C] hover:bg-[#b00017] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingTech ? 'Salvar Alterações' : 'Cadastrar Técnico'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CONFIRMAÇÃO DE EXCLUSÃO DE TÉCNICO                */}
      {/* ======================================================== */}
      {techToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#18181C] border border-[#2E2E38] w-full max-w-md shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-500">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Excluir Técnico: {techToDelete.tech.name}?
              </h3>
            </div>

            {techToDelete.associatedCount > 0 ? (
              <div className="space-y-3 text-xs text-neutral-300 leading-relaxed">
                <p className="p-3 bg-amber-950/40 border border-amber-800/60 text-amber-200">
                  <strong>Atenção:</strong> Existem{' '}
                  <span className="font-bold underline">{techToDelete.associatedCount} Ordens de Serviço</span>{' '}
                  cadastradas com este técnico.
                </p>
                <p>
                  Para preservar a rastreabilidade das evidências técnicas já arquivadas, é altamente recomendável{' '}
                  <strong>Desativar</strong> o técnico em vez de excluí-lo permanentemente.
                </p>
              </div>
            ) : (
              <p className="text-xs text-neutral-400 leading-relaxed">
                Tem certeza que deseja excluir o técnico <strong className="text-white">{techToDelete.tech.name}</strong> (Matrícula: {techToDelete.tech.registration})? Esta ação removerá o profissional da lista de técnicos autorizados.
              </p>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-4 border-t border-[#27272E]">
              <button
                type="button"
                onClick={() => setTechToDelete(null)}
                className="min-h-[40px] px-4 border border-[#3A3A46] text-neutral-300 hover:text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Cancelar
              </button>

              {techToDelete.associatedCount > 0 && techToDelete.tech.active && (
                <button
                  type="button"
                  onClick={async () => {
                    await handleToggleTechStatus(techToDelete.tech);
                    setTechToDelete(null);
                  }}
                  className="min-h-[40px] px-4 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Desativar (Recomendado)
                </button>
              )}

              <button
                type="button"
                onClick={handleConfirmDeleteTech}
                className="min-h-[40px] px-4 bg-[#D5001C] hover:bg-[#b00017] text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir Definitivamente</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
