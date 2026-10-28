import React, { useState } from 'react';
import { X, Download, Film, Image as ImageIcon, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { StoredEvidenceFile } from '../types';
import { formatFileSize, formatDateTimeBr } from '../utils/formatters';

interface MediaViewerModalProps {
  file: StoredEvidenceFile | null;
  fieldLabel: string;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (file: StoredEvidenceFile) => void;
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
  file,
  fieldLabel,
  isOpen,
  onClose,
  onDownload
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  if (!isOpen || !file) return null;

  const isVideo = file.mimeType.startsWith('video/') || file.fileName.toLowerCase().endsWith('.mp4') || file.fileName.toLowerCase().endsWith('.mov') || file.fileName.toLowerCase().endsWith('.webm');

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.5, 3.5));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.5, 1));
  const handleResetZoom = () => setZoomLevel(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in">
      <div className="relative w-full max-w-5xl bg-[#111111] text-white border border-[#27272A] shadow-2xl flex flex-col h-[94vh] max-h-[94vh] overflow-hidden">
        {/* Header: Touch-friendly */}
        <div className="flex flex-wrap items-center justify-between px-4 sm:px-6 py-3 border-b border-[#27272A] bg-[#161616] gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {isVideo ? (
              <Film className="w-5 h-5 text-[#D5001C] shrink-0" />
            ) : (
              <ImageIcon className="w-5 h-5 text-[#D5001C] shrink-0" />
            )}
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold tracking-wider uppercase text-neutral-100 truncate">
                {fieldLabel}
              </h3>
              <p className="text-[11px] text-neutral-400 font-mono truncate">
                {file.fileName} · {formatFileSize(file.fileSize)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
            {!isVideo && (
              <div className="flex items-center bg-neutral-800 border border-neutral-700 mr-1">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 1}
                  className="w-9 h-9 flex items-center justify-center text-neutral-300 hover:text-white disabled:opacity-30"
                  title="Diminuir Zoom"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="px-2 h-9 text-xs font-mono text-neutral-200 hover:text-white"
                  title="Redefinir Zoom"
                >
                  {Math.round(zoomLevel * 100)}%
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 3.5}
                  className="w-9 h-9 flex items-center justify-center text-neutral-300 hover:text-white disabled:opacity-30"
                  title="Aumentar Zoom"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={() => onDownload(file)}
              className="inline-flex items-center gap-1.5 px-3 h-9 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold uppercase tracking-wider text-neutral-200 hover:text-white transition-colors"
              title="Baixar arquivo original"
            >
              <Download className="w-4 h-4 text-[#D5001C]" />
              <span className="hidden sm:inline">Baixar Original</span>
            </button>

            <button
              onClick={() => {
                setZoomLevel(1);
                onClose();
              }}
              className="w-9 h-9 flex items-center justify-center text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 transition-colors"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Media Content Display: 100% loss-free, scrollable when zoomed */}
        <div className="relative flex-1 bg-black flex items-center justify-center p-2 sm:p-4 overflow-auto">
          {isVideo ? (
            <video
              src={file.dataUrl}
              controls
              autoPlay
              playsInline
              className="max-h-[75vh] max-w-full object-contain rounded-xs shadow-lg"
            >
              Seu navegador não suporta a reprodução deste formato de vídeo.
            </video>
          ) : (
            <div className="w-full h-full flex items-center justify-center overflow-auto">
              <img
                src={file.dataUrl}
                alt={file.fileName}
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.15s ease-out'
                }}
                className="max-h-[75vh] max-w-full object-contain cursor-grab active:cursor-grabbing rounded-xs shadow-xl"
              />
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2 bg-[#161616] border-t border-[#27272A] text-[11px] sm:text-xs text-neutral-400 font-mono">
          <span>Tamanho: {formatFileSize(file.fileSize)} · Resolução Máxima Preservada</span>
          <span className="hidden sm:inline">Capturado em: {formatDateTimeBr(file.capturedAt)}</span>
        </div>
      </div>
    </div>
  );
};
