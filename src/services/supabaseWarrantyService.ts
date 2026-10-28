import { getSupabaseClient, DEFAULT_STORAGE_BUCKET, isSupabaseConfigured } from '../lib/supabase';
import { ensureValidUUID, generateUUID } from '../utils/uuid';
import {
  WarrantyRecord,
  StoredEvidenceFile,
  EvidenceFieldKey,
  EvidenceCategory,
  SupabaseWarrantyRecordRow,
  SupabaseAttachmentRow,
  Technician,
  AppSettings
} from '../types';

/**
 * Normalizes field key between frontend and PostgreSQL schema.
 */
export const FIELD_KEY_TO_SQL_MAP: Record<EvidenceFieldKey, string> = {
  video1: 'diagnostic_video_1',
  video2: 'diagnostic_video_2',
  photo1: 'diagnostic_photo_1',
  photo2: 'diagnostic_photo_2',
  photo3: 'diagnostic_photo_3',
  photo4: 'diagnostic_photo_4',
  newPartPhoto: 'new_part_photo',
  newPartLabel1: 'new_part_label_1',
  newPartLabel2: 'new_part_label_2',
  replacedPartPhoto: 'replaced_part_photo',
  replacedPartLabel1: 'replaced_part_label_1',
  replacedPartLabel2: 'replaced_part_label_2',
};

export const SQL_TO_FIELD_KEY_MAP: Record<string, EvidenceFieldKey> = Object.entries(
  FIELD_KEY_TO_SQL_MAP
).reduce((acc, [key, sqlKey]) => {
  acc[sqlKey] = key as EvidenceFieldKey;
  return acc;
}, {} as Record<string, EvidenceFieldKey>);

// Also map direct keys if saved as video1, photo1 etc.
Object.keys(FIELD_KEY_TO_SQL_MAP).forEach((k) => {
  SQL_TO_FIELD_KEY_MAP[k] = k as EvidenceFieldKey;
});

export const FIELD_CATEGORY_MAP: Record<EvidenceFieldKey, EvidenceCategory> = {
  video1: 'video',
  video2: 'video',
  photo1: 'diagnostic_photo',
  photo2: 'diagnostic_photo',
  photo3: 'diagnostic_photo',
  photo4: 'diagnostic_photo',
  newPartPhoto: 'new_part',
  newPartLabel1: 'new_part',
  newPartLabel2: 'new_part',
  replacedPartPhoto: 'replaced_part',
  replacedPartLabel1: 'replaced_part',
  replacedPartLabel2: 'replaced_part',
};

/**
 * Converts a data URL / Base64 string to a standard File or Blob object.
 */
function dataUrlToBlob(dataUrl: string, mimeTypeFallback: string = 'image/jpeg'): Blob {
  if (dataUrl.startsWith('data:')) {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : mimeTypeFallback;
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }
  return new Blob([dataUrl], { type: mimeTypeFallback });
}

export class SupabaseWarrantyService {
  /**
   * Fetches all warranty records from PostgreSQL and populates attachments with signed URLs.
   */
  async getAllRecords(): Promise<WarrantyRecord[]> {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Supabase não está configurado.');
    }

    // 1. Fetch records
    const { data: recordsData, error: recordsError } = await client
      .from('warranty_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (recordsError) {
      throw new Error(`Erro ao consultar registros no Supabase: ${recordsError.message}`);
    }

    if (!recordsData || recordsData.length === 0) {
      return [];
    }

    // 2. Fetch all attachments for these records
    const recordIds = recordsData.map((r: SupabaseWarrantyRecordRow) => r.id);
    const { data: attachmentsData, error: attachError } = await client
      .from('warranty_attachments')
      .select('*')
      .in('record_id', recordIds);

    if (attachError) {
      console.warn('Erro ao carregar anexos do Supabase:', attachError.message);
    }

    const attachmentsByRecord: Record<string, SupabaseAttachmentRow[]> = {};
    (attachmentsData || []).forEach((att: SupabaseAttachmentRow) => {
      if (!attachmentsByRecord[att.record_id]) {
        attachmentsByRecord[att.record_id] = [];
      }
      attachmentsByRecord[att.record_id].push(att);
    });

