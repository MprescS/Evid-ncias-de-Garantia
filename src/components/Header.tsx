import React from 'react';
import { Plus, Database, ShieldCheck, FileText } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';

interface HeaderProps {
  onNewRecord: () => void;
  onOpenDbConfig: () => void;
  activeView: 'list' | 'form' | 'admin';
  onNavigateToList: () => void;
  onNavigateToAdmin: () => void;
  totalRecordsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onNewRecord,
  onOpenDbConfig,
  activeView,
  onNavigateToList,
  onNavigateToAdmin,
  totalRecordsCount
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#161619] border-b border-[#24242A] shadow-md">
      {/* Top Bar Contract: Zone 1 (Wordmark) - Zone 2 (Nav Links) - Zone 3 (1 Primary Action) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-15 sm:h-16 flex items-center justify-between gap-3 sm:gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-1.5 h-6 bg-[#D5001C]" />
          <button
            onClick={onNavigateToList}
            className="text-left group cursor-pointer"
          >
            <div className="text-xs sm:text-sm font-extrabold tracking-wider text-white uppercase">
              Evidências de Garantia
            </div>
            <div className="text-[9px] sm:text-[10px] tracking-widest text-neutral-400 font-mono uppercase">
              Pós-Venda Automotivo
            </div>
          </button>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-5 text-xs font-semibold uppercase tracking-wider text-neutral-300">
          <button
            onClick={onNavigateToList}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 py-1 ${
              activeView === 'list' ? 'text-white border-b-2 border-[#D5001C]' : ''
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Registros ({totalRecordsCount})</span>
          </button>

          <button
            onClick={onNavigateToAdmin}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer py-1 ${
              activeView === 'admin' ? 'text-white border-b-2 border-[#D5001C]' : 'text-neutral-300'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#D5001C]" />
            <span>Painel ADM</span>
            <span className="text-[9px] font-mono bg-[#282834] text-neutral-300 px-1.5 py-0.2 border border-[#353545]">
              Gestão
            </span>
          </button>

          <button
            onClick={onOpenDbConfig}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer text-neutral-300 py-1"
          >
            <Database className="w-3.5 h-3.5 text-neutral-400" />
            <span>Nuvem</span>
            {isSupabaseConfigured() ? (
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" title="Supabase Conectado" />
            ) : (
              <span className="w-2 h-2 bg-amber-500 rounded-full" title="Modo Local (IndexedDB)" />
            )}
          </button>
        </nav>

        {/* Zone 3: Actions (Mobile Admin button + Primary New Record) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={onNavigateToAdmin}
            className={`md:hidden min-h-[38px] px-2.5 py-1.5 border text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeView === 'admin'
                ? 'bg-[#252530] border-[#D5001C] text-white'
                : 'border-[#33333E] bg-[#18181C] text-neutral-300'
            }`}
            title="Painel Administrativo"
          >
            <ShieldCheck className="w-4 h-4 text-[#D5001C]" />
            <span className="text-[11px]">ADM</span>
          </button>

          <button
            onClick={onNewRecord}
            className="min-h-[40px] inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 bg-[#D5001C] hover:bg-[#b00017] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-xs cursor-pointer whitespace-nowrap shrink-0 active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Registro</span>
          </button>
        </div>
      </div>
    </header>
  );
};
