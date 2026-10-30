export type StandardEvidenceFieldKey =
  | 'video1'
  | 'video2'
  | 'photo1'
  | 'photo2'
  | 'photo3'
  | 'photo4'
  | 'newPartPhoto'
  | 'newPartLabel1'
  | 'newPartLabel2'
  | 'replacedPartPhoto'
  | 'replacedPartLabel1'
  | 'replacedPartLabel2';

export type EvidenceFieldKey = StandardEvidenceFieldKey | (string & {});

export type EvidenceCategory = 'video' | 'diagnostic_photo' | 'new_part' | 'replaced_part';

export interface FieldDefinition {
  key: EvidenceFieldKey;
  label: string;
  category: EvidenceCategory;
  categoryLabel: string;
  type: 'video' | 'image';
  required?: boolean;
  description: string;
  isCustom?: boolean;
}

export interface StoredEvidenceFile {
  id: string;
  fieldKey: EvidenceFieldKey;
  fileName: string;
  fileSize: number;
  mimeType: string;
  dataUrl: string; // Base64, blob URL, or signed URL
  capturedAt: string;
  storagePath?: string; // Path in Supabase Storage bucket
  signedUrl?: string; // Signed temporary URL
  remoteId?: string; // UUID from warranty_attachments table
  category?: EvidenceCategory;
  blob?: Blob;
}

export type RecordStatus = 'em_preenchimento' | 'finalizado' | 'draft' | 'finalized';

export interface WarrantyRecord {
  id: string; // UUID
  osNumber: string;
  chassisVin: string;
  technician: string;
  repairDate: string; // YYYY-MM-DD
  technicalReport: string;
  status: RecordStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  finalizedAt?: string;
  createdBy?: string;
  evidences: Record<string, StoredEvidenceFile | null | undefined>;
  lastPdfGeneratedAt?: string;
  lastPdfFileName?: string;
  // Cloud sync metadata
  isSyncedWithSupabase?: boolean;
  lastSyncedAt?: string;
  syncError?: string;
}

export interface RecordFilterOptions {
  searchQuery: string;
  technicianFilter: string;
  periodFilter: 'all' | 'today' | 'last7' | 'thisMonth' | 'custom';
  customStartDate?: string;
  customEndDate?: string;
  statusFilter: 'all' | 'em_preenchimento' | 'finalizado' | 'draft' | 'finalized';
  sortBy: 'date' | 'os' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
}

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationSummary {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  filledEvidenceCount: number;
  totalEvidenceCount: number;
}

export interface Technician {
  id: string;
  name: string;
  registration: string; // Matrícula / Registro Técnico (ex: P-4091)
  specialty: string; // Especialidade (ex: Alta Tensão / E-Performance, Powertrain, Chassi)
  email?: string;
  phone?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  id: string; // 'current_settings'
  dealerName: string;
  dealerCode: string;
  warrantyManagerName: string;
  warrantyManagerEmail: string;
  contactPhone: string;
  requireAdminPin: boolean;
  adminPin: string; // Default: '1948'
  autoBackupNotification: boolean;
  strictAuditValidation: boolean; // Require all evidences before finalization
  updatedAt: string;
}

// ==============================================================================
// Supabase Database Row Definitions
// ==============================================================================

export interface SupabaseWarrantyRecordRow {
  id: string;
  os_number: string;
  vin: string;
  technician: string;
  repair_date: string;
  technical_report: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
  last_pdf_generated_at: string | null;
  last_pdf_file_name: string | null;
}

export interface SupabaseAttachmentRow {
  id: string;
  record_id: string;
  category: string;
  field_key: string;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  created_by: string | null;
  created_at: string;
}

export interface SupabaseTechnicianRow {
  id: string;
  name: string;
  registration: string | null;
  specialty: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}