    // 3. Assemble complete records and generate signed URLs for attachments
    const results: WarrantyRecord[] = [];

    for (const row of recordsData as SupabaseWarrantyRecordRow[]) {
      const evidences: Partial<Record<EvidenceFieldKey, StoredEvidenceFile | null>> = {};
      const recordAttachments = attachmentsByRecord[row.id] || [];

      for (const att of recordAttachments) {
        const fieldKey = SQL_TO_FIELD_KEY_MAP[att.field_key] || (att.field_key as EvidenceFieldKey);
        
        let signedUrl = '';
        try {
          const { data: signedData, error: signErr } = await client.storage
            .from(DEFAULT_STORAGE_BUCKET)
            .createSignedUrl(att.storage_path, 3600); // 1 hour validity

          if (!signErr && signedData) {
            signedUrl = signedData.signedUrl;
          }
        } catch (e) {
          console.warn(`Erro ao gerar URL assinada para ${att.storage_path}:`, e);
        }

        evidences[fieldKey] = {
          id: att.id,
          fieldKey,
          fileName: att.original_filename,
          fileSize: Number(att.file_size),
          mimeType: att.mime_type,
          dataUrl: signedUrl || '',
          signedUrl: signedUrl || '',
          storagePath: att.storage_path,
          remoteId: att.id,
          category: att.category as EvidenceCategory,
          capturedAt: att.created_at
        };
      }

      results.push({
        id: row.id,
        osNumber: row.os_number,
        chassisVin: row.vin,
        technician: row.technician,
        repairDate: row.repair_date,
        technicalReport: row.technical_report || '',
        status: (row.status === 'finalized' || row.status === 'finalizado') ? 'finalizado' : 'em_preenchimento',
        version: 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        finalizedAt: row.finalized_at || undefined,
        createdBy: row.created_by || undefined,
        lastPdfGeneratedAt: row.last_pdf_generated_at || undefined,
        lastPdfFileName: row.last_pdf_file_name || undefined,
        evidences,
        isSyncedWithSupabase: true
      });
    }

