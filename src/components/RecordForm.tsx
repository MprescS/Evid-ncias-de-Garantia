import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Save,
  CheckCircle,
  FileText,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  User,
  Hash,
  Film,
  Camera,
  Layers,
  Trash2,
  Cloud,
  CheckCircle2,
  RefreshCw,
  HardDrive,
  Copy,
  ExternalLink,
  Check,
  X
} from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';
import { supabaseWarrantyService } from '../services/supabaseWarrantyService';
import { warrantyDb } from '../utils/storage';
import { ensureValidUUID, generateUUID } from '../utils/uuid';
import {
  WarrantyRecord,
  EvidenceFieldKey,
  StoredEvidenceFile,
  ValidationSummary
} from '../types';
import { EVIDENCE_FIELDS, COMMON_TECHNICIANS } from '../utils/constants';
import { validateRecord, formatDateBr, formatDateTimeBr } from '../utils/formatters';
import { EvidenceField } from './EvidenceField';
import { CameraCaptureModal } from './CameraCaptureModal';
import { VideoCaptureModal } from './VideoCaptureModal';
import { MediaViewerModal } from './MediaViewerModal';
import { ConfirmModal } from './ConfirmModal';
import { Technician } from '../types';

interface RecordFormProps {
  initialRecord: WarrantyRecord;
  isReadOnly?: boolean;
  onSave: (record: WarrantyRecord, isFinalized: boolean) => Promise<void>;
  onCancel: () => void;
  onRequestPdf: (record: WarrantyRecord) => void;
  onDeleteAllEvidences: (recordId: string) => Promise<void>;
  technicians?: Technician[];
  onOpenAdmin?: () => void;
}

