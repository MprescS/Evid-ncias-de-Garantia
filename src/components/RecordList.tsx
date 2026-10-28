import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  FileText,
  Edit3,
  Copy,
  Trash2,
  Calendar,
  User,
  Hash,
  Clock,
  ArrowUpDown,
  ExternalLink,
  CheckCircle,
  FileClock,
  Cloud
} from 'lucide-react';
import { WarrantyRecord, RecordFilterOptions, Technician } from '../types';
import { formatDateBr, formatDateTimeBr } from '../utils/formatters';
import { COMMON_TECHNICIANS } from '../utils/constants';

interface RecordListProps {
  records: WarrantyRecord[];
  onNewRecord: () => void;
  onEditRecord: (record: WarrantyRecord) => void;
  onViewRecord: (record: WarrantyRecord) => void;
  onDuplicateRecord: (record: WarrantyRecord) => void;
  onGeneratePdf: (record: WarrantyRecord) => void;
  onDeleteRecord: (record: WarrantyRecord) => void;
  technicians?: Technician[];
  onNavigateToAdmin?: () => void;
}

export const RecordList: React.FC<RecordListProps> = ({
  records,
  onNewRecord,
  onEditRecord,
  onViewRecord,
  onDuplicateRecord,
  onGeneratePdf,
  onDeleteRecord,
  technicians = [],
  onNavigateToAdmin
}) => {
  const [filters, setFilters] = useState<RecordFilterOptions>({
    searchQuery: '',
    technicianFilter: 'all',
    periodFilter: 'all',
    statusFilter: 'all',
    sortBy: 'updatedAt',
    sortOrder: 'desc'
  });

  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Extract unique technicians present in records plus registered technicians
  const allTechnicians = useMemo(() => {
    const set = new Set<string>();
    if (technicians && technicians.length > 0) {
      technicians.forEach((t) => set.add(t.name));
    } else {
      COMMON_TECHNICIANS.forEach((t) => set.add(t));
    }
    records.forEach((r) => {
      if (r.technician && r.technician.trim()) set.add(r.technician.trim());
    });
    return Array.from(set).sort();
  }, [records, technicians]);

  // Filter and sort records
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      // Search query (OS, VIN, technician, date)
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase().trim();
        const matchesOs = rec.osNumber.toLowerCase().includes(q);
        const matchesVin = rec.chassisVin.toLowerCase().includes(q);
        const matchesTech = rec.technician.toLowerCase().includes(q);
        const matchesDate = rec.repairDate.includes(q) || formatDateBr(rec.repairDate).includes(q);
        const matchesId = rec.id.toLowerCase().includes(q);
        if (!matchesOs && !matchesVin && !matchesTech && !matchesDate && !matchesId) {
          return false;
        }
      }

      // Technician
      if (filters.technicianFilter !== 'all' && rec.technician !== filters.technicianFilter) {
        return false;
      }

      // Status
      if (filters.statusFilter !== 'all') {
        const isRecFinalized = rec.status === 'finalizado' || rec.status === 'finalized';
        if (filters.statusFilter === 'finalizado' && !isRecFinalized) return false;
        if (filters.statusFilter === 'em_preenchimento' && isRecFinalized) return false;
      }

      // Period filter
      if (filters.periodFilter !== 'all') {
        const recordDate = new Date(rec.repairDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (filters.periodFilter === 'today') {
          const recDay = new Date(rec.repairDate);
          recDay.setHours(0, 0, 0, 0);
          if (recDay.getTime() !== today.getTime()) return false;
        } else if (filters.periodFilter === 'last7') {
          const past7 = new Date(today);
          past7.setDate(past7.getDate() - 7);
          if (recordDate < past7) return false;
        } else if (filters.periodFilter === 'thisMonth') {
          if (recordDate.getMonth() !== today.getMonth() || recordDate.getFullYear() !== today.getFullYear()) {
            return false;
          }
        } else if (filters.periodFilter === 'custom') {
          if (customStart && rec.repairDate < customStart) return false;
          if (customEnd && rec.repairDate > customEnd) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      let comparison = 0;
      if (filters.sortBy === 'date') {
        comparison = a.repairDate.localeCompare(b.repairDate);
      } else if (filters.sortBy === 'os') {
        comparison = a.osNumber.localeCompare(b.osNumber, undefined, { numeric: true });
      } else {
        // updatedAt
        comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      }
      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [records, filters, customStart, customEnd]);

  return (
    <div className="space-y-6">
      {/* Search and Filter Control Bar (Dark Charcoal surface) */}
      <div className="bg-[#18181C] border border-[#27272E] p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              placeholder="Pesquisar por OS, Chassi (VIN), Técnico ou Data..."
              className="w-full pl-10 pr-4 h-11 sm:h-9 bg-[#121214] border border-[#2E2E36] text-base sm:text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-[#D5001C] focus:bg-[#151518] transition-colors"
            />
          </div>

          {/* Sort By Selector */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Ordenar:</span>
            </div>
            <select
              value={`${filters.sortBy}-${filters.sortOrder}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split('-') as [any, any];
                setFilters({ ...filters, sortBy, sortOrder });
              }}
              className="h-11 sm:h-9 px-3 bg-[#121214] border border-[#2E2E36] text-xs font-medium text-neutral-200 focus:outline-hidden focus:border-[#D5001C]"
            >
              <option value="updatedAt-desc">Última Alteração (Recentes)</option>
              <option value="updatedAt-asc">Última Alteração (Antigos)</option>
              <option value="date-desc">Data do Reparo (Recentes)</option>
              <option value="date-asc">Data do Reparo (Antigos)</option>
              <option value="os-asc">Número da OS (Crescente)</option>
              <option value="os-desc">Número da OS (Decrescente)</option>
            </select>
          </div>
        </div>

        {/* Granular Filters: Period, Technician, Status */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#24242A] text-xs">
          {/* Status Tabs (Interactive Segmented Control) */}
          <div className="flex items-center p-1 bg-[#121214] border border-[#2A2A32]">
            <button
              onClick={() => setFilters({ ...filters, statusFilter: 'all' })}
              className={`px-3 py-1 font-semibold transition-colors cursor-pointer ${
                filters.statusFilter === 'all'
                  ? 'bg-[#25252D] text-white shadow-2xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Todos ({records.length})
            </button>
            <button
              onClick={() => setFilters({ ...filters, statusFilter: 'em_preenchimento' })}
              className={`px-3 py-1 font-semibold transition-colors cursor-pointer ${
                filters.statusFilter === 'em_preenchimento'
                  ? 'bg-[#25252D] text-white shadow-2xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Em Preenchimento
            </button>
            <button
              onClick={() => setFilters({ ...filters, statusFilter: 'finalizado' })}
              className={`px-3 py-1 font-semibold transition-colors cursor-pointer ${
                filters.statusFilter === 'finalizado'
                  ? 'bg-[#25252D] text-white shadow-2xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Finalizados
            </button>
          </div>

          {/* Period Filter */}
          <div className="flex items-center gap-2">
            <span className="text-neutral-400 font-mono text-[11px]">Período:</span>
            <select
              value={filters.periodFilter}
              onChange={(e) => setFilters({ ...filters, periodFilter: e.target.value as any })}
              className="h-9 px-2.5 bg-[#121214] border border-[#2E2E36] text-xs text-neutral-200 focus:outline-hidden"
            >
              <option value="all">Todo o período</option>
              <option value="today">Hoje</option>
              <option value="last7">Últimos 7 dias</option>
              <option value="thisMonth">Este mês</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>

          {filters.periodFilter === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-9 px-2 bg-[#121214] border border-[#2E2E36] text-xs text-white"
              />
              <span className="text-neutral-500">até</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-9 px-2 bg-[#121214] border border-[#2E2E36] text-xs text-white"
              />
            </div>
          )}

          {/* Technician Filter */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-neutral-400 font-mono text-[11px]">Técnico:</span>
            <select
              value={filters.technicianFilter}
              onChange={(e) => setFilters({ ...filters, technicianFilter: e.target.value })}
              className="h-9 px-2.5 bg-[#121214] border border-[#2E2E36] text-xs text-neutral-200 focus:outline-hidden max-w-[200px]"
            >
              <option value="all">Todos os técnicos ({allTechnicians.length})</option>
              {allTechnicians.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {onNavigateToAdmin && (
              <button
                type="button"
                onClick={onNavigateToAdmin}
                className="hidden lg:inline-flex text-[10px] font-mono uppercase text-[#D5001C] hover:underline cursor-pointer whitespace-nowrap"
                title="Gerenciar cadastro de técnicos no painel ADM"
              >
                Gerenciar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Record Grid / List */}
      {filteredRecords.length === 0 ? (
        <div className="bg-[#18181C] border border-[#27272E] p-12 text-center shadow-sm">
          <FileText className="w-12 h-12 text-neutral-600 mx-auto mb-3 stroke-[1.2]" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-200">
            Nenhum registro encontrado
          </h3>
          <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
            {filters.searchQuery || filters.technicianFilter !== 'all' || filters.statusFilter !== 'all'
              ? 'Nenhum registro corresponde aos filtros selecionados. Tente ajustar os parâmetros de busca.'
              : 'Comece criando o primeiro registro de evidências para documentação de garantia.'}
          </p>
          <button
            onClick={onNewRecord}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-[#D5001C] hover:bg-[#b00017] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-xs active:scale-98"
          >
            <Plus className="w-4 h-4" />
            Criar Novo Registro
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecords.map((record) => {
            const attachedCount = Object.values(record.evidences || {}).filter((e) => !!e).length;
            const isCompleted = record.status === 'finalizado' || record.status === 'finalized';

            return (
              <div
                key={record.id}
                className="bg-[#18181C] border border-[#27272E] hover:border-[#3E3E48] transition-all duration-150 p-4 sm:p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                {/* Left: Primary Info */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                    <span className="text-base font-extrabold text-white tracking-tight font-mono">
                      {record.osNumber}
                    </span>

                    {/* Status */}
                    <span
                      className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1 ${
                        isCompleted ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {isCompleted ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" />
                          Finalizado
                        </>
                      ) : (
                        <>
                          <FileClock className="w-3.5 h-3.5" />
                          Em Preenchimento
                        </>
                      )}
                    </span>

                    {record.isSyncedWithSupabase && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 border border-emerald-500/30 text-emerald-300 bg-emerald-950/60 flex items-center gap-1">
                        <Cloud className="w-3 h-3 text-emerald-400" />
                        Supabase
                      </span>
                    )}

                    <span className="text-neutral-600">·</span>
                    <span className="text-xs font-mono text-neutral-400 truncate max-w-[120px] sm:max-w-none" title={record.id}>
                      UUID: {record.id.slice(0, 8)}...
                    </span>
                    <span className="text-neutral-600">·</span>
                    <span className="text-xs font-mono text-neutral-400">
                      v{record.version || 1}
                    </span>
                  </div>

                  {/* Details Row: VIN, Technician, Date */}
                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-neutral-300">
                    <div className="flex items-center gap-1.5 font-mono">
                      <Hash className="w-3.5 h-3.5 text-neutral-500" />
                      <span className="text-neutral-400">VIN:</span>
                      <strong className="text-white font-semibold tracking-wider">
                        {record.chassisVin || '-'}
                      </strong>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-neutral-500" />
                      <span className="text-neutral-400">Técnico:</span>
                      <span className="text-neutral-200 font-medium">
                        {record.technician || '-'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                      <span className="text-neutral-400">Data Reparo:</span>
                      <span className="text-neutral-200 font-medium">
                        {formatDateBr(record.repairDate)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono text-neutral-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Alt: {formatDateTimeBr(record.updatedAt)}</span>
                    </div>
                  </div>

                  {/* Summary of Evidences Attached */}
                  <div className="flex items-center gap-3 pt-1 text-xs">
                    <span className="text-neutral-400 font-mono text-[11px]">
                      Evidências: <strong className="text-white">{attachedCount}</strong>/12 anexadas
                    </span>
                    <div className="w-28 h-2 bg-[#26262E] overflow-hidden">
                      <div
                        className="h-full bg-[#D5001C] transition-all duration-300"
                        style={{ width: `${(attachedCount / 12) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Actions (Touch-friendly on mobile and tablet) */}
                <div className="flex flex-wrap items-center gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-[#24242A] shrink-0">
                  <button
                    onClick={() => onViewRecord(record)}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 h-10 sm:h-9 bg-[#24242C] hover:bg-[#2C2C36] text-neutral-200 hover:text-white border border-[#32323C] text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer active:scale-98"
                    title="Visualizar registro e evidências"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Visualizar</span>
                  </button>

                  <button
                    onClick={() => onEditRecord(record)}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 h-10 sm:h-9 bg-white hover:bg-neutral-100 text-neutral-900 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer active:scale-98"
                    title="Editar registro"
                  >
                    <Edit3 className="w-4 h-4 text-neutral-900" />
                    <span>Editar</span>
                  </button>

                  <button
                    onClick={() => onGeneratePdf(record)}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 h-10 sm:h-9 border border-[#3A3A46] hover:bg-[#24242C] bg-[#1A1A1F] text-neutral-200 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer active:scale-98"
                    title="Visualizar e baixar relatório PDF"
                  >
                    <FileText className="w-4 h-4 text-[#D5001C]" />
                    <span>PDF</span>
                  </button>

                  <button
                    onClick={() => onDuplicateRecord(record)}
                    className="h-10 w-10 sm:h-9 sm:w-9 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-[#24242C] border border-[#2E2E38] transition-colors cursor-pointer shrink-0"
                    title="Duplicar dados básicos para nova OS"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onDeleteRecord(record)}
                    className="h-10 w-10 sm:h-9 sm:w-9 flex items-center justify-center text-neutral-400 hover:text-red-400 hover:bg-red-950/40 border border-[#2E2E38] transition-colors cursor-pointer shrink-0"
                    title="Excluir registro completo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
