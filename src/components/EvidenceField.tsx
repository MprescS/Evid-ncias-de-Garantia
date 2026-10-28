import React, { useRef, useState } from 'react';
import {
  Upload,
  Camera,
  Trash2,
  Eye,
  Download,
  Film,
  Image as ImageIcon,
  CheckCircle2,
  RefreshCw,
  FileQuestion,
  Video,
  Play
} from 'lucide-react';
import { FieldDefinition, StoredEvidenceFile } from '../types';
import { formatFileSize } from '../utils/formatters';

interface EvidenceFieldProps {
  field: FieldDefinition;
  file: StoredEvidenceFile | null | undefined;
  onFileSelect: (fieldKey: string, fileData: { dataUrl: string; fileName: string; fileSize: number; mimeType: string }) => void;
  onDelete: (fieldKey: string) => void;
  onPreview: (file: StoredEvidenceFile, label: string) => void;
  onDownload: (file: StoredEvidenceFile) => void;
  onRequestCamera: (fieldKey: string, label: string) => void;
  onRequestVideoCamera?: (fieldKey: string, label: string) => void;
}

export const EvidenceField: React.FC<EvidenceFieldProps> = ({
  field,
  file,
  onFileSelect,
  onDelete,
  onPreview,
  onDownload,
  onRequestCamera,
  onRequestVideoCamera
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nativeCameraCaptureRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isVideoField = field.type === 'video';
  const acceptMime = isVideoField ? 'video/mp4,video/quicktime,video/webm,video/*' : 'image/jpeg,image/png,image/webp,image/*';

  const handleNativeFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    processFile(selected);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (nativeCameraCaptureRef.current) nativeCameraCaptureRef.current.value = '';
  };

  const processFile = (selected: File) => {
    if (isVideoField && !selected.type.startsWith('video/') && !selected.name.match(/\.(mp4|mov|webm|avi)$/i)) {
      alert('Por favor, selecione um arquivo de vídeo válido (MP4, MOV, WebM).');
      return;
    }
    if (!isVideoField && !selected.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      onFileSelect(field.key, {
        dataUrl,
        fileName: selected.name,
        fileSize: selected.size,
        mimeType: selected.type || (isVideoField ? 'video/mp4' : 'image/jpeg')
      });
    };
    reader.readAsDataURL(selected);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  return (
    <div
      className={`relative flex flex-col justify-between border bg-[#18181C] p-3.5 sm:p-4 rounded-xs transition-all duration-150 ${
        file
          ? 'border-[#2E2E38] shadow-sm'
          : isDragging
          ? 'border-[#D5001C] bg-red-950/20'
          : 'border-[#282832] border-dashed hover:border-[#3E3E4C]'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input for standard picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptMime}
        className="hidden"
        onChange={handleNativeFileInput}
      />

      {/* Hidden input for direct camera capture on mobile devices */}
      <input
        ref={nativeCameraCaptureRef}
        type="file"
        accept={isVideoField ? 'video/*' : 'image/*'}
        capture="environment"
        className="hidden"
        onChange={handleNativeFileInput}
      />

      {/* Field Header */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div>
          <div className="flex items-center gap-1.5">
            {isVideoField ? (
              <Film className="w-4 h-4 text-[#D5001C] shrink-0" />
            ) : (
              <ImageIcon className="w-4 h-4 text-neutral-400 shrink-0" />
            )}
            <h4 className="text-xs sm:text-sm font-bold tracking-tight text-white uppercase">
              {field.label}
            </h4>
          </div>
          <p className="text-[11px] text-neutral-400 mt-0.5 leading-snug">
            {field.description}
          </p>
        </div>

        {file ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] sm:text-xs font-mono font-medium text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ANEXADO
          </span>
        ) : (
          <span className="text-[10px] font-mono text-neutral-500 uppercase shrink-0">
            Não anexado
          </span>
        )}
      </div>

      {/* Preview / Attachment Area: Perfectly framed with object-contain (NO CROPPING) */}
      {file ? (
        <div className="flex flex-col gap-2 my-2">
          <div
            onClick={() => onPreview(file, field.label)}
            className="group relative w-full aspect-[4/3] bg-[#0E0E10] flex items-center justify-center overflow-hidden border border-[#2E2E38] cursor-pointer shadow-inner"
            title="Clique para ampliar com qualidade máxima"
          >
            {isVideoField ? (
              <div className="relative w-full h-full flex flex-col items-center justify-center p-3 text-neutral-200">
                <video
                  src={file.dataUrl}
                  className="w-full h-full object-contain pointer-events-none"
                  preload="metadata"
                />
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2 group-hover:bg-black/30 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-[#D5001C] flex items-center justify-center text-white shadow-xl group-hover:scale-110 transition-transform">
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </div>
                  <span className="text-[11px] font-mono text-white/90 bg-black/75 px-2 py-0.5 border border-white/20">
                    Reproduzir Vídeo
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center p-1">
                {/* object-contain ensures 100% of the image fits without any edge cropped */}
                <img
                  src={file.dataUrl}
                  alt={field.label}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white">
                  <Eye className="w-5 h-5" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Ampliar Detalhes</span>
                </div>
              </div>
            )}

            {/* Quality Indicator Badge */}
            <div className="absolute bottom-2 right-2 bg-black/85 backdrop-blur-xs text-[10px] font-mono text-neutral-300 px-1.5 py-0.5 border border-neutral-700 pointer-events-none">
              ENQUADRAMENTO 100% · NITIDEZ MÁXIMA
            </div>
          </div>

          {/* File Metadata */}
          <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 px-0.5">
            <span className="truncate max-w-[200px]" title={file.fileName}>
              {file.fileName}
            </span>
            <span className="shrink-0 font-semibold text-neutral-300">{formatFileSize(file.fileSize)}</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-7 px-4 bg-[#141417] border border-[#26262E] my-2 text-center aspect-[4/3] sm:aspect-[16/10] justify-center">
          {isVideoField ? (
            <Video className="w-9 h-9 text-neutral-600 mb-2 stroke-[1.5]" />
          ) : (
            <FileQuestion className="w-9 h-9 text-neutral-600 mb-2 stroke-[1.5]" />
          )}
          <p className="text-xs sm:text-sm text-neutral-200 font-bold mb-1">
            Nenhuma evidência anexada
          </p>
          <p className="text-[11px] text-neutral-400 max-w-[220px]">
            {isVideoField
              ? 'Grave o vídeo ou escolha arquivo (MP4/MOV)'
              : 'Tire foto da peça/etiqueta ou escolha imagem'}
          </p>
        </div>
      )}

      {/* Action Buttons: Touch-friendly min-h-[44px] for mobile/tablet */}
      <div className="mt-2.5 pt-2.5 border-t border-[#26262E] flex flex-wrap items-center justify-between gap-2">
        {file ? (
          <>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => onPreview(file, field.label)}
                className="inline-flex items-center justify-center gap-1.5 px-3 h-10 sm:h-9 text-xs font-semibold text-neutral-200 hover:text-white bg-[#22222A] hover:bg-[#2A2A34] border border-[#30303C] transition-colors"
                title="Visualizar em alta resolução"
              >
                <Eye className="w-4 h-4 text-neutral-300" />
                <span>Ampliar</span>
              </button>

              <button
                type="button"
                onClick={() => onDownload(file)}
                className="inline-flex items-center justify-center gap-1.5 px-3 h-10 sm:h-9 text-xs font-semibold text-white bg-[#22222A] hover:bg-[#2A2A34] border border-[#30303C] transition-colors"
                title={isVideoField ? 'Baixar vídeo no dispositivo' : 'Baixar imagem original'}
              >
                <Download className="w-4 h-4 text-[#D5001C]" />
                <span>{isVideoField ? 'Baixar Vídeo' : 'Baixar'}</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-1.5 px-2.5 h-10 sm:h-9 text-xs text-neutral-300 hover:text-white bg-[#22222A] hover:bg-[#2A2A34] border border-[#30303C] transition-colors"
                title="Substituir arquivo por upload"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Substituir</span>
              </button>

              {isVideoField && onRequestVideoCamera && (
                <button
                  type="button"
                  onClick={() => onRequestVideoCamera(field.key, field.label)}
                  className="inline-flex items-center justify-center gap-1.5 px-2.5 h-10 sm:h-9 text-xs text-neutral-200 hover:text-white bg-[#22222A] hover:bg-[#2A2A34] border border-[#30303C] transition-colors"
                  title="Regravar vídeo direto da câmera"
                >
                  <Video className="w-3.5 h-3.5 text-[#D5001C]" />
                  <span className="hidden sm:inline">Regravar</span>
                </button>
              )}

              {!isVideoField && (
                <button
                  type="button"
                  onClick={() => onRequestCamera(field.key, field.label)}
                  className="inline-flex items-center justify-center gap-1.5 px-2.5 h-10 sm:h-9 text-xs text-neutral-200 hover:text-white bg-[#22222A] hover:bg-[#2A2A34] border border-[#30303C] transition-colors"
                  title="Tirar nova foto com a câmera"
                >
                  <Camera className="w-3.5 h-3.5 text-[#D5001C]" />
                  <span className="hidden sm:inline">Refazer Foto</span>
                </button>
              )}
            </div>

            {showDeleteConfirm ? (
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-xs text-red-400 font-bold">Excluir?</span>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(field.key);
                    setShowDeleteConfirm(false);
                  }}
                  className="px-3 h-9 bg-red-600 text-white text-xs uppercase font-bold hover:bg-red-700 active:scale-95 transition-transform"
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2.5 h-9 text-xs text-neutral-400 hover:text-white"
                >
                  Não
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="h-10 w-10 sm:h-9 sm:w-9 flex items-center justify-center text-neutral-500 hover:text-red-400 hover:bg-red-950/30 border border-[#2E2E38] transition-colors ml-auto"
                title="Excluir evidência"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2 w-full">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-[#25252F] hover:bg-[#2E2E3A] border border-[#383848] text-white text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors active:scale-98 shadow-xs"
            >
              <Upload className="w-4 h-4" />
              <span>Arquivo</span>
            </button>

            {isVideoField ? (
              <button
                type="button"
                onClick={() => {
                  if (onRequestVideoCamera) {
                    onRequestVideoCamera(field.key, field.label);
                  } else {
                    nativeCameraCaptureRef.current?.click();
                  }
                }}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-[#D5001C] hover:bg-[#b00017] text-white text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors active:scale-98 shadow-xs"
                title="Gravar vídeo direto da câmera"
              >
                <Video className="w-4 h-4" />
                <span>Gravar Vídeo</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onRequestCamera(field.key, field.label)}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-[#D5001C] hover:bg-[#b00017] text-white text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors active:scale-98 shadow-xs"
                title="Tirar foto com câmera"
              >
                <Camera className="w-4 h-4" />
                <span>Tirar Foto</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
