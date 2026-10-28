import { WarrantyRecord, EvidenceFieldKey, StoredEvidenceFile, Technician, AppSettings } from '../types';
import { isSupabaseConfigured } from '../lib/supabase';
import { supabaseWarrantyService } from '../services/supabaseWarrantyService';
import { ensureValidUUID, generateUUID } from './uuid';

const DB_NAME = 'PorscheWarrantyEvidencesDB';
const DB_VERSION = 2;
const RECORDS_STORE = 'records';
const FILES_STORE = 'files';
const TECHNICIANS_STORE = 'technicians';
const SETTINGS_STORE = 'settings';

export const DEFAULT_TECHNICIANS: Technician[] = [
  {
    id: 'tech_marcelo_silva',
    name: 'Marcelo Silva',
    registration: 'P-1001',
    specialty: 'Diagnóstico Alta Tensão & E-Performance (Master)',
    email: 'marcelo.silva@porschenewcenter.com.br',
    phone: '(11) 98765-4321',
    active: true,
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-10-27T08:00:00.000Z'
  },
  {
    id: 'tech_carlos_mendes',
    name: 'Carlos Eduardo Mendes',
    registration: 'P-2045',
    specialty: 'Powertrain, Câmbio PDK & Motor Boxer',
    email: 'carlos.mendes@porschenewcenter.com.br',
    phone: '(11) 98123-4567',
    active: true,
    createdAt: '2026-01-15T08:00:00.000Z',
    updatedAt: '2026-10-20T08:00:00.000Z'
  },
  {
    id: 'tech_rodrigo_bittencourt',
    name: 'Rodrigo Bittencourt',
    registration: 'P-3102',
    specialty: 'Chassi, Suspensão Ativa (PASM) & Freios PCCB',
    email: 'rodrigo.bittencourt@porschenewcenter.com.br',
    phone: '(11) 98234-5678',
    active: true,
    createdAt: '2026-02-01T08:00:00.000Z',
    updatedAt: '2026-10-22T08:00:00.000Z'
  },
  {
    id: 'tech_guilherme_siqueira',
    name: 'Guilherme Siqueira',
    registration: 'P-4410',
    specialty: 'Mecatrônica Geral & Redes CAN/FlexRay',
    email: 'guilherme.siqueira@porschenewcenter.com.br',
    phone: '(11) 98345-6789',
    active: true,
    createdAt: '2026-02-15T08:00:00.000Z',
    updatedAt: '2026-10-25T08:00:00.000Z'
  },
  {
    id: 'tech_lucas_fernandes',
    name: 'Lucas Fernandes',
    registration: 'P-5120',
    specialty: 'Diagnóstico Eletroeletrônico & Módulos PIWIS',
    email: 'lucas.fernandes@porschenewcenter.com.br',
    phone: '(11) 98456-7890',
    active: true,
    createdAt: '2026-03-01T08:00:00.000Z',
    updatedAt: '2026-10-26T08:00:00.000Z'
  },
  {
    id: 'tech_alexandre_prado',
    name: 'Alexandre Prado',
    registration: 'P-6034',
    specialty: 'Carroceria, Acabamento & Aerodinâmica Ativa',
    email: 'alexandre.prado@porschenewcenter.com.br',
    phone: '(11) 98567-8901',
    active: true,
    createdAt: '2026-03-15T08:00:00.000Z',
    updatedAt: '2026-10-27T08:00:00.000Z'
  }
];

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 'current_settings',
  dealerName: 'Porsche Center New Center / São Paulo',
  dealerCode: 'PC-BR-011',
  warrantyManagerName: 'Marcelo Silva',
  warrantyManagerEmail: 'marcelo.silva@porschenewcenter.com.br',
  contactPhone: '+55 (11) 3456-7890',
  requireAdminPin: false,
  adminPin: '1948',
  autoBackupNotification: true,
  strictAuditValidation: false,
  updatedAt: new Date().toISOString()
};

