import { WarrantyRecord, ValidationSummary, ValidationIssue } from '../types';

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDateBr(dateString?: string): string {
  if (!dateString) return '-';
  // If YYYY-MM-DD
  if (dateString.includes('-') && dateString.length === 10) {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  }
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  } catch {
    return dateString;
  }
}

export function formatDateTimeBr(dateString?: string): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  } catch {
    return dateString;
  }
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/_+/g, '_');
}

export function generatePdfFileName(record: WarrantyRecord): string {
  const os = sanitizeFileName(record.osNumber || 'SEM_OS');
  const vin = sanitizeFileName(record.chassisVin || 'SEM_CHASSI');
  const date = sanitizeFileName(record.repairDate || new Date().toISOString().slice(0, 10));
  return `EVIDENCIAS_OS_${os}_${vin}_${date}.pdf`;
}

export function validateRecord(record: WarrantyRecord): ValidationSummary {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // Required Fields
  if (!record.osNumber || record.osNumber.trim() === '') {
    errors.push({ field: 'osNumber', message: 'Número da OS é obrigatório', severity: 'error' });
  }

  if (!record.chassisVin || record.chassisVin.trim() === '') {
    errors.push({ field: 'chassisVin', message: 'Chassi (VIN) é obrigatório', severity: 'error' });
  } else if (record.chassisVin.trim().length !== 17) {
    warnings.push({
      field: 'chassisVin',
      message: 'Chassi padrão automotivo deve conter 17 caracteres (ISO 3779)',
      severity: 'warning'
    });
  }

  if (!record.technician || record.technician.trim() === '') {
    errors.push({ field: 'technician', message: 'Técnico responsável é obrigatório', severity: 'error' });
  }

  if (!record.repairDate || record.repairDate.trim() === '') {
    errors.push({ field: 'repairDate', message: 'Data do reparo é obrigatória', severity: 'error' });
  }

  // Technical Report
  if (!record.technicalReport || record.technicalReport.trim() === '') {
    warnings.push({
      field: 'technicalReport',
      message: 'Relatório técnico ainda não foi preenchido com o diagnóstico e ações executadas',
      severity: 'warning'
    });
  }

  // Evidence counts
  const evidenceEntries = Object.values(record.evidences || {});
  const filledEvidenceCount = evidenceEntries.filter(e => !!e).length;
  const totalEvidenceCount = 12;

  if (filledEvidenceCount === 0) {
    warnings.push({
      field: 'evidences',
      message: 'Nenhuma evidência fotográfica ou vídeo foi anexada até o momento',
      severity: 'warning'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    filledEvidenceCount,
    totalEvidenceCount
  };
}
