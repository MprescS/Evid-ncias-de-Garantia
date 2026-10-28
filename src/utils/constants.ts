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