export const RecordForm: React.FC<RecordFormProps> = ({
  initialRecord,
  isReadOnly = false,
  onSave,
  onCancel,
  onRequestPdf,
  onDeleteAllEvidences,
  technicians = [],
  onOpenAdmin
}) => {
  // Current draft state
  const [formData, setFormData] = useState<WarrantyRecord>({ ...initialRecord });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Real-time Cloud Auto-Sync State
  const [autoSyncState, setAutoSyncState] = useState<{
    status: 'idle' | 'saving' | 'synced' | 'local' | 'error';
    message: string;
    timestamp?: string;
  }>(() => {
    if (initialRecord.isSyncedWithSupabase) {
      return { status: 'synced', message: 'Salvo na Nuvem Supabase' };
    }
    if (isSupabaseConfigured()) {
      return { status: 'idle', message: 'Nuvem Supabase Ativa' };
    }
    return { status: 'local', message: 'Modo Local (IndexedDB)' };
  });

  const autoSaveTimerRef = useRef<any>(null);

  // Section quick filter for smartphone & tablet usability
  const [activeSection, setActiveSection] = useState<'all' | 'identification' | 'report' | 'videos' | 'photos' | 'parts'>('all');

  // Photo Camera modal state
  const [cameraState, setCameraState] = useState<{
    isOpen: boolean;
    fieldKey: EvidenceFieldKey | null;
    fieldLabel: string;
  }>({
    isOpen: false,
    fieldKey: null,
    fieldLabel: ''
  });

  // Video Camera modal state
  const [videoCameraState, setVideoCameraState] = useState<{
    isOpen: boolean;
    fieldKey: EvidenceFieldKey | null;
    fieldLabel: string;
  }>({
    isOpen: false,
    fieldKey: null,
    fieldLabel: ''
  });

  // Media preview modal state
  const [previewState, setPreviewState] = useState<{
    isOpen: boolean;
    file: StoredEvidenceFile | null;
    fieldLabel: string;
  }>({
    isOpen: false,
    file: null,
    fieldLabel: ''
  });

  // Confirm delete all evidences modal
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Cloud sync error diagnosis modal state
  const [showSyncErrorModal, setShowSyncErrorModal] = useState(false);
  const [syncErrorDetail, setSyncErrorDetail] = useState<string | null>(initialRecord.syncError || null);
  const [copiedFixSql, setCopiedFixSql] = useState(false);
  const [isRetryingSync, setIsRetryingSync] = useState(false);

  // Live validation
  const validation: ValidationSummary = validateRecord(formData);

  // Reset form when initialRecord changes
  useEffect(() => {
    setFormData({ ...initialRecord });
    if (initialRecord.isSyncedWithSupabase) {
      setAutoSyncState({ status: 'synced', message: 'Salvo na Nuvem Supabase' });
      setSyncErrorDetail(null);
    } else if (initialRecord.syncError) {
      setSyncErrorDetail(initialRecord.syncError);
      setAutoSyncState({
        status: 'error',
        message: `Salvo no dispositivo (pendente na nuvem: ${initialRecord.syncError})`
      });
    }
  }, [initialRecord]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const triggerAutoSave = useCallback(async (recordToSave: WarrantyRecord, actionDescription?: string) => {
    setAutoSyncState({
      status: 'saving',
      message: actionDescription || 'Salvando automaticamente na nuvem...'
    });

    try {
      const saved = await warrantyDb.saveRecord(recordToSave);
      setFormData(saved);

      if (saved.isSyncedWithSupabase) {
        setSyncErrorDetail(null);
        const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        setAutoSyncState({
          status: 'synced',
          message: 'Sincronizado na Nuvem Supabase',
          timestamp: time
        });
      } else if (saved.syncError) {
        setSyncErrorDetail(saved.syncError);
        setAutoSyncState({
          status: 'error',
          message: `Salvo no dispositivo (pendente na nuvem: ${saved.syncError})`
        });
      } else {
        setSyncErrorDetail(null);
        const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        setAutoSyncState({
          status: 'local',
          message: 'Salvo localmente no dispositivo (IndexedDB)',
          timestamp: time
        });
      }
    } catch (err: any) {
      console.warn('Falha no auto-save:', err);
      const msg = err.message || 'Falha de gravação';
      setSyncErrorDetail(msg);
      setAutoSyncState({
        status: 'error',
        message: `Salvo localmente. Erro na nuvem: ${msg}`
      });
    }
  }, []);

  const handleRetryCloudSync = async () => {
    setIsRetryingSync(true);
    try {
      const saved = await warrantyDb.saveRecord(formData);
      setFormData(saved);
      if (saved.isSyncedWithSupabase) {
        setSyncErrorDetail(null);
        setShowSyncErrorModal(false);
        const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        setAutoSyncState({
          status: 'synced',
          message: 'Sincronizado na Nuvem Supabase',
          timestamp: time
        });
      } else if (saved.syncError) {
        setSyncErrorDetail(saved.syncError);
      }
    } catch (err: any) {
      setSyncErrorDetail(err.message || 'Falha ao sincronizar');
    } finally {
      setIsRetryingSync(false);
    }
  };

  const handleFieldChange = (field: keyof WarrantyRecord, value: any) => {
    const updated: WarrantyRecord = {
      ...formData,
      [field]: value,
      updatedAt: new Date().toISOString()
    };
    setFormData(updated);

    // Debounced automatic save to local & cloud after 1.2s
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      triggerAutoSave(updated, 'Salvando alterações na nuvem...');
    }, 1200);
  };

  const handleEvidenceSelect = (
    fieldKey: string,
    fileData: { dataUrl: string; fileName: string; fileSize: number; mimeType: string }
  ) => {
    const key = fieldKey as EvidenceFieldKey;
    const newFile: StoredEvidenceFile = {
      id: generateUUID(),
      fieldKey: key,
      fileName: fileData.fileName,
      fileSize: fileData.fileSize,
      mimeType: fileData.mimeType,
      dataUrl: fileData.dataUrl,
      capturedAt: new Date().toISOString()
    };

    const updated: WarrantyRecord = {
      ...formData,
      evidences: {
        ...formData.evidences,
        [key]: newFile
      },
      updatedAt: new Date().toISOString()
    };

    // Instant local UI state update
    setFormData(updated);

    // Automatic immediate local and cloud upload!
    triggerAutoSave(updated, `Enviando ${fileData.fileName} para a nuvem...`);
  };

  const handleEvidenceDelete = (fieldKey: string) => {
    const key = fieldKey as EvidenceFieldKey;
    const updatedEvidences = { ...formData.evidences };
    delete updatedEvidences[key];

    const updated: WarrantyRecord = {
      ...formData,
      evidences: updatedEvidences,
      updatedAt: new Date().toISOString()
    };

    setFormData(updated);
    triggerAutoSave(updated, 'Atualizando evidências na nuvem...');
  };

  const handleDownloadFile = async (file: StoredEvidenceFile) => {
    try {
      let downloadHref = file.dataUrl;

      // If stored in Supabase Storage, request temporary signed download URL
      if (file.storagePath && isSupabaseConfigured()) {
        try {
          downloadHref = await supabaseWarrantyService.getSignedDownloadUrl(file.storagePath, file.fileName);
        } catch (signErr) {
          console.warn('Fallback to cached dataUrl for download:', signErr);
        }
      }

      const a = document.createElement('a');
      a.href = downloadHref;
      a.download = file.fileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      alert('Falha ao baixar arquivo original: ' + (err.message || 'Erro desconhecido'));
    }
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      await onSave({ ...formData, status: 'em_preenchimento' }, false);
      const isCloud = isSupabaseConfigured();
      setSaveSuccessMsg(
        isCloud
          ? 'Rascunho salvo e sincronizado com o Supabase PostgreSQL!'
          : 'Rascunho salvo com sucesso no armazenamento local (IndexedDB)!'
      );
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err: any) {
      alert(`Erro ao salvar rascunho: ${err.message || 'Tente novamente'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!validation.isValid) {
      alert(`Corrija os seguintes campos obrigatórios antes de finalizar:\n- ${validation.errors.map(e => e.message).join('\n- ')}`);
      return;
    }

    setIsSaving(true);
    try {
      const updated = {
        ...formData,
        status: 'finalizado' as const,
        version: (formData.version || 1) + 1
      };
      await onSave(updated, true);
      setSaveSuccessMsg('Registro finalizado e atualizado com sucesso!');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(`Erro ao finalizar: ${err.message || 'Tente novamente'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearAllEvidences = async () => {
    try {
      await onDeleteAllEvidences(formData.id);
      setFormData((prev) => ({
        ...prev,
        evidences: {},
        updatedAt: new Date().toISOString()
      }));
      setShowClearAllConfirm(false);
      setSaveSuccessMsg('Todas as evidências foram removidas do registro.');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (e: any) {
      alert('Falha ao limpar anexos: ' + e.message);
    }
  };

  // Group fields
  const videoFields = EVIDENCE_FIELDS.filter((f) => f.category === 'video');
  const diagnosticPhotoFields = EVIDENCE_FIELDS.filter((f) => f.category === 'diagnostic_photo');
  const newPartFields = EVIDENCE_FIELDS.filter((f) => f.category === 'new_part');
  const replacedPartFields = EVIDENCE_FIELDS.filter((f) => f.category === 'replaced_part');

  return (
    <div className="space-y-6 pb-28 sm:pb-16 max-w-7xl mx-auto">
      {/* Top Action Bar (Dark Graphite surface) */}
      <div className="bg-[#18181C] border border-[#27272E] p-3 sm:p-4 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 sticky top-14 sm:top-16 z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowCancelConfirm(true)}
            className="w-10 h-10 flex items-center justify-center text-neutral-300 hover:text-white bg-[#222228] hover:bg-[#2A2A32] border border-[#30303A] transition-colors shrink-0"
            title="Voltar para a lista"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-extrabold text-white tracking-tight uppercase truncate">
                {formData.osNumber ? `OS: ${formData.osNumber}` : 'Novo Registro'}
              </h2>
              <span className="text-[10px] sm:text-[11px] font-mono px-1.5 py-0.5 bg-[#25252D] border border-[#34343E] text-neutral-300 shrink-0">
                v{formData.version || 1}
              </span>

              {/* Real-time Cloud Auto-Sync Indicator */}
              {autoSyncState.status === 'saving' && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono bg-amber-950/80 text-amber-300 border border-amber-600/50 animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                  <span>{autoSyncState.message}</span>
                </span>
              )}
              {autoSyncState.status === 'synced' && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                  <Cloud className="w-3 h-3 text-emerald-400" />
                  <span>{autoSyncState.message} {autoSyncState.timestamp && `(${autoSyncState.timestamp})`}</span>
                </span>
              )}
              {autoSyncState.status === 'local' && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono bg-[#202028] text-neutral-300 border border-[#3A3A48]">
                  <HardDrive className="w-3 h-3 text-blue-400" />
                  <span>{autoSyncState.message}</span>
                </span>
              )}
              {autoSyncState.status === 'error' && (
                <button
                  type="button"
                  onClick={() => setShowSyncErrorModal(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] sm:text-[11px] font-mono bg-rose-950/90 text-rose-300 border border-rose-500/60 hover:bg-rose-900/90 transition-colors cursor-pointer text-left shadow-xs"
                  title="Clique para ver o diagnóstico completo e a solução em 1 clique"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="truncate max-w-[220px] sm:max-w-md">{autoSyncState.message}</span>
                  <span className="text-[10px] uppercase font-bold text-rose-200 underline shrink-0 ml-1">Resolver</span>
                </button>
              )}
            </div>
            <div className="text-[11px] text-neutral-400 font-mono truncate">
              VIN: {formData.chassisVin || 'Pendente'} · Alt: {formatDateTimeBr(formData.updatedAt)}
            </div>
          </div>
        </div>

        {/* Action Buttons for Desktop / Tablet */}
        <div className="hidden sm:flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCancelConfirm(true)}
            className="px-3.5 h-10 border border-[#363640] text-neutral-300 hover:text-white hover:bg-[#22222A] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={async () => {
              setIsSaving(true);
              try {
                await onSave({ ...formData, status: 'em_preenchimento' }, true);
              } catch (e: any) {
                alert('Erro ao salvar: ' + e.message);
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-3.5 h-10 border border-[#3A3A46] bg-[#22222A] hover:bg-[#2C2C36] text-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4 text-emerald-400" />
            <span>Salvar e Voltar</span>
          </button>

          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 h-10 border border-[#3A3A46] bg-[#22222A] hover:bg-[#2C2C36] text-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4 text-neutral-300" />
            <span>Salvar Rascunho</span>
          </button>

          <button
            type="button"
            onClick={() => onRequestPdf(formData)}
            className="inline-flex items-center gap-1.5 px-4 h-10 border border-[#40404C] bg-[#1E1E24] hover:bg-[#282830] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-xs"
          >
            <FileText className="w-4 h-4 text-[#D5001C]" />
            <span>Gerar PDF</span>
          </button>

          <button
            type="button"
            onClick={handleFinalize}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-5 h-10 bg-[#D5001C] hover:bg-[#b00017] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-xs disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Finalizar</span>
          </button>
        </div>
      </div>

      {/* Touch-Friendly Horizontal Section Quick-Selector */}
      <div className="bg-[#18181C] border border-[#27272E] p-2 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-medium">
          <span className="text-neutral-500 font-mono text-[10px] uppercase shrink-0 pl-1">
            Seção:
          </span>
          <button
            onClick={() => setActiveSection('all')}
            className={`min-h-[38px] px-3.5 py-1.5 whitespace-nowrap shrink-0 transition-colors ${
              activeSection === 'all'
                ? 'bg-[#D5001C] text-white font-bold'
                : 'bg-[#121214] border border-[#27272E] text-neutral-300 hover:text-white hover:bg-[#222228]'
            }`}
          >
            Todas as Seções
          </button>
          <button
            onClick={() => setActiveSection('identification')}
            className={`min-h-[38px] px-3 py-1.5 whitespace-nowrap shrink-0 transition-colors ${
              activeSection === 'identification'
                ? 'bg-[#D5001C] text-white font-bold'
                : 'bg-[#121214] border border-[#27272E] text-neutral-300 hover:text-white hover:bg-[#222228]'
            }`}
          >
            1. Identificação
          </button>
          <button
            onClick={() => setActiveSection('report')}
            className={`min-h-[38px] px-3 py-1.5 whitespace-nowrap shrink-0 transition-colors ${
              activeSection === 'report'
                ? 'bg-[#D5001C] text-white font-bold'
                : 'bg-[#121214] border border-[#27272E] text-neutral-300 hover:text-white hover:bg-[#222228]'
            }`}
          >
            2. Relatório Técnico
          </button>
          <button
            onClick={() => setActiveSection('videos')}
            className={`min-h-[38px] px-3 py-1.5 whitespace-nowrap shrink-0 transition-colors ${
              activeSection === 'videos'
                ? 'bg-[#D5001C] text-white font-bold'
                : 'bg-[#121214] border border-[#27272E] text-neutral-300 hover:text-white hover:bg-[#222228]'
            }`}
          >
            3. Vídeos ({Object.keys(formData.evidences).filter(k => k.startsWith('video') && formData.evidences[k as EvidenceFieldKey]).length}/2)
          </button>
          <button
            onClick={() => setActiveSection('photos')}
            className={`min-h-[38px] px-3 py-1.5 whitespace-nowrap shrink-0 transition-colors ${
              activeSection === 'photos'
                ? 'bg-[#D5001C] text-white font-bold'
                : 'bg-[#121214] border border-[#27272E] text-neutral-300 hover:text-white hover:bg-[#222228]'
            }`}
          >
            4. Fotos Diagnóstico ({Object.keys(formData.evidences).filter(k => k.startsWith('photo') && formData.evidences[k as EvidenceFieldKey]).length}/4)
          </button>
          <button
            onClick={() => setActiveSection('parts')}
            className={`min-h-[38px] px-3 py-1.5 whitespace-nowrap shrink-0 transition-colors ${
              activeSection === 'parts'
                ? 'bg-[#D5001C] text-white font-bold'
                : 'bg-[#121214] border border-[#27272E] text-neutral-300 hover:text-white hover:bg-[#222228]'
            }`}
          >
            5. Peças & Etiquetas ({Object.keys(formData.evidences).filter(k => (k.startsWith('newPart') || k.startsWith('replacedPart')) && formData.evidences[k as EvidenceFieldKey]).length}/6)
          </button>
        </div>
      </div>

      {/* Save Success Alert Banner */}
      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs font-medium flex items-center justify-between animate-in fade-in">
          <span>{saveSuccessMsg}</span>
          <button onClick={() => setSaveSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200 font-bold p-1">
            OK
          </button>
        </div>
      )}

      {/* Validation Warnings / Error Banner */}
      {validation.errors.length > 0 && (
        <div className="p-4 bg-amber-950/40 border border-amber-600/40 text-amber-200 text-xs space-y-1">
          <div className="font-bold flex items-center gap-2 text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            Campos obrigatórios pendentes para finalização ou relatório definitivo:
          </div>
          <ul className="list-disc list-inside pl-1 text-amber-200/90">
            {validation.errors.map((err, i) => (
              <li key={i}>{err.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Progress Bar of Evidences */}
      <div className="bg-[#18181C] border border-[#27272E] p-3.5 sm:p-4">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-bold text-white uppercase tracking-wider text-[11px] sm:text-xs">
            Progresso Geral das Evidências Técnicas
          </span>
          <span className="font-mono text-neutral-300 font-semibold">
            {validation.filledEvidenceCount} de {validation.totalEvidenceCount} anexadas ({Math.round((validation.filledEvidenceCount / validation.totalEvidenceCount) * 100)}%)
          </span>
        </div>
        <div className="w-full h-2.5 bg-[#24242A] overflow-hidden">
          <div
            className="h-full bg-[#D5001C] transition-all duration-300"
            style={{ width: `${(validation.filledEvidenceCount / validation.totalEvidenceCount) * 100}%` }}
          />
        </div>
      </div>

      {/* ======================================================== */}
      {/* SEÇÃO 1: IDENTIFICAÇÃO DO REPARO                         */}
      {/* ======================================================== */}
      {(activeSection === 'all' || activeSection === 'identification') && (
        <div className="bg-[#18181C] border border-[#27272E] p-4 sm:p-6 shadow-sm">
          <div className="border-b border-[#27272E] pb-3 mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                <span className="w-1.5 h-4 bg-[#D5001C]" />
                1. Identificação do Reparo
              </h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Dados cadastrais obrigatórios da OS e chassi para rastreabilidade
              </p>
            </div>
            <span className="text-[10px] sm:text-[11px] font-mono text-neutral-400">4 campos obrigatórios</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* OS Number */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-neutral-500" />
                Número da OS <span className="text-[#D5001C]">*</span>
              </label>
              <input
                type="text"
                value={formData.osNumber}
                disabled={isReadOnly}
                onChange={(e) => handleFieldChange('osNumber', e.target.value)}
                placeholder="Ex: OS-98421"
                className="w-full px-3.5 h-11 sm:h-9 bg-[#121214] border border-[#2E2E36] text-base sm:text-xs text-white font-mono focus:outline-hidden focus:border-[#D5001C] focus:bg-[#151518]"
              />
            </div>

            {/* Chassis (VIN) */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-neutral-500" />
                Chassi (VIN) <span className="text-[#D5001C]">*</span>
              </label>
              <input
                type="text"
                maxLength={17}
                value={formData.chassisVin}
                disabled={isReadOnly}
                onChange={(e) => handleFieldChange('chassisVin', e.target.value.toUpperCase().replace(/\s/g, ''))}
                placeholder="Ex: WP0AB2A99NS145290"
                className="w-full px-3.5 h-11 sm:h-9 bg-[#121214] border border-[#2E2E36] text-base sm:text-xs text-white font-mono tracking-wider focus:outline-hidden focus:border-[#D5001C] focus:bg-[#151518] uppercase"
              />
              <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
                <span>Padrão 17 dígitos</span>
                <span>{formData.chassisVin.length}/17</span>
              </div>
            </div>

            {/* Technician */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-neutral-500" />
                  Técnico Responsável <span className="text-[#D5001C]">*</span>
                </label>
                {onOpenAdmin && (
                  <button
                    type="button"
                    onClick={onOpenAdmin}
                    className="text-[10px] font-mono text-[#D5001C] hover:underline cursor-pointer"
                  >
                    Gerenciar no ADM
                  </button>
                )}
              </div>
              <input
                type="text"
                list="technicians-list"
                value={formData.technician}
                disabled={isReadOnly}
                onChange={(e) => handleFieldChange('technician', e.target.value)}
                placeholder="Selecione ou digite o nome do técnico"
                className="w-full px-3.5 h-11 sm:h-9 bg-[#121214] border border-[#2E2E36] text-base sm:text-xs text-white focus:outline-hidden focus:border-[#D5001C] focus:bg-[#151518]"
              />
              <datalist id="technicians-list">
                {technicians && technicians.length > 0 ? (
                  technicians
                    .filter((t) => t.active)
                    .map((tech) => (
                      <option key={tech.id} value={tech.name}>
                        {tech.registration} - {tech.specialty}
                      </option>
                    ))
                ) : (
                  COMMON_TECHNICIANS.map((tech) => (
                    <option key={tech} value={tech} />
                  ))
                )}
              </datalist>
            </div>

            {/* Repair Date */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                Data do Reparo <span className="text-[#D5001C]">*</span>
              </label>
              <input
                type="date"
                value={formData.repairDate}
                disabled={isReadOnly}
                onChange={(e) => handleFieldChange('repairDate', e.target.value)}
                className="w-full px-3.5 h-11 sm:h-9 bg-[#121214] border border-[#2E2E36] text-base sm:text-xs text-white font-mono focus:outline-hidden focus:border-[#D5001C] focus:bg-[#151518]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SEÇÃO 2: RELATÓRIO TÉCNICO                              */}
      {/* ======================================================== */}
      {(activeSection === 'all' || activeSection === 'report') && (
        <div className="bg-[#18181C] border border-[#27272E] p-4 sm:p-6 shadow-sm">
          <div className="border-b border-[#27272E] pb-3 mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                <span className="w-1.5 h-4 bg-[#D5001C]" />
                2. Relatório Técnico
              </h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Diagnóstico técnico, sintomas, testes PIWIS e procedimentos de garantia executados
              </p>
            </div>
            <span className="text-xs font-mono text-neutral-400">
              {formData.technicalReport ? formData.technicalReport.length : 0} caracteres
            </span>
          </div>

          <div className="space-y-2">
            <textarea
              rows={5}
              value={formData.technicalReport}
              disabled={isReadOnly}
              onChange={(e) => handleFieldChange('technicalReport', e.target.value)}
              placeholder="Descreva o sintoma relatado, códigos de falha (DTC), resultados dos testes funcionais, desmontagem, peça com anomalia e validação final de rodagem..."
              className="w-full p-3.5 bg-[#121214] border border-[#2E2E36] text-base sm:text-xs text-white leading-relaxed placeholder-neutral-500 focus:outline-hidden focus:border-[#D5001C] focus:bg-[#151518] font-sans"
            />
            <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
              <span>Reproduzido integralmente no relatório PDF, preservando quebras de linha.</span>
              <span>Sem limite de tamanho</span>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SEÇÃO 3: VÍDEOS DE DIAGNÓSTICO                          */}
      {/* ======================================================== */}
      {(activeSection === 'all' || activeSection === 'videos') && (
        <div className="bg-[#18181C] border border-[#27272E] p-4 sm:p-6 shadow-sm space-y-4">
          <div className="border-b border-[#27272E] pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                <Film className="w-4 h-4 text-[#D5001C]" />
                3. Vídeos de Diagnóstico
              </h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Grave diretamente pela câmera do smartphone ou selecione do dispositivo (MP4 / MOV)
              </p>
            </div>
            <span className="text-[10px] sm:text-[11px] font-mono text-neutral-400">2 Campos</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {videoFields.map((field) => (
              <EvidenceField
                key={field.key}
                field={field}
                file={formData.evidences[field.key]}
                onFileSelect={handleEvidenceSelect}
                onDelete={handleEvidenceDelete}
                onPreview={(file, label) => setPreviewState({ isOpen: true, file, fieldLabel: label })}
                onDownload={handleDownloadFile}
                onRequestCamera={(fieldKey, label) => setCameraState({ isOpen: true, fieldKey: fieldKey as EvidenceFieldKey, fieldLabel: label })}
                onRequestVideoCamera={(fieldKey, label) => setVideoCameraState({ isOpen: true, fieldKey: fieldKey as EvidenceFieldKey, fieldLabel: label })}
              />
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SEÇÃO 4: FOTOGRAFIAS DE DIAGNÓSTICO                     */}
      {/* ======================================================== */}
      {(activeSection === 'all' || activeSection === 'photos') && (
        <div className="bg-[#18181C] border border-[#27272E] p-4 sm:p-6 shadow-sm space-y-4">
          <div className="border-b border-[#27272E] pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#D5001C]" />
                4. Fotografias de Diagnóstico
              </h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Visão geral, evidência do dano, macro e medições com enquadramento integral
              </p>
            </div>
            <span className="text-[10px] sm:text-[11px] font-mono text-neutral-400">4 Campos</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {diagnosticPhotoFields.map((field) => (
              <EvidenceField
                key={field.key}
                field={field}
                file={formData.evidences[field.key]}
                onFileSelect={handleEvidenceSelect}
                onDelete={handleEvidenceDelete}
                onPreview={(file, label) => setPreviewState({ isOpen: true, file, fieldLabel: label })}
                onDownload={handleDownloadFile}
                onRequestCamera={(fieldKey, label) => setCameraState({ isOpen: true, fieldKey: fieldKey as EvidenceFieldKey, fieldLabel: label })}
              />
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SEÇÃO 5: PEÇAS NOVAS X SUBSTITUÍDAS                     */}
      {/* ======================================================== */}
      {(activeSection === 'all' || activeSection === 'parts') && (
        <div className="bg-[#18181C] border border-[#27272E] p-4 sm:p-6 shadow-sm space-y-5">
          <div className="border-b border-[#27272E] pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#D5001C]" />
                5. Peças Novas x Substituídas (Fotos e Etiquetas)
              </h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Fotografia geral da peça nova e da peça substituída, além das etiquetas de rastreamento
              </p>
            </div>

            {validation.filledEvidenceCount > 0 && (
              <button
                type="button"
                onClick={() => setShowClearAllConfirm(true)}
                className="inline-flex items-center gap-1 px-3 h-8 text-xs text-red-400 hover:bg-red-950/40 border border-red-500/30 transition-colors self-start sm:self-auto"
                title="Excluir todas as evidências anexadas"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpar Todos os Anexos
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Peça Nova Block */}
            <div className="p-3.5 sm:p-4 bg-[#141417] border border-[#26262D] space-y-3">
              <div className="flex items-center justify-between border-b border-[#26262D] pb-2">
                <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
                  Peça Nova (Genuína de Reposição)
                </span>
                <span className="text-[10px] font-mono text-neutral-400 font-semibold">1 Foto + 2 Etiquetas</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {newPartFields.map((field) => (
                  <EvidenceField
                    key={field.key}
                    field={field}
                    file={formData.evidences[field.key]}
                    onFileSelect={handleEvidenceSelect}
                    onDelete={handleEvidenceDelete}
                    onPreview={(file, label) => setPreviewState({ isOpen: true, file, fieldLabel: label })}
                    onDownload={handleDownloadFile}
                    onRequestCamera={(fieldKey, label) => setCameraState({ isOpen: true, fieldKey: fieldKey as EvidenceFieldKey, fieldLabel: label })}
                  />
                ))}
              </div>
            </div>

            {/* Peça Substituída Block */}
            <div className="p-3.5 sm:p-4 bg-[#141417] border border-[#26262D] space-y-3">
              <div className="flex items-center justify-between border-b border-[#26262D] pb-2">
                <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
                  Peça Substituída (Avariada Removida)
                </span>
                <span className="text-[10px] font-mono text-neutral-400 font-semibold">1 Foto + 2 Etiquetas</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {replacedPartFields.map((field) => (
                  <EvidenceField
                    key={field.key}
                    field={field}
                    file={formData.evidences[field.key]}
                    onFileSelect={handleEvidenceSelect}
                    onDelete={handleEvidenceDelete}
                    onPreview={(file, label) => setPreviewState({ isOpen: true, file, fieldLabel: label })}
                    onDownload={handleDownloadFile}
                    onRequestCamera={(fieldKey, label) => setCameraState({ isOpen: true, fieldKey: fieldKey as EvidenceFieldKey, fieldLabel: label })}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Thumb Action Bar for Smartphones */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#161619]/95 backdrop-blur-md border-t border-[#27272E] p-2 sm:hidden flex flex-col gap-1.5 shadow-2xl">
        {/* Mobile Real-time Sync Status Indicator */}
        <div className="flex items-center justify-between px-1 text-[10px] font-mono">
          {autoSyncState.status === 'saving' && (
            <span className="text-amber-400 flex items-center gap-1 animate-pulse">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>{autoSyncState.message}</span>
            </span>
          )}
          {autoSyncState.status === 'synced' && (
            <span className="text-emerald-400 flex items-center gap-1">
              <Cloud className="w-3 h-3" />
              <span>Salvo na Nuvem {autoSyncState.timestamp && `(${autoSyncState.timestamp})`}</span>
            </span>
          )}
          {autoSyncState.status === 'local' && (
            <span className="text-neutral-400 flex items-center gap-1">
              <HardDrive className="w-3 h-3 text-blue-400" />
              <span>Salvo no Dispositivo (IndexedDB)</span>
            </span>
          )}
          {autoSyncState.status === 'error' && (
            <button
              type="button"
              onClick={() => setShowSyncErrorModal(true)}
              className="text-rose-400 flex items-center gap-1 truncate max-w-full text-left cursor-pointer"
            >
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span className="truncate">{autoSyncState.message}</span>
              <span className="text-[9px] uppercase font-bold underline shrink-0 ml-1">Resolver</span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-1.5">
          <button
            type="button"
            onClick={async () => {
              setIsSaving(true);
              try {
                await onSave({ ...formData, status: 'em_preenchimento' }, true);
              } catch (e: any) {
                alert('Erro ao salvar: ' + e.message);
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving}
            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1 bg-[#22222A] hover:bg-[#2A2A34] border border-[#32323E] text-white text-[11px] font-bold uppercase tracking-wider active:scale-98"
          >
            <Save className="w-3.5 h-3.5 text-emerald-400" />
            <span>Salvar</span>
          </button>

          <button
            type="button"
            onClick={() => onRequestPdf(formData)}
            className="w-14 min-h-[44px] inline-flex items-center justify-center gap-1 bg-[#1C1C22] hover:bg-[#25252D] border border-[#383846] text-white text-[11px] font-bold uppercase tracking-wider active:scale-98"
            title="Gerar PDF"
          >
            <FileText className="w-4 h-4 text-[#D5001C]" />
          </button>

          <button
            type="button"
            onClick={handleFinalize}
            disabled={isSaving}
            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1 bg-[#D5001C] hover:bg-[#b00017] text-white text-[11px] font-bold uppercase tracking-wider active:scale-98 shadow-md"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Finalizar</span>
          </button>
        </div>
      </div>

      {/* Photo Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={cameraState.isOpen}
        fieldLabel={cameraState.fieldLabel}
        onClose={() => setCameraState({ isOpen: false, fieldKey: null, fieldLabel: '' })}
        onCapture={(dataUrl, fileName, fileSize) => {
          if (cameraState.fieldKey) {
            handleEvidenceSelect(cameraState.fieldKey, {
              dataUrl,
              fileName,
              fileSize,
              mimeType: 'image/jpeg'
            });
          }
        }}
      />

      {/* Video Direct Camera Capture Modal */}
      <VideoCaptureModal
        isOpen={videoCameraState.isOpen}
        fieldLabel={videoCameraState.fieldLabel}
        onClose={() => setVideoCameraState({ isOpen: false, fieldKey: null, fieldLabel: '' })}
        onCapture={(dataUrl, fileName, fileSize) => {
          if (videoCameraState.fieldKey) {
            handleEvidenceSelect(videoCameraState.fieldKey, {
              dataUrl,
              fileName,
              fileSize,
              mimeType: fileName.endsWith('.webm') ? 'video/webm' : 'video/mp4'
            });
          }
        }}
      />

      {/* Media Fullscreen Viewer */}
      <MediaViewerModal
        isOpen={previewState.isOpen}
        file={previewState.file}
        fieldLabel={previewState.fieldLabel}
        onClose={() => setPreviewState({ isOpen: false, file: null, fieldLabel: '' })}
        onDownload={handleDownloadFile}
      />

      {/* Confirm Clear All Evidences */}
      <ConfirmModal
        isOpen={showClearAllConfirm}
        title="Remover todas as evidências?"
        message="Esta ação irá excluir todos os vídeos e fotos anexados a este registro. Esta operação não pode ser desfeita."
        confirmLabel="Sim, excluir todos"
        onConfirm={handleClearAllEvidences}
        onCancel={() => setShowClearAllConfirm(false)}
      />

      {/* Confirm Discard / Cancel Changes */}
      <ConfirmModal
        isOpen={showCancelConfirm}
        title="Descartar alterações não salvas?"
        message="Se você sair agora sem salvar, quaisquer alterações feitas nesta sessão de edição serão canceladas."
        confirmLabel="Descartar e Sair"
        cancelLabel="Continuar Editando"
        isDestructive={false}
        onConfirm={onCancel}
        onCancel={() => setShowCancelConfirm(false)}
      />

      {/* Cloud Sync Error Diagnosis & 1-Click Fix Modal */}
      {showSyncErrorModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-[#18181C] border border-[#2E2E3A] max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#282832] bg-[#141417] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-none bg-rose-950/80 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm uppercase tracking-wider text-white">
                    Diagnóstico de Sincronização Supabase
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Seus dados estão 100% preservados e salvos localmente no dispositivo (IndexedDB).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSyncErrorModal(false)}
                className="text-neutral-400 hover:text-white p-1 cursor-pointer transition-colors"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-4 text-xs">
              {/* Full Raw Error Message */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-300 mb-1">
                  Mensagem Retornada pelo PostgreSQL:
                </label>
                <div className="p-3 bg-rose-950/30 border border-rose-600/40 font-mono text-[11px] text-rose-200 leading-relaxed break-all select-all">
                  {syncErrorDetail || autoSyncState.message}
                </div>
              </div>

              {/* Specific Diagnosis for created_by NOT NULL constraint */}
              {((syncErrorDetail || '').toLowerCase().includes('created_by') ||
                (syncErrorDetail || '').toLowerCase().includes('not-null') ||
                (syncErrorDetail || '').toLowerCase().includes('violates not-null constraint')) ? (
                <div className="p-4 bg-[#141418] border border-amber-600/40 space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-amber-300">
                        Causa Identificada: Restrição NOT NULL no campo "created_by"
                      </h4>
                      <p className="text-[11px] text-neutral-300 mt-1 leading-relaxed">
                        No seu banco de dados Supabase, a tabela foi criada exigindo obrigatoriamente um ID de usuário autenticado no campo <code className="text-amber-400">created_by</code>. Como os técnicos operam o aplicativo no navegador da concessionária sem login prévio no Supabase Auth, o PostgreSQL recusa a gravação com valor nulo.
                      </p>
                    </div>
                  </div>

                  <div className="border border-[#2D2D38] bg-[#0E0E12] p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 border-b border-[#22222C] pb-1.5">
                      <span className="text-emerald-400 font-bold uppercase tracking-wider">
                        Comando SQL de Correção Rápida (10 segundos):
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const sql = `ALTER TABLE public.warranty_records ALTER COLUMN created_by DROP NOT NULL;\nALTER TABLE public.warranty_attachments ALTER COLUMN created_by DROP NOT NULL;`;
                          navigator.clipboard.writeText(sql);
                          setCopiedFixSql(true);
                          setTimeout(() => setCopiedFixSql(false), 3000);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs text-white bg-[#D5001C] hover:bg-[#b00017] px-2.5 py-1 font-bold uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        {copiedFixSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedFixSql ? 'Copiado!' : 'Copiar Comando SQL'}</span>
                      </button>
                    </div>
                    <pre className="text-xs font-mono text-emerald-300 select-all overflow-x-auto py-1">
{`ALTER TABLE public.warranty_records ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.warranty_attachments ALTER COLUMN created_by DROP NOT NULL;`}
                    </pre>
                  </div>

                  {/* 3 Steps */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1">
                    <div className="p-2.5 bg-[#1B1B22] border border-[#2A2A34]">
                      <div className="font-bold text-white mb-0.5">1. Copie o comando</div>
                      <span className="text-neutral-400">Clique no botão vermelho acima para copiar o comando SQL.</span>
                    </div>
                    <div className="p-2.5 bg-[#1B1B22] border border-[#2A2A34]">
                      <div className="font-bold text-white mb-0.5">2. Execute no Supabase</div>
                      <span className="text-neutral-400">Acesse o <strong>SQL Editor</strong> no Supabase, cole e clique em <strong>Run</strong>.</span>
                    </div>
                    <div className="p-2.5 bg-[#1B1B22] border border-[#2A2A34]">
                      <div className="font-bold text-white mb-0.5">3. Sincronize o Registro</div>
                      <span className="text-neutral-400">Volte aqui e clique no botão verde abaixo para reenviar.</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-[#141418] border border-[#2D2D38] space-y-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-neutral-200">
                    O que fazer para resolver?
                  </h4>
                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    Verifique se o script de migração completo foi executado no <strong>SQL Editor</strong> do seu Supabase e se o bucket de armazenamento <code>warranty-evidence</code> foi criado no menu <strong>Storage</strong>.
                  </p>
                  <p className="text-[11px] text-neutral-400">
                    Você pode acessar a aba <strong>Banco Nuvem</strong> no rodapé do aplicativo para testar a conexão em tempo real ou copiar o script SQL completo.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-[#262630] bg-[#141417] flex flex-wrap items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowSyncErrorModal(false);
                  if (onOpenAdmin) onOpenAdmin();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#353542] text-neutral-300 hover:text-white hover:bg-[#202028] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Painel Nuvem & Conexão</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSyncErrorModal(false)}
                  className="px-3.5 py-2 border border-[#353542] text-neutral-300 hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Fechar
                </button>

                <button
                  type="button"
                  onClick={handleRetryCloudSync}
                  disabled={isRetryingSync}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 active:scale-98 shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRetryingSync ? 'animate-spin' : ''}`} />
                  <span>{isRetryingSync ? 'Sincronizando...' : 'Tentar Salvar na Nuvem Novamente'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
