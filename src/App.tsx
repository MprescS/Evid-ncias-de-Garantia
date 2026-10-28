import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { RecordList } from './components/RecordList';
import { RecordForm } from './components/RecordForm';
import { AdminPanel } from './components/AdminPanel';
import { PdfPreviewModal } from './components/PdfPreviewModal';
import { DatabaseConfigModal } from './components/DatabaseConfigModal';
import { ConfirmModal } from './components/ConfirmModal';
import { warrantyDb } from './utils/storage';
import { WarrantyRecord, Technician } from './types';
import { generateUUID } from './utils/uuid';

export default function App() {
  const [records, setRecords] = useState<WarrantyRecord[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'list' | 'form' | 'admin'>('list');
  const [activeRecord, setActiveRecord] = useState<WarrantyRecord | null>(null);

  // Modals
  const [pdfRecord, setPdfRecord] = useState<WarrantyRecord | null>(null);
  const [isDbConfigOpen, setIsDbConfigOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<WarrantyRecord | null>(null);

  // Load Technicians
  const loadTechnicians = useCallback(async () => {
    try {
      const list = await warrantyDb.getAllTechnicians();
      setTechnicians(list);
    } catch (err) {
      console.error('Failed to load technicians:', err);
    }
  }, []);

  // Pure load records from IndexedDB (never re-seeds deleted records)
  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const allRecords = await warrantyDb.getAllRecords();
      setRecords(allRecords);
    } catch (err) {
      console.error('Failed to load records from IndexedDB:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // One-time initial setup on app startup
  useEffect(() => {
    let isMounted = true;
    const initialize = async () => {
      try {
        await warrantyDb.seedRealisticDemoIfEmpty();
      } catch (err) {
        console.warn('Initial seed error:', err);
      }
      if (isMounted) {
        await Promise.all([loadRecords(), loadTechnicians()]);
      }
    };
    initialize();
    return () => {
      isMounted = false;
    };
  }, [loadRecords, loadTechnicians]);

  // Create new blank record
  const handleNewRecord = () => {
    const now = new Date().toISOString();
    const newRecord: WarrantyRecord = {
      id: generateUUID(),
      osNumber: '',
      chassisVin: '',
      technician: '',
      repairDate: new Date().toISOString().slice(0, 10),
      technicalReport: '',
      status: 'em_preenchimento',
      version: 1,
      createdAt: now,
      updatedAt: now,
      evidences: {}
    };

    setActiveRecord(newRecord);
    setCurrentView('form');
  };

  const handleEditRecord = (record: WarrantyRecord) => {
    setActiveRecord({ ...record });
    setCurrentView('form');
  };

  const handleViewRecord = (record: WarrantyRecord) => {
    setActiveRecord({ ...record });
    setCurrentView('form');
  };

  const handleDuplicateRecord = async (record: WarrantyRecord) => {
    try {
      const duplicated = await warrantyDb.duplicateRecord(record.id);
      await loadRecords();
      setActiveRecord(duplicated);
      setCurrentView('form');
    } catch (err: any) {
      alert('Erro ao duplicar registro: ' + err.message);
    }
  };

  const handleSaveRecord = async (record: WarrantyRecord, isFinalizedOrReturn: boolean) => {
    const saved = await warrantyDb.saveRecord(record);
    await loadRecords();
    setActiveRecord(saved);
    if (isFinalizedOrReturn) {
      // Return to list after finalized or when user clicked Salvar e Voltar
      setCurrentView('list');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!recordToDelete) return;
    const targetId = recordToDelete.id;
    try {
      await warrantyDb.deleteRecord(targetId);
      setRecordToDelete(null);
      // Immediately reflect deletion in state and reload
      setRecords((prev) => prev.filter((r) => r.id !== targetId));
      if (activeRecord?.id === targetId) {
        setActiveRecord(null);
        setCurrentView('list');
      }
      await loadRecords();
    } catch (err: any) {
      alert('Erro ao excluir registro: ' + err.message);
    }
  };

  const handleDeleteAllEvidences = async (recordId: string) => {
    const updated = await warrantyDb.deleteAllEvidences(recordId);
    await loadRecords();
    setActiveRecord(updated);
  };

  return (
    <div className="min-h-screen bg-[#121214] text-[#F4F4F5] flex flex-col font-sans">
      {/* 3-Zone Top Navigation Bar */}
      <Header
        onNewRecord={handleNewRecord}
        onOpenDbConfig={() => setIsDbConfigOpen(true)}
        activeView={currentView}
        onNavigateToList={() => {
          setActiveRecord(null);
          setCurrentView('list');
        }}
        onNavigateToAdmin={() => {
          setActiveRecord(null);
          setCurrentView('admin');
        }}
        totalRecordsCount={records.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center text-neutral-400">
            <div className="w-8 h-8 border-2 border-[#D5001C] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs uppercase tracking-widest font-mono text-neutral-400">
              Carregando registros de garantia do IndexedDB...
            </p>
          </div>
        ) : currentView === 'admin' ? (
          <AdminPanel
            onBackToRecords={() => setCurrentView('list')}
            onTechniciansUpdated={() => {
              loadTechnicians();
              loadRecords();
            }}
            records={records}
          />
        ) : currentView === 'list' ? (
          <RecordList
            records={records}
            technicians={technicians}
            onNewRecord={handleNewRecord}
            onEditRecord={handleEditRecord}
            onViewRecord={handleViewRecord}
            onDuplicateRecord={handleDuplicateRecord}
            onGeneratePdf={(rec) => setPdfRecord(rec)}
            onDeleteRecord={(rec) => setRecordToDelete(rec)}
            onNavigateToAdmin={() => setCurrentView('admin')}
          />
        ) : activeRecord ? (
          <RecordForm
            initialRecord={activeRecord}
            technicians={technicians}
            onSave={handleSaveRecord}
            onCancel={() => {
              setActiveRecord(null);
              setCurrentView('list');
            }}
            onRequestPdf={(rec) => setPdfRecord(rec)}
            onDeleteAllEvidences={handleDeleteAllEvidences}
            onOpenAdmin={() => setCurrentView('admin')}
          />
        ) : null}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#24242A] bg-[#161619] py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400 font-mono">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-[#D5001C]" />
            <span className="text-neutral-300">SISTEMA DE EVIDÊNCIAS DE REPAROS EM GARANTIA</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-neutral-400">
            <span>IndexedDB Persistente</span>
            <span>·</span>
            <button
              onClick={() => setCurrentView('admin')}
              className="text-neutral-200 hover:text-[#D5001C] font-semibold underline cursor-pointer transition-colors"
            >
              Painel ADM & Técnicos
            </button>
            <span>·</span>
            <button
              onClick={() => setIsDbConfigOpen(true)}
              className="text-neutral-200 hover:text-[#D5001C] font-semibold underline cursor-pointer transition-colors"
            >
              Banco Nuvem
            </button>
          </div>
        </div>
      </footer>

      {/* PDF Generator / Viewer Modal */}
      {pdfRecord && (
        <PdfPreviewModal
          isOpen={!!pdfRecord}
          record={pdfRecord}
          onClose={() => setPdfRecord(null)}
          onPdfGenerated={async () => {
            // Update lastPdfGeneratedAt in background
            const updated = {
              ...pdfRecord,
              lastPdfGeneratedAt: new Date().toISOString()
            };
            await warrantyDb.saveRecord(updated);
          }}
        />
      )}

      {/* Database & Cloud Setup Modal */}
      <DatabaseConfigModal
        isOpen={isDbConfigOpen}
        onClose={() => setIsDbConfigOpen(false)}
        onDataImported={loadRecords}
      />

      {/* Delete Record Confirmation Modal */}
      <ConfirmModal
        isOpen={!!recordToDelete}
        title="Excluir Registro de Garantia?"
        message={`Tem certeza que deseja excluir o registro da OS "${recordToDelete?.osNumber}" (Chassi: ${recordToDelete?.chassisVin}) e todos os seus arquivos anexados? Esta ação é irreversível.`}
        confirmLabel="Sim, Excluir Registro"
        cancelLabel="Cancelar"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setRecordToDelete(null)}
      />
    </div>
  );
}