class WarrantyDB {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB não é suportado neste navegador.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(RECORDS_STORE)) {
          const recordStore = db.createObjectStore(RECORDS_STORE, { keyPath: 'id' });
          recordStore.createIndex('osNumber', 'osNumber', { unique: false });
          recordStore.createIndex('chassisVin', 'chassisVin', { unique: false });
          recordStore.createIndex('technician', 'technician', { unique: false });
          recordStore.createIndex('repairDate', 'repairDate', { unique: false });
          recordStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(FILES_STORE)) {
          const fileStore = db.createObjectStore(FILES_STORE, { keyPath: 'id' });
          fileStore.createIndex('recordId', 'recordId', { unique: false });
          fileStore.createIndex('fieldKey', 'fieldKey', { unique: false });
        }

        if (!db.objectStoreNames.contains(TECHNICIANS_STORE)) {
          const techStore = db.createObjectStore(TECHNICIANS_STORE, { keyPath: 'id' });
          techStore.createIndex('name', 'name', { unique: false });
          techStore.createIndex('active', 'active', { unique: false });
        }

        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  async getAllRecords(forceLocal = false): Promise<WarrantyRecord[]> {
    const db = await this.getDB();

    // 1. Always load all local records from IndexedDB first
    const localRecords: WarrantyRecord[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(RECORDS_STORE, 'readonly');
      const store = tx.objectStore(RECORDS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const records: WarrantyRecord[] = request.result || [];
        resolve(records);
      };
      request.onerror = () => reject(request.error);
    });

    if (forceLocal || !isSupabaseConfigured()) {
      localRecords.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      return localRecords;
    }

    // 2. When Supabase is configured, fetch remote records and merge with local records
    try {
      const remoteRecords = await supabaseWarrantyService.getAllRecords();

      // Index local records in a Map
      const recordsMap = new Map<string, WarrantyRecord>();
      for (const loc of localRecords) {
        recordsMap.set(loc.id, loc);
      }

      // Merge remote records
      const tx = db.transaction(RECORDS_STORE, 'readwrite');
      const store = tx.objectStore(RECORDS_STORE);

      for (const rem of remoteRecords) {
        const existing = recordsMap.get(rem.id);
        if (!existing) {
          // Record exists on remote, save to local cache
          recordsMap.set(rem.id, rem);
          store.put(rem);
        } else {
          // Both exist: check timestamps
          const remoteTime = new Date(rem.updatedAt).getTime();
          const localTime = new Date(existing.updatedAt).getTime();

          if (remoteTime >= localTime) {
            // Remote is newer: preserve any local unsynced file dataUrls if remote doesn't have them
            const mergedEvidences = { ...rem.evidences };
            for (const [k, v] of Object.entries(existing.evidences || {})) {
              const fieldKey = k as EvidenceFieldKey;
              if (v && v.dataUrl?.startsWith('data:') && (!mergedEvidences[fieldKey] || !mergedEvidences[fieldKey]?.dataUrl)) {
                mergedEvidences[fieldKey] = {
                  ...(mergedEvidences[fieldKey] || v),
                  dataUrl: v.dataUrl
                };
              }
            }

            const mergedRecord: WarrantyRecord = {
              ...rem,
              evidences: mergedEvidences,
              isSyncedWithSupabase: true
            };
            recordsMap.set(rem.id, mergedRecord);
            store.put(mergedRecord);
          } else {
            // Local is newer: preserve local record (pending sync to remote)
            recordsMap.set(existing.id, existing);
          }
        }
      }

      const mergedList = Array.from(recordsMap.values());
      mergedList.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      return mergedList;
    } catch (err) {
      console.warn('Falha ao carregar registros do Supabase, utilizando dados locais do IndexedDB:', err);
      localRecords.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      return localRecords;
    }
  }

  async getRecord(id: string, forceLocal = false): Promise<WarrantyRecord | null> {
    const db = await this.getDB();
    const localRecord = await new Promise<WarrantyRecord | null>((resolve, reject) => {
      const tx = db.transaction(RECORDS_STORE, 'readonly');
      const store = tx.objectStore(RECORDS_STORE);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });

    if (forceLocal || !isSupabaseConfigured()) {
      return localRecord;
    }

    try {
      const remote = await supabaseWarrantyService.getRecordById(id);
      if (remote) {
        // Cache locally
        const tx = db.transaction(RECORDS_STORE, 'readwrite');
        tx.objectStore(RECORDS_STORE).put(remote);
        return remote;
      }
    } catch (err) {
      console.warn('Falha ao buscar registro no Supabase, utilizando local:', err);
    }

    return localRecord;
  }

  async saveRecord(record: WarrantyRecord): Promise<WarrantyRecord> {
    const db = await this.getDB();
    const now = new Date().toISOString();
    
    // Ensure ID is a valid RFC4122 UUID so it works in both IndexedDB and PostgreSQL
    const validId = ensureValidUUID(record.id);

    let recordToSave: WarrantyRecord = {
      ...record,
      id: validId,
      updatedAt: now
    };

    // 1. Always save to local IndexedDB first
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([RECORDS_STORE], 'readwrite');
      const store = tx.objectStore(RECORDS_STORE);
      const request = store.put(recordToSave);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // 2. If Supabase is configured, sync to PostgreSQL and Storage
    if (isSupabaseConfigured()) {
      try {
        const savedRemote = await supabaseWarrantyService.saveRecord(recordToSave);
        recordToSave = {
          ...savedRemote,
          id: validId,
          isSyncedWithSupabase: true,
          lastSyncedAt: new Date().toISOString()
        };
        // Update local with sync confirmation and signed URLs
        const txUpdate = db.transaction([RECORDS_STORE], 'readwrite');
        txUpdate.objectStore(RECORDS_STORE).put(recordToSave);
      } catch (cloudErr: any) {
        console.warn('Erro ao sincronizar com Supabase (salvo localmente no IndexedDB):', cloudErr);
        recordToSave.isSyncedWithSupabase = false;
        recordToSave.syncError = cloudErr.message || 'Erro ao sincronizar com a nuvem';
        
        // Update local record to reflect sync status
        try {
          const txErr = db.transaction([RECORDS_STORE], 'readwrite');
          txErr.objectStore(RECORDS_STORE).put(recordToSave);
        } catch {
          // ignore
        }
      }
    }

    return recordToSave;
  }

  async deleteRecord(id: string): Promise<void> {
    const db = await this.getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([RECORDS_STORE, FILES_STORE], 'readwrite');
      const recordStore = tx.objectStore(RECORDS_STORE);
      const fileStore = tx.objectStore(FILES_STORE);

      recordStore.delete(id);

      // Clean up associated files in files store
      const fileIndex = fileStore.index('recordId');
      const fileReq = fileIndex.openCursor(IDBKeyRange.only(id));
      fileReq.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Delete from Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        await supabaseWarrantyService.deleteRecord(id);
      } catch (err) {
        console.error('Erro ao excluir registro no Supabase:', err);
      }
    }
  }

  async duplicateRecord(id: string): Promise<WarrantyRecord> {
    const original = await this.getRecord(id);
    if (!original) throw new Error('Registro original não encontrado');

    const now = new Date().toISOString();
    const duplicated: WarrantyRecord = {
      id: generateUUID(),
      osNumber: `${original.osNumber} (Cópia)`,
      chassisVin: original.chassisVin,
      technician: original.technician,
      repairDate: new Date().toISOString().slice(0, 10),
      technicalReport: original.technicalReport,
      status: 'em_preenchimento',
      version: 1,
      createdAt: now,
      updatedAt: now,
      evidences: {} // Start fresh with no files attached so evidence is never mixed
    };

    await this.saveRecord(duplicated);
    return duplicated;
  }

  async deleteEvidenceFile(recordId: string, fieldKey: EvidenceFieldKey): Promise<WarrantyRecord> {
    const record = await this.getRecord(recordId);
    if (!record) throw new Error('Registro não encontrado');

    const fileId = record.evidences[fieldKey]?.id;

    // Remove from record object
    const updatedEvidences = { ...record.evidences };
    delete updatedEvidences[fieldKey];

    const updatedRecord: WarrantyRecord = {
      ...record,
      evidences: updatedEvidences,
      updatedAt: new Date().toISOString()
    };

    const db = await this.getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([RECORDS_STORE, FILES_STORE], 'readwrite');
      const recordStore = tx.objectStore(RECORDS_STORE);
      const fileStore = tx.objectStore(FILES_STORE);

      recordStore.put(updatedRecord);
      if (fileId) {
        fileStore.delete(fileId);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    if (isSupabaseConfigured()) {
      try {
        await supabaseWarrantyService.deleteAttachment(recordId, fieldKey);
      } catch (err) {
        console.warn('Erro ao remover anexo do Supabase:', err);
      }
    }

    return updatedRecord;
  }

  async deleteAllEvidences(recordId: string): Promise<WarrantyRecord> {
    const record = await this.getRecord(recordId);
    if (!record) throw new Error('Registro não encontrado');

    const updatedRecord: WarrantyRecord = {
      ...record,
      evidences: {},
      updatedAt: new Date().toISOString()
    };

    const db = await this.getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([RECORDS_STORE, FILES_STORE], 'readwrite');
      const recordStore = tx.objectStore(RECORDS_STORE);
      const fileStore = tx.objectStore(FILES_STORE);

      recordStore.put(updatedRecord);

      const fileIndex = fileStore.index('recordId');
      const fileReq = fileIndex.openCursor(IDBKeyRange.only(recordId));
      fileReq.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    if (isSupabaseConfigured()) {
      for (const fieldKey of Object.keys(record.evidences)) {
        try {
          await supabaseWarrantyService.deleteAttachment(recordId, fieldKey as EvidenceFieldKey);
        } catch (e) {
          console.warn(`Erro ao excluir anexo ${fieldKey} do Supabase:`, e);
        }
      }
    }

    return updatedRecord;
  }

  /**
   * Pushes all local records and their images/videos to Supabase PostgreSQL & Storage.
   */
  async syncAllLocalToSupabase(): Promise<{ total: number; successCount: number; errors: string[] }> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado.');
    }

    const localRecords = await this.getAllRecords(true); // force local read
    let successCount = 0;
    const errors: string[] = [];

    for (const record of localRecords) {
      try {
        await supabaseWarrantyService.saveRecord(record);
        successCount++;
      } catch (err: any) {
        errors.push(`OS ${record.osNumber || record.id}: ${err.message || 'Falha no envio'}`);
      }
    }

    return {
      total: localRecords.length,
      successCount,
      errors
    };
  }

  /**
   * Pulls all records from Supabase PostgreSQL and Storage into local IndexedDB cache.
   */
  async syncAllSupabaseToLocal(): Promise<number> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado.');
    }

    const remoteRecords = await supabaseWarrantyService.getAllRecords();
    const db = await this.getDB();
    const tx = db.transaction(RECORDS_STORE, 'readwrite');
    const store = tx.objectStore(RECORDS_STORE);

    for (const r of remoteRecords) {
      store.put(r);
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    return remoteRecords.length;
  }

  async exportAllData(): Promise<string> {
    const records = await this.getAllRecords();
    return JSON.stringify({
      appName: 'EvidenciasGarantiaAutomotiva',
      version: 1,
      exportedAt: new Date().toISOString(),
      recordsCount: records.length,
      records
    }, null, 2);
  }

  async importData(jsonString: string): Promise<number> {
    const parsed = JSON.parse(jsonString);
    if (!parsed || !Array.isArray(parsed.records)) {
      throw new Error('Formato de arquivo de backup inválido.');
    }

    const records: WarrantyRecord[] = parsed.records;
    for (const record of records) {
      if (record.id && record.osNumber) {
        await this.saveRecord(record);
      }
    }
    return records.length;
  }

  // ========================================================
  // GESTÃO DE TÉCNICOS (ADMINISTRAÇÃO)
  // ========================================================

  async getAllTechnicians(): Promise<Technician[]> {
    try {
      const db = await this.getDB();
      const techsFromDb = await new Promise<Technician[]>((resolve, reject) => {
        if (!db.objectStoreNames.contains(TECHNICIANS_STORE)) {
          resolve([]);
          return;
        }
        const tx = db.transaction(TECHNICIANS_STORE, 'readonly');
        const store = tx.objectStore(TECHNICIANS_STORE);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });

      if (techsFromDb.length > 0) {
        techsFromDb.sort((a, b) => a.name.localeCompare(b.name));
        return techsFromDb;
      }
    } catch (err) {
      console.warn('Erro ao ler técnicos do IndexedDB, recorrendo ao localStorage:', err);
    }

    // Fallback or Initial Seed from localStorage or DEFAULT_TECHNICIANS
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('porsche_warranty_technicians_v2');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        } catch (e) {
          console.warn('Erro ao parsear técnicos do localStorage:', e);
        }
      }
    }

    // Initial Seed with default Porsche technicians
    await this.seedDefaultTechnicians();
    return DEFAULT_TECHNICIANS;
  }

  private async seedDefaultTechnicians(): Promise<void> {
    try {
      const db = await this.getDB();
      if (db.objectStoreNames.contains(TECHNICIANS_STORE)) {
        const tx = db.transaction(TECHNICIANS_STORE, 'readwrite');
        const store = tx.objectStore(TECHNICIANS_STORE);
        for (const tech of DEFAULT_TECHNICIANS) {
          store.put(tech);
        }
        await new Promise((resolve) => {
          tx.oncomplete = () => resolve(true);
        });
      }
    } catch (e) {
      console.warn('Seed default technicians IDB warning:', e);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('porsche_warranty_technicians_v2', JSON.stringify(DEFAULT_TECHNICIANS));
    }
  }

  async saveTechnician(technician: Technician): Promise<void> {
    const updated: Technician = {
      ...technician,
      updatedAt: new Date().toISOString()
    };

    try {
      const db = await this.getDB();
      if (db.objectStoreNames.contains(TECHNICIANS_STORE)) {
        const tx = db.transaction(TECHNICIANS_STORE, 'readwrite');
        const store = tx.objectStore(TECHNICIANS_STORE);
        store.put(updated);
        await new Promise((resolve, reject) => {
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        });
      }
    } catch (err) {
      console.warn('IndexedDB saveTechnician error:', err);
    }

    // Always mirror to localStorage for instantaneous fast reads
    if (typeof localStorage !== 'undefined') {
      const all = await this.getAllTechnicians();
      const idx = all.findIndex((t) => t.id === updated.id);
      if (idx >= 0) {
        all[idx] = updated;
      } else {
        all.push(updated);
      }
      localStorage.setItem('porsche_warranty_technicians_v2', JSON.stringify(all));
    }
  }

  async deleteTechnician(id: string): Promise<{ success: boolean; associatedRecordsCount: number; technicianName: string }> {
    const all = await this.getAllTechnicians();
    const target = all.find((t) => t.id === id);
    const techName = target ? target.name : 'Técnico';

    // Count how many warranty records are registered under this technician
    const allRecords = await this.getAllRecords();
    const associatedRecords = allRecords.filter((r) => r.technician && r.technician.trim().toLowerCase() === techName.trim().toLowerCase());
    const count = associatedRecords.length;

    try {
      const db = await this.getDB();
      if (db.objectStoreNames.contains(TECHNICIANS_STORE)) {
        const tx = db.transaction(TECHNICIANS_STORE, 'readwrite');
        const store = tx.objectStore(TECHNICIANS_STORE);
        store.delete(id);
        await new Promise((resolve, reject) => {
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        });
      }
    } catch (err) {
      console.warn('IndexedDB deleteTechnician error:', err);
    }

    if (typeof localStorage !== 'undefined') {
      const filtered = all.filter((t) => t.id !== id);
      localStorage.setItem('porsche_warranty_technicians_v2', JSON.stringify(filtered));
    }

    return {
      success: true,
      associatedRecordsCount: count,
      technicianName: techName
    };
  }

  async toggleTechnicianStatus(id: string): Promise<Technician | null> {
    const all = await this.getAllTechnicians();
    const target = all.find((t) => t.id === id);
    if (!target) return null;

    const updated: Technician = {
      ...target,
      active: !target.active,
      updatedAt: new Date().toISOString()
    };

    await this.saveTechnician(updated);
    return updated;
  }

  // ========================================================
  // CONFIGURAÇÕES GLOBAIS DO APLICATIVO (ADM)
  // ========================================================

  async getAppSettings(): Promise<AppSettings> {
    try {
      const db = await this.getDB();
      if (db.objectStoreNames.contains(SETTINGS_STORE)) {
        const tx = db.transaction(SETTINGS_STORE, 'readonly');
        const store = tx.objectStore(SETTINGS_STORE);
        const req = store.get('current_settings');
        const result = await new Promise<AppSettings | null>((resolve) => {
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        });
        if (result) return result;
      }
    } catch (e) {
      console.warn('getAppSettings IDB warning:', e);
    }

    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('porsche_warranty_app_settings_v2');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          console.warn('Error parsing settings from localStorage:', e);
        }
      }
    }

    return DEFAULT_APP_SETTINGS;
  }

  async saveAppSettings(settings: AppSettings): Promise<void> {
    const updated: AppSettings = {
      ...settings,
      updatedAt: new Date().toISOString()
    };

    try {
      const db = await this.getDB();
      if (db.objectStoreNames.contains(SETTINGS_STORE)) {
        const tx = db.transaction(SETTINGS_STORE, 'readwrite');
        const store = tx.objectStore(SETTINGS_STORE);
        store.put(updated);
        await new Promise((resolve) => {
          tx.oncomplete = () => resolve(true);
        });
      }
    } catch (e) {
      console.warn('saveAppSettings IDB warning:', e);
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('porsche_warranty_app_settings_v2', JSON.stringify(updated));
    }
  }

  // ========================================================
  // ANALYTICS & MÉTRICAS GLOBAIS DO APLICATIVO
  // ========================================================

  async getStorageAnalytics(): Promise<{
    totalRecords: number;
    finalizedCount: number;
    draftCount: number;
    totalEvidences: number;
    estimatedSizeMb: number;
    techniciansCount: number;
    technicianDistribution: { name: string; count: number; finalized: number; draft: number }[];
  }> {
    const records = await this.getAllRecords();
    const technicians = await this.getAllTechnicians();

    const finalizedCount = records.filter((r) => r.status === 'finalizado').length;
    const draftCount = records.filter((r) => r.status === 'em_preenchimento').length;

    let totalEvidences = 0;
    let totalBytes = 0;

    const techMap = new Map<string, { count: number; finalized: number; draft: number }>();
    technicians.forEach((t) => {
      techMap.set(t.name, { count: 0, finalized: 0, draft: 0 });
    });

    records.forEach((r) => {
      const tName = r.technician && r.technician.trim() ? r.technician.trim() : 'Não especificado';
      const current = techMap.get(tName) || { count: 0, finalized: 0, draft: 0 };
      current.count += 1;
      if (r.status === 'finalizado') current.finalized += 1;
      else current.draft += 1;
      techMap.set(tName, current);

      if (r.evidences) {
        Object.values(r.evidences).forEach((file) => {
          if (file) {
            totalEvidences += 1;
            totalBytes += file.fileSize || (file.dataUrl ? file.dataUrl.length : 0);
          }
        });
      }
      totalBytes += (r.technicalReport ? r.technicalReport.length : 0) + 1024;
    });

    const technicianDistribution = Array.from(techMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count);

    const estimatedSizeMb = Math.round((totalBytes / (1024 * 1024)) * 100) / 100;

    return {
      totalRecords: records.length,
      finalizedCount,
      draftCount,
      totalEvidences,
      estimatedSizeMb,
      techniciansCount: technicians.length,
      technicianDistribution
    };
  }

  // ========================================================
  // BACKUP COMPLETO DO SISTEMA (REGISTROS + TÉCNICOS + CONFIG)
  // ========================================================

  async exportFullDatabaseBackup(): Promise<string> {
    const records = await this.getAllRecords();
    const technicians = await this.getAllTechnicians();
    const settings = await this.getAppSettings();

    return JSON.stringify(
      {
        appName: 'EvidenciasGarantiaAutomotiva',
        exportType: 'FULL_SYSTEM_BACKUP',
        version: 2,
        exportedAt: new Date().toISOString(),
        settings,
        technicians,
        recordsCount: records.length,
        records
      },
      null,
      2
    );
  }

  async importFullDatabaseBackup(backupJson: string): Promise<{ importedRecords: number; importedTechs: number }> {
    const parsed = JSON.parse(backupJson);
    if (!parsed || (!Array.isArray(parsed.records) && !Array.isArray(parsed.technicians))) {
      throw new Error('Arquivo de backup inválido ou incompatível.');
    }

    let importedTechs = 0;
    if (Array.isArray(parsed.technicians)) {
      for (const tech of parsed.technicians) {
        if (tech.id && tech.name) {
          await this.saveTechnician(tech);
          importedTechs += 1;
        }
      }
    }

    let importedRecords = 0;
    if (Array.isArray(parsed.records)) {
      for (const rec of parsed.records) {
        if (rec.id && rec.osNumber) {
          await this.saveRecord(rec);
          importedRecords += 1;
        }
      }
    }

    if (parsed.settings && typeof parsed.settings === 'object') {
      await this.saveAppSettings(parsed.settings);
    }

    return { importedRecords, importedTechs };
  }

  async purgeDraftRecords(): Promise<number> {
    const records = await this.getAllRecords();
    const drafts = records.filter((r) => r.status === 'em_preenchimento');
    for (const draft of drafts) {
      await this.deleteRecord(draft.id);
    }
    return drafts.length;
  }

  async purgeAllRecords(): Promise<void> {
    const records = await this.getAllRecords();
    for (const rec of records) {
      await this.deleteRecord(rec.id);
    }
  }

  async seedRealisticDemoIfEmpty(): Promise<boolean> {
    // If Supabase is configured, NEVER inject fictitious records into production
    if (isSupabaseConfigured()) {
      return false;
    }

    // If the database has already been initialized previously, do NOT resurrect deleted records!
    if (typeof localStorage !== 'undefined' && localStorage.getItem('porsche_warranty_demo_seeded')) {
      return false;
    }

    const existing = await this.getAllRecords(true);
    if (existing.length > 0) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('porsche_warranty_demo_seeded', 'true');
      }
      return false;
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('porsche_warranty_demo_seeded', 'true');
    }

    return this.createDemoRecords();
  }

  async forceSeedDemo(): Promise<void> {
    await this.createDemoRecords();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('porsche_warranty_demo_seeded', 'true');
    }
  }

  private async createDemoRecords(): Promise<boolean> {
    // Generate lightweight SVG data URLs for realistic initial seeds
    const sampleImage1 = createSvgDataUrl('TURBOCHARGER', 'Vazamento de óleo no mancal do turbo compressor');
    const sampleImage2 = createSvgDataUrl('VALVE COVER', 'Fissura estrutural na tampa de válvulas');
    const samplePhotoNew = createSvgDataUrl('NOVA PEÇA TURBO', 'Peça nova 9A2.145.701.B pronta para instalação');
    const samplePhotoOld = createSvgDataUrl('PEÇA SUBSTITUÍDA', 'Peça danificada 9A2.145.701.A com trinca no caracol');
    const sampleLabelNew = createSvgDataUrl('NEW PART P/N 9A2.145.701.B', 'Genuína Porsche AG - 9A2.145.701.B - Made in Germany');
    const sampleLabelOld = createSvgDataUrl('DAMAGED PART P/N 9A2.145.701.A', 'Substituída - 9A2.145.701.A - SN: 84920194');

    const sampleRecord1: WarrantyRecord = {
      id: '11111111-9110-4000-a000-000000000001',
      osNumber: 'OS-98241',
      chassisVin: 'WP0AB2A99NS145290',
      technician: 'Carlos Eduardo Mendes',
      repairDate: '2026-10-24',
      technicalReport: 'Diagnóstico de perda de pressão de sobrealimentação em aceleração progressiva. Identificada anomalia no atuador eletropneumático do turbocompressor do lado direito (bancada 2) e leve perda de estanqueidade na carcaça de turbina. Procedida substituição completa do turbocompressor de alta pressão conforme Boletim Técnico TI 44/25. Teste de rodagem de 35 km executado com monitoramento via PIWIS IV: parâmetros de pressão absoluta dentro da faixa nominal especificada (2.25 bar de pico). Sem códigos de avaria remanescentes no módulo DME.',
      status: 'finalizado',
      version: 1,
      createdAt: '2026-10-24T09:30:00.000Z',
      updatedAt: '2026-10-25T14:15:00.000Z',
      evidences: {
        photo1: {
          id: 'file_p1_01',
          fieldKey: 'photo1',
          fileName: 'diagnostico_turbo_lado_direito_geral.jpg',
          fileSize: 2450000,
          mimeType: 'image/jpeg',
          dataUrl: sampleImage1,
          capturedAt: '2026-10-24T10:15:00.000Z'
        },
        photo2: {
          id: 'file_p2_01',
          fieldKey: 'photo2',
          fileName: 'detalhe_atuador_turbo_vazamento.jpg',
          fileSize: 3120000,
          mimeType: 'image/jpeg',
          dataUrl: sampleImage2,
          capturedAt: '2026-10-24T10:20:00.000Z'
        },
        newPartPhoto: {
          id: 'file_npp_01',
          fieldKey: 'newPartPhoto',
          fileName: 'foto_peca_nova_turbocompressor_9A2.jpg',
          fileSize: 2890000,
          mimeType: 'image/jpeg',
          dataUrl: samplePhotoNew,
          capturedAt: '2026-10-24T10:45:00.000Z'
        },
        newPartLabel1: {
          id: 'file_np1_01',
          fieldKey: 'newPartLabel1',
          fileName: 'etiqueta_embalagem_turbo_novo_9A2145701B.jpg',
          fileSize: 1850000,
          mimeType: 'image/jpeg',
          dataUrl: sampleLabelNew,
          capturedAt: '2026-10-24T11:00:00.000Z'
        },
        replacedPartPhoto: {
          id: 'file_rpp_01',
          fieldKey: 'replacedPartPhoto',
          fileName: 'foto_peca_substituida_avariada_turbo.jpg',
          fileSize: 2750000,
          mimeType: 'image/jpeg',
          dataUrl: samplePhotoOld,
          capturedAt: '2026-10-24T10:50:00.000Z'
        },
        replacedPartLabel1: {
          id: 'file_rp1_01',
          fieldKey: 'replacedPartLabel1',
          fileName: 'etiqueta_peca_avariada_removida_9A2145701A.jpg',
          fileSize: 1940000,
          mimeType: 'image/jpeg',
          dataUrl: sampleLabelOld,
          capturedAt: '2026-10-24T11:10:00.000Z'
        }
      }
    };

    const sampleRecord2: WarrantyRecord = {
      id: 'rec_taycan_bms_02',
      osNumber: 'OS-98310',
      chassisVin: 'WP0AA2Y14PSA88219',
      technician: 'Rodrigo Bittencourt',
      repairDate: '2026-10-26',
      technicalReport: 'Veículo apresentou alerta no painel de instrumentos "Falha no sistema elétrico de alta tensão - Necessário serviço". Leitura PIWIS registrou DTC P0A7F00 (Deterioração do módulo 4 da bateria de tração de 800V). Realizado isolamento galvânico conforme protocolo de alta voltagem e substituição do módulo de células CMC #4 e sensores de temperatura associados.',
      status: 'em_preenchimento',
      version: 1,
      createdAt: '2026-10-26T08:15:00.000Z',
      updatedAt: '2026-10-26T16:45:00.000Z',
      evidences: {}
    };

    await this.saveRecord(sampleRecord1);
    await this.saveRecord(sampleRecord2);
    return true;
  }
}

