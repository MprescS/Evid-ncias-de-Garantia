import { EvidenceFieldKey, FieldDefinition } from '../types';

export const EVIDENCE_FIELDS: FieldDefinition[] = [
  // 1. Diagnóstico por Vídeo
  {
    key: 'video1',
    label: 'Vídeo de diagnóstico 1',
    category: 'video',
    categoryLabel: 'Vídeos de Diagnóstico',
    type: 'video',
    description: 'Registro em movimento do sintoma, ruído, folga mecânica ou falha funcional (direto da câmera ou arquivo).'
  },
  {
    key: 'video2',
    label: 'Vídeo de diagnóstico 2',
    category: 'video',
    categoryLabel: 'Vídeos de Diagnóstico',
    type: 'video',
    description: 'Ângulo complementar ou teste pós-desmontagem/validação (direto da câmera ou arquivo).'
  },

  // 2. Fotografias de Diagnóstico
  {
    key: 'photo1',
    label: 'Foto de diagnóstico 1',
    category: 'diagnostic_photo',
    categoryLabel: 'Fotografias de Diagnóstico',
    type: 'image',
    description: 'Visão geral do conjunto ou componente montado no veículo.'
  },
  {
    key: 'photo2',
    label: 'Foto de diagnóstico 2',
    category: 'diagnostic_photo',
    categoryLabel: 'Fotografias de Diagnóstico',
    type: 'image',
    description: 'Evidência direta do dano, desgaste, vazamento ou trinca.'
  },
  {
    key: 'photo3',
    label: 'Foto de diagnóstico 3',
    category: 'diagnostic_photo',
    categoryLabel: 'Fotografias de Diagnóstico',
    type: 'image',
    description: 'Aproximação em macro ou detalhe da falha técnica identificada.'
  },
  {
    key: 'photo4',
    label: 'Foto de diagnóstico 4',
    category: 'diagnostic_photo',
    categoryLabel: 'Fotografias de Diagnóstico',
    type: 'image',
    description: 'Contexto adicional, instrumento de medição ou leitura diagnóstica.'
  },

  // 3. Peça Nova (Foto e Etiquetas)
  {
    key: 'newPartPhoto',
    label: 'Foto da peça nova',
    category: 'new_part',
    categoryLabel: 'Peça Nova (Genuína)',
    type: 'image',
    description: 'Fotografia geral da peça nova genuína fora da embalagem ou posicionada para instalação.'
  },
  {
    key: 'newPartLabel1',
    label: 'Etiqueta da peça nova 1',
    category: 'new_part',
    categoryLabel: 'Peça Nova (Genuína)',
    type: 'image',
    description: 'Embalagem original da peça genuína com número da peça (P/N) e código de barras legível.'
  },
  {
    key: 'newPartLabel2',
    label: 'Etiqueta da peça nova 2',
    category: 'new_part',
    categoryLabel: 'Peça Nova (Genuína)',
    type: 'image',
    description: 'Gravação, etiqueta interna ou QR Code impresso no corpo da peça nova.'
  },

  // 4. Peça Substituída (Foto e Etiquetas)
  {
    key: 'replacedPartPhoto',
    label: 'Foto da peça substituída',
    category: 'replaced_part',
    categoryLabel: 'Peça Substituída (Avariada)',
    type: 'image',
    description: 'Fotografia geral da peça avariada removida do veículo com foco na avaria técnica.'
  },
  {
    key: 'replacedPartLabel1',
    label: 'Etiqueta da peça substituída 1',
    category: 'replaced_part',
    categoryLabel: 'Peça Substituída (Avariada)',
    type: 'image',
    description: 'Identificação da peça avariada removida com P/N de fábrica visível.'
  },
  {
    key: 'replacedPartLabel2',
    label: 'Etiqueta da peça substituída 2',
    category: 'replaced_part',
    categoryLabel: 'Peça Substituída (Avariada)',
    type: 'image',
    description: 'Número de série, lote de fabricação ou data stamp da peça substituída.'
  }
];

export const COMMON_TECHNICIANS = [
  'Carlos Eduardo Mendes',
  'Rodrigo Bittencourt',
  'Guilherme Siqueira',
  'Lucas Fernandes',
  'Alexandre Prado',
  'Marcelo Silva'
];

/**
 * Automatically infers the category of an evidence field key.
 */
export function getEvidenceCategory(
  fieldKey: string,
  existingCategory?: string
): import('../types').EvidenceCategory {
  if (
    existingCategory &&
    ['video', 'diagnostic_photo', 'new_part', 'replaced_part'].includes(existingCategory)
  ) {
    return existingCategory as import('../types').EvidenceCategory;
  }
  const k = fieldKey.toLowerCase();
  if (k.startsWith('video') || k.includes('video')) return 'video';
  if (k.startsWith('newpart') || k.includes('peca_nova') || k.includes('pecanova')) return 'new_part';
  if (k.startsWith('replacedpart') || k.includes('peca_substituida') || k.includes('pecasubstituida')) return 'replaced_part';
  return 'diagnostic_photo';
}

/**
 * Creates a dynamic FieldDefinition for user-added photos, videos, or parts.
 */
export function createDynamicFieldDefinition(
  key: string,
  category?: import('../types').EvidenceCategory,
  customLabel?: string,
  type?: 'video' | 'image'
): FieldDefinition {
  const cat = category || getEvidenceCategory(key);
  const isVideo = type ? type === 'video' : cat === 'video';

  let defaultLabel = 'Foto Adicional';
  let categoryLabel = 'Fotografias de Diagnóstico';
  let description = 'Evidência fotográfica complementar anexada para a garantia.';

  if (cat === 'video') {
    defaultLabel = 'Vídeo Adicional';
    categoryLabel = 'Vídeos de Diagnóstico';
    description = 'Registro em vídeo complementar (movimento, ruído ou teste de validação).';
  } else if (cat === 'new_part') {
    defaultLabel = 'Peça Nova Adicional';
    categoryLabel = 'Peça Nova (Genuína)';
    description = 'Foto complementar da peça nova ou etiqueta adicional de rastreamento.';
  } else if (cat === 'replaced_part') {
    defaultLabel = 'Peça Substituída Adicional';
    categoryLabel = 'Peça Substituída (Avariada)';
    description = 'Foto complementar da avaria ou etiqueta da peça avariada substituída.';
  }

  return {
    key,
    label: customLabel || defaultLabel,
    category: cat,
    categoryLabel,
    type: isVideo ? 'video' : 'image',
    description,
    isCustom: true
  };
}