    return results;
  }

  /**
   * Fetches a single warranty record with fresh signed URLs.
   */
  async getRecordById(id: string): Promise<WarrantyRecord | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    const { data: row, error } = await client
      .from('warranty_records')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !row) return null;

    const { data: attachments } = await client
      .from('warranty_attachments')
      .select('*')
      .eq('record_id', id);

    const evidences: Partial<Record<EvidenceFieldKey, StoredEvidenceFile | null>> = {};

    for (const att of attachments || []) {
      const fieldKey = SQL_TO_FIELD_KEY_MAP[att.field_key] || (att.field_key as EvidenceFieldKey);
      let signedUrl = '';
      try {
        const { data: signedData } = await client.storage
          .from(DEFAULT_STORAGE_BUCKET)
          .createSignedUrl(att.storage_path, 3600);
        if (signedData) signedUrl = signedData.signedUrl;
      } catch (e) {
        console.warn('Erro ao gerar URL assinada:', e);
      }

      evidences[fieldKey] = {
        id: att.id,
        fieldKey,
        fileName: att.original_filename,
        fileSize: Number(att.file_size),
        mimeType: att.mime_type,
        dataUrl: signedUrl,
        signedUrl,
        storagePath: att.storage_path,
        remoteId: att.id,
        category: att.category as EvidenceCategory,
        capturedAt: att.created_at
      };
    }

    return {
      id: row.id,
      osNumber: row.os_number,
      chassisVin: row.vin,
      technician: row.technician,
      repairDate: row.repair_date,
      technicalReport: row.technical_report || '',
      status: (row.status === 'finalized' || row.status === 'finalizado') ? 'finalizado' : 'em_preenchimento',
      version: 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      finalizedAt: row.finalized_at || undefined,
      createdBy: row.created_by || undefined,
      lastPdfGeneratedAt: row.last_pdf_generated_at || undefined,
      lastPdfFileName: row.last_pdf_file_name || undefined,
      evidences,
      isSyncedWithSupabase: true
    };
  }

  /**
   * Creates or updates a warranty record in PostgreSQL.
   */
  async saveRecord(record: WarrantyRecord): Promise<WarrantyRecord> {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Supabase não configurado');
    }

    const now = new Date().toISOString();
    const recordId = ensureValidUUID(record.id);

    // Discover active Supabase auth user or attempt anonymous session
    let authUserId: string | null = record.createdBy || null;
    if (!authUserId) {
      try {
        const { data: authData } = await client.auth.getUser();
        if (authData?.user?.id) {
          authUserId = authData.user.id;
        } else {
          // Attempt anonymous sign-in if enabled in the project
          const { data: anonData } = await client.auth.signInAnonymously();
          if (anonData?.user?.id) {
            authUserId = anonData.user.id;
          }
        }
      } catch {
        // Continue without auth user (table should have created_by nullable)
      }
    }

    // Normalize status to strictly 'draft' or 'finalized' for PostgreSQL check constraint compatibility
    const isCompleted = record.status === 'finalizado' || record.status === 'finalized';
    const dbStatus = isCompleted ? 'finalized' : 'draft';

    // Map to PostgreSQL schema
    const payload: Partial<SupabaseWarrantyRecordRow> = {
      id: recordId,
      os_number: (record.osNumber || '').trim(),
      vin: (record.chassisVin || '').trim().toUpperCase(),
      technician: (record.technician || '').trim(),
      repair_date: record.repairDate || now.slice(0, 10),
      technical_report: record.technicalReport || '',
      status: dbStatus,
      updated_at: now
    };

    if (authUserId) {
      payload.created_by = authUserId;
    }

    if (isCompleted) {
      payload.finalized_at = record.finalizedAt || now;
    }

    if (record.lastPdfGeneratedAt) {
      payload.last_pdf_generated_at = record.lastPdfGeneratedAt;
    }
    if (record.lastPdfFileName) {
      payload.last_pdf_file_name = record.lastPdfFileName;
    }

    // Upsert record row
    const { data: savedRow, error: saveErr } = await client
      .from('warranty_records')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (saveErr) {
      if (
        saveErr.message?.toLowerCase().includes('created_by') &&
        (saveErr.message?.toLowerCase().includes('not-null') || saveErr.message?.toLowerCase().includes('null value'))
      ) {
        throw new Error(
          `A coluna "created_by" no Supabase está como NOT NULL. Como o app opera sem login obrigatório, execute no SQL Editor do Supabase: ALTER TABLE public.warranty_records ALTER COLUMN created_by DROP NOT NULL; ALTER TABLE public.warranty_attachments ALTER COLUMN created_by DROP NOT NULL;`
        );
      }
      if (saveErr.message?.toLowerCase().includes('status_check')) {
        throw new Error(
          `A restrição de status do PostgreSQL ('warranty_records_status_check') exige os valores 'draft' ou 'finalized'. O aplicativo foi atualizado para normalizar automaticamente.`
        );
      }
      throw new Error(`Falha ao salvar registro no PostgreSQL: ${saveErr.message}`);
    }

    // Sync evidences (for any newly attached base64 or blob files)
    const updatedEvidences = { ...record.evidences };
    const uploadErrors: string[] = [];

    for (const [key, evidence] of Object.entries(record.evidences)) {
      const fieldKey = key as EvidenceFieldKey;
      if (!evidence) continue;

      // If already stored in Supabase Storage with valid storagePath and signed URL, skip re-upload
      if (evidence.storagePath && !evidence.dataUrl.startsWith('data:')) {
        continue;
      }

      // If we have a dataUrl or blob to upload
      if (evidence.dataUrl?.startsWith('data:') || evidence.blob) {
        try {
          const uploaded = await this.uploadAttachment(recordId, fieldKey, evidence);
          updatedEvidences[fieldKey] = uploaded;
        } catch (err: any) {
          console.error(`Erro ao fazer upload do anexo ${fieldKey} para o Storage:`, err);
          uploadErrors.push(`${fieldKey}: ${err.message || 'Falha no upload'}`);
        }
      }
    }

    return {
      ...record,
      id: savedRow.id,
      updatedAt: savedRow.updated_at,
      evidences: updatedEvidences,
      isSyncedWithSupabase: uploadErrors.length === 0,
      syncError: uploadErrors.length > 0 ? `Falha em ${uploadErrors.length} anexo(s): ${uploadErrors.join('; ')}` : undefined
    };
  }

  /**
   * Uploads an evidence file to Supabase Storage and records metadata in warranty_attachments.
   */
  async uploadAttachment(
    recordId: string,
    fieldKey: EvidenceFieldKey,
    fileData: {
      fileName: string;
      mimeType: string;
      dataUrl?: string;
      blob?: Blob;
      fileSize?: number;
    }
  ): Promise<StoredEvidenceFile> {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Supabase não está configurado.');
    }

    const validRecordId = ensureValidUUID(recordId);
    const category = FIELD_CATEGORY_MAP[fieldKey] || 'diagnostic_photo';
    const sqlFieldKey = FIELD_KEY_TO_SQL_MAP[fieldKey] || fieldKey;
    const attachmentId = generateUUID();

    // Clean filename
    const sanitizedName = fileData.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    // Exact structured path requested: {record_id}/{category}/{attachment_id}_{filename}
    const storagePath = `${validRecordId}/${category}/${attachmentId}_${sanitizedName}`;

    // Get blob content
    let blob: Blob;
    if (fileData.blob) {
      blob = fileData.blob;
    } else if (fileData.dataUrl) {
      blob = dataUrlToBlob(fileData.dataUrl, fileData.mimeType);
    } else {
      throw new Error('Nenhum dado de arquivo (Blob ou Base64) foi fornecido para upload.');
    }

    // Check existing attachment to remove later after successful new upload
    const { data: existingAtt } = await client
      .from('warranty_attachments')
      .select('*')
      .eq('record_id', validRecordId)
      .eq('field_key', sqlFieldKey)
      .maybeSingle();

    // 1. Upload to Supabase Storage
    let { error: uploadError } = await client.storage
      .from(DEFAULT_STORAGE_BUCKET)
      .upload(storagePath, blob, {
        contentType: fileData.mimeType,
        upsert: true
      });

    // If bucket was not found, attempt auto-creation
    if (uploadError && (uploadError.message?.toLowerCase().includes('not found') || (uploadError as any).statusCode === '404' || (uploadError as any).status === 404)) {
      try {
        await client.storage.createBucket(DEFAULT_STORAGE_BUCKET, { public: false });
        // Retry upload
        const retry = await client.storage
          .from(DEFAULT_STORAGE_BUCKET)
          .upload(storagePath, blob, {
            contentType: fileData.mimeType,
            upsert: true
          });
        uploadError = retry.error;
      } catch {
        // Fallback
      }
    }

    if (uploadError) {
      const errMsg = uploadError.message?.toLowerCase().includes('not found')
        ? `Bucket de armazenamento '${DEFAULT_STORAGE_BUCKET}' não foi encontrado no seu Supabase. Crie o bucket no painel do Supabase (Storage > New Bucket > ${DEFAULT_STORAGE_BUCKET}) ou execute o SQL da aba Nuvem.`
        : `Erro ao enviar arquivo para o Supabase Storage: ${uploadError.message}`;
      throw new Error(errMsg);
    }

    // 2. Record attachment row in PostgreSQL
    let attachAuthUserId: string | null = null;
    try {
      const { data: authData } = await client.auth.getUser();
      attachAuthUserId = authData?.user?.id || null;
    } catch {
      // ignore
    }

    const attachmentPayload: Record<string, any> = {
      id: attachmentId,
      record_id: validRecordId,
      category,
      field_key: sqlFieldKey,
      original_filename: fileData.fileName,
      storage_path: storagePath,
      mime_type: fileData.mimeType,
      file_size: blob.size || fileData.fileSize || 0
    };

    if (attachAuthUserId) {
      attachmentPayload.created_by = attachAuthUserId;
    }

    const { error: dbAttachError } = await client
      .from('warranty_attachments')
      .upsert(attachmentPayload, { onConflict: 'record_id,field_key' });

    if (dbAttachError) {
      // Rollback uploaded file to avoid orphan files
      await client.storage.from(DEFAULT_STORAGE_BUCKET).remove([storagePath]);
      if (
        dbAttachError.message?.toLowerCase().includes('created_by') &&
        (dbAttachError.message?.toLowerCase().includes('not-null') || dbAttachError.message?.toLowerCase().includes('null value'))
      ) {
        throw new Error(
          `A coluna 'created_by' na tabela warranty_attachments está como NOT NULL. Execute no SQL Editor do Supabase: ALTER TABLE public.warranty_attachments ALTER COLUMN created_by DROP NOT NULL;`
        );
      }
      throw new Error(`Falha ao registrar anexo no PostgreSQL: ${dbAttachError.message}`);
    }

    // 3. Delete old file from storage only after successful replacement
    if (existingAtt && existingAtt.storage_path && existingAtt.storage_path !== storagePath) {
      try {
        await client.storage.from(DEFAULT_STORAGE_BUCKET).remove([existingAtt.storage_path]);
      } catch (e) {
        console.warn('Erro ao remover arquivo antigo substituído no Storage:', e);
      }
    }

    // 4. Generate signed URL for immediate display
    let signedUrl = '';
    const { data: signedData } = await client.storage
      .from(DEFAULT_STORAGE_BUCKET)
      .createSignedUrl(storagePath, 3600);
    if (signedData) {
      signedUrl = signedData.signedUrl;
    }

    return {
      id: attachmentId,
      fieldKey,
      fileName: fileData.fileName,
      fileSize: blob.size,
      mimeType: fileData.mimeType,
      dataUrl: signedUrl || fileData.dataUrl || '',
      signedUrl,
      storagePath,
      remoteId: attachmentId,
      category,
      capturedAt: new Date().toISOString()
    };
  }

  /**
   * Fast path: uploads a single evidence directly to Supabase Storage and updates the record.
   */
  async uploadSingleEvidence(
    record: WarrantyRecord,
    fieldKey: EvidenceFieldKey,
    fileData: StoredEvidenceFile
  ): Promise<{ updatedRecord: WarrantyRecord; uploadedFile: StoredEvidenceFile }> {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Supabase não configurado');
    }

    const validRecordId = ensureValidUUID(record.id);

    // 1. Ensure the parent record exists in PostgreSQL first
    const now = new Date().toISOString();
    const payload: Partial<SupabaseWarrantyRecordRow> = {
      id: validRecordId,
      os_number: (record.osNumber || '').trim(),
      vin: (record.chassisVin || '').trim().toUpperCase(),
      technician: (record.technician || '').trim(),
      repair_date: record.repairDate || now.slice(0, 10),
      technical_report: record.technicalReport || '',
      status: record.status || 'draft',
      updated_at: now
    };

    const { error: recordErr } = await client
      .from('warranty_records')
      .upsert(payload, { onConflict: 'id' });

    if (recordErr) {
      throw new Error(`Falha ao registrar OS no PostgreSQL: ${recordErr.message}`);
    }

    // 2. Upload file to Storage
    const uploadedFile = await this.uploadAttachment(validRecordId, fieldKey, fileData);

    const updatedRecord: WarrantyRecord = {
      ...record,
      id: validRecordId,
      updatedAt: now,
      evidences: {
        ...record.evidences,
        [fieldKey]: uploadedFile
      },
      isSyncedWithSupabase: true
    };

    return { updatedRecord, uploadedFile };
  }

  /**
   * Deletes an attachment from both Supabase Storage and PostgreSQL.
   */
  async deleteAttachment(recordId: string, fieldKey: EvidenceFieldKey): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    const sqlFieldKey = FIELD_KEY_TO_SQL_MAP[fieldKey] || fieldKey;

    // Get attachment row to know storage path
    const { data: att } = await client
      .from('warranty_attachments')
      .select('storage_path')
      .eq('record_id', recordId)
      .eq('field_key', sqlFieldKey)
      .maybeSingle();

    if (att && att.storage_path) {
      // 1. Delete from storage
      await client.storage.from(DEFAULT_STORAGE_BUCKET).remove([att.storage_path]);
    }

    // 2. Delete row from database
    await client
      .from('warranty_attachments')
      .delete()
      .eq('record_id', recordId)
      .eq('field_key', sqlFieldKey);
  }

  /**
   * Completely deletes a warranty record and all its associated files from Storage.
   */
  async deleteRecord(recordId: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Supabase não está configurado.');
    }

    // 1. Find all attachments
    const { data: attachments } = await client
      .from('warranty_attachments')
      .select('storage_path')
      .eq('record_id', recordId);

    // 2. Remove files from Storage
    if (attachments && attachments.length > 0) {
      const paths = attachments.map((a) => a.storage_path).filter(Boolean);
      if (paths.length > 0) {
        await client.storage.from(DEFAULT_STORAGE_BUCKET).remove(paths);
      }
    }

    // 3. Delete record (warranty_attachments row will cascade delete)
    const { error } = await client.from('warranty_records').delete().eq('id', recordId);
    if (error) {
      throw new Error(`Falha ao excluir registro do PostgreSQL: ${error.message}`);
    }
  }

  /**
   * Generates a temporary signed URL with download disposition for any attachment.
   */
  async getSignedDownloadUrl(storagePath: string, fileName: string): Promise<string> {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Supabase não está configurado.');
    }

    const { data, error } = await client.storage
      .from(DEFAULT_STORAGE_BUCKET)
      .createSignedUrl(storagePath, 3600, {
        download: fileName
      });

    if (error || !data) {
      throw new Error(`Falha ao gerar URL assinada para download: ${error?.message || 'Arquivo não encontrado'}`);
    }

    return data.signedUrl;
  }

  /**
   * Syncs technicians with PostgreSQL.
   */
  async getAllTechnicians(): Promise<Technician[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
      .from('technicians')
      .select('*')
      .order('name');

    if (error || !data) {
      console.warn('Erro ao consultar técnicos no Supabase:', error?.message);
      return [];
    }

    return data.map((t) => ({
      id: t.id,
      name: t.name,
      registration: t.registration || '',
      specialty: t.specialty || '',
      email: t.email || '',
      phone: t.phone || '',
      active: t.active,
      createdAt: t.created_at,
      updatedAt: t.updated_at
    }));
  }

  async saveTechnician(tech: Technician): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    await client.from('technicians').upsert({
      id: tech.id,
      name: tech.name,
      registration: tech.registration,
      specialty: tech.specialty,
      email: tech.email,
      phone: tech.phone,
      active: tech.active,
      updated_at: new Date().toISOString()
    });
  }

  async deleteTechnician(id: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    await client.from('technicians').delete().eq('id', id);
  }

  /**
   * Syncs dealership app settings with PostgreSQL.
   */
  async getAppSettings(): Promise<AppSettings | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    const { data, error } = await client
      .from('app_settings')
      .select('*')
      .eq('id', 'current_settings')
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      dealerName: data.dealer_name || 'Porsche Center',
      dealerCode: data.dealer_code || 'PC-BR-011',
      warrantyManagerName: data.warranty_manager_name || '',
      warrantyManagerEmail: data.warranty_manager_email || '',
      contactPhone: data.contact_phone || '',
      requireAdminPin: Boolean(data.require_admin_pin),
      adminPin: data.admin_pin || '1948',
      autoBackupNotification: true,
      strictAuditValidation: Boolean(data.strict_audit_validation),
      updatedAt: data.updated_at
    };
  }

  async saveAppSettings(settings: AppSettings): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    await client.from('app_settings').upsert({
      id: 'current_settings',
      dealer_name: settings.dealerName,
      dealer_code: settings.dealerCode,
      warranty_manager_name: settings.warrantyManagerName,
      warranty_manager_email: settings.warrantyManagerEmail,
      contact_phone: settings.contactPhone,
      require_admin_pin: settings.requireAdminPin,
      admin_pin: settings.adminPin,
      strict_audit_validation: settings.strictAuditValidation,
      updated_at: new Date().toISOString()
    });
  }
}

export const supabaseWarrantyService = new SupabaseWarrantyService();