function createSvgDataUrl(title: string, subtitle: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
    <rect width="1200" height="900" fill="#18181B"/>
    <rect x="40" y="40" width="1120" height="820" fill="none" stroke="#27272A" stroke-width="2"/>
    <line x1="40" y1="120" x2="1160" y2="120" stroke="#D5001C" stroke-width="4"/>
    <text x="70" y="90" font-family="monospace" font-size="28" font-weight="bold" fill="#F4F4F5" letter-spacing="2">PORSCHE WARRANTY EVIDENCE ARCHIVE</text>
    <rect x="70" y="160" width="1060" height="540" fill="#202023" rx="8"/>
    <circle cx="600" cy="400" r="110" fill="none" stroke="#3F3F46" stroke-width="3" stroke-dasharray="8 8"/>
    <text x="600" y="415" font-family="sans-serif" font-size="32" font-weight="700" fill="#E4E4E7" text-anchor="middle">${title}</text>
    <text x="600" y="760" font-family="sans-serif" font-size="24" fill="#A1A1AA" text-anchor="middle">${subtitle}</text>
    <text x="70" y="820" font-family="monospace" font-size="16" fill="#71717A">VERIFIED TECHNICAL CAPTURE · HIGH RESOLUTION DOCUMENTATION</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export const warrantyDb = new WarrantyDB();
